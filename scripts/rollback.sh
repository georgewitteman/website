#!/usr/bin/env bash
#
# rollback.sh - Trigger rollback on EC2 from local machine
#
# This script runs locally (or on GitHub Actions). It:
#   1. Connects to the EC2 instance via SSH (using EC2 Instance Connect)
#   2. Runs server-rollback.sh on the server
#
# Prerequisites:
#   - AWS CLI configured with appropriate credentials
#
# Environment variables:
#   EC2_INSTANCE_ID  - Required. The EC2 instance to rollback.
#
# Usage:
#   EC2_INSTANCE_ID=i-xxx ./scripts/rollback.sh
#

set -o errexit
set -o nounset
set -o pipefail
set -o xtrace

if [ -z "${EC2_INSTANCE_ID:-}" ]; then
    echo "ERROR: EC2_INSTANCE_ID environment variable is required"
    exit 1
fi

instance_id="$EC2_INSTANCE_ID"
instance_region="us-west-2"
instance_user="ubuntu"

echo ""
echo "=== Rollback Configuration ==="
echo "Instance ID: $instance_id"
echo "Region:      $instance_region"
echo "User:        $instance_user"
echo "==============================="
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

# Run rollback on server
ssh -o StrictHostKeyChecking=no -o "IdentitiesOnly=yes" -i "${tmp_key_file}" \
    "${instance_user}@${instance_ip}" \
    "/home/${instance_user}/website/scripts/server-rollback.sh"
