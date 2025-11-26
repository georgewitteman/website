#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail
set -o xtrace

ls -la "${HOME}/website"

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
sudo cp "${HOME}/website/caddy.service" /etc/systemd/system/caddy.service

# Configure Caddy
sudo mkdir -p /etc/caddy
sudo cp "${HOME}/website/Caddyfile" /etc/caddy/Caddyfile
sudo chown root:root /etc/caddy/Caddyfile
sudo chmod 644 /etc/caddy/Caddyfile

# Start the backend service
sudo cp "${HOME}/website/website.service" "/etc/systemd/system/website.service"
sudo systemctl daemon-reload
sudo systemctl enable website
sudo systemctl restart website

# Start/reload Caddy (reload for zero-downtime config changes)
sudo systemctl enable caddy
sudo systemctl reload-or-restart caddy

# Health check - verify the service is responding
max_attempts=10
attempt=1
while [ $attempt -le $max_attempts ]; do
    if curl --fail --silent --max-time 5 http://localhost:8080/ > /dev/null; then
        echo "Health check passed on attempt $attempt"
        break
    fi
    echo "Health check attempt $attempt/$max_attempts failed, retrying..."
    sleep 1
    attempt=$((attempt + 1))
done

if [ $attempt -gt $max_attempts ]; then
    echo "Health check failed after $max_attempts attempts"
    sudo systemctl status website --no-pager || true
    sudo journalctl -u website --no-pager -n 50 || true
    exit 1
fi

sudo systemctl status website --no-pager || true
sudo systemctl status caddy --no-pager || true
