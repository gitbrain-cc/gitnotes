# Page Frontmatter

NoteOne uses YAML frontmatter at the top of markdown files to store page metadata.

## Format

```yaml
---
created: 2025-01-15T10:30:00
modified: 2025-01-15T14:22:00
---

Your note content here...
```

## Supported Properties

| Property | Type | Auto-managed | Description |
|----------|------|--------------|-------------|
| `created` | ISO 8601 timestamp | Yes | When the page was first created |
| `modified` | ISO 8601 timestamp | Yes | When the page was last saved |

## Behavior

- **Auto-creation**: New pages get `created` and `modified` set automatically
- **Auto-update**: `modified` updates on every save
- **Migration**: Files without frontmatter get timestamps added from filesystem metadata
- **Preservation**: Unknown properties are preserved (not stripped)

## Timestamp Format

Timestamps use ISO 8601 format without timezone:

```
2025-01-15T10:30:00
```

NoteOne stores local time, not UTC.

## Sorting

Frontmatter timestamps are used when sorting pages by:
- `created-asc` / `created-desc`
- `modified-asc` / `modified-desc`

See [Section Metadata](section-metadata.md) for configuring sort order.

## Example

```yaml
---
created: 2025-01-15T10:30:00
modified: 2025-01-15T14:22:00
---

# Meeting Notes

Discussion points from today's standup...
```
