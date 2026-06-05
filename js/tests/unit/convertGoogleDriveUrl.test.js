import {
  convertGoogleDriveUrl,
  getGoogleDriveFileId,
  googleDriveImageTextForUrl,
  isGoogleDriveFileUrl,
} from '../../src/lib.js';

const FIRST_FILE_ID = '1Cxkx6-428EQAX0-eiaq66H829ohnPp7q';
const SECOND_FILE_ID = '1fgJaftjv53xCN7vgiJOaQlbfWkUqPgyd';

function directDownloadUrl(fileId) {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

describe('Google Drive URL helpers', () => {
  it.each([
    [
      'issue URL with /view',
      `https://drive.google.com/file/d/${FIRST_FILE_ID}/view`,
      FIRST_FILE_ID,
    ],
    [
      'issue URL without /view',
      `https://drive.google.com/file/d/${FIRST_FILE_ID}`,
      FIRST_FILE_ID,
    ],
    [
      'second issue URL with /view',
      `https://drive.google.com/file/d/${SECOND_FILE_ID}/view`,
      SECOND_FILE_ID,
    ],
    [
      'second issue URL without /view',
      `https://drive.google.com/file/d/${SECOND_FILE_ID}`,
      SECOND_FILE_ID,
    ],
    [
      'open?id URL',
      `https://drive.google.com/open?id=${FIRST_FILE_ID}`,
      FIRST_FILE_ID,
    ],
    [
      'direct uc URL',
      `https://drive.google.com/uc?export=download&id=${FIRST_FILE_ID}`,
      FIRST_FILE_ID,
    ],
    [
      'redirected usercontent URL',
      `https://drive.usercontent.google.com/download?id=${FIRST_FILE_ID}&export=download`,
      FIRST_FILE_ID,
    ],
  ])('extracts and converts %s', (_name, input, fileId) => {
    expect(getGoogleDriveFileId(input)).toBe(fileId);
    expect(isGoogleDriveFileUrl(input)).toBe(true);
    expect(convertGoogleDriveUrl(input)).toBe(directDownloadUrl(fileId));
  });

  it('ignores non-Google Drive URLs and malformed Drive IDs', () => {
    const example = 'https://example.com/image.jpg';
    const malformed = 'https://drive.google.com/file/d/not%20valid/view';

    expect(getGoogleDriveFileId(example)).toBeNull();
    expect(isGoogleDriveFileUrl(example)).toBe(false);
    expect(convertGoogleDriveUrl(example)).toBe(example);
    expect(getGoogleDriveFileId(malformed)).toBeNull();
    expect(isGoogleDriveFileUrl(malformed)).toBe(false);
    expect(convertGoogleDriveUrl(malformed)).toBe(malformed);
  });

  it('keeps empty or missing inputs unchanged when converting', () => {
    expect(convertGoogleDriveUrl(null)).toBeNull();
    expect(convertGoogleDriveUrl(undefined)).toBeUndefined();
    expect(convertGoogleDriveUrl('')).toBe('');
  });

  it('renders text output with the original file URL and direct image URL', () => {
    const input = `https://drive.google.com/file/d/${FIRST_FILE_ID}/view`;

    expect(googleDriveImageTextForUrl(input)).toContain(
      `Original Google Drive file: ${input}`
    );
    expect(googleDriveImageTextForUrl(input)).toContain(
      `Image: ${directDownloadUrl(FIRST_FILE_ID)}`
    );
    expect(
      googleDriveImageTextForUrl('https://example.com/image.jpg')
    ).toBeNull();
  });
});
