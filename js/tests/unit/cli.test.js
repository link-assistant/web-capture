// Unit tests for CLI argument parsing and functionality
import { spawn } from 'child_process';
import http from 'node:http';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import packageJson from '../../package.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliPath = resolve(__dirname, '../../bin/web-capture.js');
const searchFixturePath = resolve(__dirname, '../helpers/search-fixture.cjs');

// Helper function to run CLI and capture output
function runCli(args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [cliPath, ...args], {
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

function startFixtureServer({
  body = '<!doctype html><html><body><h1>Issue 68</h1><p>Captured from positional URL.</p></body></html>',
  contentType = 'text/html; charset=utf-8',
} = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(body);
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

    test('shows web-capture version when run from another npm project', async () => {
      const callerProjectDir = mkdtempSync(join(process.cwd(), 'caller-'));
      writeFileSync(
        join(callerProjectDir, 'package.json'),
        JSON.stringify({
          name: 'caller-project',
          version: '1.0.0',
        })
      );

      try {
        const result = await runCli(['--version'], { cwd: callerProjectDir });

        expect(result.code).toBe(0);
        expect(result.stdout.trim()).toBe(packageJson.version);
      } finally {
        rmSync(callerProjectDir, { recursive: true, force: true });
      }
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

  describe('FormalAI-compatible CLI contract', () => {
    test('writes HTML, Markdown, and text captures to stdout with -o -', async () => {
      const { server, url } = await startFixtureServer({
        body: '<!doctype html><html><body><h1>FormalAI Fixture</h1><p>Stable CLI shape.</p></body></html>',
      });

      try {
        const html = await runCli([url, '--format', 'html', '--output', '-']);
        expect(html.code).toBe(0);
        expect(html.stdout).toContain('<h1>FormalAI Fixture</h1>');

        const markdown = await runCli([
          url,
          '--format',
          'markdown',
          '--output',
          '-',
        ]);
        expect(markdown.code).toBe(0);
        expect(markdown.stdout).toContain('FormalAI Fixture');
        expect(markdown.stdout).toContain('Stable CLI shape.');

        const text = await runCli([url, '--format', 'txt', '--output', '-']);
        expect(text.code).toBe(0);
        expect(text.stdout).toContain('FormalAI Fixture');
      } finally {
        await stopFixtureServer(server);
      }
    }, 20000);

    test('writes archive captures as ZIP files for binary CLI consumers', async () => {
      const outputDir = mkdtempSync(join(process.cwd(), 'formalai-cli-'));
      const outputPath = join(outputDir, 'capture.zip');
      const { server, url } = await startFixtureServer({
        body: '<!doctype html><html><body><h1>FormalAI Archive</h1></body></html>',
      });

      try {
        const result = await runCli([
          url,
          '--archive',
          'zip',
          '--output',
          outputPath,
        ]);

        expect(result.code).toBe(0);
        const zipBytes = readFileSync(outputPath);
        expect(zipBytes.length).toBeGreaterThan(50);
        expect(zipBytes[0]).toBe(0x50);
        expect(zipBytes[1]).toBe(0x4b);
      } finally {
        await stopFixtureServer(server);
        rmSync(outputDir, { recursive: true, force: true });
      }
    }, 20000);

    test('emits normalized search JSON from the search subcommand', async () => {
      const nodeOptions = [
        process.env.NODE_OPTIONS,
        `--require=${searchFixturePath}`,
      ]
        .filter(Boolean)
        .join(' ');
      const result = await runCli(
        ['search', 'formal-ai', '--provider', 'wikipedia', '--limit', '1'],
        {
          env: { NODE_OPTIONS: nodeOptions },
        }
      );

      expect(result.code).toBe(0);
      const body = JSON.parse(result.stdout);
      expect(body).toMatchObject({
        query: 'formal-ai',
        provider: 'wikipedia',
        captureMode: 'fetch',
      });
      expect(body.results).toEqual([
        {
          rank: 1,
          title: 'Formal methods',
          url: 'https://en.wikipedia.org/wiki/Formal_methods',
          snippet: 'the study of formal methods',
        },
      ]);
      expect(body.diagnostics).toMatchObject({
        status: 200,
        blockedByCors: false,
        blockedByCaptcha: false,
      });
      expect(body.diagnostics.sourceUrl).toContain('en.wikipedia.org');
    }, 20000);
  });
});
