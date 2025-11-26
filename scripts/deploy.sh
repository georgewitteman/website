#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail
set -o xtrace

WEBSITE_DIR="${HOME}/website"

ls -la "${WEBSITE_DIR}"

# Install Caddy if not present
if ! command -v caddy &> /dev/null; then
    # Download and install Caddy binary directly (Amazon Linux 2023 compatible)
    curl -fsSL "https://caddyserver.com/api/download?os=linux&arch=amd64" -o /tmp/caddy
    chmod +x /tmp/caddy
    sudo mv /tmp/caddy /usr/bin/caddy

    # Create caddy user and group
    sudo groupadd --system caddy 2>/dev/null || true
    sudo useradd --system --gid caddy --create-home --home-dir /var/lib/caddy --shell /usr/sbin/nologin caddy 2>/dev/null || true

    # Create necessary directories
    sudo mkdir -p /etc/caddy
    sudo mkdir -p /var/lib/caddy
    sudo chown caddy:caddy /var/lib/caddy
fi

# Install Caddy systemd service (API-based configuration)
sudo cp "${WEBSITE_DIR}/caddy-api.service" /etc/systemd/system/caddy.service

# Determine which slot to deploy to (blue=8080, green=8081)
# Query Caddy API for current upstream, default to 8080 if Caddy not running yet
active_port=$(curl -sf "http://localhost:2019/config/apps/http/servers/main/routes/0/handle/1/upstreams/0/dial" 2>/dev/null | tr -d '"' | sed 's/localhost://' || echo "8080")

if [ "$active_port" = "8080" ]; then
    deploy_slot="green"
    deploy_port="8081"
    other_slot="blue"
    other_port="8080"
else
    deploy_slot="blue"
    deploy_port="8080"
    other_slot="green"
    other_port="8081"
fi

echo "Active port: $active_port, deploying to: $deploy_slot (port $deploy_port)"

# Stop the deploy slot before copying (can't overwrite running binary)
sudo systemctl stop "website-${deploy_slot}" 2>/dev/null || true

# Copy binary to both slots (ensures rollback slot has a binary)
cp "${WEBSITE_DIR}/website" "${WEBSITE_DIR}/website-${deploy_slot}"
if [ ! -f "${WEBSITE_DIR}/website-${other_slot}" ]; then
    cp "${WEBSITE_DIR}/website" "${WEBSITE_DIR}/website-${other_slot}"
fi

# Install systemd services
sudo cp "${WEBSITE_DIR}/website-blue.service" /etc/systemd/system/website-blue.service
sudo cp "${WEBSITE_DIR}/website-green.service" /etc/systemd/system/website-green.service
sudo systemctl daemon-reload

# Ensure both slots are enabled and running. The inactive slot must be running
# so we can roll back instantly by switching Caddy to it.
sudo systemctl enable "website-blue"
sudo systemctl enable "website-green"
if ! sudo systemctl is-active --quiet "website-${other_slot}"; then
    echo "Starting ${other_slot} slot for rollback capability"
    # Reset any failed state before starting
    sudo systemctl reset-failed "website-${other_slot}" 2>/dev/null || true
    sudo systemctl start "website-${other_slot}"
fi

# Verify rollback slot is healthy before proceeding (with retries for startup time)
echo "Verifying rollback slot (${other_slot}) is healthy..."
rollback_attempts=10
rollback_attempt=1
while [ $rollback_attempt -le $rollback_attempts ]; do
    if curl --fail --silent --max-time 5 "http://localhost:${other_port}/" > /dev/null; then
        echo "Rollback slot health check passed on attempt $rollback_attempt"
        break
    fi
    echo "Rollback slot health check attempt $rollback_attempt/$rollback_attempts failed, retrying..."
    sleep 1
    rollback_attempt=$((rollback_attempt + 1))
done

if [ $rollback_attempt -gt $rollback_attempts ]; then
    echo "ERROR: Rollback slot ${other_slot} (port ${other_port}) is not healthy after $rollback_attempts attempts"
    echo "Instant rollback will not be possible. Aborting deploy."
    sudo systemctl status "website-${other_slot}" --no-pager || true
    sudo journalctl -u "website-${other_slot}" --no-pager -n 50 || true
    exit 1
fi

# Start/restart the new version
sudo systemctl restart "website-${deploy_slot}"

# Health check the new version
max_attempts=10
attempt=1
while [ $attempt -le $max_attempts ]; do
    if curl --fail --silent --max-time 5 "http://localhost:${deploy_port}/" > /dev/null; then
        echo "Health check passed on attempt $attempt"
        break
    fi
    echo "Health check attempt $attempt/$max_attempts failed, retrying..."
    sleep 1
    attempt=$((attempt + 1))
done

if [ $attempt -gt $max_attempts ]; then
    echo "Health check failed after $max_attempts attempts"
    sudo systemctl status "website-${deploy_slot}" --no-pager || true
    sudo journalctl -u "website-${deploy_slot}" --no-pager -n 50 || true
    exit 1
fi

# Ensure Caddy is running with API
sudo systemctl enable caddy
if ! sudo systemctl is-active --quiet caddy; then
    sudo systemctl start caddy
    sleep 2
fi

# Load full config with updated upstream port via Caddy API
# Using sed to update the port in caddy.json before loading
sed "s/localhost:8080/localhost:${deploy_port}/" "${WEBSITE_DIR}/caddy.json" | \
    curl -X POST \
        -H "Content-Type: application/json" \
        -d @- \
        "http://localhost:2019/load"

echo "Deploy complete. Traffic now routing to $deploy_slot (port $deploy_port)"

sudo systemctl status website-blue --no-pager || true
sudo systemctl status website-green --no-pager || true
