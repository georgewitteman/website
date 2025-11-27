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
# Usage:
#   ./scripts/rollback.sh
#

set -o errexit
set -o nounset
set -o pipefail
set -o xtrace

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

# Run rollback on server
ssh -o StrictHostKeyChecking=no -o "IdentitiesOnly=yes" -i "${tmp_key_file}" \
    "${instance_user}@${instance_ip}" \
    "/home/${instance_user}/website/scripts/server-rollback.sh"
