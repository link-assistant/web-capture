import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { jest } from '@jest/globals';

import {
  captureSharedDialog,
  formatSharedDialogAsDemoMemory,
  formatSharedDialogAsMarkdown,
  formatSharedDialogAsMetaLanguage,
  parseSharedDialog,
} from '../../src/shared-dialog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '../../..');

const CHATGPT_SHARE_URL =
  'https://chatgpt.com/share/6a3825b9-8de4-83ee-9c24-52fd1eb38d24';
const GOOGLE_AI_MODE_URL = 'https://share.google/aimode/VG0HhpnAXrBkC0QgP';

function readCaseStudyFixture(name) {
  return readFileSync(
    resolve(repoRoot, 'docs/case-studies/issue-141/raw-data', name),
    'utf-8'
  );
}

describe('shared-dialog module (#141)', () => {
  it('extracts the four visible ChatGPT shared-dialog turns', () => {
    const capture = parseSharedDialog(
      readCaseStudyFixture('chatgpt-share-6a3825b9.html'),
      {
        sourceUrl: CHATGPT_SHARE_URL,
        captureMethod: 'static_http',
      }
    );

    expect(capture).toMatchObject({
      provider: 'chatgpt',
      sourceUrl: CHATGPT_SHARE_URL,
      captureMethod: 'static_http',
      status: 'ok',
      conversationId: '6a3825b9-8de4-83ee-9c24-52fd1eb38d24',
      title: 'Infinite loop script',
    });
    expect(capture.turns).toHaveLength(4);
    expect(capture.turns.map((turn) => turn.role)).toEqual([
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
    expect(capture.turns[0]).toMatchObject({
      visibility: 'visible',
      sourceEvidence: [
        {
          sourceUrl: CHATGPT_SHARE_URL,
          kind: 'chatgpt_linear_conversation',
        },
      ],
    });
    expect(capture.turns[0].content).toContain('make a loop of that');
    expect(capture.turns[1].content).toContain(
      'while true; do sleep 30m && hive-cleanup -f; done'
    );
    expect(capture.turns[3].content).toContain(
      'screen -dmS auto-cleanup bash -c'
    );
  });

  it('formats ChatGPT captures as demo_memory', () => {
    const capture = parseSharedDialog(
      readCaseStudyFixture('chatgpt-share-6a3825b9.html'),
      {
        sourceUrl: CHATGPT_SHARE_URL,
        captureMethod: 'static_http',
      }
    );

    const memory = formatSharedDialogAsDemoMemory(capture, {
      demoLabel: 'issue-552-chatgpt-share',
    });

    expect(memory).toContain('demo_memory');
    expect(memory.match(/\n {2}event "/g)).toHaveLength(4);
    expect(memory).toContain('role "user"');
    expect(memory).toContain('role "assistant"');
    expect(memory).toContain(
      'conversationId "6a3825b9-8de4-83ee-9c24-52fd1eb38d24"'
    );
    expect(memory).toContain('conversationTitle "Infinite loop script"');
    expect(memory).toContain(`evidence "${CHATGPT_SHARE_URL}"`);
    expect(memory).toContain(
      "screen -dmS auto-cleanup bash -c 'while true; do sleep 30m && hive-cleanup -f; done'"
    );
  });

  it('formats captures as shared-dialog meta-language and Markdown', () => {
    const capture = parseSharedDialog(
      readCaseStudyFixture('chatgpt-share-6a3825b9.html'),
      {
        sourceUrl: CHATGPT_SHARE_URL,
        captureMethod: 'static_http',
      }
    );

    const metaLanguage = formatSharedDialogAsMetaLanguage(capture);
    expect(metaLanguage).toContain('shared_dialog_capture');
    expect(metaLanguage).toContain('provider "chatgpt"');
    expect(metaLanguage).toContain(
      'turn "0c9f0151-b5a1-402f-afc3-6bd34a0d01d2"'
    );

    const markdown = formatSharedDialogAsMarkdown(capture);
    expect(markdown).toContain('# Infinite loop script');
    expect(markdown).toContain('**User**');
    expect(markdown).toContain('**Assistant**');
  });

  it('returns a structured Google AI Mode interstitial diagnostic', () => {
    const capture = parseSharedDialog(
      readCaseStudyFixture('google-ai-mode-VG0HhpnAXrBkC0QgP.html'),
      {
        sourceUrl: GOOGLE_AI_MODE_URL,
        captureMethod: 'static_http',
      }
    );

    expect(capture).toMatchObject({
      provider: 'google_ai_mode',
      sourceUrl: GOOGLE_AI_MODE_URL,
      captureMethod: 'static_http',
      status: 'unsupported',
      turns: [],
      diagnostics: {
        unsupportedReason: 'provider_challenge_interstitial',
      },
    });
  });

  it('uses browser-rendered DOM when static Google AI Mode capture is blocked', async () => {
    const googleHtml = readCaseStudyFixture(
      'google-ai-mode-VG0HhpnAXrBkC0QgP.html'
    );
    const renderHtml = jest.fn(async () => googleHtml);
    const capture = await captureSharedDialog({
      url: GOOGLE_AI_MODE_URL,
      capture: 'browser',
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        text: async () => googleHtml,
      }),
      renderHtml,
      now: () => '2026-06-25T00:00:00.000Z',
    });

    expect(renderHtml).toHaveBeenCalledWith(GOOGLE_AI_MODE_URL, {
      engine: 'puppeteer',
    });
    expect(capture).toMatchObject({
      provider: 'google_ai_mode',
      captureMethod: 'browser',
      status: 'unsupported',
      capturedAt: '2026-06-25T00:00:00.000Z',
      diagnostics: {
        unsupportedReason: 'provider_challenge_interstitial',
      },
    });
  });
});
