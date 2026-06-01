import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = process.argv[2] || 'https://example.com';
const endpoint = `http://localhost:3000/image?url=${encodeURIComponent(url)}`;

fetch(endpoint)
  .then((res) => {
    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers.get('content-type'));
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    return res.arrayBuffer();
  })
  .then((buffer) => {
    const buf = Buffer.from(buffer);
    const pngSignature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    if (buf.slice(0, 8).equals(pngSignature)) {
      const outputPath = path.join(__dirname, 'downloaded.png');
      fs.writeFileSync(outputPath, buf);
      console.log(`Image saved to ${outputPath} (valid PNG)`);
    } else {
      console.log(
        'Response is not a valid PNG! First bytes:',
        buf.slice(0, 16)
      );
    }
  })
  .catch((err) => {
    console.error('Error:', err);
  });
