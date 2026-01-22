# OneNote Importer for GitNotes

Import your OneNote notes to GitNotes by converting `.docx` exports to markdown files.

## Features

- Converts OneNote Word exports to clean markdown
- Splits multi-page sections into individual files
- Preserves page creation dates (file modification times)
- Supports English and French date formats
- No quote escaping issues (unlike pandoc)

## Prerequisites

- Node.js 18+
- OneNote notes exported as `.docx` files

## Installation

```bash
cd importers/onenote
npm install
```

## Usage

```bash
# Run directly
npm run dev -- --input ~/Downloads/onenote-export --output ~/notes

# Or build and run
npm run build
node dist/index.js --input ~/Downloads/onenote-export --output ~/notes
```

### Options

| Option | Description |
|--------|-------------|
| `-i, --input <dir>` | Directory containing .docx files from OneNote |
| `-o, --output <dir>` | Directory to write markdown files to |
| `-h, --help` | Show help message |

## How to Export from OneNote

1. Open OneNote on Windows
2. Go to **File > Export**
3. Select a Section or Notebook
4. Choose **Word Document (.docx)** format
5. Save each section as a separate `.docx` file
6. Transfer the `.docx` files to your machine

## Output Structure

```
output/
  SectionName/
    Page Title.md
    Another Page.md
    ...
  AnotherSection/
    ...
```

Each markdown file contains:
- `# Title` header matching the original page title
- Original page content converted to markdown
- File modification date set to the original creation date

## Development

```bash
# Run with hot reload
npm run dev -- --input ./test-data --output ./test-output

# Type check
npx tsc --noEmit
```
