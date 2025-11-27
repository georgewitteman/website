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
#   - EC2_INSTANCE_ID environment variable set (or pass as argument)
#
# Usage:
#   EC2_INSTANCE_ID=i-xxx ./scripts/setup.sh
#   # or
#   ./scripts/setup.sh i-xxx
#

set -o errexit
set -o nounset
set -o pipefail
set -o xtrace

# Accept instance ID as argument or environment variable
instance_id="${1:-${EC2_INSTANCE_ID:-}}"
if [ -z "$instance_id" ]; then
    echo "ERROR: EC2 instance ID required"
    echo "Usage: $0 <instance-id>"
    echo "   or: EC2_INSTANCE_ID=i-xxx $0"
    exit 1
fi

instance_region="${EC2_REGION:-us-west-2}"
instance_user="${EC2_USER:-ubuntu}"

echo ""
echo "=== Setup Configuration ==="
echo "Instance ID: $instance_id"
echo "Region:      $instance_region"
echo "User:        $instance_user"
echo "==========================="
echo ""

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

# Get instance IP
instance_ip=$(aws ec2 describe-instances \
    --region "$instance_region" \
    --instance-ids "$instance_id" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

if [ -z "$instance_ip" ] || [ "$instance_ip" = "None" ]; then
    echo "ERROR: Could not get IP address for instance $instance_id"
    echo "Is the instance running?"
    exit 1
fi

echo "Instance IP: $instance_ip"

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

# Run setup on server
ssh $ssh_opts "${instance_user}@${instance_ip}" "/home/${instance_user}/website/scripts/server-setup.sh"

echo ""
echo "=== Server Provisioning Complete ==="
echo ""
echo "The server is now ready for deployments."
echo "Push to main branch or run ./scripts/build.sh to deploy."
