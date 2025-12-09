#!/usr/bin/env node
// CLI entry point for web-capture
// Supports two modes:
// 1. Server mode: web-capture --serve [--port 3000]
// 2. Capture mode: web-capture <url> [options]

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';
import { URL } from 'url';
import { makeConfig } from 'lino-arguments';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create configuration using lino-arguments pattern
const config = makeConfig({
  yargs: ({ yargs, getenv }) => {
    return yargs
      .usage('web-capture - Capture web pages as HTML, Markdown, or PNG\n\nUsage:\n  web-capture --serve [--port <port>]       Start as API server\n  web-capture <url> [options]               Capture a URL to file/stdout')
      .option('serve', {
        alias: 's',
        type: 'boolean',
        description: 'Start as HTTP API server',
        default: false
      })
      .option('port', {
        alias: 'p',
        type: 'number',
        description: 'Port to listen on (default: 3000, or PORT env)',
        default: getenv('PORT', 3000)
      })
      .option('format', {
        alias: 'f',
        type: 'string',
        description: 'Output format: html, markdown, md, image, png',
        default: 'html'
      })
      .option('output', {
        alias: 'o',
        type: 'string',
        description: 'Output file path (default: stdout for text, auto-generated for images)'
      })
      .option('engine', {
        alias: 'e',
        type: 'string',
        description: 'Browser engine: puppeteer, playwright',
        default: getenv('BROWSER_ENGINE', 'puppeteer')
      })
      .option('configuration', {
        type: 'string',
        description: 'Path to .lenv configuration file'
      })
      .help('help')
      .alias('help', 'h')
      .version()
      .alias('version', 'v')
      .example('web-capture --serve', 'Start API server on port 3000')
      .example('web-capture --serve --port 8080', 'Start API server on custom port')
      .example('web-capture https://example.com', 'Capture URL as HTML to stdout')
      .example('web-capture https://example.com --format markdown --output page.md', 'Capture URL as Markdown to file')
      .example('web-capture https://example.com --format png --engine playwright -o screenshot.png', 'Capture screenshot using Playwright')
      .epilogue('API Endpoints (in server mode):\n  GET /html?url=<URL>&engine=<ENGINE>       Get rendered HTML\n  GET /markdown?url=<URL>                   Get Markdown conversion\n  GET /image?url=<URL>&engine=<ENGINE>      Get PNG screenshot\n  GET /fetch?url=<URL>                      Proxy fetch\n  GET /stream?url=<URL>                     Streaming proxy')
      .strict();
  },
  lenv: {
    enabled: true,
    path: '.lenv'
  }
});

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
  // Get positional arguments (non-option arguments)
  const url = config._ && config._.length > 0 ? config._[0] : null;

  if (config.serve) {
    // Server mode
    await startServer(config.port);
  } else if (url) {
    // Capture mode
    await captureUrl(url, {
      format: config.format,
      output: config.output,
      engine: config.engine
    });
  } else {
    // No arguments - show error
    console.error('Error: Missing URL or --serve flag');
    console.error('Run with --help for usage information');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
