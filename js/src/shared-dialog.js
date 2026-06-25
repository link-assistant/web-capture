/**
 * Shared AI dialog capture and normalization (issue #141).
 *
 * The primary supported source today is ChatGPT shared-page HTML. ChatGPT
 * embeds a React Router stream containing a devalue table; this module decodes
 * that table, finds `linear_conversation`, and keeps visible user/assistant
 * messages. Providers that do not expose transcript data return a structured
 * unsupported diagnostic instead of guessed content.
 */

import fetch from 'node-fetch';
import he from 'he';
import { URL } from 'node:url';

import { createBrowser as defaultCreateBrowser } from './browser.js';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const ENQUEUE_MARKER = 'window.__reactRouterContext.streamController.enqueue(';

export const SHARED_DIALOG_FORMATS = [
  'json',
  'meta-language',
  'demo-memory',
  'markdown',
  'md',
  'txt',
  'text',
  'html',
];

function normalizeSourceUrl(url) {
  if (!url) {
    throw new Error('Missing shared-dialog URL');
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
}

function providerFromUrl(sourceUrl) {
  try {
    const parsed = new URL(sourceUrl);
    const host = parsed.hostname.toLowerCase();
    if (host === 'chatgpt.com' || host.endsWith('.chatgpt.com')) {
      return 'chatgpt';
    }
    if (host === 'share.google' && parsed.pathname.startsWith('/aimode/')) {
      return 'google_ai_mode';
    }
  } catch {
    // Fall through to body-based detection.
  }
  return null;
}

function detectProvider(input, sourceUrl) {
  const fromUrl = providerFromUrl(sourceUrl);
  if (fromUrl) {
    return fromUrl;
  }
  if (input.includes(ENQUEUE_MARKER) || input.includes('linear_conversation')) {
    return 'chatgpt';
  }
  if (looksLikeGoogleAiModeInterstitial(input)) {
    return 'google_ai_mode';
  }
  return 'unknown';
}

function okCapture({
  provider,
  sourceUrl,
  captureMethod,
  capturedAt,
  httpStatus,
  title,
  conversationId,
  turns,
  warnings = [],
}) {
  return {
    provider,
    sourceUrl,
    captureMethod,
    capturedAt,
    status: 'ok',
    conversationId,
    title,
    turns,
    diagnostics: {
      status: 'ok',
      httpStatus,
      warnings,
    },
  };
}

function unsupportedCapture({
  provider,
  sourceUrl,
  captureMethod,
  capturedAt,
  httpStatus,
  unsupportedReason,
  message,
  warnings = [],
  error,
}) {
  return {
    provider,
    sourceUrl,
    captureMethod,
    capturedAt,
    status: 'unsupported',
    conversationId: null,
    title: null,
    turns: [],
    diagnostics: {
      status: 'unsupported',
      httpStatus,
      unsupportedReason,
      message,
      warnings,
      ...(error ? { error } : {}),
    },
  };
}

function parseUnsupported(input, provider) {
  if (looksLikeGoogleAiModeInterstitial(input)) {
    return {
      reason: 'provider_challenge_interstitial',
      message:
        'Google AI Mode capture returned a Google Search JavaScript/interstitial page instead of transcript data.',
    };
  }
  if (/log in|sign in|login required|authentication required/i.test(input)) {
    return {
      reason: 'login_required',
      message:
        'The shared dialog page requires login before transcript data is visible.',
    };
  }
  if (/deleted|expired|not found|unavailable/i.test(input)) {
    return {
      reason: 'deleted_or_expired_share',
      message:
        'The shared dialog appears to be deleted, expired, or unavailable.',
    };
  }
  if (provider === 'unknown') {
    return {
      reason: 'unsupported_provider_format',
      message:
        'The URL or captured DOM is not a supported shared-dialog provider format.',
    };
  }
  return {
    reason: 'no_transcript_in_captured_dom',
    message: 'The captured DOM did not contain replayable transcript data.',
  };
}

/**
 * Parse a captured shared-dialog DOM/transcript into the normalized contract.
 *
 * @param {string} input - Captured HTML or compact transcript
 * @param {Object} options - Parse metadata
 * @returns {Object} Normalized shared-dialog capture
 */
export function parseSharedDialog(input, options = {}) {
  const sourceUrl = options.sourceUrl || '';
  const captureMethod = options.captureMethod || 'static_http';
  const capturedAt = options.capturedAt;
  const httpStatus = options.httpStatus;
  const provider = options.provider || detectProvider(input || '', sourceUrl);
  const warnings = [...(options.warnings || [])];

  if (provider === 'chatgpt') {
    try {
      return parseChatGptShareHtml(input || '', {
        sourceUrl,
        captureMethod,
        capturedAt,
        httpStatus,
        warnings,
      });
    } catch (err) {
      const diagnostic = parseUnsupported(input || '', provider);
      return unsupportedCapture({
        provider,
        sourceUrl,
        captureMethod,
        capturedAt,
        httpStatus,
        unsupportedReason:
          diagnostic.reason === 'no_transcript_in_captured_dom'
            ? 'no_transcript_in_captured_dom'
            : diagnostic.reason,
        message:
          diagnostic.reason === 'no_transcript_in_captured_dom'
            ? `ChatGPT share capture did not contain a parseable linear_conversation transcript: ${err.message}`
            : diagnostic.message,
        warnings,
      });
    }
  }

  const markdown = parseMarkdownTranscript(input || '', {
    provider,
    sourceUrl,
    captureMethod,
    capturedAt,
    httpStatus,
    warnings,
  });
  if (markdown.status === 'ok') {
    return markdown;
  }

  const diagnostic = parseUnsupported(input || '', provider);
  return unsupportedCapture({
    provider,
    sourceUrl,
    captureMethod,
    capturedAt,
    httpStatus,
    unsupportedReason: diagnostic.reason,
    message: diagnostic.message,
    warnings,
  });
}

function parseChatGptShareHtml(input, metadata) {
  const table = extractChatGptDevalueTable(input);
  const resolved = resolveDevalueRoot(table);
  const data = findObjectWithArrayKey(resolved, 'linear_conversation');
  if (!data) {
    throw new Error('linear_conversation data was not found');
  }
  const linear = Array.isArray(data.linear_conversation)
    ? data.linear_conversation
    : null;
  if (!linear) {
    throw new Error('linear_conversation field was not an array');
  }

  const turns = [];
  linear.forEach((item, index) => {
    const turn = chatGptTurnFromItem(item, index, metadata);
    if (turn) {
      turns.push(turn);
    }
  });
  if (turns.length === 0) {
    throw new Error('no visible user or assistant turns were found');
  }

  const title =
    stringField(data, 'title') ||
    titleFromHtml(input) ||
    metadata.conversationTitle ||
    null;
  const conversationId =
    stringField(data, 'conversation_id') ||
    chatGptShareId(metadata.sourceUrl) ||
    null;

  return okCapture({
    provider: 'chatgpt',
    sourceUrl: metadata.sourceUrl,
    captureMethod: metadata.captureMethod,
    capturedAt: metadata.capturedAt,
    httpStatus: metadata.httpStatus,
    title,
    conversationId,
    turns,
    warnings: metadata.warnings,
  });
}

function chatGptTurnFromItem(item, index, metadata) {
  const message = item?.message || item;
  const role = message?.author?.role;
  if (role !== 'user' && role !== 'assistant') {
    return null;
  }
  if (messageIsHidden(message)) {
    return null;
  }
  const content = messageContentText(message?.content).trim();
  if (!content) {
    return null;
  }
  const id = typeof message?.id === 'string' ? message.id : '';
  return {
    id: id || `chatgpt-turn-${index + 1}`,
    role,
    content,
    visibility: 'visible',
    sourceEvidence: [
      {
        kind: 'chatgpt_linear_conversation',
        sourceUrl: metadata.sourceUrl,
        captureMethod: metadata.captureMethod,
        pointer: `linear_conversation[${index}].message`,
      },
    ],
  };
}

function messageIsHidden(message) {
  return Boolean(message?.metadata?.is_visually_hidden_from_conversation);
}

function messageContentText(content) {
  if (!content) {
    return '';
  }
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content.parts)) {
    const parts = [];
    for (const part of content.parts) {
      if (typeof part === 'string' && part) {
        parts.push(part);
      } else if (typeof part?.text === 'string' && part.text) {
        parts.push(part.text);
      }
    }
    return parts.join('\n\n');
  }
  return typeof content.text === 'string' ? content.text : '';
}

function extractChatGptDevalueTable(input) {
  for (const chunk of extractReactRouterStreamChunks(input)) {
    const trimmed = chunk.trimStart();
    if (!trimmed.startsWith('[')) {
      continue;
    }
    const value = JSON.parse(trimmed);
    if (Array.isArray(value)) {
      return value;
    }
  }
  throw new Error('ChatGPT share capture did not contain a JSON devalue table');
}

function extractReactRouterStreamChunks(input) {
  const chunks = [];
  let cursor = 0;
  while (cursor < input.length) {
    const relative = input.indexOf(ENQUEUE_MARKER, cursor);
    if (relative === -1) {
      break;
    }
    let literalStart = relative + ENQUEUE_MARKER.length;
    while (/[\s]/.test(input[literalStart] || '')) {
      literalStart += 1;
    }
    if (input[literalStart] !== '"') {
      cursor = literalStart + 1;
      continue;
    }
    const { literal, length } = extractJsonStringLiteral(
      input.slice(literalStart)
    );
    chunks.push(JSON.parse(literal));
    cursor = literalStart + length;
  }
  if (chunks.length === 0) {
    throw new Error(
      'ChatGPT share capture did not contain React Router chunks'
    );
  }
  return chunks;
}

function extractJsonStringLiteral(input) {
  if (input[0] !== '"') {
    throw new Error('expected a JSON string literal');
  }
  let index = 1;
  while (index < input.length) {
    if (input[index] === '\\') {
      index += 2;
    } else if (input[index] === '"') {
      return {
        literal: input.slice(0, index + 1),
        length: index + 1,
      };
    } else {
      index += 1;
    }
  }
  throw new Error('unterminated JSON string literal');
}

function resolveDevalueRoot(table) {
  if (!table.length) {
    throw new Error('ChatGPT devalue table was empty');
  }
  return resolveTableIndex(table, 0, []);
}

function resolveTableIndex(table, index, stack) {
  if (index >= table.length || stack.includes(index)) {
    return null;
  }
  stack.push(index);
  const value = resolveTableValue(table, table[index], stack);
  stack.pop();
  return value;
}

function resolveTableValue(table, value, stack) {
  if (Array.isArray(value)) {
    return value.map((item) => resolveEncodedReference(table, item, stack));
  }
  if (value && typeof value === 'object') {
    const resolved = {};
    for (const [encodedKey, encodedValue] of Object.entries(value)) {
      const key = resolveObjectKey(table, encodedKey, stack);
      resolved[key] = resolveEncodedReference(table, encodedValue, stack);
    }
    return resolved;
  }
  return value;
}

function resolveEncodedReference(table, value, stack) {
  if (Number.isInteger(value)) {
    if (value < 0) {
      return null;
    }
    return resolveTableIndex(table, value, stack);
  }
  return resolveTableValue(table, value, stack);
}

function resolveObjectKey(table, encodedKey, stack) {
  if (encodedKey.startsWith('_')) {
    const index = Number.parseInt(encodedKey.slice(1), 10);
    if (Number.isInteger(index)) {
      const key = resolveTableIndex(table, index, stack);
      if (typeof key === 'string') {
        return key;
      }
    }
  }
  return encodedKey;
}

function findObjectWithArrayKey(value, key) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findObjectWithArrayKey(item, key);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (value && typeof value === 'object') {
    if (Array.isArray(value[key])) {
      return value;
    }
    for (const child of Object.values(value)) {
      const found = findObjectWithArrayKey(child, key);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function parseMarkdownTranscript(input, metadata) {
  const turns = [];
  let currentRole = null;
  let currentLines = [];

  for (const line of input.split(/\r?\n/)) {
    const prefixed = markdownTurnPrefix(line);
    if (prefixed) {
      pushMarkdownTurn(turns, currentRole, currentLines, metadata);
      currentRole = prefixed.role;
      currentLines = [prefixed.rest.trimStart()];
    } else if (currentRole) {
      currentLines.push(line);
    }
  }
  pushMarkdownTurn(turns, currentRole, currentLines, metadata);

  if (turns.length === 0) {
    return unsupportedCapture({
      provider: metadata.provider,
      sourceUrl: metadata.sourceUrl,
      captureMethod: metadata.captureMethod,
      capturedAt: metadata.capturedAt,
      httpStatus: metadata.httpStatus,
      unsupportedReason: 'no_transcript_in_captured_dom',
      message: 'No compact Markdown transcript turns were found.',
      warnings: metadata.warnings,
    });
  }

  return okCapture({
    provider: metadata.provider,
    sourceUrl: metadata.sourceUrl,
    captureMethod: metadata.captureMethod,
    capturedAt: metadata.capturedAt,
    httpStatus: metadata.httpStatus,
    title: null,
    conversationId: null,
    turns,
    warnings: metadata.warnings,
  });
}

function markdownTurnPrefix(line) {
  const trimmed = line.trimStart();
  for (const [prefix, role] of [
    ['U:', 'user'],
    ['User:', 'user'],
    ['A:', 'assistant'],
    ['Assistant:', 'assistant'],
  ]) {
    if (
      trimmed.slice(0, prefix.length).toLowerCase() === prefix.toLowerCase()
    ) {
      return { role, rest: trimmed.slice(prefix.length) };
    }
  }
  return null;
}

function pushMarkdownTurn(turns, role, lines, metadata) {
  if (!role) {
    return;
  }
  const content = trimmedContentLines(lines);
  if (!content) {
    return;
  }
  turns.push({
    id: `markdown-turn-${turns.length + 1}`,
    role,
    content,
    visibility: 'visible',
    sourceEvidence: [
      {
        kind: 'markdown_transcript',
        sourceUrl: metadata.sourceUrl,
        captureMethod: metadata.captureMethod,
        pointer: `turns[${turns.length}]`,
      },
    ],
  });
}

function trimmedContentLines(lines) {
  const start = lines.findIndex((line) => line.trim());
  if (start === -1) {
    return '';
  }
  let end = lines.length - 1;
  while (end > start && !lines[end].trim()) {
    end -= 1;
  }
  return lines
    .slice(start, end + 1)
    .join('\n')
    .trim();
}

function stringField(object, key) {
  return typeof object?.[key] === 'string' ? object[key] : null;
}

function titleFromHtml(input) {
  const match = input.match(/<title>([\s\S]*?)<\/title>/i);
  if (!match) {
    return null;
  }
  const title = he.decode(match[1]).trim();
  return title.replace(/^ChatGPT\s*-\s*/i, '') || null;
}

function chatGptShareId(sourceUrl) {
  if (!sourceUrl) {
    return null;
  }
  try {
    const parsed = new URL(sourceUrl);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const shareIndex = parts.indexOf('share');
    if (shareIndex !== -1 && parts[shareIndex + 1]) {
      return parts[shareIndex + 1];
    }
  } catch {
    return null;
  }
  return null;
}

function looksLikeGoogleAiModeInterstitial(input) {
  return (
    input.includes('share.google/aimode') ||
    (input.includes('Google Search') &&
      input.includes("If you're having trouble accessing Google Search")) ||
    (input.includes('/search?q=') && input.includes('enablejs')) ||
    (input.includes('/httpservice/retry/enablejs') &&
      input.includes('Google Search'))
  );
}

/**
 * Render a URL through the repository browser abstraction and return DOM HTML.
 *
 * @param {string} url - Absolute URL
 * @param {Object} options - Browser options
 * @returns {Promise<string>} Rendered DOM
 */
export async function renderSharedDialogWithBrowser(url, options = {}) {
  const browser = await (options.createBrowser || defaultCreateBrowser)(
    options.engine || 'puppeteer'
  );
  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Charset': 'utf-8',
    });
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForTimeout?.(5000);
    return await page.content();
  } finally {
    await browser.close();
  }
}

/**
 * Fetch and normalize a shared dialog URL. Browser mode first tries static HTTP
 * because some providers expose all transcript data there, then falls back to
 * rendered DOM when the static capture is unsupported.
 *
 * @param {Object} options - Capture options
 * @returns {Promise<Object>} Normalized shared-dialog capture
 */
export async function captureSharedDialog({
  url,
  capture = 'browser',
  fetchImpl = fetch,
  renderHtml = renderSharedDialogWithBrowser,
  engine = 'puppeteer',
  now = () => new Date().toISOString(),
} = {}) {
  const sourceUrl = normalizeSourceUrl(url);
  new URL(sourceUrl);
  const capturedAt = now();
  let staticHtml = '';
  let httpStatus = 0;
  let warnings = [];

  try {
    const response = await fetchImpl(sourceUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    httpStatus = response.status || 0;
    staticHtml = await response.text();
  } catch (err) {
    warnings = [`static_http_failed: ${err.message}`];
  }

  const staticCapture = parseSharedDialog(staticHtml, {
    sourceUrl,
    captureMethod: 'static_http',
    capturedAt,
    httpStatus,
    warnings,
  });

  if (staticCapture.status === 'ok' || capture.toLowerCase() === 'api') {
    return staticCapture;
  }
  if (capture.toLowerCase() !== 'browser') {
    return withWarning(
      staticCapture,
      `unsupported_capture_method: ${capture}; use browser or api`
    );
  }

  try {
    const renderedHtml = await renderHtml(sourceUrl, { engine });
    return parseSharedDialog(renderedHtml, {
      sourceUrl,
      captureMethod: 'browser',
      capturedAt,
      warnings:
        staticCapture.status === 'unsupported'
          ? [
              ...staticCapture.diagnostics.warnings,
              `static_http_unsupported: ${staticCapture.diagnostics.unsupportedReason}`,
            ]
          : staticCapture.diagnostics.warnings,
    });
  } catch (err) {
    return withWarning(staticCapture, `browser_render_failed: ${err.message}`);
  }
}

function withWarning(capture, warning) {
  return {
    ...capture,
    diagnostics: {
      ...capture.diagnostics,
      warnings: [...(capture.diagnostics.warnings || []), warning],
    },
  };
}

function escapeLino(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function pushField(lines, indent, name, value) {
  if (value === undefined || value === null || value === '') {
    return;
  }
  lines.push(`${indent}${name} "${escapeLino(value)}"`);
}

export function formatSharedDialogAsMetaLanguage(capture) {
  const lines = ['shared_dialog_capture'];
  pushField(lines, '  ', 'provider', capture.provider);
  pushField(lines, '  ', 'sourceUrl', capture.sourceUrl);
  pushField(lines, '  ', 'captureMethod', capture.captureMethod);
  pushField(lines, '  ', 'capturedAt', capture.capturedAt);
  pushField(lines, '  ', 'status', capture.status);
  pushField(lines, '  ', 'conversationId', capture.conversationId);
  pushField(lines, '  ', 'title', capture.title);
  lines.push('  diagnostics');
  pushField(lines, '    ', 'status', capture.diagnostics.status);
  pushField(lines, '    ', 'httpStatus', capture.diagnostics.httpStatus);
  pushField(
    lines,
    '    ',
    'unsupportedReason',
    capture.diagnostics.unsupportedReason
  );
  pushField(lines, '    ', 'message', capture.diagnostics.message);
  for (const warning of capture.diagnostics.warnings || []) {
    pushField(lines, '    ', 'warning', warning);
  }
  for (const turn of capture.turns || []) {
    lines.push(`  turn "${escapeLino(turn.id)}"`);
    pushField(lines, '    ', 'role', turn.role);
    pushField(lines, '    ', 'visibility', turn.visibility);
    pushField(lines, '    ', 'content', turn.content);
    for (const evidence of turn.sourceEvidence || []) {
      lines.push('    evidence');
      pushField(lines, '      ', 'kind', evidence.kind);
      pushField(lines, '      ', 'sourceUrl', evidence.sourceUrl);
      pushField(lines, '      ', 'captureMethod', evidence.captureMethod);
      pushField(lines, '      ', 'pointer', evidence.pointer);
    }
  }
  return `${lines.join('\n')}\n`;
}

export function formatSharedDialogAsDemoMemory(
  capture,
  { demoLabel = 'web-capture-shared-dialog' } = {}
) {
  const lines = ['demo_memory'];
  if (capture.status !== 'ok') {
    lines.push('  diagnostic "shared-dialog-unsupported"');
    pushField(lines, '    ', 'provider', capture.provider);
    pushField(lines, '    ', 'sourceUrl', capture.sourceUrl);
    pushField(lines, '    ', 'captureMethod', capture.captureMethod);
    pushField(
      lines,
      '    ',
      'unsupportedReason',
      capture.diagnostics.unsupportedReason
    );
    pushField(lines, '    ', 'message', capture.diagnostics.message);
    return `${lines.join('\n')}\n`;
  }

  for (const turn of capture.turns) {
    lines.push(`  event "${escapeLino(turn.id)}"`);
    pushField(lines, '    ', 'role', turn.role);
    pushField(lines, '    ', 'content', turn.content);
    pushField(lines, '    ', 'demoLabel', demoLabel);
    pushField(lines, '    ', 'conversationId', capture.conversationId);
    pushField(lines, '    ', 'conversationTitle', capture.title);
    for (const evidence of turn.sourceEvidence || []) {
      pushField(lines, '    ', 'evidence', evidence.sourceUrl);
    }
  }
  return `${lines.join('\n')}\n`;
}

export function formatSharedDialogAsMarkdown(capture) {
  const lines = [];
  lines.push(`# ${capture.title || 'Shared Dialog Capture'}`);
  lines.push('');
  lines.push(`- Provider: \`${capture.provider}\``);
  lines.push(`- Source: ${capture.sourceUrl || ''}`);
  lines.push(`- Capture method: \`${capture.captureMethod}\``);
  lines.push(`- Status: \`${capture.status}\``);
  if (capture.conversationId) {
    lines.push(`- Conversation ID: \`${capture.conversationId}\``);
  }
  if (capture.status !== 'ok') {
    lines.push(
      `- Unsupported reason: \`${capture.diagnostics.unsupportedReason}\``
    );
    if (capture.diagnostics.message) {
      lines.push('');
      lines.push(capture.diagnostics.message);
    }
    return `${lines.join('\n')}\n`;
  }
  lines.push('');
  for (const turn of capture.turns) {
    lines.push(`**${turn.role === 'user' ? 'User' : 'Assistant'}**`);
    lines.push('');
    lines.push(turn.content);
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

export function formatSharedDialogAsText(capture) {
  if (capture.status !== 'ok') {
    return [
      `Provider: ${capture.provider}`,
      `Source: ${capture.sourceUrl || ''}`,
      `Capture method: ${capture.captureMethod}`,
      `Status: ${capture.status}`,
      `Unsupported reason: ${capture.diagnostics.unsupportedReason}`,
      capture.diagnostics.message || '',
      '',
    ].join('\n');
  }
  const lines = [];
  for (const turn of capture.turns) {
    lines.push(`${turn.role === 'user' ? 'User' : 'Assistant'}:`);
    lines.push(turn.content);
    lines.push('');
  }
  return lines.join('\n');
}

export function formatSharedDialogAsHtml(capture) {
  const markdown = formatSharedDialogAsMarkdown(capture);
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>${he.escape(capture.title || 'Shared Dialog Capture')}</title></head>
<body><pre>${he.escape(markdown)}</pre></body>
</html>
`;
}

export function formatSharedDialogResult(capture, format = 'json') {
  const normalized = format.toLowerCase();
  if (normalized === 'meta-language' || normalized === 'meta_language') {
    return formatSharedDialogAsMetaLanguage(capture);
  }
  if (normalized === 'demo-memory' || normalized === 'demo_memory') {
    return formatSharedDialogAsDemoMemory(capture);
  }
  if (normalized === 'markdown' || normalized === 'md') {
    return formatSharedDialogAsMarkdown(capture);
  }
  if (normalized === 'txt' || normalized === 'text') {
    return formatSharedDialogAsText(capture);
  }
  if (normalized === 'html') {
    return formatSharedDialogAsHtml(capture);
  }
  return `${JSON.stringify(capture, null, 2)}\n`;
}

export function sharedDialogOutputExtension(format = 'json') {
  const normalized = format.toLowerCase();
  if (normalized === 'meta-language' || normalized === 'meta_language') {
    return 'lino';
  }
  if (normalized === 'demo-memory' || normalized === 'demo_memory') {
    return 'lino';
  }
  if (normalized === 'markdown' || normalized === 'md') {
    return 'md';
  }
  if (normalized === 'txt' || normalized === 'text') {
    return 'txt';
  }
  if (normalized === 'html') {
    return 'html';
  }
  return 'json';
}

export async function sharedDialogHandler(req, res) {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('Missing `url` parameter');
  }
  const format = (req.query.format || 'json').toLowerCase();
  try {
    const capture = await captureSharedDialog({
      url,
      capture: req.query.capture || 'browser',
      engine: req.query.engine || req.query.browser || 'puppeteer',
    });
    const body = formatSharedDialogResult(capture, format);
    if (format === 'json') {
      res.type('application/json').send(body);
    } else if (format === 'markdown' || format === 'md') {
      res.type('text/markdown').send(body);
    } else if (format === 'html') {
      res.type('text/html').send(body);
    } else {
      res.type('text/plain').send(body);
    }
  } catch (err) {
    res.status(500).send(`Error capturing shared dialog: ${err.message}`);
  }
}
