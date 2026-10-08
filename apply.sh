#!/usr/bin/env bash
set -euo pipefail

# Usage: ./apply.sh [directory] [--skip-install]
# Reuse the published service rather than maintaining a separate implementation.
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
TARGET_DIR=${1:-web-capture}
PACKAGE_VERSION=$(node -p "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')).version" "$SCRIPT_DIR/js/package.json")
mkdir -p "$TARGET_DIR"
cd "$TARGET_DIR"
git init

cat > package.json <<EOF_PACKAGE
{
  "name": "web-capture-service",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=26.10.0" },
  "packageManager": "npm@12.2.0",
  "allowScripts": { "puppeteer": true },
  "scripts": { "start": "node index.js", "dev": "node --watch index.js" },
  "dependencies": { "@link-assistant/web-capture": "^$PACKAGE_VERSION" }
}
EOF_PACKAGE

cat > index.js <<'EOF_JS'
import { app } from '@link-assistant/web-capture';
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Renderer service listening on http://localhost:${port}`);
});
EOF_JS

# Share the maintained browser image and current dependency installation policy.
sed 's@"bin/web-capture.js", "--serve"@"index.js"@' "$SCRIPT_DIR/js/Dockerfile" > Dockerfile
cat > .gitignore <<'EOF_IGNORE'
node_modules
.env
EOF_IGNORE
cat > README.md <<'EOF_README'
# web-capture service

Run `npm ci && npm start`. The maintained web-capture application provides
`GET /html?url=<URL>`, `GET /markdown?url=<URL>` and `GET /image?url=<URL>`,
along with all its other capture and search endpoints.

Build with `docker build -t web-capture .` and run with
`docker run -p 3000:3000 web-capture`.
EOF_README

if [ "${2:-}" != '--skip-install' ]; then
  # npm 12 drops unpublished optional Kreuzberg musl lock placeholders.
  # Generate the compatible lock once, then use current npm for installation.
  npx --yes npm@11.13.0 install --package-lock-only
  npx --yes npm@12.2.0 ci
fi
printf 'Service scaffolded in %s\n' "$(pwd)"
