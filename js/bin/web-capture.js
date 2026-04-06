#!/usr/bin/env node
// CLI entry point for web-capture
// Supports two modes:
// 1. Server mode: web-capture --serve [--port 3000]
// 2. Capture mode: web-capture <url> [options]

import fs from 'fs';
import { URL } from 'node:url';
import { makeConfig } from 'lino-arguments';

// Create configuration using lino-arguments pattern
const config = makeConfig({
  yargs: ({ yargs, getenv }) =>
    yargs
      .usage(
        'web-capture - Capture web pages as HTML, Markdown, or PNG\n\nUsage:\n  web-capture --serve [--port <port>]       Start as API server\n  web-capture <url> [options]               Capture a URL to file/stdout'
      )
      .option('serve', {
        alias: 's',
        type: 'boolean',
        description: 'Start as HTTP API server',
        default: false,
      })
      .option('port', {
        alias: 'p',
        type: 'number',
        description: 'Port to listen on (default: 3000, or PORT env)',
        // Don't use getenv here - let yargs read from process.env.PORT directly
        // which will be set by the test or by lino-arguments from .lenv
        default: 3000,
      })
      .option('format', {
        alias: 'f',
        type: 'string',
        description:
          'Output format: html, markdown, md, image, png, jpeg, pdf, docx, archive',
        default: 'html',
      })
      .option('theme', {
        alias: 't',
        type: 'string',
        description:
          'Color scheme for screenshots/PDF: light, dark, no-preference',
      })
      .option('width', {
        type: 'number',
        description: 'Viewport width in pixels (default: 1280)',
        default: 1280,
      })
      .option('height', {
        type: 'number',
        description: 'Viewport height in pixels (default: 800)',
        default: 800,
      })
      .option('quality', {
        type: 'number',
        description: 'JPEG quality 0-100 (default: 80, only for jpeg format)',
        default: 80,
      })
      .option('fullPage', {
        type: 'boolean',
        description: 'Capture full scrollable page (default: false)',
        default: false,
      })
      .option('localImages', {
        type: 'boolean',
        description: 'Download images locally in archive mode (default: true)',
        default: true,
      })
      .option('documentFormat', {
        type: 'string',
        description:
          'Document format in archive mode: markdown (default) or html',
        default: 'markdown',
      })
      .option('output', {
        alias: 'o',
        type: 'string',
        description:
          'Output file path (default: stdout for text, auto-generated for images)',
      })
      .option('engine', {
        alias: 'e',
        type: 'string',
        description: 'Browser engine: puppeteer, playwright',
        default: getenv('BROWSER_ENGINE', 'puppeteer'),
      })
      .option('configuration', {
        type: 'string',
        description: 'Path to .lenv configuration file',
      })
      .help('help')
      .alias('help', 'h')
      .version()
      .alias('version', 'v')
      .example('web-capture --serve', 'Start API server on port 3000')
      .example(
        'web-capture --serve --port 8080',
        'Start API server on custom port'
      )
      .example(
        'web-capture https://example.com',
        'Capture URL as HTML to stdout'
      )
      .example(
        'web-capture https://example.com --format markdown --output page.md',
        'Capture URL as Markdown to file'
      )
      .example(
        'web-capture https://example.com --format png --engine playwright -o screenshot.png',
        'Capture screenshot using Playwright'
      )
      .epilogue(
        'API Endpoints (in server mode):\n  GET /html?url=<URL>&engine=<ENGINE>           Get rendered HTML\n  GET /markdown?url=<URL>                       Get Markdown conversion\n  GET /image?url=<URL>&format=png|jpeg&theme=light|dark  Screenshot\n  GET /archive?url=<URL>&localImages=true&documentFormat=markdown|html  ZIP archive\n  GET /pdf?url=<URL>&theme=light|dark           PDF with embedded images\n  GET /docx?url=<URL>                           DOCX with embedded images\n  GET /fetch?url=<URL>                          Proxy fetch\n  GET /stream?url=<URL>                         Streaming proxy'
      )
      .strict(),
  lenv: {
    enabled: true,
    path: '.lenv',
  },
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
      console.log(`  GET /image?url=<URL>      - Screenshot (PNG/JPEG)`);
      console.log(
        `  GET /archive?url=<URL>    - ZIP archive with markdown + images`
      );
      console.log(`  GET /pdf?url=<URL>        - PDF with embedded images`);
      console.log(`  GET /docx?url=<URL>       - DOCX with embedded images`);
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
  const {
    format,
    output,
    engine,
    theme,
    width,
    height,
    quality,
    fullPage,
    // localImages is used by archive format
    // eslint-disable-next-line no-unused-vars
    localImages,
  } = options;

  // Ensure URL is absolute
  let absoluteUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    absoluteUrl = `https://${url}`;
  }

  // Validate URL
  try {
    new URL(absoluteUrl);
  } catch {
    console.error(`Error: Invalid URL "${url}"`);
    process.exit(1);
  }

  // Import required modules
  const {
    fetchHtml,
    convertHtmlToMarkdown,
    convertToUtf8,
    convertRelativeUrls,
  } = await import('../src/lib.js');
  const { createBrowser } = await import('../src/browser.js');

  const normalizedFormat = format.toLowerCase();

  try {
    if (normalizedFormat === 'jpeg') {
      // JPEG screenshot
      const { createBrowser } = await import('../src/browser.js');
      const { dismissPopups, scrollToLoadContent } =
        await import('../src/popups.js');
      const browserOpts = theme ? { colorScheme: theme } : {};
      const browser = await createBrowser(engine, browserOpts);
      try {
        const page = await browser.newPage();
        await page.setViewport({ width, height });
        await page.goto(absoluteUrl, {
          waitUntil: 'networkidle0',
          timeout: 30000,
        });
        await new Promise((resolve) => setTimeout(resolve, 5000));
        if (fullPage) {
          await scrollToLoadContent(page);
        }
        await dismissPopups(page);
        const buffer = await page.screenshot({
          type: 'jpeg',
          quality,
          fullPage,
        });
        const outPath =
          output ||
          `${new URL(absoluteUrl).hostname.replace(/\./g, '_')}_${Date.now()}.jpg`;
        fs.writeFileSync(outPath, buffer);
        console.error(`JPEG screenshot saved to: ${outPath}`);
      } finally {
        await browser.close();
      }
    } else if (normalizedFormat === 'pdf') {
      // PDF export
      const { createBrowser } = await import('../src/browser.js');
      const { dismissPopups, scrollToLoadContent } =
        await import('../src/popups.js');
      const browserOpts = theme ? { colorScheme: theme } : {};
      const browser = await createBrowser(engine, browserOpts);
      try {
        const page = await browser.newPage();
        await page.setViewport({ width, height });
        await page.goto(absoluteUrl, {
          waitUntil: 'networkidle0',
          timeout: 30000,
        });
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await scrollToLoadContent(page);
        await dismissPopups(page);
        const rawPage = page.rawPage || page;
        const pdfBuffer = await rawPage.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
        });
        const outPath = output || 'page.pdf';
        fs.writeFileSync(outPath, pdfBuffer);
        console.error(`PDF saved to: ${outPath}`);
      } finally {
        await browser.close();
      }
    } else if (normalizedFormat === 'docx') {
      // DOCX export – delegate to the docx handler logic
      const { fetchHtml, convertRelativeUrls } = await import('../src/lib.js');
      const cheerio = await import('cheerio');
      // eslint-disable-next-line no-unused-vars
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } =
        await import('docx');
      const html = await fetchHtml(absoluteUrl);
      const absHtml = convertRelativeUrls(html, absoluteUrl);
      const $ = cheerio.load(absHtml);
      $('style, script, noscript, nav, footer, header').remove();
      const children = [];
      const titleText =
        $('h1').first().text().trim() || $('title').text().trim();
      if (titleText) {
        children.push(
          new Paragraph({ text: titleText, heading: HeadingLevel.TITLE })
        );
      }
      const body = $('article').length ? $('article') : $('body');
      for (const el of body.children().toArray()) {
        const text = $(el).text().trim();
        if (text) {
          children.push(new Paragraph({ text }));
        }
      }
      if (children.length === 0) {
        children.push(new Paragraph({ text: 'No content extracted.' }));
      }
      const doc = new Document({ sections: [{ children }] });
      const buffer = await Packer.toBuffer(doc);
      const outPath = output || 'page.docx';
      fs.writeFileSync(outPath, buffer);
      console.error(`DOCX saved to: ${outPath}`);
    } else if (normalizedFormat === 'archive' || normalizedFormat === 'zip') {
      // ZIP archive
      const { default: archiver } = await import('archiver');
      const { fetchHtml, convertHtmlToMarkdown, convertRelativeUrls } =
        await import('../src/lib.js');
      const { retry } = await import('../src/retry.js');
      const cheerio = await import('cheerio');
      const nodeFetch = await import('node-fetch');

      const html = await retry(() => fetchHtml(absoluteUrl), {
        retries: 3,
        baseDelay: 1000,
        onRetry: (err, attempt) => {
          console.error(`Retry ${attempt} fetching page: ${err.message}`);
        },
      });

      const docFormat = options.documentFormat === 'html' ? 'html' : 'markdown';
      const outPath =
        output ||
        `${new URL(absoluteUrl).hostname.replace(/\./g, '-')}-archive.zip`;
      const outStream = fs.createWriteStream(outPath);
      const archive = archiver.default
        ? archiver.default('zip', { zlib: { level: 9 } })
        : archiver('zip', { zlib: { level: 9 } });
      archive.pipe(outStream);

      // Collect images
      const $ = cheerio.load(html);
      const images = [];
      $('img').each(function () {
        const src = $(this).attr('src');
        if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
          try {
            images.push(new URL(src, absoluteUrl).href);
          } catch {
            /* skip */
          }
        }
      });
      const uniqueImages = [...new Set(images)];

      // Build image map for local downloads
      const imageMap = new Map();
      if (options.localImages && uniqueImages.length > 0) {
        let idx = 1;
        for (const imgUrl of uniqueImages) {
          const ext = imgUrl.match(/\.(jpe?g|gif|webp|svg|png)/i)?.[1] || 'png';
          imageMap.set(imgUrl, `images/image-${idx}.${ext}`);
          idx++;
        }
      }

      if (docFormat === 'html') {
        const outputHtml = convertRelativeUrls(html, absoluteUrl);
        const $out = cheerio.load(outputHtml);
        $out('script, noscript').remove();
        if (imageMap.size > 0) {
          $out('img').each(function () {
            const src = $out(this).attr('src');
            if (src) {
              try {
                const resolved = new URL(src, absoluteUrl).href;
                if (imageMap.has(resolved)) {
                  $out(this).attr('src', imageMap.get(resolved));
                }
              } catch {
                /* skip */
              }
            }
          });
        }
        archive.append($out.html(), { name: 'article.html' });
      } else {
        let markdown = convertHtmlToMarkdown(html, absoluteUrl);
        if (imageMap.size > 0) {
          for (const [remoteUrl, localPath] of imageMap) {
            markdown = markdown.split(remoteUrl).join(localPath);
          }
        }
        archive.append(markdown, { name: 'article.md' });
      }

      // Download images
      if (imageMap.size > 0) {
        for (const [imgUrl, localPath] of imageMap) {
          try {
            const fetchFn = nodeFetch.default || nodeFetch;
            const resp = await retry(() => fetchFn(imgUrl), {
              retries: 2,
              baseDelay: 500,
            });
            if (resp.ok) {
              const buffer = await resp.buffer();
              archive.append(buffer, { name: localPath });
            }
          } catch {
            /* skip failed image downloads */
          }
        }
      }

      await archive.finalize();
      await new Promise((resolve) => outStream.on('close', resolve));
      console.error(`Archive saved to: ${outPath}`);
    } else if (normalizedFormat === 'markdown' || normalizedFormat === 'md') {
      // Markdown format
      const html = await fetchHtml(absoluteUrl);
      const markdown = convertHtmlToMarkdown(html, absoluteUrl);

      if (output) {
        fs.writeFileSync(output, markdown, 'utf-8');
        console.error(`Markdown saved to: ${output}`);
      } else {
        process.stdout.write(markdown);
      }
    } else if (
      normalizedFormat === 'image' ||
      normalizedFormat === 'png' ||
      normalizedFormat === 'screenshot'
    ) {
      // Image/screenshot format
      const browser = await createBrowser(engine);
      try {
        const page = await browser.newPage();
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Charset': 'utf-8',
        });
        await page.setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
        await page.setViewport({ width: 1280, height: 800 });
        await page.goto(absoluteUrl, {
          waitUntil: 'networkidle0',
          timeout: 30000,
        });
        // Wait for 5 seconds after page load
        await new Promise((resolve) => setTimeout(resolve, 5000));

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
      const hasJavaScript =
        /<script[^>]*>[\s\S]*?<\/script>|<script[^>]*\/>|javascript:/i.test(
          html
        );
      const isHtml = /<html[^>]*>[\s\S]*?<\/html>/i.test(html);

      let resultHtml;

      if (!isHtml || hasJavaScript) {
        // Use browser to get rendered HTML
        const browser = await createBrowser(engine);
        try {
          const page = await browser.newPage();
          await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Charset': 'utf-8',
          });
          await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          );
          await page.setViewport({ width: 1280, height: 800 });
          await page.goto(absoluteUrl, {
            waitUntil: 'networkidle0',
            timeout: 30000,
          });
          // Wait for 5 seconds after page load
          await new Promise((resolve) => setTimeout(resolve, 5000));

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
      engine: config.engine,
      theme: config.theme,
      width: config.width,
      height: config.height,
      quality: config.quality,
      fullPage: config.fullPage,
      localImages: config.localImages,
      documentFormat: config.documentFormat,
    });
  } else {
    // No arguments - show error
    console.error('Error: Missing URL or --serve flag');
    console.error('Run with --help for usage information');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
