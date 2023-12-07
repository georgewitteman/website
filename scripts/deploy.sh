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

# Install acme.sh dependencies
sudo dnf install cronie -y
sudo systemctl enable crond.service
sudo systemctl start crond.service
sudo systemctl status crond.service

# Start the server
sudo cp "${HOME}/website/website.service" "/etc/systemd/system/website.service"
sudo systemctl daemon-reload
sudo systemctl enable website

# # Install acme.sh
curl https://get.acme.sh | sh -s email=george@witteman.me

# Get the certificate
/home/ec2-user/.acme.sh/acme.sh --issue -d "$DOMAIN" --webroot "${HOME}/website/static" --server letsencrypt || true

/home/ec2-user/.acme.sh/acme.sh --install-cert -d "$DOMAIN" \
--cert-file "${HOME}/website/cert.pem" \
--key-file "${HOME}/website/key.pem" \
--fullchain-file "${HOME}/website/fullchain.pem" \
--reloadcmd "sudo systemctl restart website"

sleep "2s"
sudo netstat -tulpn
