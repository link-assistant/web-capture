import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = process.argv[2] || 'https://example.com';
const endpoint = `http://localhost:3000/html?url=${encodeURIComponent(url)}`;

fetch(endpoint)
  .then((res) => {
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    return res.text();
  })
  .then((text) => {
    const outputPath = path.join(__dirname, 'downloaded.html');
    fs.writeFileSync(outputPath, text, 'utf-8');
    console.log(`HTML saved to ${outputPath}`);
  })
  .catch((err) => {
    console.error('Error:', err);
  });
