/**
 * Integration test for converting the DeepWiki search page from issue #17.
 *
 * The page is JavaScript-rendered, so this suite verifies the /markdown
 * endpoint captures rendered content instead of the initial Next.js shell.
 *
 * Set DEEPWIKI_INTEGRATION=true to run it. The suite is skipped by default so
 * local/offline test runs remain deterministic.
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { fileURLToPath } from 'url';
import { app } from '../../src/index.js';
import { retry } from '../../src/retry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEEPWIKI_URL =
  'https://deepwiki.com/search/-57-4-23-57_0e4aa687-7a9d-4591-8c6f-67c4b2d732f6';
const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures', 'deepwiki');
const INLINE_MARKDOWN_LINE_LIMIT = 1500;
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const ORDERED_CONTENT_MARKERS = [
  'Search | DeepWiki',
  'deep-assistant/hive-mind',
  'расскажи пожалуйста на английском',
  'Deep\n\nThought Process',
  '# Hive Mind: A Comprehensive Overview of an AI Agent System for Software Development',
  '## Executive Summary',
  '## I. Foundational Philosophy: Human-AI Collaboration Model',
  '## II. Architectural Layers: The Three-Tier Design',
  '## III. Original Ideas and Innovations',
  'Innovation 1: The Task Clarification System',
  'Innovation 2: Multi-Dimensional Feedback Detection',
  'Innovation 3: Thinking Depth Control',
  '## IV. The Workflow Logic: How Everything Connects',
  '## XI. Practical Implications: What This Enables',
];

const SKIP_LIVE =
  !process.env.DEEPWIKI_INTEGRATION ||
  process.env.DEEPWIKI_INTEGRATION === 'false';
const describeIfLive = SKIP_LIVE ? describe.skip : describe;

jest.setTimeout(180000);

function readFixtureChunks() {
  return ['index.md', 'part-1.md'].map((filename) =>
    fs.readFileSync(path.join(FIXTURE_DIR, filename), 'utf8')
  );
}

function splitMarkdown(markdown) {
  const lines = markdown.split('\n');
  const chunks = [];
  for (
    let index = 0;
    index < lines.length;
    index += INLINE_MARKDOWN_LINE_LIMIT
  ) {
    chunks.push(
      lines.slice(index, index + INLINE_MARKDOWN_LINE_LIMIT).join('\n')
    );
  }
  return chunks;
}

function expectMarkersInOrder(markdown, markers) {
  let previousIndex = -1;
  for (const marker of markers) {
    const index = markdown.indexOf(marker);
    expect(index).toBeGreaterThan(previousIndex);
    previousIndex = index;
  }
}

async function getDeepwikiMarkdown() {
  const response = await retry(
    () =>
      request(app)
        .get('/markdown')
        .query({ url: DEEPWIKI_URL, engine: 'playwright' })
        .expect(200),
    {
      retries: 2,
      baseDelay: 3000,
      onRetry: (err, attempt, delay) => {
        console.log(
          `Retry ${attempt} for DeepWiki markdown after ${delay}ms: ${err.message}`
        );
      },
    }
  );

  expect(response.headers['content-type']).toMatch(/text\/markdown/);
  return response.text;
}

describe('DeepWiki committed reference fixtures (issue #17)', () => {
  it('stores markdown split into inline-sized reference documents', () => {
    const fixtureChunks = readFixtureChunks();
    const fixtureMarkdown = fixtureChunks.join('\n');

    expect(fixtureChunks).toHaveLength(2);
    expect(fixtureChunks[0].split('\n').length).toBeLessThanOrEqual(
      INLINE_MARKDOWN_LINE_LIMIT
    );
    expect(fixtureChunks[1].split('\n').length).toBeGreaterThan(0);
    expect(fixtureMarkdown.split('\n').length).toBeGreaterThan(
      INLINE_MARKDOWN_LINE_LIMIT
    );
    expectMarkersInOrder(fixtureMarkdown, ORDERED_CONTENT_MARKERS);
  });

  it('keeps the full-page screenshot fixture as a PNG visual reference', () => {
    const screenshot = fs.readFileSync(
      path.join(FIXTURE_DIR, 'deepwiki-full-page.png')
    );

    expect(screenshot.subarray(0, PNG_SIGNATURE.length)).toEqual(PNG_SIGNATURE);
    expect(screenshot.length).toBeGreaterThan(100000);
  });
});

describeIfLive('DeepWiki search page markdown capture (issue #17)', () => {
  it('matches the committed markdown fixture split from the rendered page', async () => {
    const markdown = await getDeepwikiMarkdown();
    const fixtureChunks = readFixtureChunks();
    const fixtureMarkdown = fixtureChunks.join('\n');

    expect(markdown).not.toMatch(/<html/i);
    expect(markdown).not.toContain('__NEXT_DATA__');
    expect(markdown.split('\n').length).toBeGreaterThan(
      INLINE_MARKDOWN_LINE_LIMIT
    );
    expectMarkersInOrder(markdown, ORDERED_CONTENT_MARKERS);
    expectMarkersInOrder(fixtureMarkdown, ORDERED_CONTENT_MARKERS);
    expect(splitMarkdown(markdown)).toEqual(fixtureChunks);
  }, 180000);
});
