import fs from 'fs';
import path from 'path';

import {
  captureSharedDialog,
  formatSharedDialogResult,
} from './shared-dialog.js';

export async function runSharedDialogCli(sharedDialogUrl, options = {}) {
  const format = (options.format || 'json').toLowerCase();
  const capture = await captureSharedDialog({
    url: sharedDialogUrl,
    capture: options.capture,
    engine: options.engine,
  });
  const body = formatSharedDialogResult(capture, format);

  if (options.output && options.output !== '-') {
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, body, 'utf-8');
    console.error(`Shared dialog (${format}) saved to: ${options.output}`);
  } else {
    process.stdout.write(body);
  }
}
