FROM node:18-alpine

ARG NODE_ENV
ENV NODE_ENV=${NODE_ENV}

# Ensure NODE_ENV is set
RUN test -n "$NODE_ENV"

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

EXPOSE 8080

WORKDIR /app/apps/server

CMD ["node", "index.js"]
