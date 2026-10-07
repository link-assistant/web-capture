import nock from 'nock';

// Nock 15 interceptors survive Jest VM contexts unless explicitly restored.
// https://github.com/nock/nock#memory-issues-with-jest
afterAll(() => {
  nock.cleanAll();
  nock.restore();
});

export default nock;
