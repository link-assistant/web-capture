FROM node:26.10.0-trixie

WORKDIR /app

# Install dependencies for headless Chrome (used by both Puppeteer and Playwright)
# Retry loop handles transient network errors from Debian mirrors in CI
RUN apt-get update && \
    for i in 1 2 3; do \
      apt-get install -y \
        chromium \
        fonts-liberation \
        libasound2t64 \
        libatk-bridge2.0-0t64 \
        libatk1.0-0t64 \
        libatspi2.0-0t64 \
        libcups2t64 \
        libdbus-1-3 \
        libdrm2 \
        libgbm1 \
        libgtk-3-0t64 \
        libnspr4 \
        libnss3 \
        libxcomposite1 \
        libxdamage1 \
        libxfixes3 \
        libxrandr2 \
        libxshmfence1 \
        xdg-utils \
        --no-install-recommends && break || \
      { if [ "$i" -eq 3 ]; then exit 1; fi; \
        echo "apt-get install attempt $i failed, retrying..."; \
        apt-get update && sleep 5; }; \
    done && \
    rm -rf /var/lib/apt/lists/*

# Set Puppeteer environment variables
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_ARGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage"

# Set Playwright environment variables
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

COPY package.json package-lock.json ./
RUN npm install --global npm@12.2.0 && npm ci

COPY . .

EXPOSE 3000

ENTRYPOINT ["node", "bin/web-capture.js", "--serve"]
