import { spawn } from 'child_process';
import fetch from 'node-fetch';
import getPort from 'get-port';
import path from 'path';

const WAIT_FOR_READY = 5000; // ms
let serverProcess;
let baseUrl;

beforeAll(async () => {
  const port = await getPort();
  baseUrl = `http://localhost:${port}`;

  serverProcess = spawn(
    'node',
    [path.resolve('bin/web-capture.js'), '--serve'],
    {
      env: { ...process.env, PORT: port },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  // Wait for the server to be ready (simple delay or poll)
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Server did not start in time'));
    }, WAIT_FOR_READY);
    serverProcess.stdout.on('data', (data) => {
      if (
        data.toString().includes('listening') ||
        data.toString().includes('Server running')
      ) {
        clearTimeout(timeout);
        resolve();
      }
    });
    // Fallback: resolve after WAIT_FOR_READY
    setTimeout(resolve, WAIT_FOR_READY);
  });
});

afterAll(() => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

describe('E2E: Web Capture Microservice', () => {
  it('should return HTML from /html endpoint', async () => {
    const url = 'https://example.com';
    const res = await fetch(`${baseUrl}/html?url=${encodeURIComponent(url)}`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/<html/i);
  });

  it('should return Markdown from /markdown endpoint', async () => {
    const url = 'https://example.com';
    const res = await fetch(
      `${baseUrl}/markdown?url=${encodeURIComponent(url)}`
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/example/i);
  });

  it('should return PNG from /image endpoint', async () => {
    const url = 'https://example.com';
    const res = await fetch(`${baseUrl}/image?url=${encodeURIComponent(url)}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^image\/png/);
    const buf = Buffer.from(await res.arrayBuffer());
    // PNG signature check
    const pngSignature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(buf.slice(0, 8)).toEqual(pngSignature);
    expect(buf.length).toBeGreaterThan(100); // Should be a non-trivial PNG
  }, 60000);

  it('should stream content from /stream endpoint', async () => {
    const url = 'https://example.com';
    const res = await fetch(`${baseUrl}/stream?url=${encodeURIComponent(url)}`);
    expect(res.status).toBe(200);
    // Get the response as text
    const text = await res.text();
    expect(text).toMatch(/<html/i);
    expect(text).toMatch(/Example Domain/i);
  }, 20000);

  it('should return content from /fetch endpoint', async () => {
    const url = 'https://example.com';
    const res = await fetch(`${baseUrl}/fetch?url=${encodeURIComponent(url)}`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/<html/i);
    expect(text).toMatch(/Example Domain/i);
  }, 20000);
});
