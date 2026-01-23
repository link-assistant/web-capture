# web-capture (JavaScript/Node.js)

A CLI and microservice to fetch URLs and render them as:

- **HTML**: Rendered page content
- **Markdown**: Converted from HTML
- **PNG screenshot**: Full page capture

## Installation

### From npm

```bash
npm install -g @link-assistant/web-capture
```

### From Source

```bash
cd js
npm install
# or
yarn install
```

## Quick Start

### CLI Usage

```bash
# Capture a URL as HTML (output to stdout)
web-capture https://example.com

# Capture as Markdown and save to file
web-capture https://example.com --format markdown --output page.md

# Take a screenshot
web-capture https://example.com --format png --output screenshot.png

# Start as API server
web-capture --serve

# Start server on custom port
web-capture --serve --port 8080
```

### API Endpoints (Server Mode)

- **HTML**: GET /html?url=<URL>
- **Markdown**: GET /markdown?url=<URL>
- **PNG screenshot**: GET /image?url=<URL>

## CLI Reference

### Server Mode

Start the API server:

```bash
web-capture --serve [--port <port>]
```

| Option    | Short | Description              | Default            |
| --------- | ----- | ------------------------ | ------------------ |
| `--serve` | `-s`  | Start as HTTP API server | -                  |
| `--port`  | `-p`  | Port to listen on        | 3000 (or PORT env) |

### Capture Mode

Capture a URL directly:

```bash
web-capture <url> [options]
```

| Option     | Short | Description                                           | Default                                  |
| ---------- | ----- | ----------------------------------------------------- | ---------------------------------------- |
| `--format` | `-f`  | Output format: `html`, `markdown`/`md`, `image`/`png` | `html`                                   |
| `--output` | `-o`  | Output file path                                      | stdout (text) or auto-generated (images) |
| `--engine` | `-e`  | Browser engine: `puppeteer`, `playwright`             | `puppeteer` (or BROWSER_ENGINE env)      |

### Examples

```bash
# Capture HTML to stdout
web-capture https://example.com

# Capture Markdown to file
web-capture https://example.com -f markdown -o page.md

# Take screenshot with Playwright engine
web-capture https://example.com -f png -e playwright -o screenshot.png

# Pipe HTML to another command
web-capture https://example.com | grep "title"
```

## Docker

```bash
# Build and run using Docker Compose
docker compose up -d

# Or manually
docker build -t web-capture-js .
docker run -p 3000:3000 web-capture-js
```

## API Endpoints

### HTML Endpoint

```bash
GET /html?url=<URL>&engine=<ENGINE>
```

Returns the raw HTML content of the specified URL.

**Parameters:**

- `url` (required): The URL to fetch
- `engine` (optional): Browser engine to use (`puppeteer` or `playwright`). Default: `puppeteer`

### Markdown Endpoint

```bash
GET /markdown?url=<URL>
```

Converts the HTML content of the specified URL to Markdown format.

### Image Endpoint

```bash
GET /image?url=<URL>&engine=<ENGINE>
```

Returns a PNG screenshot of the specified URL.

**Parameters:**

- `url` (required): The URL to capture
- `engine` (optional): Browser engine to use (`puppeteer` or `playwright`). Default: `puppeteer`

## Configuration

Configuration values are resolved with the following priority (highest to lowest):

1. **CLI arguments**: `--port 8080`
2. **Environment variables**: `PORT=8080`
3. **Default .lenv file**: `.lenv` in the project root
4. **Built-in defaults**

### Environment Variables

```bash
# Set port via environment variable
export PORT=8080
web-capture --serve

# Set browser engine
export BROWSER_ENGINE=playwright
web-capture https://example.com --format png
```

## Browser Engine Support

The service supports both **Puppeteer** and **Playwright** browser engines:

- **Puppeteer**: Default engine, mature and well-tested
- **Playwright**: Alternative engine with similar capabilities

**Supported engine values:**

- `puppeteer` or `pptr` - Use Puppeteer
- `playwright` or `pw` - Use Playwright

## Development

### Available Commands

- `npm run dev` - Start the development server with hot reloading
- `npm run start` - Start the service using Docker Compose
- `npm test` - Run all unit tests
- `npm run lint` - Check code with ESLint
- `npm run format` - Format code with Prettier

### Testing

```bash
npm test                    # Run unit tests
npm run test:e2e            # Run end-to-end tests
npm run test:all            # Run all tests including build
```

## Built With

- Express.js for the web server
- Puppeteer and Playwright for headless browser automation
- Turndown for HTML to Markdown conversion
- Jest for testing

## License

UNLICENSED
