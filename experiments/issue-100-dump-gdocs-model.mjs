#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { createBrowser } from '../js/src/browser.js';
import {
  buildEditUrl,
  extractDocumentId,
  parseGoogleDocsModelChunks,
} from '../js/src/gdocs.js';

const DEFAULT_URL =
  'https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit';
const url = process.argv[2] || DEFAULT_URL;
const outDir =
  process.argv[3] || 'docs/case-studies/issue-100/experiments/model-dump';

const INIT_SCRIPT = () => {
  window.__captured_chunks = [];
  const captureChunk = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const item of value) captureChunk(item);
      return;
    }
    try {
      window.__captured_chunks.push(JSON.parse(JSON.stringify(value)));
    } catch {
      window.__captured_chunks.push(value);
    }
  };
  const wrapChunkArray = (value) => {
    if (!Array.isArray(value) || value.__webCaptureDocsModelWrapped) {
      return value;
    }
    const originalPush = value.push;
    Object.defineProperty(value, '__webCaptureDocsModelWrapped', {
      value: true,
      enumerable: false,
    });
    Object.defineProperty(value, 'push', {
      value(...items) {
        for (const item of items) captureChunk(item);
        return originalPush.apply(this, items);
      },
      writable: true,
      configurable: true,
    });
    for (const item of value) captureChunk(item);
    return value;
  };
  Object.defineProperty(window, 'DOCS_modelChunk', {
    set(value) {
      captureChunk(value);
      window.__DOCS_modelChunk_latest = wrapChunkArray(value);
    },
    get() {
      return window.__DOCS_modelChunk_latest;
    },
    configurable: false,
  });
};

const EXTRACT_SCRIPT = () => {
  const chunks = [...(window.__captured_chunks || [])];
  if (
    window.DOCS_modelChunk &&
    chunks.length === 0 &&
    !chunks.includes(window.DOCS_modelChunk)
  ) {
    chunks.push(window.DOCS_modelChunk);
  }
  const cidUrlMap = {};
  const scripts = document.querySelectorAll('script');
  for (const script of scripts) {
    const text = script.textContent || '';
    if (!text.includes('docs-images-rt')) continue;
    const regex =
      /"([A-Za-z0-9_-]{20,})"\s*:\s*"(https:\/\/docs\.google\.com\/docs-images-rt\/[^"]+)"/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      cidUrlMap[match[1]] = match[2]
        .replace(/\\u003d/g, '=')
        .replace(/\\u0026/g, '&')
        .replace(/\\\//g, '/');
    }
  }
  return { chunks, cidUrlMap };
};

function collectItems(chunks) {
  const items = [];
  for (const chunk of chunks || []) {
    if (Array.isArray(chunk)) {
      items.push(...chunk);
    } else if (Array.isArray(chunk?.chunk)) {
      items.push(...chunk.chunk);
    } else if (chunk?.ty) {
      items.push(chunk);
    }
  }
  return items;
}

function visibleControlSummary(text) {
  return [...text]
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        return `<0x${code.toString(16).padStart(2, '0')}>`;
      }
      return ch;
    })
    .join('');
}

function lineEnd(text, needle) {
  const start = text.indexOf(needle);
  if (start < 0) return null;
  const end = text.indexOf('\n', start);
  return end < 0 ? text.length : end + 1;
}

await fs.mkdir(outDir, { recursive: true });

const documentId = extractDocumentId(url);
const editUrl = buildEditUrl(documentId);
const browser = await createBrowser(process.env.BROWSER_ENGINE || 'puppeteer');
let page;
try {
  page = await browser.newPage();
  await page.addInitScript(INIT_SCRIPT);
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Charset': 'utf-8',
  });
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(Number(process.env.WEB_CAPTURE_BROWSER_WAIT_MS || 8000));
  const modelData = await page.evaluate(EXTRACT_SCRIPT);
  const items = collectItems(modelData.chunks);
  const fullText = items
    .filter((item) => item.ty === 'is' || item.ty === 'iss')
    .map((item) => item.s || '')
    .join('');
  const capture = parseGoogleDocsModelChunks(
    modelData.chunks,
    modelData.cidUrlMap
  );

  const probes = [
    'Feature',
    'A',
    'Parent item 1',
    'Child item 1.1',
    'Grandchild item 1.2.1',
    'Unordered child A',
    'Ordered child 2.1',
  ];
  const listStyles = probes.map((needle) => {
    const end = lineEnd(fullText, needle);
    return {
      needle,
      end,
      styles: items
        .filter((item) => item.ty === 'as' && item.st === 'list' && item.ei === end)
        .map((item) => item.sm || {}),
    };
  });

  const controls = visibleControlSummary(fullText);
  const windows = ['Feature', 'A', 'x', 'y'].map((needle) => {
    const idx = controls.indexOf(needle);
    return {
      needle,
      excerpt: idx < 0 ? null : controls.slice(Math.max(0, idx - 80), idx + 220),
    };
  });

  await fs.writeFile(
    path.join(outDir, 'model-data.json'),
    JSON.stringify(modelData, null, 2)
  );
  await fs.writeFile(
    path.join(outDir, 'summary.json'),
    JSON.stringify(
      {
        chunkCount: modelData.chunks.length,
        itemCount: items.length,
        cidUrlCount: Object.keys(modelData.cidUrlMap).length,
        blockCount: capture.blocks.length,
        tableShapes: capture.tables.map((table) =>
          table.rows.map((row) => row.cells.length)
        ),
        imageCount: capture.images.length,
        listStyles,
        windows,
      },
      null,
      2
    )
  );
  console.error(`Wrote model dump to ${outDir}`);
} finally {
  if (page) {
    await page.close();
  }
  await browser.close();
}
