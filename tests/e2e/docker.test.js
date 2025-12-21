import fetch from 'node-fetch';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const WAIT_FOR_READY = 10000; // ms
const PORT = 3000; // Use the same port as in docker-compose.yml
const baseUrl = `http://localhost:${PORT}`;

const timings = {};

async function isServiceRunning() {
  try {
    const res = await fetch(`${baseUrl}/html?url=https://example.com`);
    return res.status === 200;
  } catch {
    return false;
  }
}

beforeAll(async () => {
  timings.start = Date.now();
  console.log('Checking if Docker service is already running...');
  const alreadyRunning = await isServiceRunning();
  if (!alreadyRunning) {
    console.log('Service not running, starting Docker container...');
    try {
      const dockerStart = Date.now();
      // Start the Docker container using docker compose (v2 command)
      const { stdout, stderr } = await execAsync('docker compose up -d');
      timings.dockerStartup = Date.now() - dockerStart;
      console.log('Docker compose output:', stdout);
      if (stderr) {
        console.error('Docker compose errors:', stderr);
      }

      // Wait for the service to be ready
      const readyStart = Date.now();
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Docker service did not start in time'));
        }, WAIT_FOR_READY);

        const checkReady = async () => {
          try {
            console.log(`Checking if service is ready at ${baseUrl}...`);
            const res = await fetch(`${baseUrl}/html?url=https://example.com`);
            if (res.status === 200) {
              console.log('Service is ready!');
              clearTimeout(timeout);
              resolve();
            } else {
              console.log(`Service not ready yet, status: ${res.status}`);
              setTimeout(checkReady, 500);
            }
          } catch (err) {
            console.log('Service not ready yet, error:', err.message);
            setTimeout(checkReady, 500);
          }
        };
        checkReady();
      });
      timings.serviceReady = Date.now() - readyStart;
    } catch (error) {
      console.error('Failed to start Docker container:', error);
      throw error;
    }
    timings.beforeAll = Date.now() - timings.start;
    console.log('Timing: Docker startup:', `${timings.dockerStartup}ms`);
    console.log('Timing: Service readiness:', `${timings.serviceReady}ms`);
    console.log('Timing: beforeAll total:', `${timings.beforeAll}ms`);
  } else {
    console.log('Docker service is already running. Skipping startup.');
    timings.beforeAll = Date.now() - timings.start;
    console.log(
      'Timing: beforeAll (already running):',
      `${timings.beforeAll}ms`
    );
  }
}, 30000); // Reduced timeout for beforeAll

describe('E2E (Docker): Web Capture Microservice', () => {
  it('should return HTML from /html endpoint', async () => {
    const htmlStart = Date.now();
    const url = 'https://example.com';
    const res = await fetch(`${baseUrl}/html?url=${encodeURIComponent(url)}`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/<html/i);
    timings.html = Date.now() - htmlStart;
    console.log('Timing: /html endpoint:', `${timings.html}ms`);
  }, 20000);

  it('should return Markdown from /markdown endpoint', async () => {
    const mdStart = Date.now();
    const url = 'https://example.com';
    const res = await fetch(
      `${baseUrl}/markdown?url=${encodeURIComponent(url)}`
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/example/i);
    timings.markdown = Date.now() - mdStart;
    console.log('Timing: /markdown endpoint:', `${timings.markdown}ms`);
  }, 20000);

  it('should return PNG from /image endpoint', async () => {
    const pngStart = Date.now();
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
    timings.png = Date.now() - pngStart;
    console.log('Timing: /image endpoint:', `${timings.png}ms`);
  }, 60000);

  it('should stream content from /stream endpoint', async () => {
    const startTime = Date.now();
    const url = 'https://example.com';
    const res = await fetch(`${baseUrl}/stream?url=${encodeURIComponent(url)}`);
    expect(res.status).toBe(200);
    // Get the response as text
    const text = await res.text();
    expect(text).toMatch(/<html/i);
    expect(text).toMatch(/Example Domain/i);
    const endTime = Date.now();
    console.log(`Timing: /stream endpoint: ${endTime - startTime}ms`);
  }, 20000);

  it('should return content from /fetch endpoint', async () => {
    const startTime = Date.now();
    const url = 'https://example.com';
    const res = await fetch(`${baseUrl}/fetch?url=${encodeURIComponent(url)}`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/<html/i);
    expect(text).toMatch(/Example Domain/i);
    const endTime = Date.now();
    console.log(`Timing: /fetch endpoint: ${endTime - startTime}ms`);
  }, 20000);
});
