# Notes Directory Format

NoteOne stores notes as plain markdown files in a directory structure. No proprietary formats, no database - just files you can read, edit, and version control.

## Directory Structure

```
notes/
├── .order.json              # Section ordering
├── section-name/
│   ├── .section.md          # Section metadata (frontmatter)
│   ├── page-one.md
│   └── page-two.md
└── another-section/
    ├── .section.md
    └── notes.md
```

## Section Metadata (`.section.md`)

Each section can have a `.section.md` file with YAML frontmatter to configure display name, color, sorting, and more.

```yaml
---
title: Weekly Notes
color: "#e8a849"
sort: modified-desc
pinned:
  - important.md
order:
  - page1.md
  - page2.md
---

Optional section description here (not displayed in app yet).
```

### Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `title` | string | folder name | Display name shown in sidebar |
| `color` | hex string | none | Ribbon color (e.g., `"#e8a849"`) |
| `sort` | string | `alpha-asc` | Page sort order (see below) |
| `pinned` | array | `[]` | Filenames pinned to top |
| `order` | array | `[]` | Manual page order (only used with `sort: manual`) |

### Sort Options

- `alpha-asc` / `alpha-desc` - Alphabetical by name
- `created-asc` / `created-desc` - By creation date
- `modified-asc` / `modified-desc` - By last modified date
- `manual` - Custom order defined in `order` array

### Preset Colors

The color picker offers these presets:

| Color | Hex |
|-------|-----|
| Orange/Gold | `#e8a849` |
| Coral Red | `#e85d5d` |
| Magenta | `#d65db1` |
| Purple | `#845ec2` |
| Green | `#4a9f4a` |
| Cyan | `#00b4d8` |
| Blue | `#5b8def` |
| Brown | `#8b7355` |

## Page Frontmatter

Individual pages use YAML frontmatter for timestamps:

```yaml
---
created: 2025-01-15T10:30:00
modified: 2025-01-15T14:22:00
---

# Page Title

Content here...
```

NoteOne auto-manages `created` and `modified` timestamps on save.

## Root `.order.json`

Controls section ordering in the sidebar:

```json
{
  "sections": [
    "1-weeks",
    "1-todo",
    "projects",
    "archive"
  ]
}
```

Sections not listed appear alphabetically after listed ones.

## Why This Format?

- **Portable** - Standard markdown, works with any editor
- **Git-friendly** - Text files diff and merge cleanly
- **Industry standard** - Same frontmatter pattern as Hugo, Jekyll, Obsidian
- **Future-proof** - Your notes aren't locked in a database
