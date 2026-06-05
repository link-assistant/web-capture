#!/usr/bin/env node
/**
 * Test script to fetch xpaste.pro HTML and convert to markdown
 * This helps us understand what the markdown extraction looks like
 */

import {
  appendTextPasteMarkdownAttachment,
  convertHtmlToMarkdown,
} from "../../js/src/lib.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testXpasteHtmlToMarkdown() {
  const url = "https://xpaste.pro/p/t4q0Lsp0";

  console.log("Fetching HTML from:", url);
  const response = await fetch(url);
  const html = await response.text();
  const rawResponse = await fetch(`${url}/raw`);
  const rawText = await rawResponse.text();

  // Save the HTML for reference
  const htmlPath = path.join(
    __dirname,
    "../../tests/xpaste/data/t4q0Lsp0-page.html",
  );
  fs.writeFileSync(htmlPath, html);
  console.log("Saved HTML to:", htmlPath);
  const rawPath = path.join(
    __dirname,
    "../../tests/xpaste/data/t4q0Lsp0-actual-content.txt",
  );
  fs.writeFileSync(rawPath, rawText);
  console.log("Saved raw text to:", rawPath);

  // Convert to markdown
  console.log("\nConverting to markdown...");
  const pageMarkdown = convertHtmlToMarkdown(html, url);
  const markdown = appendTextPasteMarkdownAttachment(
    pageMarkdown,
    url,
    rawText,
  );

  // Save the markdown
  const mdPath = path.join(
    __dirname,
    "../../tests/xpaste/data/t4q0Lsp0-page.md",
  );
  fs.writeFileSync(mdPath, markdown);
  console.log("Saved markdown to:", mdPath);

  // Analyze the markdown
  const lines = markdown.split("\n");
  console.log("\nMarkdown statistics:");
  console.log("- Total lines:", lines.length);
  console.log("- Total characters:", markdown.length);

  // Check for key elements from the screenshot
  const checks = [
    { name: "Page title/header", pattern: /xpaste|упакует/i },
    { name: "Format info", pattern: /формат|format.*text/i },
    { name: "Creation date", pattern: /07\.07\.2021|время создания/i },
    { name: "SQL query #1", pattern: /User@Host.*1703313381.*1138102510/i },
    { name: "SQL query content", pattern: /SELECT.*phpbb_posts/i },
    { name: "Footer text", pattern: /southbridge|справка|политика/i },
  ];

  console.log("\nContent checks:");
  checks.forEach((check) => {
    const found = check.pattern.test(markdown);
    console.log(`- ${check.name}: ${found ? "✓" : "✗"}`);
  });

  // Show first 500 chars of markdown
  console.log("\nFirst 500 characters of markdown:");
  console.log(markdown.substring(0, 500));
  console.log("...\n");

  // Show last 300 chars of markdown
  console.log("Last 300 characters of markdown:");
  console.log("...");
  console.log(markdown.substring(markdown.length - 300));
}

testXpasteHtmlToMarkdown().catch(console.error);
