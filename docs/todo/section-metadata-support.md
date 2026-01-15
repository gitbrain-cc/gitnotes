# Section Metadata Support for OneNote Importer

## Goal

Adapt the importer to output `.section.md` files with YAML frontmatter, respecting original OneNote material.

## Target Format

```yaml
---
displayName: Weekly Notes
color: "#ff6b35"
order:
  - 2025-03.md
  - 2025-02.md
collapsed: false
---

Optional section description here...
```

## Mapping from OneNote

| OneNote | `.section.md` field |
|---------|---------------------|
| Section name (docx filename) | `displayName` |
| Page order (by creation date) | `order` array |
| N/A | `color` (omit or default) |
| N/A | `collapsed` (default `false`) |

## Folder Naming

Folder names should be URL-safe slugs derived from section names:

| Original Section | Folder | `displayName` |
|------------------|--------|---------------|
| `Business.docx` | `business/` | `"Business"` |
| `Home & Family.docx` | `home-family/` | `"Home & Family"` |
| `IA Notes.docx` | `ia-notes/` | `"IA Notes"` |

Slugify rules:
- Lowercase
- Replace spaces/special chars with hyphens
- Collapse multiple hyphens
- Trim leading/trailing hyphens

## Order Array

Pages sorted by `createdAt` timestamp (oldest first, matching current behavior). Array contains filenames only:

```yaml
order:
  - old-note.md
  - newer-note.md
  - newest-note.md
```

## Implementation Changes

### `index.ts`

1. After processing all pages for a section, generate `.section.md`:

```typescript
async function writeSectionMetadata(
  sectionDir: string,
  displayName: string,
  pageFilenames: string[]
): Promise<void> {
  const frontmatter = {
    displayName,
    order: pageFilenames,
    collapsed: false,
  };

  const yaml = Object.entries(frontmatter)
    .map(([k, v]) => {
      if (Array.isArray(v)) {
        return `${k}:\n${v.map(f => `  - ${f}`).join('\n')}`;
      }
      if (typeof v === 'string') return `${k}: "${v}"`;
      return `${k}: ${v}`;
    })
    .join('\n');

  const content = `---\n${yaml}\n---\n`;
  await writeFile(join(sectionDir, '.section.md'), content, 'utf-8');
}
```

2. Add `slugify()` function for folder names:

```typescript
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

3. Update `processDocx()`:
   - Use `slugify(sectionName)` for folder name
   - Track page filenames in order
   - Call `writeSectionMetadata()` after all pages written

### File structure output

```
brain/
├── business/
│   ├── .section.md          # displayName: "Business"
│   ├── old-meeting.md
│   └── recent-meeting.md
├── home-family/
│   ├── .section.md          # displayName: "Home & Family"
│   └── ...
```

## Preserving Original Material

- **Section names**: Exact original name in `displayName`
- **Page titles**: Preserved as-is in `# Title` header
- **Creation dates**: In frontmatter `created:` field
- **Page order**: Chronological by original creation date
- **Content**: Converted markdown, no modifications
