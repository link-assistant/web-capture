import fetch from 'node-fetch';
import fs from 'fs';

const baseUrl = 'http://localhost:3000';
const targetUrl = 'https://example.com';

console.log('Comparing Puppeteer and Playwright engines...\n');

// Fetch using Puppeteer
console.log('1. Fetching HTML using Puppeteer (default)...');
const startPuppeteer = Date.now();
const puppeteerResponse = await fetch(
  `${baseUrl}/html?url=${encodeURIComponent(targetUrl)}`
);
const puppeteerHtml = await puppeteerResponse.text();
const puppeteerTime = Date.now() - startPuppeteer;
fs.writeFileSync('output/puppeteer_comparison.html', puppeteerHtml);
console.log(`   Time: ${puppeteerTime}ms`);
console.log(`   Size: ${puppeteerHtml.length} bytes`);

// Fetch using Playwright
console.log('\n2. Fetching HTML using Playwright...');
const startPlaywright = Date.now();
const playwrightResponse = await fetch(
  `${baseUrl}/html?url=${encodeURIComponent(targetUrl)}&engine=playwright`
);
const playwrightHtml = await playwrightResponse.text();
const playwrightTime = Date.now() - startPlaywright;
fs.writeFileSync('output/playwright_comparison.html', playwrightHtml);
console.log(`   Time: ${playwrightTime}ms`);
console.log(`   Size: ${playwrightHtml.length} bytes`);

// Summary
console.log('\n=== Summary ===');
console.log(`Puppeteer: ${puppeteerTime}ms, ${puppeteerHtml.length} bytes`);
console.log(`Playwright: ${playwrightTime}ms, ${playwrightHtml.length} bytes`);
console.log(`Difference: ${Math.abs(puppeteerTime - playwrightTime)}ms`);

console.log('\nResults saved to output/ directory.');
