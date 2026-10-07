// Bound memory with node --max-old-space-size=256 when probing HTTP interception.
import nock from '../../js/node_modules/nock/dist/index.js';
import fetch from '../../js/node_modules/node-fetch/src/index.js';
nock('https://example.test').get('/fixture').reply(200, 'exact mocked bytes');
try {
  const response = await fetch('https://example.test/fixture');
  console.log(response.status, await response.text());
} finally { nock.cleanAll(); nock.restore(); }
