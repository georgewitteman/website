#!/bin/sh

set -o errexit
set -o nounset
set -o xtrace

export AWS_REGION=us-west-2

node --test
npm run typecheck

aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin 866631827662.dkr.ecr.us-west-2.amazonaws.com
docker build -t website .
docker tag website:latest 866631827662.dkr.ecr.us-west-2.amazonaws.com/website:latest
docker push 866631827662.dkr.ecr.us-west-2.amazonaws.com/website:latest
aws ecs update-service --cluster Prod --service website-v5 --force-new-deployment --no-cli-pager
