# https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md
# docker run --publish 8080:8080 --rm --init "$(docker build --quiet .)"

FROM node:20-alpine

USER node

# https://snyk.io/blog/10-best-practices-to-containerize-nodejs-web-applications-with-docker/#
ENV NODE_ENV production

# https://github.com/nodejs/docker-node/issues/740
RUN mkdir -p /home/node/app

WORKDIR /home/node/app

COPY package*.json ./

# https://github.com/goldbergyoni/nodebestpractices/blob/master/sections/docker/clean-cache.md
RUN npm ci --only=production && npm cache clean --force

COPY . .

EXPOSE 8080

CMD ["node", "server.js"]
