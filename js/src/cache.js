import { createHash, randomUUID } from 'node:crypto';
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  unlink,
  readdir,
} from 'node:fs/promises';
import path from 'node:path';
import { captureResponse } from './transport.js';

const VERSION = 1;
const queues = new Map();
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export class CaptureCacheError extends Error {
  constructor(message, kind = 'cache', sourceUrl = '') {
    super(message);
    this.name = 'CaptureCacheError';
    this.kind = kind;
    this.sourceUrl = sourceUrl;
  }
}

export function captureRequestKey({ url, method = 'GET', headers = {} }) {
  if (
    typeof url !== 'string' ||
    typeof method !== 'string' ||
    !headers ||
    typeof headers !== 'object' ||
    Array.isArray(headers) ||
    Object.values(headers).some((value) => typeof value !== 'string')
  ) {
    throw new CaptureCacheError('Invalid capture request');
  }
  return digest(
    JSON.stringify([
      VERSION,
      url,
      method,
      Object.entries(headers).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    ])
  );
}

function validate(record) {
  if (
    !record?.request ||
    record.version !== VERSION ||
    !/^[a-f0-9]{64}$/.test(record.sha256) ||
    record.requestKey !== captureRequestKey(record.request) ||
    !Number.isSafeInteger(record.fetchedAt) ||
    record.fetchedAt < 0 ||
    !record.receipt?.finalUrl ||
    !record.receipt?.diagnostics
  ) {
    throw new CaptureCacheError('Unsupported or invalid capture record');
  }
}

function capture(record, cached = true) {
  return {
    receipt: { ...record.receipt, body: Buffer.from(record.receipt.body) },
    requestKey: record.requestKey,
    fetchedAt: record.fetchedAt,
    sha256: record.sha256,
    cached,
    stale: false,
  };
}

/** Shared disk format; operations are serialized within this Node process. */
export class CaptureStore {
  constructor(directory) {
    this.directory = path.resolve(directory);
  }

  async locked(operation) {
    const previous = queues.get(this.directory) || Promise.resolve();
    const next = previous.catch(() => {}).then(operation);
    queues.set(this.directory, next);
    try {
      return await next;
    } catch (error) {
      if (error instanceof CaptureCacheError) {
        throw error;
      }
      throw new CaptureCacheError(error.message);
    } finally {
      if (queues.get(this.directory) === next) {
        queues.delete(this.directory);
      }
    }
  }
  recordPath(key) {
    return path.join(this.directory, 'requests', `${key}.json`);
  }
  bodyPath(sha256) {
    return path.join(this.directory, 'bodies', sha256);
  }

  async read(request) {
    let record;
    try {
      record = JSON.parse(
        await readFile(this.recordPath(captureRequestKey(request)), 'utf8')
      );
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
    validate(record);
    if (record.requestKey !== captureRequestKey(request)) {
      throw new CaptureCacheError('Request does not match capture');
    }
    record.receipt.body = await readFile(this.bodyPath(record.sha256));
    if (digest(record.receipt.body) !== record.sha256) {
      throw new CaptureCacheError('Capture SHA-256 mismatch');
    }
    return record;
  }
  load(request) {
    return this.locked(async () => {
      const record = await this.read(request);
      return record ? capture(record) : null;
    });
  }
  async atomicWrite(target, bytes) {
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    const temporary = path.join(path.dirname(target), `.tmp-${randomUUID()}`);
    try {
      await writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 });
      await rename(temporary, target);
    } finally {
      await unlink(temporary).catch((error) => {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      });
    }
  }
  store(request, receipt, fetchedAt) {
    return this.locked(async () => {
      const record = {
        version: VERSION,
        requestKey: captureRequestKey(request),
        request: {
          url: request.url,
          method: request.method ?? 'GET',
          headers: { ...request.headers },
        },
        fetchedAt,
        sha256: digest(receipt.body),
        receipt: { ...receipt, body: [] },
      };
      validate(record);
      await this.atomicWrite(this.bodyPath(record.sha256), receipt.body);
      await this.atomicWrite(
        this.recordPath(record.requestKey),
        JSON.stringify(record, null, 2)
      );
      record.receipt.body = receipt.body;
      return capture(record, false);
    });
  }
  export(request) {
    return this.locked(async () => {
      const record = await this.read(request);
      if (!record) {
        throw new CaptureCacheError('No capture to export');
      }
      record.receipt.body = [...record.receipt.body];
      return JSON.stringify(record, null, 2);
    });
  }
  async import(replay) {
    let record;
    try {
      record = JSON.parse(replay);
    } catch (error) {
      throw new CaptureCacheError(`Invalid replay JSON: ${error.message}`);
    }
    validate(record);
    if (
      !Array.isArray(record.receipt.body) ||
      record.receipt.body.some(
        (byte) => !Number.isInteger(byte) || byte < 0 || byte > 255
      )
    ) {
      throw new CaptureCacheError('Invalid replay bytes');
    }
    const body = Buffer.from(record.receipt.body);
    if (digest(body) !== record.sha256) {
      throw new CaptureCacheError('Replay SHA-256 mismatch');
    }
    return await this.store(
      record.request,
      { ...record.receipt, body },
      record.fetchedAt
    );
  }
  async records() {
    let names;
    try {
      names = await readdir(path.join(this.directory, 'requests'));
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
    const result = [];
    for (const name of names.filter((name) => name.endsWith('.json')).sort()) {
      const record = JSON.parse(
        await readFile(path.join(this.directory, 'requests', name), 'utf8')
      );
      validate(record);
      if (name !== `${record.requestKey}.json`) {
        throw new CaptureCacheError('Capture filename mismatch');
      }
      result.push(record);
    }
    return result;
  }
  list() {
    return this.locked(() => this.records());
  }
  prune(now, ttl) {
    return this.locked(async () => {
      const records = await this.records();
      const live = new Set();
      let removed = 0;
      for (const record of records) {
        if (Math.max(0, now - record.fetchedAt) >= ttl) {
          await unlink(this.recordPath(record.requestKey));
          removed++;
        } else {
          live.add(record.sha256);
        }
      }
      let bodies = [];
      try {
        bodies = await readdir(path.join(this.directory, 'bodies'));
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
      for (const body of bodies) {
        if (!live.has(body)) {
          await unlink(this.bodyPath(body));
        }
      }
      return removed;
    });
  }
}

/** Decorate any injectable transport; `execute` is safe to pass as a callback. */
export class CachedTransport {
  constructor(
    inner,
    store,
    { ttl = 60 * 24 * 60 * 60 * 1000, offline = false, now = Date.now } = {}
  ) {
    if (!Number.isFinite(ttl) || ttl < 0) {
      throw new TypeError('TTL must be non-negative milliseconds');
    }
    this.inner = inner;
    this.store = store;
    this.ttl = ttl;
    this.offline = offline;
    this.now = now;
    this.execute = this.execute.bind(this);
  }
  async capture(request) {
    request.signal?.throwIfAborted();
    const identity = {
      url: request.url,
      method: request.method ?? 'GET',
      headers: { ...request.headers },
    };
    const saved = await this.store.load(identity);
    if (saved) {
      saved.stale = Math.max(0, this.now() - saved.fetchedAt) >= this.ttl;
      if (!saved.stale || this.offline) {
        return saved;
      }
    }
    if (this.offline) {
      throw new CaptureCacheError(
        'No cached capture in offline mode',
        'offline_cache_miss',
        identity.url
      );
    }
    const receipt = await captureResponse(identity.url, {
      ...identity,
      headers: { ...identity.headers },
      signal: request.signal,
      transport: this.inner,
    });
    return this.store.store(identity, receipt, this.now());
  }
  async execute(request) {
    return (await this.capture(request)).receipt;
  }
}
