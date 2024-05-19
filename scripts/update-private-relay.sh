#!/bin/sh

curl --fail \
    --silent \
    --tlsv1.3 \
    --show-error \
    --location \
    --output "./static/private-relay-ip-addresses.csv" \
    "https://mask-api.icloud.com/egress-ip-ranges.csv"
