# Note Header with Front Matter

## Overview

Add a visual header to notes showing title, creation date, and git-based modification info. Uses YAML front matter for `created` timestamp and git for modification history.

## Front Matter Format

Minimal YAML at the top of each `.md` file:

```yaml
---
created: 2026-01-13T00:30:00
---
```

- `created`: Set once on file creation or migrated from filesystem
- No `modified` field - git is the source of truth

## Visual Header

Rendered inside CodeMirror as a widget at document position 0, scrolling with content:

```
┌─────────────────────────────────────────┐
│  2020-43                                │  ← Large title (filename sans .md)
│  Created 3 days ago · Simon, 2h ago     │  ← Relative dates, git author
├─────────────────────────────────────────┤
│  MONDAY                                 │  ← Markdown content
│  - IDEA new magento order...            │
```

### Title Source

Filename without `.md` extension.

### Date Display Format

Relative + absolute: "Created 3 days ago · Simon, 2 hours ago"

### Git Status Indicators

| State | Display |
|-------|---------|
| Clean (committed) | `Simon, 2 hours ago` |
| Uncommitted changes | `Modified · not committed` |
| Untracked file | `New · not in git` |
| Not a git repo | `Modified 2 hours ago` (filesystem fallback) |

## Implementation

### Rust Backend (`src-tauri/src/lib.rs`)

New commands:

```rust
#[tauri::command]
fn get_file_metadata(path: String) -> Result<FileMetadata, String>

struct FileMetadata {
    created: Option<String>,  // ISO timestamp from filesystem
}

#[tauri::command]
fn get_git_info(path: String) -> Result<GitInfo, String>

struct GitInfo {
    last_commit_date: Option<String>,
    last_commit_author: Option<String>,
    is_dirty: bool,
    is_tracked: bool,
    is_git_repo: bool,
}
```

**Auto-commit on save:**
- Default behavior: commit with message `Update {filename}`
- Future: settings toggle to disable for expert mode

### Frontend

**New file: `src/frontmatter.ts`**
- `parseFrontMatter(content: string)` → `{ frontmatter: object, body: string }`
- `serializeFrontMatter(frontmatter: object, body: string)` → `string`

**Modified: `src/editor.ts`**
- `StateField` to track front matter boundaries
- `Decoration.replace` to hide front matter block
- `Decoration.widget` to render header at position 0
- Header is read-only, content below is editable

**Modified: `src/main.ts`**
- On page load: parse front matter, fetch git info, render header
- On save: preserve front matter, auto-commit, refresh git info

**Modified: `src/styles/main.css`**
- Header title: ~24px, prominent
- Header dates: ~12px, muted color

### Migration for Existing Files

When opening a file without front matter:
1. Read filesystem creation date (`birthtime`)
2. Add front matter with `created` timestamp
3. Save file (triggers auto-commit)

## Flow Diagrams

### Page Load
```
read_page → parse front matter → get_git_info → render header widget
```

### Page Save
```
get content → rebuild front matter → write_page → auto-commit → refresh git info
```

## Future Considerations

- Expert mode: disable auto-commit in settings
- Additional front matter fields (tags, etc.) can be added later
- Full-text search could index front matter fields
