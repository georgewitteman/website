#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail
set -o xtrace

DOMAIN="georgewitteman.com"

ls -la "${HOME}/website"

# https://serverfault.com/a/408670
sudo rm /etc/sysctl.d/99-website.conf || true
echo "net.ipv6.bindv6only=1" | sudo tee /etc/sysctl.d/99-website.conf
sudo sysctl -p

# Start the server
sudo cp "${HOME}/website/website.service" "/etc/systemd/system/website.service"
sudo systemctl daemon-reload
sudo systemctl enable website

sleep "2s"
sudo netstat -tulpn
