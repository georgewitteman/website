#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail
set -o xtrace

sudo curl -sL -o /usr/local/bin/tailwindcss https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-linux-x64
sudo chmod +x /usr/local/bin/tailwindcss
tailwindcss --watch -i ./input.css -o ./static/styles.css
