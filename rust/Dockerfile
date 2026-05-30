# Build stage
FROM rust:1.94-bullseye AS builder

WORKDIR /app

# Copy Cargo files first for better caching
COPY Cargo.toml Cargo.lock* ./

# Create a dummy main.rs to build dependencies
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    echo "pub fn dummy() {}" > src/lib.rs

# Build dependencies only
RUN cargo build --release && rm -rf src

# Copy the actual source code
COPY src ./src

# Build the actual application
RUN touch src/main.rs src/lib.rs && cargo build --release

# Runtime stage
FROM debian:bullseye-slim

WORKDIR /app

# Install dependencies for headless Chrome (with retries for transient network errors)
RUN apt-get update && \
    for i in 1 2 3; do \
      apt-get install -y \
        chromium \
        fonts-liberation \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libatspi2.0-0 \
        libcups2 \
        libdbus-1-3 \
        libdrm2 \
        libgbm1 \
        libgtk-3-0 \
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
      { echo "apt-get install attempt $i failed, retrying..."; sleep 5; }; \
    done && \
    rm -rf /var/lib/apt/lists/*

# Set Chrome/Chromium environment variables
ENV CHROME_PATH=/usr/bin/chromium
ENV CHROMIUM_PATH=/usr/bin/chromium

# Copy the binary from builder
COPY --from=builder /app/target/release/web-capture /usr/local/bin/web-capture

EXPOSE 3000

ENTRYPOINT ["web-capture", "--serve"]
