#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail
set -o xtrace

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
instance_id="i-095e542040fba92d3"
instance_user="ubuntu"
instance_ip=$(aws ec2 describe-instances \
    --region us-west-2 \
    --instance-ids "$instance_id" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

aws ec2-instance-connect send-ssh-public-key \
    --region us-west-2 \
    --instance-id "$instance_id" \
    --instance-os-user "$instance_user" \
    --ssh-public-key "file://${tmp_key_file}.pub"

rsync --partial --progress --archive --verbose --delete \
    --exclude='website-blue' \
    --exclude='website-green' \
    -e "ssh -o StrictHostKeyChecking=no -o IdentitiesOnly=yes -i \"${tmp_key_file}\"" \
    "$tmp_dir/." \
    "${instance_user}@${instance_ip}:/home/${instance_user}/website"

ssh -o StrictHostKeyChecking=no -o "IdentitiesOnly=yes" -i "${tmp_key_file}" "${instance_user}@${instance_ip}" "/home/${instance_user}/website/scripts/deploy.sh"
