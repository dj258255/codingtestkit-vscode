import * as cheerio from 'cheerio';

/**
 * Converts an HTML string to Markdown.
 * Handles headings, paragraphs, line breaks, bold, italic, code, pre blocks,
 * lists, links, images, tables, blockquotes, and horizontal rules.
 */
export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) {
    return '';
  }

  const $ = cheerio.load(html);

  // Process the body content
  const result = processNode($, $.root());
  return cleanOutput(result);
}

// --- Node processing ---

function processNode($: cheerio.CheerioAPI, node: cheerio.Cheerio<any>): string {
  const parts: string[] = [];

  node.contents().each((_i, child) => {
    if (child.type === 'text') {
      const text = $(child).text();
      parts.push(text);
    } else if (child.type === 'tag') {
      const el = $(child);
      const tagName = child.tagName?.toLowerCase() ?? '';
      parts.push(processElement($, el, tagName));
    }
  });

  return parts.join('');
}

function processElement(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<any>,
  tagName: string,
): string {
  switch (tagName) {
    // Headings
    case 'h1':
      return `\n\n# ${processNode($, el).trim()}\n\n`;
    case 'h2':
      return `\n\n## ${processNode($, el).trim()}\n\n`;
    case 'h3':
      return `\n\n### ${processNode($, el).trim()}\n\n`;
    case 'h4':
      return `\n\n#### ${processNode($, el).trim()}\n\n`;
    case 'h5':
      return `\n\n##### ${processNode($, el).trim()}\n\n`;
    case 'h6':
      return `\n\n###### ${processNode($, el).trim()}\n\n`;

    // Paragraph
    case 'p':
      return `\n\n${processNode($, el).trim()}\n\n`;

    // Line break
    case 'br':
      return '\n';

    // Bold
    case 'strong':
    case 'b': {
      const inner = processNode($, el).trim();
      return inner ? `**${inner}**` : '';
    }

    // Italic
    case 'em':
    case 'i': {
      const inner = processNode($, el).trim();
      return inner ? `*${inner}*` : '';
    }

    // Inline code
    case 'code': {
      // If inside a <pre>, don't wrap with backticks (handled by pre)
      const parent = el.parent();
      if (parent.length > 0 && parent.prop('tagName')?.toLowerCase() === 'pre') {
        return processNode($, el);
      }
      const inner = processNode($, el);
      if (inner.includes('`')) {
        return `\`\` ${inner} \`\``;
      }
      return `\`${inner}\``;
    }

    // Preformatted / code blocks
    case 'pre': {
      const codeEl = el.find('code');
      let codeText: string;
      if (codeEl.length > 0) {
        codeText = codeEl.text();
      } else {
        codeText = el.text();
      }
      // Detect language from class
      let lang = '';
      const codeClass = (codeEl.length > 0 ? codeEl.attr('class') : el.attr('class')) ?? '';
      const langMatch = codeClass.match(/(?:language-|lang-)(\w+)/);
      if (langMatch) {
        lang = langMatch[1];
      }
      return `\n\n\`\`\`${lang}\n${codeText.replace(/\n$/, '')}\n\`\`\`\n\n`;
    }

    // Unordered list
    case 'ul': {
      const items = processListItems($, el, 'ul', 0);
      return `\n\n${items}\n\n`;
    }

    // Ordered list
    case 'ol': {
      const items = processListItems($, el, 'ol', 0);
      return `\n\n${items}\n\n`;
    }

    // List item (handled by processListItems, but in case it appears standalone)
    case 'li': {
      const inner = processNode($, el).trim();
      return `- ${inner}\n`;
    }

    // Link
    case 'a': {
      const href = el.attr('href') ?? '';
      const text = processNode($, el).trim();
      if (!href || href === text) {
        return text;
      }
      return `[${text}](${href})`;
    }

    // Image
    case 'img': {
      const alt = el.attr('alt') ?? '';
      const src = el.attr('src') ?? '';
      return `![${alt}](${src})`;
    }

    // Table
    case 'table':
      return `\n\n${processTable($, el)}\n\n`;

    // Blockquote
    case 'blockquote': {
      const inner = processNode($, el).trim();
      const lines = inner.split('\n');
      const quoted = lines.map((line) => `> ${line}`).join('\n');
      return `\n\n${quoted}\n\n`;
    }

    // Horizontal rule
    case 'hr':
      return '\n\n---\n\n';

    // Div, section, article - block-level containers
    case 'div':
    case 'section':
    case 'article':
    case 'main':
    case 'header':
    case 'footer':
    case 'nav':
      return `\n\n${processNode($, el).trim()}\n\n`;

    // Span, sup, sub, small, mark - inline containers
    case 'span':
    case 'sup':
    case 'sub':
    case 'small':
    case 'mark':
    case 'u':
    case 'del':
    case 's':
      return processNode($, el);

    // Definition list
    case 'dl':
    case 'dt':
    case 'dd':
      return processNode($, el);

    // Skip script and style tags
    case 'script':
    case 'style':
    case 'noscript':
      return '';

    // Fallback: process children
    default:
      return processNode($, el);
  }
}

// --- List processing ---

function processListItems(
  $: cheerio.CheerioAPI,
  listEl: cheerio.Cheerio<any>,
  listType: 'ul' | 'ol',
  depth: number,
): string {
  const lines: string[] = [];
  const indent = '  '.repeat(depth);
  let counter = 1;

  listEl.children('li').each((_i, liNode) => {
    const li = $(liNode);
    const parts: string[] = [];

    // Process immediate text content (not nested lists)
    li.contents().each((_j, child) => {
      if (child.type === 'text') {
        const text = $(child).text();
        if (text.trim()) {
          parts.push(text.trim());
        }
      } else if (child.type === 'tag') {
        const childTag = child.tagName?.toLowerCase() ?? '';
        if (childTag === 'ul') {
          // Nested unordered list
          const nested = processListItems($, $(child), 'ul', depth + 1);
          parts.push('\n' + nested);
        } else if (childTag === 'ol') {
          // Nested ordered list
          const nested = processListItems($, $(child), 'ol', depth + 1);
          parts.push('\n' + nested);
        } else {
          parts.push(processElement($, $(child), childTag));
        }
      }
    });

    const content = parts.join('').trim();
    const bullet = listType === 'ol' ? `${counter}.` : '-';
    // Handle multiline content in list items
    const contentLines = content.split('\n');
    if (contentLines.length > 1) {
      lines.push(`${indent}${bullet} ${contentLines[0]}`);
      for (let k = 1; k < contentLines.length; k++) {
        lines.push(contentLines[k]);
      }
    } else {
      lines.push(`${indent}${bullet} ${content}`);
    }
    counter++;
  });

  return lines.join('\n');
}

// --- Table processing ---

function processTable($: cheerio.CheerioAPI, tableEl: cheerio.Cheerio<any>): string {
  const rows: string[][] = [];
  let headerRowCount = 0;

  // Process thead rows
  tableEl.find('thead tr').each((_i, trNode) => {
    const cells: string[] = [];
    $(trNode)
      .find('th, td')
      .each((_j, cellNode) => {
        cells.push(processNode($, $(cellNode)).trim());
      });
    rows.push(cells);
    headerRowCount++;
  });

  // Process tbody rows
  tableEl.find('tbody tr').each((_i, trNode) => {
    const cells: string[] = [];
    $(trNode)
      .find('th, td')
      .each((_j, cellNode) => {
        cells.push(processNode($, $(cellNode)).trim());
      });
    rows.push(cells);
  });

  // If no thead, treat first <tr> with <th> elements as header
  if (rows.length === 0) {
    tableEl.find('tr').each((_i, trNode) => {
      const cells: string[] = [];
      $(trNode)
        .find('th, td')
        .each((_j, cellNode) => {
          cells.push(processNode($, $(cellNode)).trim());
        });
      rows.push(cells);
    });

    // Check if first row has <th> elements
    const firstTr = tableEl.find('tr').first();
    if (firstTr.find('th').length > 0) {
      headerRowCount = 1;
    }
  }

  if (rows.length === 0) {
    return '';
  }

  // Normalize column count
  const colCount = Math.max(...rows.map((r) => r.length));
  for (const row of rows) {
    while (row.length < colCount) {
      row.push('');
    }
  }

  // Calculate column widths
  const widths: number[] = [];
  for (let col = 0; col < colCount; col++) {
    let maxWidth = 3; // minimum "---"
    for (const row of rows) {
      maxWidth = Math.max(maxWidth, row[col].length);
    }
    widths.push(maxWidth);
  }

  // Build table
  const lines: string[] = [];

  // If no header was detected, use first row as header
  const headerEnd = headerRowCount > 0 ? headerRowCount : 1;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = row.map((cell, col) => cell.padEnd(widths[col]));
    lines.push(`| ${cells.join(' | ')} |`);

    // Separator after header rows
    if (i === headerEnd - 1) {
      const sep = widths.map((w) => '-'.repeat(w));
      lines.push(`| ${sep.join(' | ')} |`);
    }
  }

  return lines.join('\n');
}

// --- Clean output ---

function cleanOutput(text: string): string {
  // Collapse triple+ newlines to double newlines
  let result = text.replace(/\n{3,}/g, '\n\n');
  // Trim leading/trailing whitespace
  result = result.trim();
  // Ensure single trailing newline
  if (result && !result.endsWith('\n')) {
    result += '\n';
  }
  return result;
}
