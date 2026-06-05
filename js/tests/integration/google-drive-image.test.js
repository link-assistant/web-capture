import request from 'supertest';
import nock from 'nock';
import unzipper from 'unzipper';
import { app } from '../../src/index.js';

const FIRST_FILE_ID = '1Cxkx6-428EQAX0-eiaq66H829ohnPp7q';
const SECOND_FILE_ID = '1fgJaftjv53xCN7vgiJOaQlbfWkUqPgyd';
const JPEG_BYTES = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/ASP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/ASP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Ap//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EFBQRAQAAAAAAAAAAAAAAAAAAARD/2gAIAQMBAT8QH//EFBQRAQAAAAAAAAAAAAAAAAAAARD/2gAIAQIBAT8QH//EFBABAQAAAAAAAAAAAAAAAAAAARD/2gAIAQEAAT8QH//Z',
  'base64'
);

const DRIVE_URLS = [
  {
    name: 'first issue URL with /view',
    fileId: FIRST_FILE_ID,
    url: `https://drive.google.com/file/d/${FIRST_FILE_ID}/view`,
  },
  {
    name: 'first issue URL without /view',
    fileId: FIRST_FILE_ID,
    url: `https://drive.google.com/file/d/${FIRST_FILE_ID}`,
  },
  {
    name: 'second issue URL with /view',
    fileId: SECOND_FILE_ID,
    url: `https://drive.google.com/file/d/${SECOND_FILE_ID}/view`,
  },
  {
    name: 'second issue URL without /view',
    fileId: SECOND_FILE_ID,
    url: `https://drive.google.com/file/d/${SECOND_FILE_ID}`,
  },
];

function directDownloadUrl(fileId) {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

function mockDriveHead(fileId) {
  return nock('https://drive.google.com')
    .head('/uc')
    .query({ export: 'download', id: fileId })
    .reply(200, '', { 'content-type': 'image/jpeg' });
}

function mockDriveGet(fileId) {
  return nock('https://drive.google.com')
    .get('/uc')
    .query({ export: 'download', id: fileId })
    .reply(200, JPEG_BYTES, {
      'content-type': 'image/jpeg',
      'content-length': String(JPEG_BYTES.length),
    });
}

function bufferParser(res, callback) {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

afterEach(() => {
  nock.cleanAll();
});

describe('Google Drive public image links', () => {
  it.each(DRIVE_URLS)(
    '/image downloads image bytes for $name',
    async (item) => {
      mockDriveGet(item.fileId);

      const res = await request(app)
        .get('/image')
        .query({ url: item.url })
        .buffer(true)
        .parse(bufferParser)
        .expect(200);

      expect(res.headers['content-type']).toMatch(/^image\/jpeg/);
      expect(res.body.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
      expect(nock.isDone()).toBe(true);
    }
  );

  it.each(DRIVE_URLS)(
    '/fetch proxies direct image bytes for $name',
    async (item) => {
      mockDriveGet(item.fileId);

      const res = await request(app)
        .get('/fetch')
        .query({ url: item.url })
        .buffer(true)
        .parse(bufferParser)
        .expect(200);

      expect(res.headers['content-type']).toMatch(/^image\/jpeg/);
      expect(res.body.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
      expect(nock.isDone()).toBe(true);
    }
  );

  it.each(DRIVE_URLS)(
    '/stream proxies direct image bytes for $name',
    async (item) => {
      mockDriveGet(item.fileId);

      const res = await request(app)
        .get('/stream')
        .query({ url: item.url })
        .buffer(true)
        .parse(bufferParser)
        .expect(200);

      expect(res.headers['content-type']).toMatch(/^image\/jpeg/);
      expect(res.body.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
      expect(nock.isDone()).toBe(true);
    }
  );

  it.each(DRIVE_URLS)(
    '/markdown includes a direct image link for $name',
    async (item) => {
      mockDriveHead(item.fileId);

      const res = await request(app)
        .get('/markdown')
        .query({ url: item.url })
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/markdown/);
      expect(res.text).toContain(
        `![Google Drive image](${directDownloadUrl(item.fileId)})`
      );
      expect(nock.isDone()).toBe(true);
    }
  );

  it.each(DRIVE_URLS)(
    '/txt includes the original and direct image links for $name',
    async (item) => {
      mockDriveHead(item.fileId);

      const res = await request(app)
        .get('/txt')
        .query({ url: item.url })
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/plain/);
      expect(res.text).toContain('Google Drive image');
      expect(res.text).toContain(`Original Google Drive file: ${item.url}`);
      expect(res.text).toContain(`Image: ${directDownloadUrl(item.fileId)}`);
      expect(nock.isDone()).toBe(true);
    }
  );

  it.each(DRIVE_URLS)(
    '/html includes a direct image tag for $name',
    async (item) => {
      mockDriveHead(item.fileId);

      const res = await request(app)
        .get('/html')
        .query({ url: item.url })
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain(
        `src="${directDownloadUrl(item.fileId).replace('&', '&amp;')}"`
      );
      expect(nock.isDone()).toBe(true);
    }
  );

  it('archive includes markdown and the downloaded Drive image', async () => {
    const item = DRIVE_URLS[0];
    mockDriveHead(item.fileId);
    mockDriveGet(item.fileId);

    const res = await request(app)
      .get('/archive')
      .query({ url: item.url })
      .buffer(true)
      .parse(bufferParser)
      .expect(200);

    const zip = await unzipper.Open.buffer(res.body);
    const document = zip.files.find((file) => file.path === 'document.md');
    const image = zip.files.find((file) => file.path.startsWith('images/'));

    expect(document).toBeDefined();
    expect(image).toBeDefined();
    expect((await document.buffer()).toString('utf8')).toContain(
      '![Google Drive image](images/image-1.jpg)'
    );
    expect((await image.buffer()).subarray(0, 3)).toEqual(
      Buffer.from([0xff, 0xd8, 0xff])
    );
    expect(nock.isDone()).toBe(true);
  });

  it('docx includes the downloaded Drive image', async () => {
    const item = DRIVE_URLS[0];
    mockDriveHead(item.fileId);
    mockDriveGet(item.fileId);

    const res = await request(app)
      .get('/docx')
      .query({ url: item.url })
      .buffer(true)
      .parse(bufferParser)
      .expect(200);

    expect(res.headers['content-type']).toMatch(
      /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/
    );
    expect(res.body.subarray(0, 2)).toEqual(Buffer.from('PK'));

    const docx = await unzipper.Open.buffer(res.body);
    const mediaEntry = docx.files.find(
      (file) => file.path.startsWith('word/media/') && !file.path.endsWith('/')
    );
    expect(mediaEntry).toBeDefined();
    expect((await mediaEntry.buffer()).subarray(0, 3)).toEqual(
      Buffer.from([0xff, 0xd8, 0xff])
    );
    expect(nock.isDone()).toBe(true);
  });

  it('pdf renders the downloaded Drive image document', async () => {
    const item = DRIVE_URLS[0];
    mockDriveGet(item.fileId);

    const res = await request(app)
      .get('/pdf')
      .query({ url: item.url })
      .buffer(true)
      .parse(bufferParser)
      .expect(200);

    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.body.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(nock.isDone()).toBe(true);
  });
});
