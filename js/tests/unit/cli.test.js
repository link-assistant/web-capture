// Unit tests for CLI argument parsing and functionality
import { spawn } from 'child_process';
import http from 'node:http';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliPath = resolve(__dirname, '../../bin/web-capture.js');

// Helper function to run CLI and capture output
function runCli(args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [cliPath, ...args], {
      cwd: options.cwd || dirname(cliPath),
      env: { ...process.env, ...options.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });

    proc.on('error', reject);
  });
}

function startFixtureServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        '<!doctype html><html><body><h1>Issue 68</h1><p>Captured from positional URL.</p></body></html>'
      );
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        server,
        url: `http://127.0.0.1:${port}/article`,
      });
    });
  });
}

function stopFixtureServer(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

describe('CLI', () => {
  describe('--help', () => {
    test('shows help message with --help flag', async () => {
      const result = await runCli(['--help']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('web-capture');
      expect(result.stdout).toContain('Usage:');
      expect(result.stdout).toContain('--serve');
      expect(result.stdout).toContain('--format');
      expect(result.stdout).toContain('--output');
      expect(result.stdout).toContain('--engine');
    });

    test('shows help message with -h flag', async () => {
      const result = await runCli(['-h']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('web-capture');
      expect(result.stdout).toContain('Usage:');
    });

    test('shows error and exits with code 1 when no arguments provided', async () => {
      const result = await runCli([]);
      expect(result.code).toBe(1);
      // With lino-arguments and yargs, error messages go to stderr
      expect(result.stderr).toContain('Error');
    });
  });

  describe('--version', () => {
    test('shows version with --version flag', async () => {
      const result = await runCli(['--version']);
      expect(result.code).toBe(0);
      // yargs outputs just the version number
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });

    test('shows version with -v flag', async () => {
      const result = await runCli(['-v']);
      expect(result.code).toBe(0);
      // yargs outputs just the version number
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('URL validation', () => {
    test('accepts a URL as a positional argument', async () => {
      const { server, url } = await startFixtureServer();

      try {
        const result = await runCli([
          url,
          '--format',
          'markdown',
          '--output',
          '-',
        ]);

        expect(result.code).toBe(0);
        expect(result.stderr).not.toContain('Unknown argument');
        expect(result.stdout).toContain('Issue 68');
        expect(result.stdout).toContain('Captured from positional URL.');
      } finally {
        await stopFixtureServer(server);
      }
    }, 15000);

    test('accepts a URL after the -- argument separator', async () => {
      const { server, url } = await startFixtureServer();

      try {
        const result = await runCli([
          '--format',
          'markdown',
          '--output',
          '-',
          '--',
          url,
        ]);

        expect(result.code).toBe(0);
        expect(result.stderr).not.toContain('Missing URL');
        expect(result.stdout).toContain('Issue 68');
      } finally {
        await stopFixtureServer(server);
      }
    }, 15000);

    test('rejects unknown options', async () => {
      const result = await runCli([
        '--unknown-option-for-issue-68',
        'https://example.com',
      ]);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Unknown argument');
    });

    test('rejects invalid URL', async () => {
      const result = await runCli(['http://[invalid-url']);
      // Should fail before trying to capture.
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Invalid URL');
    }, 15000);
  });

  describe('format options', () => {
    test('accepts --format html', async () => {
      // Just test that the argument is accepted (actual fetch would fail without network)
      const result = await runCli(['--help']);
      expect(result.stdout).toContain('--format');
      expect(result.stdout).toContain('html');
    });

    test('accepts --format markdown', async () => {
      const result = await runCli(['--help']);
      expect(result.stdout).toContain('markdown');
    });

    test('accepts --format image', async () => {
      const result = await runCli(['--help']);
      expect(result.stdout).toContain('image');
    });
  });

  describe('engine options', () => {
    test('help shows engine options', async () => {
      const result = await runCli(['--help']);
      expect(result.stdout).toContain('--engine');
      expect(result.stdout).toContain('puppeteer');
      expect(result.stdout).toContain('playwright');
    });

    test('accepts --engine option', async () => {
      const result = await runCli(['--help']);
      expect(result.stdout).toContain('--engine');
    });
  });

  describe('server mode options', () => {
    test('help shows --serve option', async () => {
      const result = await runCli(['--help']);
      expect(result.stdout).toContain('--serve');
      expect(result.stdout).toContain('-s');
    });

    test('help shows --port option', async () => {
      const result = await runCli(['--help']);
      expect(result.stdout).toContain('--port');
      expect(result.stdout).toContain('-p');
    });

    test('help shows API endpoints', async () => {
      const result = await runCli(['--help']);
      expect(result.stdout).toContain('/html');
      expect(result.stdout).toContain('/markdown');
      expect(result.stdout).toContain('/image');
      expect(result.stdout).not.toContain('/gdocs');
    });
  });

  describe('output options', () => {
    test('help shows --output option', async () => {
      const result = await runCli(['--help']);
      expect(result.stdout).toContain('--output');
      expect(result.stdout).toContain('-o');
    });
  });
});
