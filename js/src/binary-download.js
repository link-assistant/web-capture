import { retry } from './retry.js';

// Shared image-download policy; keep HTTP errors distinct from network retries.
export async function downloadBinary(url) {
  const response = await retry(() => fetch(url), {
    retries: 3,
    baseDelay: 1000,
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}
