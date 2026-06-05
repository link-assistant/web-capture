import { spawn } from 'child_process';
import http from 'http';
import fetch from 'node-fetch';
import getPort from 'get-port';
import path from 'path';

const WAIT_FOR_READY = 5000; // ms
let serverProcess;
let baseUrl;
let mockServer;
let mockUrl;

const MOCK_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Example Domain</title></head>
<body><h1>Example Domain</h1><p>This domain is for use in illustrative examples.</p></body>
</html>`;

beforeAll(async () => {
  // Start a local mock server to avoid depending on external network
  const mockPort = await getPort();
  mockServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(MOCK_HTML);
  });
  await new Promise((resolve) => mockServer.listen(mockPort, resolve));
  mockUrl = `http://localhost:${mockPort}`;

  const port = await getPort();
  baseUrl = `http://localhost:${port}`;

  serverProcess = spawn(
    'node',
    [path.resolve('bin/web-capture.js'), '--serve', '--port', port.toString()],
    {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  // Wait for the server to be ready (simple delay or poll)
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Server did not start in time'));
    }, WAIT_FOR_READY);

    let serverStarted = false;
    serverProcess.stdout.on('data', (data) => {
      if (
        data.toString().includes('listening') ||
        data.toString().includes('Server running')
      ) {
        serverStarted = true;
        clearTimeout(timeout);
        resolve();
      }
    });

    serverProcess.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    serverProcess.on('exit', (code, signal) => {
      if (!serverStarted) {
        clearTimeout(timeout);
        reject(
          new Error(`Server process exited with code ${code}, signal ${signal}`)
        );
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
  if (mockServer) {
    mockServer.close();
  }
});

describe('E2E: Web Capture Microservice', () => {
  it('should return HTML from /html endpoint', async () => {
    const res = await fetch(
      `${baseUrl}/html?url=${encodeURIComponent(mockUrl)}`
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/<html/i);
  });

  it('should return Markdown from /markdown endpoint', async () => {
    const res = await fetch(
      `${baseUrl}/markdown?url=${encodeURIComponent(mockUrl)}`
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/example/i);
  });

  it('should return PNG from /image endpoint', async () => {
    const res = await fetch(
      `${baseUrl}/image?url=${encodeURIComponent(mockUrl)}`
    );
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
    const res = await fetch(
      `${baseUrl}/stream?url=${encodeURIComponent(mockUrl)}`
    );
    expect(res.status).toBe(200);
    // Get the response as text
    const text = await res.text();
    expect(text).toMatch(/<html/i);
    expect(text).toMatch(/Example Domain/i);
  }, 20000);

  it('should return content from /fetch endpoint', async () => {
    const res = await fetch(
      `${baseUrl}/fetch?url=${encodeURIComponent(mockUrl)}`
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/<html/i);
    expect(text).toMatch(/Example Domain/i);
  }, 20000);
});
