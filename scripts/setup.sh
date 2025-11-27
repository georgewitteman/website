#!/usr/bin/env bash
#
# setup.sh - Provision a fresh EC2 instance from your local machine
#
# This script runs LOCALLY and:
#   1. Connects to the EC2 instance via SSH (using EC2 Instance Connect)
#   2. Copies the setup files to the server
#   3. Runs server-setup.sh on the server
#
# Prerequisites:
#   - AWS CLI configured with appropriate credentials
#
# Environment variables:
#   SMTP_PASSWORD - Required. Fastmail app password for email notifications.
#
# Usage:
#   SMTP_PASSWORD=xxx ./scripts/setup.sh
#

set -o errexit
set -o nounset
set -o pipefail
set -o xtrace

if [ -z "${SMTP_PASSWORD:-}" ]; then
    echo "ERROR: SMTP_PASSWORD environment variable is required"
    exit 1
fi

instance_id="i-095e542040fba92d3"
instance_ip="54.71.97.150"
instance_region="us-west-2"
instance_user="ubuntu"

# Create temporary SSH key
key_type="ed25519"
tmp_key_dir="$(mktemp -d)"
tmp_key_file="${tmp_key_dir}/${key_type}"

cleanup() {
    rm -rf "$tmp_key_dir"
}
trap cleanup EXIT

ssh-keygen -t "$key_type" -f "$tmp_key_file" -N ""
chmod 600 "$tmp_key_file"

# Push SSH key via EC2 Instance Connect
aws ec2-instance-connect send-ssh-public-key \
    --region "$instance_region" \
    --instance-id "$instance_id" \
    --instance-os-user "$instance_user" \
    --ssh-public-key "file://${tmp_key_file}.pub"

ssh_opts="-o StrictHostKeyChecking=no -o IdentitiesOnly=yes -i ${tmp_key_file}"

# Create website directory on server
ssh $ssh_opts "${instance_user}@${instance_ip}" "mkdir -p /home/${instance_user}/website"

# Copy setup files to server
rsync --partial --progress --archive --verbose \
    -e "ssh $ssh_opts" \
    ./scripts/server-setup.sh \
    ./caddy.service \
    ./website-blue.service \
    ./website-green.service \
    ./Caddyfile \
    "${instance_user}@${instance_ip}:/home/${instance_user}/website/"

# Make scripts directory and move setup script
ssh $ssh_opts "${instance_user}@${instance_ip}" "mkdir -p /home/${instance_user}/website/scripts && mv /home/${instance_user}/website/server-setup.sh /home/${instance_user}/website/scripts/"

# Run setup on server (pass SMTP_PASSWORD for email notifications)
ssh $ssh_opts "${instance_user}@${instance_ip}" "SMTP_PASSWORD='${SMTP_PASSWORD:-}' /home/${instance_user}/website/scripts/server-setup.sh"

echo ""
echo "=== Server Provisioning Complete ==="
echo ""
echo "The server is now ready for deployments."
echo "Push to main branch or run ./scripts/build.sh to deploy."
