# https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md
# docker run --publish 8080:8080 --rm --init "$(docker build --quiet .)"

FROM node:18-alpine

USER node

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

EXPOSE 8080

CMD ["node", "index.js"]
