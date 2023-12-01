FROM rust:1-bullseye as build
WORKDIR /app
COPY . /app/
RUN cargo build --release

FROM debian:bookworm
COPY --from=build /app/target/release/website /website
CMD ["/website"]
