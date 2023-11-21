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
ENV CI=true
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
ENTRYPOINT [ "bun", "run", "./src/server.ts" ]
