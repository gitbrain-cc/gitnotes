# Section Metadata

Each section folder can have a `.section.md` file to configure display name, color, and page sorting.

## Location

```
notes/
├── my-section/
│   ├── .section.md    <-- section metadata
│   ├── page-one.md
│   └── page-two.md
```

## Format

```yaml
---
title: My Section
color: "#e8a849"
sort: modified-desc
pinned:
  - important.md
order:
  - page1.md
  - page2.md
---

Optional description (not displayed in app).
```

## Supported Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `title` | string | folder name | Display name in sidebar |
| `color` | hex string | none | Ribbon/accent color |
| `sort` | string | `alpha-asc` | Page sort order |
| `pinned` | array | `[]` | Filenames pinned to top of list |
| `order` | array | `[]` | Manual page order (only with `sort: manual`) |

## Sort Options

| Value | Description |
|-------|-------------|
| `alpha-asc` | A-Z alphabetical |
| `alpha-desc` | Z-A alphabetical |
| `created-asc` | Oldest first (by creation date) |
| `created-desc` | Newest first (by creation date) |
| `modified-asc` | Least recently modified first |
| `modified-desc` | Most recently modified first |
| `manual` | Custom order from `order` array |

## Preset Colors

The color picker offers these presets:

| Name | Hex |
|------|-----|
| Orange/Gold | `#e8a849` |
| Coral Red | `#e85d5d` |
| Magenta | `#d65db1` |
| Purple | `#845ec2` |
| Green | `#4a9f4a` |
| Cyan | `#00b4d8` |
| Blue | `#5b8def` |
| Brown | `#8b7355` |

Any valid hex color works (`#RGB` or `#RRGGBB`).

## Examples

### Basic - Just a display name

```yaml
---
title: Weekly Notes
---
```

### With color and sort

```yaml
---
title: Project Ideas
color: "#845ec2"
sort: modified-desc
---
```

### Pinned pages

```yaml
---
title: Documentation
sort: alpha-asc
pinned:
  - getting-started.md
  - faq.md
---
```

Pinned pages appear at the top regardless of sort order.

### Manual ordering

```yaml
---
title: Chapters
sort: manual
order:
  - 01-introduction.md
  - 02-setup.md
  - 03-basics.md
  - 04-advanced.md
---
```

Pages not in the `order` array appear after listed pages, sorted alphabetically.
