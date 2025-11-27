#!/usr/bin/env bash
#
# rollback.sh - Instantly roll back to the previous deployment
#
# This script runs ON THE EC2 INSTANCE. It:
#   1. Reads the current active port from .active_port
#   2. Verifies the other slot is running and healthy
#   3. Switches Caddy to route traffic to the other slot
#
# Rollback is instant because both slots are always running.
# The "rollback" slot contains the previous deployment's binary.
#

set -o errexit
set -o nounset
set -o pipefail
set -o xtrace

WEBSITE_DIR="${HOME}/website"
ACTIVE_PORT_FILE="${WEBSITE_DIR}/.active_port"

# Slot configuration
BLUE_PORT=8080
GREEN_PORT=8081

#
# Get the name of a slot from its port number
#
port_to_slot() {
    local port=$1
    if [ "$port" = "$BLUE_PORT" ]; then
        echo "blue"
    elif [ "$port" = "$GREEN_PORT" ]; then
        echo "green"
    else
        echo "unknown"
    fi
}

# Read current active port
if [ ! -f "$ACTIVE_PORT_FILE" ]; then
    echo "ERROR: $ACTIVE_PORT_FILE not found"
    echo "Cannot determine current active slot. Has a deployment ever succeeded?"
    exit 1
fi

active_port=$(cat "$ACTIVE_PORT_FILE")

# Validate it's a known port
if [ "$active_port" != "$BLUE_PORT" ] && [ "$active_port" != "$GREEN_PORT" ]; then
    echo "ERROR: Invalid port '$active_port' in $ACTIVE_PORT_FILE"
    echo "Expected $BLUE_PORT (blue) or $GREEN_PORT (green)"
    exit 1
fi

# Calculate rollback target (opposite of active)
if [ "$active_port" = "$BLUE_PORT" ]; then
    rollback_port=$GREEN_PORT
else
    rollback_port=$BLUE_PORT
fi

rollback_slot=$(port_to_slot $rollback_port)
current_slot=$(port_to_slot $active_port)

echo ""
echo "=== Rollback Plan ==="
echo "Currently active: $current_slot (port $active_port)"
echo "Rolling back to:  $rollback_slot (port $rollback_port)"
echo "===================="
echo ""

# Check if the rollback target is running
if ! sudo systemctl is-active --quiet "website-${rollback_slot}"; then
    echo "ERROR: website-${rollback_slot} is not running"
    echo "Cannot rollback to a stopped service."
    echo "You may need to start it manually or redeploy a previous version."
    exit 1
fi

# Health check the rollback target
if ! curl --fail --silent --max-time 5 "http://localhost:${rollback_port}/" > /dev/null; then
    echo "ERROR: website-${rollback_slot} is not responding on port ${rollback_port}"
    echo "Cannot rollback to an unhealthy service."
    echo "Check the service status:"
    sudo systemctl status "website-${rollback_slot}" --no-pager || true
    exit 1
fi

# Update Caddyfile with rollback port and reload
sudo sed -i "s/localhost:[0-9]*/localhost:${rollback_port}/" /etc/caddy/Caddyfile
sudo systemctl reload caddy

# Update the active port file
echo "$rollback_port" > "$ACTIVE_PORT_FILE"

echo ""
echo "=== Rollback Complete ==="
echo "Traffic now routing to: $rollback_slot (port $rollback_port)"
echo "========================="
echo ""

sudo systemctl status website-blue --no-pager || true
sudo systemctl status website-green --no-pager || true
