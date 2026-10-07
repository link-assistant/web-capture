import { CaptureStore, CachedTransport } from '../../src/cache.js';
import { fetchTransport } from '../../src/transport.js';

const store = new CaptureStore('.captures');
const request = { url: 'https://example.com', method: 'GET', headers: {} };
const online = new CachedTransport(fetchTransport, store);
const first = await online.capture(request);
const offline = new CachedTransport(fetchTransport, store, { offline: true });
const replay = await offline.capture(request);
console.log(replay.sha256, replay.cached, replay.stale);
console.log('Exact replay:', first.receipt.body.equals(replay.receipt.body));
console.log('Portable fixture:', await store.export(request));
