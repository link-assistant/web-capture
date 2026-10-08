# Build stage
FROM rust:1.99.0-trixie AS builder

WORKDIR /app

# Limit parallel compilation of generated browser protocol code.
ARG CARGO_BUILD_JOBS=2
ENV CARGO_BUILD_JOBS=${CARGO_BUILD_JOBS}

# Copy Cargo files first for better caching
COPY Cargo.toml Cargo.lock* ./

# Create a dummy main.rs to build dependencies
RUN mkdir src examples && \
    echo "fn main() {}" > src/main.rs && \
    echo "pub fn dummy() {}" > src/lib.rs && \
    echo "fn main() {}" > examples/capture_cache.rs

# Build dependencies only
RUN cargo build --release --locked && rm -rf src examples

# Copy the actual source code
COPY src ./src
COPY examples ./examples

# Build the actual application
RUN touch src/main.rs src/lib.rs && cargo build --release --locked

# Runtime stage
FROM debian:trixie-20261005-slim

WORKDIR /app

# Install dependencies for headless Chrome (with retries for transient network errors)
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
        ca-certificates \
        --no-install-recommends && break || \
      { if [ "$i" -eq 3 ]; then exit 1; fi; \
        echo "apt-get install attempt $i failed, retrying..."; \
        apt-get update && sleep 5; }; \
    done && \
    rm -rf /var/lib/apt/lists/*

# Set Chrome/Chromium environment variables
ENV CHROME_PATH=/usr/bin/chromium
ENV CHROMIUM_PATH=/usr/bin/chromium

# Copy the binary from builder
COPY --from=builder /app/target/release/web-capture /usr/local/bin/web-capture

EXPOSE 3000

ENTRYPOINT ["web-capture", "--serve"]
