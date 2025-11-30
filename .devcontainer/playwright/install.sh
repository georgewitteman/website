#!/bin/bash
set -e
# Install Playwright system dependencies and Chromium browser
npx playwright install-deps chromium
npx playwright install chromium
