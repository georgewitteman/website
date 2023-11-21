# https://bun.sh/guides/ecosystem/docker
# docker run --publish 8080:8080 --rm --init "$(docker build --quiet .)"

# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1-alpine as base
WORKDIR /usr/src/app

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS devinstall
RUN mkdir -p /temp/dev
COPY package.json bun.lockb /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# install with --production (exclude devDependencies)
FROM base AS prodinstall
RUN mkdir -p /temp/prod
COPY package.json bun.lockb /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM devinstall AS build
COPY --from=devinstall /temp/dev/node_modules node_modules
COPY . .

# [optional] tests & build
ENV NODE_ENV=production
RUN bun run build

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=prodinstall /temp/prod/node_modules node_modules
COPY --from=build /usr/src/app/package.json .
COPY --from=build /usr/src/app/src ./src
COPY --from=build /usr/src/app/static ./static

# run the app
USER bun
EXPOSE 8080/tcp
ENTRYPOINT [ "bun", "run", "./src/server.js" ]
# USER node
# ENV CI true
# ENV NODE_ENV production
# RUN npm config set update-notifier false
# RUN mkdir -p /home/node/app
# WORKDIR /home/node/app
# COPY package*.json ./
# RUN npm ci && npm cache clean --force
# COPY . .
# RUN npx tailwindcss -i ./static/input.css -o ./static/output.css --minify

# FROM node:20-alpine

# USER node

# # https://github.com/npm/cli/blob/b1c3256d62250b5dca113dd99bf1bd99f2500318/lib/utils/update-notifier.js#L113
# # https://github.com/watson/ci-info/blob/20fae89d2bdeb0e5dd70e6a9e8d2647764e6ff04/index.js#L60
# ENV CI true

# # https://snyk.io/blog/10-best-practices-to-containerize-nodejs-web-applications-with-docker/#
# ENV NODE_ENV production

# RUN npm config set update-notifier false

# # https://github.com/nodejs/docker-node/issues/740
# RUN mkdir -p /home/node/app

# WORKDIR /home/node/app

# COPY package*.json ./

# # https://github.com/goldbergyoni/nodebestpractices/blob/master/sections/docker/clean-cache.md
# RUN npm ci --omit=dev && npm cache clean --force

# COPY . .
# COPY --from=build /home/node/app/static/output.css ./static/output.css

# EXPOSE 8080

# CMD ["node", "server.js"]
