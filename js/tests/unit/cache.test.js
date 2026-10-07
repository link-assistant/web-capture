import { jest } from '@jest/globals';
import { mkdtemp, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CaptureStore, CachedTransport } from '../../src/cache.js';
import { captureResponse } from '../../src/transport.js';

const request = {
  url: 'https://example.test/source',
  method: 'GET',
  headers: { accept: 'application/octet-stream' },
};
const receipt = {
  body: Buffer.from([0, 255, 65]),
  finalUrl: 'https://example.test/final',
  status: 206,
  headers: { etag: 'v1' },
  diagnostics: { outcome: 'response' },
};
let directory, store;
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'capture-cache-'));
  store = new CaptureStore(directory);
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

test('exact receipts survive cache hits, offline stale replay and online refresh', async () => {
  let time = 1000;
  const inner = jest.fn(async () => receipt);
  const options = { ttl: 100, now: () => time };
  const online = new CachedTransport(inner, store, options);
  const first = await online.capture(request);
  expect(first).toMatchObject({ cached: false, stale: false, receipt });
  expect(
    await captureResponse(request.url, {
      transport: online.execute,
      headers: request.headers,
    })
  ).toEqual(receipt);
  expect(inner).toHaveBeenCalledTimes(1);
  const forbidden = jest.fn(() => {
    throw new Error('offline network access');
  });
  const offline = new CachedTransport(forbidden, store, {
    ...options,
    offline: true,
  });
  expect(await offline.capture(request)).toMatchObject({
    cached: true,
    stale: false,
    receipt,
  });
  time = 1100;
  expect(await offline.capture(request)).toMatchObject({
    cached: true,
    stale: true,
    receipt,
  });
  expect(forbidden).not.toHaveBeenCalled();
  expect(await online.capture(request)).toMatchObject({
    cached: false,
    stale: false,
  });
  expect(inner).toHaveBeenCalledTimes(2);
  expect(await store.list()).toHaveLength(1);
  expect(await store.prune(1200, 100)).toBe(1);
  await expect(offline.capture(request)).rejects.toMatchObject({
    kind: 'offline_cache_miss',
  });
});

test('portable fixture imports/exports, request isolation and body deduplication', async () => {
  const fixture = await readFile(
    new globalThis.URL(
      '../../../rust/tests/fixtures/capture-v1.json',
      import.meta.url
    ),
    'utf8'
  );
  await store.import(fixture);
  expect((await store.load(request)).receipt).toEqual(receipt);
  expect(JSON.parse(await store.export(request))).toEqual(JSON.parse(fixture));
  for (const different of [
    { ...request, method: 'POST' },
    { ...request, url: `${request.url}?query=1` },
    { ...request, headers: { authorization: 'different' } },
  ]) {
    expect(await store.load(different)).toBeNull();
  }
  await store.store(
    { ...request, url: `${request.url}/duplicate` },
    receipt,
    2000
  );
  expect(await readdir(path.join(directory, 'bodies'))).toHaveLength(1);
  expect(await store.prune(1100, 100)).toBe(1);
  expect(await readdir(path.join(directory, 'bodies'))).toHaveLength(1);
  await expect(
    store.import(fixture.replace('255', '254'))
  ).rejects.toMatchObject({ kind: 'cache' });
  await expect(
    store.import(fixture.replace('"version": 1', '"version": 999'))
  ).rejects.toMatchObject({ kind: 'cache' });
});

test('corrupt bodies are rejected and failed transports are never cached', async () => {
  const stored = await store.store(request, receipt, 1000);
  await writeFile(path.join(directory, 'bodies', stored.sha256), 'corrupt');
  await expect(store.load(request)).rejects.toMatchObject({ kind: 'cache' });
  const failure = new Error('transport failed');
  const cache = new CachedTransport(async () => {
    throw failure;
  }, store);
  await expect(
    cache.capture({ ...request, url: 'https://other.test' })
  ).rejects.toThrow('transport failed');
  expect(await store.list()).toHaveLength(1);
});

test('Unicode header ordering matches the shared Rust replay format', async () => {
  const fixture = await readFile(
    new globalThis.URL(
      '../../../rust/tests/fixtures/capture-v1-unicode.json',
      import.meta.url
    ),
    'utf8'
  );
  const replay = JSON.parse(fixture);
  await store.import(fixture);
  expect((await store.load(replay.request)).receipt).toEqual(receipt);
  expect(JSON.parse(await store.export(replay.request))).toEqual(replay);
});

test('failed online refresh retains the expired capture for offline replay', async () => {
  await store.store(request, receipt, 800);
  const cache = new CachedTransport(
    async () => {
      throw new Error('offline upstream');
    },
    store,
    { ttl: 100, now: () => 1000 }
  );
  await expect(cache.capture(request)).rejects.toThrow('offline upstream');
  const offline = new CachedTransport(null, store, {
    offline: true,
    ttl: 100,
    now: () => 1000,
  });
  expect(await offline.capture(request)).toMatchObject({
    stale: true,
    receipt,
  });
  for (const replay of ['{', 'null', '{}']) {
    await expect(store.import(replay)).rejects.toMatchObject({ kind: 'cache' });
  }
});

test('headers are sorted without mutating the caller; TTL zero always refreshes', async () => {
  const a = { ...request, headers: { z: '1', a: '2' } };
  const b = { ...request, headers: { a: '2', z: '1' } };
  await store.store(a, receipt, 1000);
  expect((await store.load(b)).receipt).toEqual(receipt);
  const inner = jest.fn(async () => receipt);
  const cache = new CachedTransport(inner, store, { ttl: 0, now: () => 1000 });
  await cache.capture(a);
  await cache.capture(a);
  expect(inner).toHaveBeenCalledTimes(2);
});

test('caller mutation during a fetch cannot change the stored request identity', async () => {
  const mutable = { ...request, headers: { ...request.headers } };
  const cache = new CachedTransport(async () => {
    mutable.url = 'https://mutated.test';
    mutable.headers.accept = 'text/plain';
    return receipt;
  }, store);
  await cache.capture(mutable);
  expect((await store.load(request)).receipt).toEqual(receipt);
  expect(await store.load(mutable)).toBeNull();
});
