#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail
set -o xtrace

WEBSITE_DIR="${HOME}/website"
ACTIVE_PORT_FILE="${WEBSITE_DIR}/active_port"

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

# Install Caddy systemd service
sudo cp "${WEBSITE_DIR}/caddy.service" /etc/systemd/system/caddy.service

# Determine which slot to deploy to (blue=8080, green=8081)
if [ -f "$ACTIVE_PORT_FILE" ]; then
    active_port=$(cat "$ACTIVE_PORT_FILE")
else
    # First deploy - default to blue being active, deploy to green
    active_port="8080"
fi

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
    sudo systemctl start "website-${other_slot}"
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

# Update Caddyfile to point to new port
sudo mkdir -p /etc/caddy
sudo sed "s/localhost:[0-9]*/localhost:${deploy_port}/" "${WEBSITE_DIR}/Caddyfile" | sudo tee /etc/caddy/Caddyfile > /dev/null
sudo chown root:root /etc/caddy/Caddyfile
sudo chmod 644 /etc/caddy/Caddyfile

# Reload Caddy to switch traffic
sudo systemctl enable caddy
sudo systemctl reload-or-restart caddy

# Save the new active port
echo "$deploy_port" > "$ACTIVE_PORT_FILE"

echo "Deploy complete. Traffic now routing to $deploy_slot (port $deploy_port)"

sudo systemctl status website-blue --no-pager || true
sudo systemctl status website-green --no-pager || true
