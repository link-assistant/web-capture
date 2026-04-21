export function renderBlocksMarkdown(blocks) {
  const counters = new Map();
  const rendered = blocks.map((block) => {
    if (block.type === 'table') {
      counters.clear();
      return { text: renderTableMarkdown(block), list: null, quote: false };
    }
    const counterKey = block.list
      ? `${block.list.id || ''}\u0000${block.list.level || 0}`
      : null;
    if (block.list) {
      for (const key of [...counters.keys()]) {
        const level = Number(key.split('\u0000')[1]);
        if (level > (block.list.level || 0)) {
          counters.delete(key);
        }
      }
      const next = (counters.get(counterKey) || 0) + 1;
      counters.set(counterKey, next);
      return {
        text: renderParagraphMarkdown(block, { orderedIndex: next }),
        list: block.list,
        quote: Boolean(block.quote),
      };
    }
    counters.clear();
    return {
      text: renderParagraphMarkdown(block),
      list: null,
      quote: Boolean(block.quote),
    };
  });

  const joined = [];
  for (let i = 0; i < rendered.length; i++) {
    const cur = rendered[i];
    if (!cur.text) {
      continue;
    }
    if (joined.length > 0) {
      const prev = rendered
        .slice(0, i)
        .reverse()
        .find((entry) => entry.text);
      const sameList =
        cur.list && prev?.list && (cur.list.id || '') === (prev.list.id || '');
      if (sameList) {
        joined.push('\n');
      } else if (cur.quote && prev?.quote) {
        joined.push('\n>\n');
      } else {
        joined.push('\n\n');
      }
    }
    joined.push(cur.text);
  }
  const markdown = joined.join('').trimEnd();
  return markdown ? `${markdown}\n` : '';
}

function renderParagraphMarkdown(block, context = {}) {
  const text = renderContentMarkdown(block.content).trim();
  if (block.horizontalRule) {
    return '---';
  }
  const style = block.style || '';
  const headingMatch = style.match(/^HEADING_(\d)$/u);
  if (headingMatch) {
    return `${'#'.repeat(Number(headingMatch[1]))} ${text}`;
  }
  if (style === 'TITLE') {
    return `# ${text}`;
  }
  if (style === 'SUBTITLE') {
    return `## ${text}`;
  }
  if (block.list) {
    const indent = '  '.repeat(Math.max(0, block.list.level || 0));
    const orderedIndex = Math.max(1, Number(context.orderedIndex) || 1);
    const marker = block.list.ordered ? `${orderedIndex}.` : '-';
    return `${indent}${marker} ${text}`;
  }
  if (block.quote) {
    return text
      .split('\n')
      .map((line) => (line ? `> ${line}` : '>'))
      .join('\n');
  }
  return text;
}

function renderTableMarkdown(table) {
  if (!table.rows.length) {
    return '';
  }
  const width = Math.max(...table.rows.map((row) => row.cells.length), 1);
  const rows = table.rows.map((row) =>
    Array.from({ length: width }, (_, idx) =>
      escapeMarkdownTableCell(
        renderContentMarkdown(row.cells[idx]?.content || [])
      )
    )
  );
  const separator = Array.from({ length: width }, () => '---');
  return [rows[0], separator, ...rows.slice(1)]
    .map((row) => `| ${row.join(' | ')} |`)
    .join('\n');
}

function renderContentMarkdown(content = []) {
  const rendered = [];
  for (let idx = 0; idx < content.length; idx++) {
    const node = content[idx];
    if (node.type === 'image') {
      rendered.push(node.url ? `![${node.alt || 'image'}](${node.url})` : '');
      continue;
    }

    const link = node.link || null;
    const linkNodes = [node];
    while (
      content[idx + 1]?.type === 'text' &&
      (content[idx + 1].link || null) === link
    ) {
      linkNodes.push(content[++idx]);
    }
    const label = renderTextRunsMarkdown(linkNodes);
    rendered.push(link ? `[${label}](${link})` : label);
  }
  return rendered.join('');
}

function renderTextRunsMarkdown(nodes = []) {
  const inactive = { bold: false, italic: false, strike: false };
  let active = { ...inactive };
  let output = '';
  for (const node of nodes) {
    const next = {
      bold: Boolean(node.bold),
      italic: Boolean(node.italic),
      strike: Boolean(node.strike),
    };
    output += markdownStyleTransition(active, next);
    output += node.text || '';
    active = next;
  }
  output += markdownStyleTransition(active, inactive);
  return output;
}

function markdownStyleTransition(active, next) {
  const styles = [
    ['bold', '**'],
    ['italic', '*'],
    ['strike', '~~'],
  ];
  let markers = '';
  for (const [key, marker] of [...styles].reverse()) {
    if (active[key] && !next[key]) {
      markers += marker;
    }
  }
  for (const [key, marker] of styles) {
    if (!active[key] && next[key]) {
      markers += marker;
    }
  }
  return markers;
}

function escapeMarkdownTableCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}
