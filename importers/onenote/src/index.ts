#!/usr/bin/env node
/**
 * OneNote to Markdown importer for NoteOne.
 *
 * Converts OneNote exports (.docx) to individual markdown files,
 * preserving page structure and creation dates.
 *
 * Usage:
 *   noteone-import-onenote --input ./exports --output ./notes
 */

import { readdir, mkdir, writeFile, utimes, stat } from 'fs/promises';
import { join, basename, extname } from 'path';
import { docxToMarkdown } from './converter.js';
import { splitMarkdown, sanitizeFilename, type Page } from './splitter.js';

/** Convert section name to normalized folder name (kebab-case) */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, '$1-$2') // camelCase -> camel-case
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumeric -> dash
    .replace(/^-+|-+$/g, '') // trim dashes
    .replace(/-+/g, '-'); // collapse multiple dashes
}

interface Args {
  input: string;
  output: string;
  help: boolean;
}

function parseArgs(): Args {
  const args: Args = {
    input: '',
    output: '',
    help: false,
  };

  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--input' || arg === '-i') {
      args.input = argv[++i] || '';
    } else if (arg === '--output' || arg === '-o') {
      args.output = argv[++i] || '';
    }
  }

  return args;
}

function printHelp(): void {
  console.log(`
OneNote to Markdown Importer for NoteOne

USAGE:
  noteone-import-onenote --input <dir> --output <dir>

OPTIONS:
  -i, --input <dir>   Directory containing .docx files exported from OneNote
  -o, --output <dir>  Directory to write markdown files to
  -h, --help          Show this help message

EXAMPLE:
  noteone-import-onenote --input ~/Downloads/onenote-export --output ~/notes

NOTES:
  To export from OneNote:
  1. Open OneNote on Windows
  2. File > Export > Section or Notebook
  3. Choose "Word Document (.docx)" format
  4. Save each section as a .docx file
`);
}

async function processDocx(
  docxPath: string,
  outputDir: string
): Promise<number> {
  const sectionName = basename(docxPath, extname(docxPath));
  console.log(`\nProcessing: ${sectionName}`);

  // Convert docx to markdown
  const markdown = await docxToMarkdown(docxPath);

  // Split into pages
  const pages = splitMarkdown(markdown);

  if (pages.length === 0) {
    // No page headers found, save as single file
    console.log('  No page headers found, keeping as single file');
    const folderName = slugify(sectionName);
    const sectionDir = join(outputDir, folderName);
    await mkdir(sectionDir, { recursive: true });

    const outPath = join(sectionDir, `${sanitizeFilename(sectionName)}.md`);
    await writeFile(outPath, markdown, 'utf-8');
    return 1;
  }

  console.log(`  Found ${pages.length} pages`);

  // Create section directory with normalized name
  const folderName = slugify(sectionName);
  const sectionDir = join(outputDir, folderName);
  await mkdir(sectionDir, { recursive: true });

  // Sort pages by date (oldest first) for file creation order
  const sortedPages = [...pages].sort((a, b) => {
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  // Track used filenames to avoid collisions
  const usedNames = new Set<string>();

  for (const page of sortedPages) {
    let filename = sanitizeFilename(page.title) + '.md';

    // Handle filename collisions
    let counter = 1;
    while (usedNames.has(filename.toLowerCase())) {
      filename = `${sanitizeFilename(page.title)}_${counter}.md`;
      counter++;
    }
    usedNames.add(filename.toLowerCase());

    const filePath = join(sectionDir, filename);

    // Build content with front-matter (only created - no H1)
    let content = page.content;
    if (page.createdAt) {
      const isoDate = page.createdAt.toISOString().slice(0, 19);
      content = `---\ncreated: ${isoDate}\n---\n\n${page.content}`;
    }

    await writeFile(filePath, content, 'utf-8');

    // Set file modification time if we have a date
    if (page.createdAt) {
      await utimes(filePath, page.createdAt, page.createdAt);
    }

    const dateInfo = page.createdAt
      ? page.createdAt.toISOString().slice(0, 16).replace('T', ' ')
      : 'unknown date';
    console.log(`  -> ${filename} (${dateInfo})`);
  }

  return pages.length;
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.input || !args.output) {
    console.error('Error: --input and --output are required');
    console.error('Run with --help for usage information');
    process.exit(1);
  }

  // Verify input directory exists
  try {
    const inputStat = await stat(args.input);
    if (!inputStat.isDirectory()) {
      console.error(`Error: ${args.input} is not a directory`);
      process.exit(1);
    }
  } catch {
    console.error(`Error: Input directory not found: ${args.input}`);
    process.exit(1);
  }

  // Create output directory
  await mkdir(args.output, { recursive: true });

  // Find all docx files
  const files = await readdir(args.input);
  const docxFiles = files.filter(f => f.endsWith('.docx'));

  if (docxFiles.length === 0) {
    console.error(`Error: No .docx files found in ${args.input}`);
    process.exit(1);
  }

  console.log(`Found ${docxFiles.length} .docx files`);
  console.log('='.repeat(60));

  let totalPages = 0;

  for (const file of docxFiles.sort()) {
    const fullPath = join(args.input, file);
    totalPages += await processDocx(fullPath, args.output);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Done! Imported ${totalPages} pages to: ${args.output}`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
