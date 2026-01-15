# NoteOne Competitors

Quick reference for competitive analysis.

## Note-Taking Apps

| App | Type | Storage | Frontmatter | Sync | Platform |
|-----|------|---------|-------------|------|----------|
| Obsidian | Local-first markdown | Local files | YAML (created, modified) | Paid sync or git | Desktop, Mobile |
| Notion | Cloud-based | Proprietary DB | Export only | Built-in | Web, Desktop, Mobile |
| Bear | Native markdown | SQLite | Export only | iCloud | macOS, iOS |
| Ulysses | Native markdown | Proprietary | Export only | iCloud | macOS, iOS |
| Logseq | Local-first outliner | Local files | Properties (different syntax) | Git | Desktop |
| Apple Notes | Cloud-based | iCloud DB | None | iCloud | macOS, iOS |
| OneNote | Cloud-based | OneDrive | None | Built-in | All platforms |

## Static Site Generators (relevant for format compatibility)

| Tool | Frontmatter Format |
|------|-------------------|
| Jekyll | YAML (`date`, `modified`) |
| Hugo | YAML/TOML (`date`, `lastmod`) |
| Eleventy | YAML (`date`) |

## Common Frontmatter Fields

```yaml
---
title: Page Title
created: 2024-01-15T10:30:00
modified: 2024-01-15T14:22:00
tags: [tag1, tag2]
---
```

## Migration Considerations

- **From Obsidian**: Direct compatibility if using same frontmatter fields
- **From Notion**: Export to markdown, frontmatter included
- **From Bear/Ulysses**: Export to markdown, may need to add frontmatter
- **From Logseq**: Convert property syntax to YAML
- **From OneNote**: No good export path (main NoteOne motivation)
