#!/usr/bin/env bash
#
# build-and-deploy.sh - Build and deploy to EC2
#
# This script runs locally (or on GitHub Actions). It:
#   1. Builds the Rust binary for Linux
#   2. Creates a temporary SSH key for EC2 Instance Connect
#   3. Rsyncs the build artifacts to the EC2 instance
#   4. Runs server-deploy.sh on the EC2 instance to complete deployment
#
# Required environment variables:
#   - EC2_INSTANCE_ID: The EC2 instance to deploy to
#   - AWS credentials (configured via aws-actions/configure-aws-credentials)
#

set -o errexit
set -o nounset
set -o pipefail
set -o xtrace

instance_id="${EC2_INSTANCE_ID:?EC2_INSTANCE_ID environment variable must be set}"
instance_region="us-west-2"
instance_user="ubuntu"

key_type="ed25519"
tmp_key_dir="$(mktemp -d)"
tmp_key_file="${tmp_key_dir}/${key_type}"

tmp_dir="$(mktemp -d)"

# Clean up temp directories on exit
cleanup() {
    rm -rf "$tmp_key_dir" "$tmp_dir"
}
trap cleanup EXIT

# Build
cargo build --release --target x86_64-unknown-linux-gnu
cp ./target/x86_64-unknown-linux-gnu/release/website "${tmp_dir}/website"
cp -r ./scripts "${tmp_dir}/scripts"
cp -r ./static "${tmp_dir}/static"
cp ./website-blue.service "${tmp_dir}/website-blue.service"
cp ./website-green.service "${tmp_dir}/website-green.service"
cp ./caddy.service "${tmp_dir}/caddy.service"
cp ./Caddyfile "${tmp_dir}/Caddyfile"

# Deploy
ssh-keygen -t "$key_type" -f "$tmp_key_file" -N ""
chmod 600 "$tmp_key_file"

instance_ip=$(aws ec2 describe-instances \
    --region "$instance_region" \
    --instance-ids "$instance_id" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

aws ec2-instance-connect send-ssh-public-key \
    --region "$instance_region" \
    --instance-id "$instance_id" \
    --instance-os-user "$instance_user" \
    --ssh-public-key "file://${tmp_key_file}.pub"

rsync --partial --progress --archive --verbose --delete \
    --exclude='website-blue' \
    --exclude='website-green' \
    --exclude='.active_port' \
    -e "ssh -o StrictHostKeyChecking=no -o IdentitiesOnly=yes -i \"${tmp_key_file}\"" \
    "$tmp_dir/." \
    "${instance_user}@${instance_ip}:/home/${instance_user}/website"

ssh -o StrictHostKeyChecking=no -o "IdentitiesOnly=yes" -i "${tmp_key_file}" "${instance_user}@${instance_ip}" "/home/${instance_user}/website/scripts/server-deploy.sh"
