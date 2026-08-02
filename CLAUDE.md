# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Personal website backend for georgewitteman.com. A Rust web server using Axum framework, deployed to AWS EC2 with Caddy as a reverse proxy.

## Common Commands

```bash
# Development
cargo run                          # Run server locally (default port 8080)
cargo watch -x run                 # Auto-reload on file changes

# Testing and linting
cargo test                         # Run all tests
cargo test <test_name>             # Run a specific test
cargo fmt --check                  # Check formatting
cargo clippy -- -D warnings        # Run linter (warnings are errors in CI)

# E2E tests (Playwright)
npm run test:e2e                   # Run e2e tests (starts server automatically)
npm run test:e2e:ui                # Run e2e tests with UI mode

# Build
cargo build --release --target x86_64-unknown-linux-gnu   # Production build for deployment

# Deployment (requires AWS credentials)
./scripts/build-and-deploy.sh      # Build and deploy to EC2
```

## Architecture

### Server Structure

- **`src/main.rs`** - Entry point, server setup with graceful shutdown, and all integration tests
- **`src/router.rs`** - Route definitions and security header middleware (CSP, HSTS, X-Frame-Options, etc.)
- **`src/handlers/`** - Request handlers for each route (echo, uuid, sha, slot, icloud-private-relay, weather, index)
- **`src/extractors.rs`** - Proxy header handling (X-Forwarded-For, X-Forwarded-Proto) with trust verification for localhost
- **`src/config.rs`** - Environment-based configuration (PORT, SERVER_HOSTNAME)
- **`src/services/`** - External service integrations (iCloud Private Relay IP detection, Open-Meteo weather)
- **`src/units.rs`** - Typed quantities (`Temperature`, `TemperatureDelta`, `Speed`), each storing one canonical unit
- **`src/comfort.rs`** - Steadman apparent temperature plus a radiation budget, giving felt temperature in sun and in shade
- **`src/scale.rs`** - The personal 0-10 comfort scale the weather page leads with
- **`src/locations.rs`** - Committed saved locations for the weather page

### The weather page

`/weather` answers "what do I wear, and do I need a layer for later". It is
rendered server-side in one pass and leads with a 0-10 comfort score rather than
a temperature; degrees are kept as supporting detail.

- Felt temperature is Steadman's apparent temperature in its radiation form, so
  it stays informative between 50-80°F where consumer "feels like" values fall
  back to raw air temperature. See the module docs in `src/comfort.rs`.
- The sun/shade pair needs direct and diffuse solar radiation separately, which
  is why the data source is Open-Meteo — see `src/services/open_meteo.rs` for
  the comparison against the alternatives. No API key is involved.
- Forecasts are cached in memory per location for ten minutes. There is no
  database: saved locations are committed to `src/locations.rs`, and the browser
  keeps any personal default in `localStorage`.
- The page's CSP is `default-src 'self'`, so there is no inline script or style.
  The score tooltips are CSS-only (`:hover` plus `:focus` for touch).

### Templates and Static Files

- **`templates/`** - Askama HTML templates with a base layout
- **`static/`** - Static files served via ServeDir fallback (CSS, JS, HTML tools)

### Deployment

Blue-green deployment on EC2:

- `website-blue.service` / `website-green.service` - Systemd units for each slot
- Caddy handles HTTPS termination and proxies to the active slot
- `scripts/server-deploy.sh` runs on EC2 to swap slots atomically

### Environment Variables

- `PORT` - Server port (default: 8080)
- `SERVER_HOSTNAME` - Domain name (default: localhost)
- `RUST_LOG` - Log level filter (default: info)
- `GIT_SHA` - Commit hash shown at /sha endpoint
- `SLOT` - Deployment slot (blue/green) shown at /slot endpoint
