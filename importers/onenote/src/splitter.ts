/**
 * Split OneNote markdown export into individual pages.
 * Each page is identified by: Title, Date line, Time line.
 */

import { isDateLine, isTimeLine, parseDate } from './dates.js';

export interface Page {
  title: string;
  dateStr: string;
  timeStr: string;
  content: string;
  createdAt: Date | null;
}

interface HeaderMatch {
  title: string;
  dateStr: string;
  timeStr: string;
  contentStart: number;
}

function findHeaderAt(lines: string[], start: number): HeaderMatch | null {
  if (start >= lines.length) {
    return null;
  }

  let i = start;
  const title = lines[i].trim();
  if (!title) {
    return null;
  }

  i++;

  // Skip blank lines after title (up to 3)
  let blanks = 0;
  while (i < lines.length && !lines[i].trim() && blanks < 3) {
    i++;
    blanks++;
  }

  if (i >= lines.length) {
    return null;
  }

  const dateStr = lines[i].trim();
  if (!isDateLine(dateStr)) {
    return null;
  }

  i++;

  // Skip blank lines after date (up to 3)
  blanks = 0;
  while (i < lines.length && !lines[i].trim() && blanks < 3) {
    i++;
    blanks++;
  }

  if (i >= lines.length) {
    return null;
  }

  const timeStr = lines[i].trim();
  if (!isTimeLine(timeStr)) {
    return null;
  }

  return {
    title,
    dateStr,
    timeStr,
    contentStart: i + 1,
  };
}

export function splitMarkdown(content: string): Page[] {
  const lines = content.split('\n');
  const pages: Page[] = [];

  let i = 0;
  while (i < lines.length) {
    const header = findHeaderAt(lines, i);

    if (header) {
      const contentLines: string[] = [];
      let j = header.contentStart;

      // Collect content until next header
      while (j < lines.length) {
        const nextHeader = findHeaderAt(lines, j);
        if (nextHeader) {
          break;
        }
        contentLines.push(lines[j]);
        j++;
      }

      // Trim leading/trailing blank lines from content
      while (contentLines.length > 0 && !contentLines[0].trim()) {
        contentLines.shift();
      }
      while (contentLines.length > 0 && !contentLines[contentLines.length - 1].trim()) {
        contentLines.pop();
      }

      pages.push({
        title: header.title,
        dateStr: header.dateStr,
        timeStr: header.timeStr,
        content: contentLines.join('\n'),
        createdAt: parseDate(header.dateStr, header.timeStr),
      });

      i = j;
      continue;
    }

    i++;
  }

  return pages;
}

export function sanitizeFilename(name: string): string {
  // Replace invalid filename characters
  let safe = name.replace(/[<>:"/\\|?*]/g, '-');
  // Collapse multiple spaces
  safe = safe.replace(/\s+/g, ' ');
  // Trim dots and spaces from edges
  safe = safe.replace(/^[.\s]+|[.\s]+$/g, '');
  // Limit length
  return safe.slice(0, 100);
}
