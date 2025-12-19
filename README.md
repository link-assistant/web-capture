# web-capture

<img width="1824" alt="Screenshot 2025-05-12 at 3 49 32 AM" src="https://github.com/user-attachments/assets/cbf63dec-7dcd-40e7-9d5d-eddc49fe6169" />

A CLI and microservice to fetch URLs and render them as:

- **HTML**: Rendered page content
- **Markdown**: Converted from HTML
- **PNG screenshot**: Full page capture

## Quick Start

### CLI Usage

```bash
# Install globally
npm install -g web-capture

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

## Installation

```bash
npm install
# or
yarn install
```

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

## Available Commands

### Development

- `yarn dev` - Start the development server with hot reloading using nodemon
- `yarn start` - Start the service using Docker Compose

### Testing

- `yarn test` - Run all unit tests
- `yarn test:watch` - Run tests in watch mode
- `yarn test:e2e` - Run end-to-end tests
- `yarn test:e2e:docker` - Run end-to-end tests against Docker container
- `yarn test:all` - Run all tests including build and e2e tests

### Building

- `yarn build` - Build and start the Docker container

### Examples

- `yarn examples:python` - Run Python example scripts
- `yarn examples:javascript` - Run JavaScript example scripts
- `yarn examples` - Run all examples (requires build)

## Usage

### Local Development

```bash
yarn dev
curl http://localhost:3000/html?url=https://example.com
```

### Docker

```bash
# Build and run using Docker Compose
yarn start

# Or manually
docker build -t web-capture .
docker run -p 3000:3000 web-capture
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

**Examples:**

```bash
# Using default Puppeteer engine
curl http://localhost:3000/html?url=https://example.com

# Using Playwright engine
curl http://localhost:3000/html?url=https://example.com&engine=playwright
```

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

**Examples:**

```bash
# Using default Puppeteer engine
curl http://localhost:3000/image?url=https://example.com > screenshot.png

# Using Playwright engine
curl http://localhost:3000/image?url=https://example.com&engine=playwright > screenshot.png
```

## Configuration

web-capture uses [lino-arguments](https://github.com/link-foundation/lino-arguments) for unified configuration management. Configuration values are resolved with the following priority (highest to lowest):

1. **CLI arguments**: `--port 8080`
2. **Environment variables**: `PORT=8080`
3. **Custom configuration file**: `--configuration path/to/custom.lenv`
4. **Default .lenv file**: `.lenv` in the project root
5. **Built-in defaults**

### Configuration File (.lenv)

Create a `.lenv` file in your project root using Links Notation format:

```lenv
# Server configuration
PORT: 3000

# Browser engine (puppeteer or playwright)
BROWSER_ENGINE: puppeteer
```

### Using Custom Configuration Files

Specify a custom configuration file path:

```bash
web-capture --serve --configuration /path/to/custom.lenv
```

### Environment Variables

All configuration options support environment variables:

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

You can choose the engine using:

- CLI argument: `--engine playwright`
- Environment variable: `BROWSER_ENGINE=playwright`
- Configuration file: `BROWSER_ENGINE: playwright` in `.lenv`

**Supported engine values:**

- `puppeteer` or `pptr` - Use Puppeteer
- `playwright` or `pw` - Use Playwright

## Development

The service is built with:

- Express.js for the web server
- Puppeteer and Playwright for headless browser automation and screenshots
- Turndown for HTML to Markdown conversion
- Jest for testing

## License

UNLICENSED
