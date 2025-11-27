#!/usr/bin/env bash
#
# server-setup.sh - Server provisioning
#
# This script runs ON THE EC2 INSTANCE to set up the server.
# It installs and configures:
#   - Automatic security updates (unattended-upgrades)
#   - Email notifications via Fastmail SMTP (msmtp)
#   - Disk space monitoring with email alerts
#   - Caddy web server (reverse proxy with automatic HTTPS)
#   - Systemd services for blue/green deployment slots
#
# This script is idempotent - safe to run multiple times.
#
# Environment variables:
#   SMTP_PASSWORD - Required. Fastmail app password for email notifications.
#
# Usage (run locally via setup.sh):
#   SMTP_PASSWORD=xxx ./scripts/setup.sh
#

set -o errexit
set -o nounset
set -o pipefail
set -o xtrace

WEBSITE_DIR="${WEBSITE_DIR:-${HOME}/website}"

echo ""
echo "=== Server Setup ==="
echo "Website directory: $WEBSITE_DIR"
echo "===================="
echo ""

#
# Configure automatic security updates
#
echo "Configuring automatic updates..."
sudo apt-get update
sudo apt-get install -y unattended-upgrades apt-listchanges msmtp msmtp-mta

# Configure msmtp for sending emails via Fastmail
echo "Configuring msmtp with Fastmail SMTP..."
sudo tee /etc/msmtprc > /dev/null << EOF
defaults
auth           on
tls            on
tls_trust_file /etc/ssl/certs/ca-certificates.crt
logfile        /var/log/msmtp.log

account        fastmail
host           smtp.fastmail.com
port           587
from           george@witteman.me
user           george@witteman.me
password       ${SMTP_PASSWORD}

account default : fastmail
EOF
sudo chmod 600 /etc/msmtprc

# Configure unattended-upgrades
sudo tee /etc/apt/apt.conf.d/50unattended-upgrades > /dev/null << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}";
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};

// Remove unused kernel packages and dependencies
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";

// Do not automatically reboot - notify via email instead
Unattended-Upgrade::Automatic-Reboot "false";

// Email notifications
Unattended-Upgrade::Mail "george@witteman.me";
Unattended-Upgrade::MailReport "always";
EOF

# Enable automatic updates
sudo tee /etc/apt/apt.conf.d/20auto-upgrades > /dev/null << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
EOF

echo "Automatic updates configured"

#
# Set up disk space monitoring
#
echo "Setting up disk space monitoring..."
sudo tee /usr/local/bin/check-disk-space > /dev/null << 'SCRIPT'
#!/bin/bash
THRESHOLD=80
EMAIL="george@witteman.me"
HOSTNAME=$(hostname)

usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')

if [ "$usage" -ge "$THRESHOLD" ]; then
    echo -e "To: ${EMAIL}\nSubject: [${HOSTNAME}] Disk space alert: ${usage}% used\n\nDisk usage on ${HOSTNAME} has reached ${usage}%.\n\n$(df -h)" | msmtp "$EMAIL"
fi
SCRIPT
sudo chmod +x /usr/local/bin/check-disk-space

# Run disk space check daily at 6am
echo "0 6 * * * root /usr/local/bin/check-disk-space" | sudo tee /etc/cron.d/disk-space-check > /dev/null

echo "Disk space monitoring configured"

#
# Install Caddy from official apt repository
#
echo "Installing Caddy from official repository..."
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg --yes
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
sudo apt-get update
sudo apt-get install -y caddy
echo "Caddy installed: $(caddy version)"

#
# Install Caddy systemd service (override the default)
#
echo "Installing Caddy systemd service..."
sudo cp "${WEBSITE_DIR}/caddy.service" /etc/systemd/system/caddy.service

#
# Install website systemd services
#
echo "Installing website systemd services..."
sudo cp "${WEBSITE_DIR}/website-blue.service" /etc/systemd/system/website-blue.service
sudo cp "${WEBSITE_DIR}/website-green.service" /etc/systemd/system/website-green.service

#
# Reload systemd and enable services
#
echo "Enabling services..."
sudo systemctl daemon-reload
sudo systemctl enable caddy
sudo systemctl enable website-blue
sudo systemctl enable website-green

#
# Install initial Caddyfile (pointing to blue slot by default)
#
if [ ! -f /etc/caddy/Caddyfile ]; then
    echo "Installing initial Caddyfile..."
    sudo cp "${WEBSITE_DIR}/Caddyfile" /etc/caddy/Caddyfile
else
    echo "Caddyfile already exists, skipping"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Deploy the application: push to main branch or run ./scripts/build.sh"
echo "  2. The first deploy will start the services and configure Caddy"
echo ""
echo "Service status:"
sudo systemctl status caddy --no-pager 2>/dev/null || echo "  caddy: not started (will start on first deploy)"
sudo systemctl status website-blue --no-pager 2>/dev/null || echo "  website-blue: not started (will start on first deploy)"
sudo systemctl status website-green --no-pager 2>/dev/null || echo "  website-green: not started (will start on first deploy)"
