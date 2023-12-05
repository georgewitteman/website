#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail
set -o xtrace

key_type="ed25519"
tmp_key_dir="$(mktemp -d)"
tmp_key_file="${tmp_key_dir}/${key_type}"

tmp_dir="$(mktemp -d)"

sudo curl -sL -o /usr/local/bin/tailwindcss https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-linux-x64
sudo chmod +x /usr/local/bin/tailwindcss
tailwindcss -i ./input.css -o ./static/styles.css --minify

# Build
cargo build --release --target x86_64-unknown-linux-gnu
cp ./target/x86_64-unknown-linux-gnu/release/website "${tmp_dir}/website"
cp -r ./scripts "${tmp_dir}/scripts"
cp -r ./static "${tmp_dir}/static"
cp -r ./website.service "${tmp_dir}/website.service"

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
