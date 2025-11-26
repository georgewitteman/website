#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail
set -o xtrace

WEBSITE_DIR="${HOME}/website"
ACTIVE_PORT_FILE="${WEBSITE_DIR}/active_port"

if [ ! -f "$ACTIVE_PORT_FILE" ]; then
    echo "No active_port file found. Cannot determine current state."
    exit 1
fi

active_port=$(cat "$ACTIVE_PORT_FILE")

# Determine which slot to roll back to
if [ "$active_port" = "8080" ]; then
    rollback_slot="green"
    rollback_port="8081"
else
    rollback_slot="blue"
    rollback_port="8080"
fi

echo "Current active port: $active_port, rolling back to: $rollback_slot (port $rollback_port)"

# Check if the rollback target is running
if ! sudo systemctl is-active --quiet "website-${rollback_slot}"; then
    echo "Error: website-${rollback_slot} is not running. Cannot rollback."
    echo "You may need to redeploy a previous version instead."
    exit 1
fi

# Health check the rollback target
if ! curl --fail --silent --max-time 5 "http://localhost:${rollback_port}/" > /dev/null; then
    echo "Error: website-${rollback_slot} is not responding on port ${rollback_port}. Cannot rollback."
    exit 1
fi

# Update Caddyfile to point to rollback port
sudo sed -i "s/localhost:[0-9]*/localhost:${rollback_port}/" /etc/caddy/Caddyfile

# Reload Caddy to switch traffic
sudo systemctl reload caddy

# Save the new active port
echo "$rollback_port" > "$ACTIVE_PORT_FILE"

echo "Rollback complete. Traffic now routing to $rollback_slot (port $rollback_port)"

sudo systemctl status website-blue --no-pager || true
sudo systemctl status website-green --no-pager || true
