export interface FrontMatter {
  created?: string;
  [key: string]: string | undefined;  // Preserve unknown fields
}

export interface ParsedNote {
  frontmatter: FrontMatter;
  body: string;
}

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontMatter(content: string): ParsedNote {
  const match = content.match(FRONTMATTER_REGEX);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const yamlContent = match[1];
  const body = content.slice(match[0].length);
  const frontmatter: FrontMatter = {};

  // Simple YAML parsing - preserve all key-value pairs
  const lines = yamlContent.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Strip surrounding quotes (YAML quoted strings)
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key && value) {
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body };
}

export function serializeFrontMatter(frontmatter: FrontMatter, body: string): string {
  const lines: string[] = [];

  // Output all frontmatter fields
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value) {
      lines.push(`${key}: ${value}`);
    }
  }

  if (lines.length === 0) {
    return body;
  }

  return `---\n${lines.join('\n')}\n---\n${body}`;
}

export function getFrontMatterRange(content: string): { start: number; end: number } | null {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) return null;
  return { start: 0, end: match[0].length };
}
