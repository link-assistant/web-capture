import { spawn } from 'child_process';
import fetch from 'node-fetch';
import getPort from 'get-port';
import path from 'path';

const WAIT_FOR_READY = 5000; // ms
let serverProcess;
let serverOutput = '';
let baseUrl;
let mockProcess;
let mockUrl;

const MOCK_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Example Domain</title></head>
<body><h1>Example Domain</h1><p>This domain is for use in illustrative examples.</p></body>
</html>`;

beforeAll(async () => {
  const mockPort = await getPort();
  mockProcess = startMockServer(mockPort);
  await waitForProcessOutput(mockProcess, 'mock fixture server listening');
  mockUrl = `http://127.0.0.1:${mockPort}`;

  const port = await getPort();
  baseUrl = `http://127.0.0.1:${port}`;

  serverProcess = spawn(
    'node',
    [path.resolve('bin/web-capture.js'), '--serve', '--port', port.toString()],
    {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  collectProcessOutput(serverProcess, (chunk) => {
    serverOutput += chunk;
  });

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
  if (mockProcess) {
    mockProcess.kill();
  }
});

describe('E2E: Web Capture Microservice', () => {
  it('should return HTML from /html endpoint', async () => {
    const res = await fetch(
      `${baseUrl}/html?url=${encodeURIComponent(mockUrl)}`
    );
    const text = await expectTextResponse(res);
    expect(text).toMatch(/<html/i);
  });

  it('should return Markdown from /markdown endpoint', async () => {
    const res = await fetch(
      `${baseUrl}/markdown?url=${encodeURIComponent(mockUrl)}`
    );
    const text = await expectTextResponse(res);
    expect(text).toMatch(/example/i);
  });

  it('should return PNG from /image endpoint', async () => {
    const res = await fetch(
      `${baseUrl}/image?url=${encodeURIComponent(mockUrl)}`
    );
    await expectStatusOk(res);
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
    const text = await expectTextResponse(res);
    expect(text).toMatch(/<html/i);
    expect(text).toMatch(/Example Domain/i);
  }, 20000);

  it('should return content from /fetch endpoint', async () => {
    const res = await fetch(
      `${baseUrl}/fetch?url=${encodeURIComponent(mockUrl)}`
    );
    const text = await expectTextResponse(res);
    expect(text).toMatch(/<html/i);
    expect(text).toMatch(/Example Domain/i);
  }, 20000);
});

function startMockServer(port) {
  const script = `
    const http = require('http');
    const html = ${JSON.stringify(MOCK_HTML)};
    const server = http.createServer((req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': Buffer.byteLength(html),
      });
      res.end(html);
    });
    server.listen(${port}, '127.0.0.1', () => {
      console.log('mock fixture server listening');
    });
    process.on('SIGTERM', () => server.close(() => process.exit(0)));
    process.on('SIGINT', () => server.close(() => process.exit(0)));
  `;
  return spawn('node', ['-e', script], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function collectProcessOutput(child, onChunk) {
  child.stdout.on('data', (data) => onChunk(data.toString()));
  child.stderr.on('data', (data) => onChunk(data.toString()));
}

async function waitForProcessOutput(child, expected) {
  let output = '';
  collectProcessOutput(child, (chunk) => {
    output += chunk;
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(`Timed out waiting for "${expected}". Output:\n${output}`)
      );
    }, WAIT_FOR_READY);
    child.stdout.on('data', (data) => {
      if (data.toString().includes(expected)) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.on('exit', (code, signal) => {
      clearTimeout(timeout);
      reject(new Error(`Process exited with code ${code}, signal ${signal}`));
    });
  });
}

async function expectTextResponse(res) {
  let text;
  try {
    text = await res.text();
  } catch (error) {
    throw new Error(
      `${error.message}\nServer output:\n${serverOutput || '(empty)'}`
    );
  }
  expectResponseStatus(res.status, text);
  return text;
}

async function expectStatusOk(res) {
  if (res.status === 200) {
    return;
  }
  expectResponseStatus(res.status, await res.text());
}

function expectResponseStatus(status, body) {
  if (status !== 200) {
    throw new Error(
      `Expected HTTP 200, received ${status}\nBody:\n${body}\nServer output:\n${serverOutput}`
    );
  }
}
