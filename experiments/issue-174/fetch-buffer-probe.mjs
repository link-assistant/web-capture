// Verify that binary responses preserve bytes without deprecated node-fetch APIs.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fetchHandler } from '../../js/src/fetch.js';
const warnings = [];
process.on('warning', (warning) => warnings.push(warning.message));
const bytes = Buffer.from([0, 255, 127, 128]);
const server = createServer((_req, response) => {
  response.writeHead(200, { 'Content-Type': 'application/octet-stream' });
  response.end(bytes);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
try {
  const response = {
    status() {
      return this;
    },
    setHeader() {
      return this;
    },
    send(body) {
      assert.deepEqual(body, bytes);
      return this;
    },
  };
  await fetchHandler(
    { query: { url: `http://127.0.0.1:${server.address().port}/` } },
    response
  );
  await new Promise(setImmediate);
  assert.equal(
    warnings.filter((message) => message.includes('response.buffer()')).length,
    0
  );
  console.log(
    'Binary response bytes preserved; no deprecated buffer API warning.'
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
}
