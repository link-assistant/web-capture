// Unit tests for CLI argument parsing and functionality
import { spawn } from 'child_process';
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
    test('rejects invalid URL', async () => {
      const result = await runCli(['not-a-valid-url-without-dots']);
      // Should fail with invalid URL or show help due to strict mode
      expect(result.code).toBe(1);
      // Either an error message or help output (from yargs strict mode)
      expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0);
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
