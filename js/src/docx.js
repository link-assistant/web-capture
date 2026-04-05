/**
 * DOCX export handler.
 *
 * Converts a web page to a DOCX document with embedded images.
 * Uses the page's markdown conversion and the `docx` library to build the document.
 *
 * Query parameters:
 *   url    (required) - URL to convert
 *   engine - 'puppeteer' or 'playwright' (only used for browser rendering fallback)
 */

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  ImageRun,
  ExternalHyperlink,
} from 'docx';
import { fetchHtml, convertRelativeUrls } from './lib.js';

export async function docxHandler(req, res) {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('Missing `url` parameter');
  }

  try {
    const absoluteUrl = url.startsWith('http') ? url : `https://${url}`;
    const html = await fetchHtml(absoluteUrl);
    const absHtml = convertRelativeUrls(html, absoluteUrl);
    const $ = cheerio.load(absHtml);

    // Remove unwanted elements
    $('style, script, noscript, nav, footer, header').remove();

    // Build DOCX sections from HTML structure
    const children = [];

    // Extract title
    const title = $('h1').first().text().trim() || $('title').text().trim();
    if (title) {
      children.push(
        new Paragraph({ text: title, heading: HeadingLevel.TITLE })
      );
    }

    // Process body content
    const body = $('article').length ? $('article') : $('body');
    for (const el of body.children().toArray()) {
      const tagName = (el.tagName || '').toLowerCase();
      const text = $(el).text().trim();

      if (!text && tagName !== 'img' && tagName !== 'figure') {
        continue;
      }

      if (tagName === 'h1') {
        children.push(new Paragraph({ text, heading: HeadingLevel.HEADING_1 }));
      } else if (tagName === 'h2') {
        children.push(new Paragraph({ text, heading: HeadingLevel.HEADING_2 }));
      } else if (tagName === 'h3') {
        children.push(new Paragraph({ text, heading: HeadingLevel.HEADING_3 }));
      } else if (tagName === 'h4' || tagName === 'h5' || tagName === 'h6') {
        children.push(new Paragraph({ text, heading: HeadingLevel.HEADING_4 }));
      } else if (tagName === 'figure' || tagName === 'img') {
        const img = tagName === 'img' ? $(el) : $(el).find('img').first();
        const src = img.attr('src');
        if (src && !src.startsWith('data:')) {
          try {
            const imgUrl = new URL(src, absoluteUrl).href;
            const imgResp = await fetch(imgUrl);
            if (imgResp.ok) {
              const buffer = await imgResp.buffer();
              children.push(
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: buffer,
                      transformation: { width: 600, height: 400 },
                      type: guessImageType(imgUrl),
                    }),
                  ],
                })
              );
            }
          } catch {
            /* skip failed image embeds */
          }
        }
        // Add caption if present
        const caption = $(el).find('figcaption').text().trim();
        if (caption) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: caption, italics: true })],
            })
          );
        }
      } else if (tagName === 'ul' || tagName === 'ol') {
        $(el)
          .find('li')
          .each(function () {
            const liText = $(this).text().trim();
            if (liText) {
              children.push(
                new Paragraph({
                  text: liText,
                  bullet: { level: 0 },
                })
              );
            }
          });
      } else if (tagName === 'pre' || tagName === 'code') {
        children.push(
          new Paragraph({
            children: [new TextRun({ text, font: 'Courier New', size: 20 })],
          })
        );
      } else if (tagName === 'a') {
        const href = $(el).attr('href');
        if (href && text) {
          children.push(
            new Paragraph({
              children: [
                new ExternalHyperlink({
                  children: [
                    new TextRun({
                      text,
                      style: 'Hyperlink',
                    }),
                  ],
                  link: href,
                }),
              ],
            })
          );
        }
      } else {
        // Default: treat as paragraph
        if (text) {
          children.push(new Paragraph({ text }));
        }
      }
    }

    if (children.length === 0) {
      children.push(new Paragraph({ text: 'No content extracted.' }));
    }

    const doc = new Document({
      sections: [{ children }],
    });

    const buffer = await Packer.toBuffer(doc);

    res.set(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.set('Content-Disposition', 'attachment; filename="page.docx"');
    res.end(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating DOCX');
  }
}

function guessImageType(url) {
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) {
    return 'jpg';
  }
  if (pathname.endsWith('.gif')) {
    return 'gif';
  }
  return 'png';
}
