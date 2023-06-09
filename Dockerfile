# https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md
# docker run --publish 8080:8080 --rm --init "$(docker build --quiet .)"

FROM node:20-alpine

USER node

# https://github.com/nodejs/docker-node/issues/740
RUN mkdir -p /home/node/app

WORKDIR /home/node/app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

EXPOSE 8080

CMD ["node", "index.js"]
