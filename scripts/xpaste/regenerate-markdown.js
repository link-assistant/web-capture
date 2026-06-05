import { readFileSync, writeFileSync } from "fs";
import {
  appendTextPasteMarkdownAttachment,
  convertHtmlToMarkdown,
} from "../../js/src/lib.js";

const url = "https://xpaste.pro/p/t4q0Lsp0";
const html = readFileSync("./tests/xpaste/data/t4q0Lsp0-page.html", "utf-8");
const rawText = readFileSync(
  "./tests/xpaste/data/t4q0Lsp0-actual-content.txt",
  "utf-8",
);
const pageMarkdown = convertHtmlToMarkdown(html, url);
const markdown = appendTextPasteMarkdownAttachment(pageMarkdown, url, rawText);
writeFileSync("./tests/xpaste/data/t4q0Lsp0-page.md", markdown);

console.log("✅ Markdown regenerated successfully");
console.log("\nFirst 30 lines:");
console.log(markdown.split("\n").slice(0, 30).join("\n"));

console.log("\n\n=== Checking key elements ===");
const lines = markdown.split("\n");
const headingLine = lines.findIndex((line) => line.includes("Упакуем пароль"));
const formatLine = lines.findIndex((line) => line.includes("Формат:"));
const languageLine = lines.findIndex(
  (line) => line.includes("[Ru]") || line.includes("[En]"),
);

console.log(`Heading "Упакуем пароль..." at line: ${headingLine + 1}`);
console.log(`Format metadata at line: ${formatLine + 1}`);
console.log(`Language links at line: ${languageLine + 1}`);

if (headingLine < formatLine) {
  console.log("✅ Heading comes before metadata (correct order)");
} else {
  console.log("❌ Heading comes after metadata (incorrect order)");
}
