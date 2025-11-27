#!/usr/bin/env bash
#
# server-deploy.sh - Deploy new version using blue/green strategy
#
# This script runs ON THE EC2 INSTANCE (not on CI). It:
#   1. Determines which slot (blue/green) is currently active
#   2. Deploys the new binary to the inactive slot
#   3. Health checks both slots
#   4. Switches Caddy to route traffic to the new slot
#
# Prerequisites:
#   - Server must be set up first (run ./scripts/setup.sh)
#
# Blue/green deployment allows instant rollback by switching Caddy back
# to the previous slot (see rollback.sh).
#
# State tracking:
#   - .active_port file tracks which port Caddy is routing to (8080 or 8081)
#   - Blue slot = port 8080, Green slot = port 8081
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
# Wait for a service to respond to health checks
# Usage: wait_for_health <port> <service_name>
# Returns: 0 on success, 1 on failure
#
wait_for_health() {
    local port=$1
    local name=$2
    local max_attempts=10
    local attempt=1

    echo "Waiting for $name (port $port) to be healthy..."
    while [ $attempt -le $max_attempts ]; do
        if curl --fail --silent --max-time 5 "http://localhost:${port}/" > /dev/null; then
            echo "$name is healthy (attempt $attempt/$max_attempts)"
            return 0
        fi
        echo "Health check attempt $attempt/$max_attempts failed, retrying in 1s..."
        sleep 1
        attempt=$((attempt + 1))
    done

    echo "ERROR: $name failed health check after $max_attempts attempts"
    return 1
}

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

#
# Main deployment logic
#

ls -la "${WEBSITE_DIR}"

# Check prerequisites
if ! command -v caddy &> /dev/null; then
    echo "ERROR: Caddy is not installed"
    echo "Run ./scripts/setup.sh first to provision the server"
    exit 1
fi

# Determine which slot to deploy to
# Read from .active_port file, or default to 8080 on first deploy
if [ -f "$ACTIVE_PORT_FILE" ]; then
    active_port=$(cat "$ACTIVE_PORT_FILE")
    # Validate it's a known port
    if [ "$active_port" != "$BLUE_PORT" ] && [ "$active_port" != "$GREEN_PORT" ]; then
        echo "ERROR: Invalid port '$active_port' in $ACTIVE_PORT_FILE"
        echo "Expected $BLUE_PORT (blue) or $GREEN_PORT (green)"
        exit 1
    fi
else
    echo "No .active_port file found, assuming first deploy (defaulting to blue/8080)"
    active_port=$BLUE_PORT
fi

# Calculate deploy target (opposite of active)
if [ "$active_port" = "$BLUE_PORT" ]; then
    deploy_port=$GREEN_PORT
    other_port=$BLUE_PORT
else
    deploy_port=$BLUE_PORT
    other_port=$GREEN_PORT
fi

deploy_slot=$(port_to_slot $deploy_port)
other_slot=$(port_to_slot $other_port)

echo ""
echo "=== Deployment Plan ==="
echo "Currently active: $other_slot (port $other_port)"
echo "Deploying to:     $deploy_slot (port $deploy_port)"
echo "======================="
echo ""

# Stop the deploy slot before copying (can't overwrite running binary)
sudo systemctl stop "website-${deploy_slot}" 2>/dev/null || true

# Copy binary to deploy slot
cp "${WEBSITE_DIR}/website" "${WEBSITE_DIR}/website-${deploy_slot}"

# Ensure other slot has a binary (for rollback)
if [ ! -f "${WEBSITE_DIR}/website-${other_slot}" ]; then
    echo "Copying binary to ${other_slot} slot for rollback capability"
    cp "${WEBSITE_DIR}/website" "${WEBSITE_DIR}/website-${other_slot}"
fi

# Ensure rollback slot is running (required for instant rollback)
if ! sudo systemctl is-active --quiet "website-${other_slot}"; then
    echo "Starting ${other_slot} slot for rollback capability..."
    sudo systemctl reset-failed "website-${other_slot}" 2>/dev/null || true
    sudo systemctl start "website-${other_slot}"
fi

# Verify rollback slot is healthy
if ! wait_for_health "$other_port" "rollback slot ($other_slot)"; then
    echo "Rollback slot is not healthy. Aborting deploy."
    echo "Without a healthy rollback slot, instant rollback is not possible."
    sudo systemctl status "website-${other_slot}" --no-pager || true
    sudo journalctl -u "website-${other_slot}" --no-pager -n 50 || true
    exit 1
fi

# Start the new version
sudo systemctl restart "website-${deploy_slot}"

# Health check the new version
if ! wait_for_health "$deploy_port" "new version ($deploy_slot)"; then
    echo "New version failed health check. NOT switching traffic."
    echo "The old version ($other_slot) is still serving traffic."
    echo "Fix the issue and redeploy, or check logs below:"
    sudo systemctl status "website-${deploy_slot}" --no-pager || true
    sudo journalctl -u "website-${deploy_slot}" --no-pager -n 50 || true
    exit 1
fi

# Update Caddyfile with new port and reload
sed "s/localhost:${BLUE_PORT}/localhost:${deploy_port}/" "${WEBSITE_DIR}/Caddyfile" | sudo tee /etc/caddy/Caddyfile > /dev/null

# Reload Caddy to switch traffic
sudo systemctl reload-or-restart caddy

# Record the new active port
echo "$deploy_port" > "$ACTIVE_PORT_FILE"

# Verify traffic is flowing through Caddy
echo "Verifying deployment through Caddy..."
sleep 2
if curl --fail --silent --max-time 10 "http://localhost:80/" > /dev/null; then
    echo "Traffic is flowing through Caddy successfully"
else
    echo "WARNING: Could not verify traffic through Caddy (port 80)"
    echo "The deployment may have succeeded - check manually"
fi

echo ""
echo "=== Deploy Complete ==="
echo "Traffic now routing to: $deploy_slot (port $deploy_port)"
echo "Rollback available to:  $other_slot (port $other_port)"
echo "======================="
echo ""

sudo systemctl status website-blue --no-pager || true
sudo systemctl status website-green --no-pager || true
