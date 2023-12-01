#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail
set -o xtrace

ls -la "${HOME}/website"

# Install acme.sh dependencies
sudo dnf install cronie -y
sudo systemctl enable crond.service
sudo systemctl start crond.service
sudo systemctl status crond.service

# Start the server
sudo cp "${HOME}/website/website.service" "/etc/systemd/system/website.service"
sudo systemctl daemon-reload

# # Install acme.sh
curl https://get.acme.sh | sh -s email=george@witteman.me

# Get the certificate
/home/ec2-user/.acme.sh/acme.sh --issue -d v2.georgewitteman.com --webroot "${HOME}/website/static" --server letsencrypt || true

/home/ec2-user/.acme.sh/acme.sh --install-cert -d v2.georgewitteman.com \
--cert-file "${HOME}/website/cert.pem" \
--key-file "${HOME}/website/key.pem" \
--fullchain-file "${HOME}/website/fullchain.pem" \
--reloadcmd "sudo systemctl restart website"
