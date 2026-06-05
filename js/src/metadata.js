/**
 * Article metadata extraction module.
 *
 * Extracts metadata from web pages including:
 * - Author information (name, URL, karma)
 * - Publication date and modification date
 * - Reading time and difficulty
 * - Views, votes, bookmarks, comments
 * - Hubs and tags (with URLs)
 * - Translation information
 * - LD+JSON structured data
 *
 * Based on reference implementation from:
 * https://github.com/link-foundation/meta-theory/blob/main/scripts/download-article.mjs
 */

/**
 * Extract article metadata from HTML using Cheerio.
 * Works without a browser by parsing the HTML directly.
 *
 * @param {Object} $ - Cheerio instance loaded with the page HTML
 * @returns {Object} Extracted metadata
 */
export function extractMetadata($) {
  const meta = {};

  // Author
  const authorEl = $('.tm-user-info__username');
  if (authorEl.length > 0) {
    meta.author = authorEl.text().trim();
    meta.authorUrl = authorEl.attr('href') || null;
  }

  // Publication date
  const timeEl = $('time[datetime]').first();
  if (timeEl.length > 0) {
    meta.publishDate = timeEl.attr('datetime');
    meta.publishDateText = timeEl.text().trim();
  }

  // Reading time
  const readTimeEl = $('.tm-article-reading-time__label');
  if (readTimeEl.length > 0) {
    meta.readingTime = readTimeEl.text().trim();
  }

  // Difficulty level
  const diffEl = $('.tm-article-complexity__label');
  if (diffEl.length > 0) {
    meta.difficulty = diffEl.text().trim();
  }

  // Views
  const viewsEl = $('.tm-icon-counter__value');
  if (viewsEl.length > 0) {
    meta.views = viewsEl.attr('title') || viewsEl.text().trim();
  }

  // Hubs (use specific hub link selector to avoid duplicates)
  const hubEls = $('.tm-publication-hub__link');
  if (hubEls.length > 0) {
    meta.hubs = [];
    meta.hubUrls = [];
    hubEls.each(function () {
      const nameSpan = $(this).find('span:first-child');
      const name = nameSpan.length
        ? nameSpan.text().trim()
        : $(this)
            .text()
            .trim()
            .replace(/\s*\*\s*$/, '');
      meta.hubs.push(name);
      meta.hubUrls.push({
        name,
        url: $(this).attr('href') || null,
      });
    });
  }

  // Tags from meta keywords
  const keywordsMeta = $('meta[name="keywords"]');
  if (keywordsMeta.length > 0) {
    const content = keywordsMeta.attr('content');
    if (content) {
      meta.tags = content
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }

  // Tags with URLs (from article footer)
  const tagEls = $('.tm-article-body__tags-item a, .tm-tags-list__link');
  if (tagEls.length > 0) {
    meta.tagLinks = [];
    tagEls.each(function () {
      meta.tagLinks.push({
        name: $(this).text().trim(),
        url: $(this).attr('href') || null,
      });
    });
  }

  // Translation badge
  const translationLabelEl = $('.tm-publication-label_variant-translation');
  if (translationLabelEl.length > 0) {
    meta.isTranslation = true;
    meta.translationLabel = translationLabelEl.text().trim();
  }

  // Original article link
  const originLinkEl = $('.tm-article-presenter__origin-link');
  if (originLinkEl.length > 0) {
    meta.originalArticleUrl = originLinkEl.attr('href') || null;
    const authorSpan = originLinkEl.find('span');
    if (authorSpan.length > 0) {
      meta.originalAuthors = authorSpan.text().trim();
    }
    meta.originalAuthorText = originLinkEl.text().trim();
  }

  // LD+JSON structured data
  const ldJsonScript = $('script[type="application/ld+json"]').first();
  if (ldJsonScript.length > 0) {
    try {
      const ldData = JSON.parse(ldJsonScript.html());
      if (ldData.dateModified) {
        meta.dateModified = ldData.dateModified;
      }
      if (ldData.author?.name) {
        meta.authorFullName = ldData.author.name;
      }
    } catch {
      // ignore parse errors
    }
  }

  // Votes
  const votesEl = $('.tm-votes-meter__value');
  if (votesEl.length > 0) {
    meta.votes = votesEl.text().trim();
  }

  // Comments count
  const commentsEl = $('.tm-article-comments-counter-link__value');
  if (commentsEl.length > 0) {
    meta.comments = commentsEl.text().trim();
  }

  // Bookmarks count
  const bookmarksEl = $('.bookmarks-button__counter');
  if (bookmarksEl.length > 0) {
    meta.bookmarks = bookmarksEl.text().trim();
  }

  // Author karma
  const karmaEl = $('.tm-karma__votes');
  if (karmaEl.length > 0) {
    meta.authorKarma = karmaEl.text().trim();
  }

  return meta;
}

/**
 * Format metadata as a markdown header block.
 * Placed after the title in the output markdown.
 *
 * @param {Object} metadata - Extracted metadata object
 * @returns {string[]} Array of markdown lines
 */
export function formatMetadataBlock(metadata) {
  if (!metadata) {
    return [];
  }
  const lines = [];

  // Author line
  if (metadata.author) {
    const authorName = metadata.authorFullName
      ? `${metadata.authorFullName} (${metadata.author})`
      : metadata.author;
    const authorLink = metadata.authorUrl
      ? `[${authorName}](${metadata.authorUrl})`
      : authorName;
    lines.push(`**Author:** ${authorLink}`);
  }

  // Article type (translation)
  if (metadata.isTranslation) {
    lines.push(`**Type:** ${metadata.translationLabel || 'Translation'}`);
  }

  // Original article link
  if (metadata.originalAuthors) {
    const authorsText = metadata.originalAuthors;
    if (metadata.originalArticleUrl) {
      lines.push(
        `**Original article:** [${authorsText}](${metadata.originalArticleUrl})`
      );
    } else {
      lines.push(`**Original authors:** ${authorsText}`);
    }
  }

  // Publication date
  if (metadata.publishDate) {
    const date = new Date(metadata.publishDate);
    const formatted = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    let dateLine = `**Published:** ${formatted}`;
    if (metadata.dateModified) {
      const modDate = new Date(metadata.dateModified);
      const modFormatted = modDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      if (modFormatted !== formatted) {
        dateLine += ` (updated ${modFormatted})`;
      }
    }
    lines.push(dateLine);
  }

  // Reading time and difficulty
  const infoItems = [];
  if (metadata.readingTime) {
    infoItems.push(`Reading time: ${metadata.readingTime}`);
  }
  if (metadata.difficulty) {
    infoItems.push(`Difficulty: ${metadata.difficulty}`);
  }
  if (metadata.views) {
    infoItems.push(`Views: ${metadata.views}`);
  }
  if (infoItems.length > 0) {
    lines.push(`**${infoItems.join(' | ')}**`);
  }

  // Hubs
  if (metadata.hubs && metadata.hubs.length > 0) {
    lines.push(`**Hubs:** ${metadata.hubs.join(', ')}`);
  }

  // Tags
  if (metadata.tags && metadata.tags.length > 0) {
    lines.push(`**Tags:** ${metadata.tags.join(', ')}`);
  }

  return lines;
}

/**
 * Format footer metadata block.
 * Placed at the end of the article, matching Habr article footer.
 *
 * @param {Object} metadata - Extracted metadata object
 * @returns {string[]} Array of markdown lines
 */
export function formatFooterBlock(metadata) {
  if (!metadata) {
    return [];
  }
  const lines = [];

  lines.push('---');
  lines.push('');

  // Tags with links
  if (metadata.tagLinks && metadata.tagLinks.length > 0) {
    const tagStrings = metadata.tagLinks.map((t) =>
      t.url ? `[${t.name}](${t.url})` : t.name
    );
    lines.push(`**Tags:** ${tagStrings.join(', ')}`);
    lines.push('');
  } else if (metadata.tags && metadata.tags.length > 0) {
    lines.push(`**Tags:** ${metadata.tags.join(', ')}`);
    lines.push('');
  }

  // Hubs with links
  if (metadata.hubUrls && metadata.hubUrls.length > 0) {
    const hubStrings = metadata.hubUrls.map((h) =>
      h.url ? `[${h.name}](${h.url})` : h.name
    );
    lines.push(`**Hubs:** ${hubStrings.join(', ')}`);
    lines.push('');
  } else if (metadata.hubs && metadata.hubs.length > 0) {
    lines.push(`**Hubs:** ${metadata.hubs.join(', ')}`);
    lines.push('');
  }

  // Article stats
  const stats = [];
  if (metadata.votes) {
    stats.push(`Votes: ${metadata.votes}`);
  }
  if (metadata.views) {
    stats.push(`Views: ${metadata.views}`);
  }
  if (metadata.bookmarks) {
    stats.push(`Bookmarks: ${metadata.bookmarks}`);
  }
  if (metadata.comments) {
    stats.push(`Comments: ${metadata.comments}`);
  }
  if (stats.length > 0) {
    lines.push(`**${stats.join(' | ')}**`);
    lines.push('');
  }

  // Author info
  if (metadata.author) {
    const authorName = metadata.authorFullName
      ? `${metadata.authorFullName} (${metadata.author})`
      : metadata.author;
    const authorLink = metadata.authorUrl
      ? `[${authorName}](${metadata.authorUrl})`
      : authorName;
    let authorLine = `**Author:** ${authorLink}`;
    if (metadata.authorKarma) {
      authorLine += ` | Karma: ${metadata.authorKarma}`;
    }
    lines.push(authorLine);
    lines.push('');
  }

  return lines;
}
