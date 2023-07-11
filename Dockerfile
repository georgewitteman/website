# https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md
# docker run --publish 8080:8080 --rm --init "$(docker build --quiet .)"

FROM node:20-alpine

USER node

# https://github.com/npm/cli/blob/b1c3256d62250b5dca113dd99bf1bd99f2500318/lib/utils/update-notifier.js#L113
# https://github.com/watson/ci-info/blob/20fae89d2bdeb0e5dd70e6a9e8d2647764e6ff04/index.js#L60
ENV CI true

# https://snyk.io/blog/10-best-practices-to-containerize-nodejs-web-applications-with-docker/#
ENV NODE_ENV production

RUN npm config set update-notifier false

# https://github.com/nodejs/docker-node/issues/740
RUN mkdir -p /home/node/app

WORKDIR /home/node/app

COPY package*.json ./

# https://github.com/goldbergyoni/nodebestpractices/blob/master/sections/docker/clean-cache.md
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

EXPOSE 8080

CMD ["node", "server.js"]
