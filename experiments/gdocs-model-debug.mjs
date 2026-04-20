import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(new URL("../js/package.json", import.meta.url));
const { chromium } = require("playwright");

const DOC_ID = "1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM";
const DOC_URL = `https://docs.google.com/document/d/${DOC_ID}/edit`;
const OUT_DIR = path.resolve("docs/case-studies/issue-90/logs");

await fs.promises.mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});

const page = await browser.newPage({
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  viewport: { width: 1280, height: 800 },
  extraHTTPHeaders: {
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Charset": "utf-8",
  },
});

await page.addInitScript(() => {
  const captured = [];
  const captureChunk = (value) => {
    if (!value) {
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        captureChunk(item);
      }
      return;
    }
    try {
      captured.push(JSON.parse(JSON.stringify(value)));
    } catch {
      captured.push(value);
    }
  };
  const wrapArray = (value) => {
    if (!Array.isArray(value) || value.__webCaptureWrapped) {
      return value;
    }
    const originalPush = value.push;
    Object.defineProperty(value, "__webCaptureWrapped", {
      value: true,
      enumerable: false,
    });
    Object.defineProperty(value, "push", {
      value(...args) {
        for (const arg of args) {
          captureChunk(arg);
        }
        return originalPush.apply(this, args);
      },
      writable: true,
      configurable: true,
    });
    for (const existing of value) {
      captureChunk(existing);
    }
    return value;
  };

  Object.defineProperty(window, "__captured_chunks", {
    value: captured,
    configurable: false,
  });

  let latest = wrapArray([]);
  Object.defineProperty(window, "DOCS_modelChunk", {
    set(value) {
      captureChunk(value);
      latest = wrapArray(value);
    },
    get() {
      return latest;
    },
    configurable: false,
  });
});

const responses = [];
let editorHtml = "";
page.on("response", async (response) => {
  const url = response.url();
  if (url === DOC_URL) {
    try {
      editorHtml = await response.text();
    } catch {
      editorHtml = "";
    }
  }
  if (
    url.includes("DOCS_modelChunk") ||
    url.includes("/edit") ||
    url.includes("kix") ||
    url.includes("drivesharing")
  ) {
    responses.push({
      status: response.status(),
      url,
      contentType: response.headers()["content-type"] || "",
    });
  }
});

await page.goto(DOC_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(12000);

const result = await page.evaluate(() => {
  const chunks = window.__captured_chunks || [];
  const latest = window.DOCS_modelChunk;
  const scripts = Array.from(document.querySelectorAll("script")).map(
    (script, index) => ({
      index,
      length: (script.textContent || "").length,
      hasModelChunk: (script.textContent || "").includes("DOCS_modelChunk"),
      hasPush: (script.textContent || "").includes("DOCS_modelChunk.push"),
      preview: (script.textContent || "").slice(0, 1000),
    }),
  );
  return {
    location: location.href,
    title: document.title,
    capturedLength: chunks.length,
    latestIsArray: Array.isArray(latest),
    latestLength: Array.isArray(latest) ? latest.length : null,
    firstChunkPreview: chunks[0]
      ? JSON.stringify(chunks[0]).slice(0, 2000)
      : null,
    scriptCount: scripts.length,
    scriptsWithModel: scripts.filter((script) => script.hasModelChunk),
  };
});

const content = await page.content();
await fs.promises.writeFile(
  path.join(OUT_DIR, "gdocs-browser-content.html"),
  content,
);
await fs.promises.writeFile(
  path.join(OUT_DIR, "gdocs-editor-response.html"),
  editorHtml,
);

await fs.promises.writeFile(
  path.join(OUT_DIR, "gdocs-model-debug.json"),
  JSON.stringify(
    {
      result: {
        ...result,
        browserContentHasModelChunk: content.includes("DOCS_modelChunk"),
        editorResponseHasModelChunk: editorHtml.includes("DOCS_modelChunk"),
        editorResponseBytes: editorHtml.length,
      },
      responses,
    },
    null,
    2,
  ),
);

console.log(JSON.stringify(result, null, 2));

await browser.close();
