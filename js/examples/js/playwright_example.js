import fetch from 'node-fetch';
import fs from 'fs';

const baseUrl = 'http://localhost:3000';
const targetUrl = 'https://example.com';

console.log('Fetching HTML using Playwright engine...');
const htmlResponse = await fetch(
  `${baseUrl}/html?url=${encodeURIComponent(targetUrl)}&engine=playwright`
);
const html = await htmlResponse.text();
fs.writeFileSync('output/playwright_html.html', html);
console.log('HTML saved to output/playwright_html.html');

console.log('Fetching screenshot using Playwright engine...');
const imageResponse = await fetch(
  `${baseUrl}/image?url=${encodeURIComponent(targetUrl)}&engine=playwright`
);
const imageBuffer = await imageResponse.buffer();
fs.writeFileSync('output/playwright_screenshot.png', imageBuffer);
console.log('Screenshot saved to output/playwright_screenshot.png');

console.log('Done! Both requests used Playwright engine.');
