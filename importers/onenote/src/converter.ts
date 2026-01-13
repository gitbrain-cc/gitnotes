/**
 * Convert docx files to markdown using mammoth.
 */

import mammoth from 'mammoth';
import { readFile } from 'fs/promises';

export async function docxToMarkdown(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);

  // Convert to HTML first (mammoth's markdown output is limited)
  const result = await mammoth.convertToHtml({ buffer });

  if (result.messages.length > 0) {
    for (const msg of result.messages) {
      if (msg.type === 'error') {
        console.warn(`Warning in ${filePath}: ${msg.message}`);
      }
    }
  }

  // Convert HTML to simple markdown
  return htmlToMarkdown(result.value);
}

function htmlToMarkdown(html: string): string {
  let md = html;

  // Headers
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');

  // Bold and italic
  md = md.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i>(.*?)<\/i>/gi, '*$1*');

  // Strikethrough
  md = md.replace(/<s>(.*?)<\/s>/gi, '~~$1~~');
  md = md.replace(/<strike>(.*?)<\/strike>/gi, '~~$1~~');
  md = md.replace(/<del>(.*?)<\/del>/gi, '~~$1~~');

  // Links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

  // Line breaks and paragraphs
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<\/p>/gi, '\n\n');
  md = md.replace(/<p[^>]*>/gi, '');

  // Lists - handle nested lists
  md = processLists(md);

  // Remove remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  md = decodeHtmlEntities(md);

  // Clean up extra whitespace
  md = md.replace(/\n{3,}/g, '\n\n');
  md = md.trim();

  return md;
}

function processLists(html: string): string {
  let result = html;

  // Process unordered lists
  result = result.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, content) => {
    return processListItems(content, '-') + '\n';
  });

  // Process ordered lists
  result = result.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, content) => {
    return processListItems(content, '1.') + '\n';
  });

  return result;
}

function processListItems(content: string, marker: string): string {
  const items: string[] = [];
  const regex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match;

  while ((match = regex.exec(content)) !== null) {
    let itemContent = match[1].trim();

    // Handle nested lists recursively
    itemContent = processLists(itemContent);

    // Remove any remaining p tags inside list items
    itemContent = itemContent.replace(/<\/?p[^>]*>/gi, '');

    // Indent nested content
    const lines = itemContent.split('\n');
    const formattedLines = lines.map((line, i) => {
      if (i === 0) {
        return `${marker} ${line}`;
      }
      return `  ${line}`;
    });

    items.push(formattedLines.join('\n'));
  }

  return items.join('\n');
}

function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&ndash;': '–',
    '&mdash;': '—',
    '&lsquo;': "'",
    '&rsquo;': "'",
    '&ldquo;': '"',
    '&rdquo;': '"',
    '&hellip;': '…',
  };

  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'g'), char);
  }

  // Handle numeric entities
  result = result.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  result = result.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));

  return result;
}
