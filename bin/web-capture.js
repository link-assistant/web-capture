#!/usr/bin/env node
// CLI entry point for web-capture
// Supports two modes:
// 1. Server mode: web-capture --serve [--port 3000]
// 2. Capture mode: web-capture <url> [options]

import { fileURLToPath } from 'url';
import { dirname, resolve, basename } from 'path';
import fs from 'fs';
import { URL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
function parseArgs(argv) {
  const args = {
    serve: false,
    port: parseInt(process.env.PORT, 10) || 3000,
    url: null,
    format: 'html',
    output: null,
    engine: process.env.BROWSER_ENGINE || 'puppeteer',
    help: false,
    version: false
  };

  const positionalArgs = [];

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--serve' || arg === '-s') {
      args.serve = true;
    } else if (arg === '--port' || arg === '-p') {
      args.port = parseInt(argv[++i], 10) || 3000;
    } else if (arg === '--format' || arg === '-f') {
      args.format = argv[++i] || 'html';
    } else if (arg === '--output' || arg === '-o') {
      args.output = argv[++i];
    } else if (arg === '--engine' || arg === '-e') {
      args.engine = argv[++i] || 'puppeteer';
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--version' || arg === '-v') {
      args.version = true;
    } else if (!arg.startsWith('-')) {
      positionalArgs.push(arg);
    }
  }

  if (positionalArgs.length > 0) {
    args.url = positionalArgs[0];
  }

  return args;
}

function showHelp() {
  console.log(`
web-capture - Capture web pages as HTML, Markdown, or PNG

Usage:
  web-capture --serve [--port <port>]       Start as API server
  web-capture <url> [options]               Capture a URL to file/stdout

Server Mode:
  --serve, -s                 Start as HTTP API server
  --port, -p <port>           Port to listen on (default: 3000, or PORT env)

Capture Mode:
  <url>                       URL to capture
  --format, -f <format>       Output format: html, markdown, md, image, png
                              (default: html)
  --output, -o <file>         Output file path (default: stdout for text,
                              auto-generated filename for images)
  --engine, -e <engine>       Browser engine: puppeteer, playwright
                              (default: puppeteer, or BROWSER_ENGINE env)

Other Options:
  --help, -h                  Show this help message
  --version, -v               Show version number

Examples:
  # Start API server on port 3000
  web-capture --serve

  # Start API server on custom port
  web-capture --serve --port 8080

  # Capture URL as HTML to stdout
  web-capture https://example.com

  # Capture URL as Markdown to file
  web-capture https://example.com --format markdown --output page.md

  # Capture screenshot using Playwright
  web-capture https://example.com --format png --engine playwright -o screenshot.png

API Endpoints (in server mode):
  GET /html?url=<URL>&engine=<ENGINE>       Get rendered HTML
  GET /markdown?url=<URL>                   Get Markdown conversion
  GET /image?url=<URL>&engine=<ENGINE>      Get PNG screenshot
  GET /fetch?url=<URL>                      Proxy fetch
  GET /stream?url=<URL>                     Streaming proxy
`);
}

async function showVersion() {
  try {
    const packagePath = resolve(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    console.log(`web-capture v${packageJson.version}`);
  } catch (err) {
    console.log('web-capture v1.0.0');
  }
}

async function startServer(port) {
  // Import the Express app
  const { app } = await import('../src/index.js');

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`web-capture server listening on http://localhost:${port}`);
      console.log('');
      console.log('Available endpoints:');
      console.log(`  GET /html?url=<URL>       - Render page as HTML`);
      console.log(`  GET /markdown?url=<URL>   - Convert page to Markdown`);
      console.log(`  GET /image?url=<URL>      - Screenshot page as PNG`);
      console.log(`  GET /fetch?url=<URL>      - Proxy fetch content`);
      console.log(`  GET /stream?url=<URL>     - Stream content`);
      console.log('');
      console.log('Press Ctrl+C to stop the server');
      resolve(server);
    });

    server.on('error', reject);

    // Handle graceful shutdown
    function shutdown(signal) {
      console.log(`\nReceived ${signal}, shutting down...`);
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
      // Force exit if not closed in 2 seconds
      setTimeout(() => {
        console.error('Force exiting after 2s');
        process.exit(1);
      }, 2000);
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  });
}

async function captureUrl(url, options) {
  const { format, output, engine } = options;

  // Ensure URL is absolute
  let absoluteUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    absoluteUrl = `https://${url}`;
  }

  // Validate URL
  try {
    new URL(absoluteUrl);
  } catch (err) {
    console.error(`Error: Invalid URL "${url}"`);
    process.exit(1);
  }

  // Import required modules
  const { fetchHtml, convertHtmlToMarkdown, convertToUtf8, convertRelativeUrls } = await import('../src/lib.js');
  const { createBrowser } = await import('../src/browser.js');

  const normalizedFormat = format.toLowerCase();

  try {
    if (normalizedFormat === 'markdown' || normalizedFormat === 'md') {
      // Markdown format
      const html = await fetchHtml(absoluteUrl);
      const markdown = convertHtmlToMarkdown(html, absoluteUrl);

      if (output) {
        fs.writeFileSync(output, markdown, 'utf-8');
        console.error(`Markdown saved to: ${output}`);
      } else {
        process.stdout.write(markdown);
      }
    } else if (normalizedFormat === 'image' || normalizedFormat === 'png' || normalizedFormat === 'screenshot') {
      // Image/screenshot format
      const browser = await createBrowser(engine);
      try {
        const page = await browser.newPage();
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Charset': 'utf-8'
        });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 800 });
        await page.goto(absoluteUrl, {
          waitUntil: 'networkidle0',
          timeout: 30000
        });
        // Wait for 5 seconds after page load
        await new Promise(resolve => setTimeout(resolve, 5000));

        const buffer = await page.screenshot({ type: 'png' });

        if (output) {
          fs.writeFileSync(output, buffer);
          console.error(`Screenshot saved to: ${output}`);
        } else {
          // Generate default filename based on URL
          const urlObj = new URL(absoluteUrl);
          const defaultFilename = `${urlObj.hostname.replace(/\./g, '_')}_${Date.now()}.png`;
          fs.writeFileSync(defaultFilename, buffer);
          console.error(`Screenshot saved to: ${defaultFilename}`);
        }
      } finally {
        await browser.close();
      }
    } else {
      // HTML format (default)
      const html = await fetchHtml(absoluteUrl);
      const hasJavaScript = /<script[^>]*>[\s\S]*?<\/script>|<script[^>]*\/>|javascript:/i.test(html);
      const isHtml = /<html[^>]*>[\s\S]*?<\/html>/i.test(html);

      let resultHtml;

      if (!isHtml || hasJavaScript) {
        // Use browser to get rendered HTML
        const browser = await createBrowser(engine);
        try {
          const page = await browser.newPage();
          await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Charset': 'utf-8'
          });
          await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
          await page.setViewport({ width: 1280, height: 800 });
          await page.goto(absoluteUrl, {
            waitUntil: 'networkidle0',
            timeout: 30000
          });
          // Wait for 5 seconds after page load
          await new Promise(resolve => setTimeout(resolve, 5000));

          const renderedHtml = await page.content();
          const utf8Html = convertToUtf8(renderedHtml);
          resultHtml = convertRelativeUrls(utf8Html, absoluteUrl);
        } finally {
          await browser.close();
        }
      } else {
        // Plain HTML without JavaScript
        const utf8Html = convertToUtf8(html);
        resultHtml = convertRelativeUrls(utf8Html, absoluteUrl);
      }

      if (output) {
        fs.writeFileSync(output, resultHtml, 'utf-8');
        console.error(`HTML saved to: ${output}`);
      } else {
        process.stdout.write(resultHtml);
      }
    }
  } catch (err) {
    console.error(`Error capturing ${absoluteUrl}: ${err.message}`);
    process.exit(1);
  }
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  if (args.version) {
    await showVersion();
    process.exit(0);
  }

  if (args.serve) {
    // Server mode
    await startServer(args.port);
  } else if (args.url) {
    // Capture mode
    await captureUrl(args.url, {
      format: args.format,
      output: args.output,
      engine: args.engine
    });
  } else {
    // No arguments - show help
    showHelp();
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
