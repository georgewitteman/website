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
cp -r ./website.service "${tmp_dir}/website.service"
cp -r ./caddy.service "${tmp_dir}/caddy.service"
cp -r ./Caddyfile "${tmp_dir}/Caddyfile"

# Deploy
ssh-keygen -t "$key_type" -f "$tmp_key_file" -N ""
chmod 600 "$tmp_key_file"
aws ec2-instance-connect send-ssh-public-key \
    --region us-west-2 \
    --instance-id i-03e83beff21cbda7c \
    --instance-os-user ec2-user \
    --ssh-public-key "file://${tmp_key_file}.pub"

rsync --partial --progress --archive --verbose --delete \
    -e "ssh -o StrictHostKeyChecking=no -o IdentitiesOnly=yes -i \"${tmp_key_file}\"" \
    "$tmp_dir/." \
    ec2-user@54.71.97.150:/home/ec2-user/website

ssh -o StrictHostKeyChecking=no -o "IdentitiesOnly=yes" -i "${tmp_key_file}" ec2-user@54.71.97.150 /home/ec2-user/website/scripts/deploy.sh
