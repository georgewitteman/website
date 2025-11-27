#!/usr/bin/env bash
#
# server-setup.sh - Server provisioning
#
# This script runs ON THE EC2 INSTANCE to set up the server.
# It installs and configures:
#   - Automatic security updates (unattended-upgrades)
#   - Email notifications via Fastmail SMTP (msmtp)
#   - Caddy web server (reverse proxy with automatic HTTPS)
#   - Systemd services for blue/green deployment slots
#
# This script is idempotent - safe to run multiple times.
#
# Environment variables:
#   SMTP_PASSWORD  - Required. Fastmail app password for email notifications.
#
# Usage (run locally via setup.sh):
#   EC2_INSTANCE_ID=i-xxx SMTP_PASSWORD=xxx ./scripts/setup.sh
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

// Automatically reboot if required (at 3am)
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "03:00";

// Email notifications
Unattended-Upgrade::Mail "george@witteman.me";
Unattended-Upgrade::MailReport "only-on-error";
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
# Install Caddy
#
if command -v caddy &> /dev/null; then
    echo "Caddy is already installed: $(caddy version)"
else
    echo "Installing Caddy..."
    curl -fsSL "https://caddyserver.com/api/download?os=linux&arch=amd64" -o /tmp/caddy
    chmod +x /tmp/caddy
    sudo mv /tmp/caddy /usr/bin/caddy
    echo "Caddy installed: $(caddy version)"
fi

#
# Create caddy user and group
#
if id "caddy" &>/dev/null; then
    echo "Caddy user already exists"
else
    echo "Creating caddy user and group..."
    sudo groupadd --system caddy 2>/dev/null || true
    sudo useradd --system --gid caddy --create-home --home-dir /var/lib/caddy --shell /usr/sbin/nologin caddy
fi

#
# Create Caddy directories
#
echo "Creating Caddy directories..."
sudo mkdir -p /etc/caddy
sudo mkdir -p /var/lib/caddy
sudo chown caddy:caddy /var/lib/caddy

#
# Install Caddy systemd service
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
