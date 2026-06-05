#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const input =
  process.argv[2] ||
  'docs/case-studies/issue-108/experiments/model-dump/model-data.json';
const output =
  process.argv[3] ||
  'docs/case-studies/issue-108/experiments/model-analysis.json';

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

function lineEnd(text, needle) {
  const start = text.lastIndexOf(needle);
  if (start < 0) {
    return null;
  }
  const end = text.indexOf('\n', start);
  return end < 0 ? text.length : end + 1;
}

const modelData = JSON.parse(await fs.readFile(input, 'utf8'));
const items = collectItems(modelData.chunks);
const fullText = items
  .filter((item) => item.ty === 'is' || item.ty === 'iss')
  .map((item) => item.s || '')
  .join('');

const probes = [
  'Apple',
  'Banana',
  'Cherry',
  'Step one',
  'Continuation paragraph that is not a list item. Same indent as Step one.',
  'Step two',
  'Red',
  'Green',
  'Blue',
];

const records = probes.map((needle) => {
  const end = lineEnd(fullText, needle);
  return {
    needle,
    end,
    lists: items
      .filter((item) => item.ty === 'as' && item.st === 'list' && item.ei === end)
      .map((item) => item.sm || {}),
    paragraphs: items
      .filter(
        (item) => item.ty === 'as' && item.st === 'paragraph' && item.ei === end
      )
      .map((item) => item.sm || {}),
    textStyles: items
      .filter((item) => item.ty === 'as' && item.st === 'text' && item.ei >= end)
      .slice(0, 3)
      .map((item) => ({ si: item.si, ei: item.ei, sm: item.sm || {} })),
  };
});

const stylesWithListMarkerFields = items
  .filter((item) => item.ty === 'as' && item.st === 'list')
  .filter((item) =>
    Object.keys(item.sm || {}).some((key) => /^ls_(?!id$|nest$)/u.test(key))
  )
  .map((item) => item.sm);

const result = {
  chunkCount: modelData.chunks?.length || 0,
  itemCount: items.length,
  fullTextBytes: Buffer.byteLength(fullText),
  records,
  distinctListRecords: [
    ...new Map(
      items
        .filter((item) => item.ty === 'as' && item.st === 'list')
        .map((item) => [JSON.stringify(item.sm || {}), item.sm || {}])
    ).values(),
  ],
  stylesWithListMarkerFields,
};

await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Wrote ${output}`);
