# Page Sorting Feature

## Overview

Add sorting options for pages within a section, matching OneNote's functionality.

## Sort Options

| Option | Toggle | Default |
|--------|--------|---------|
| Alphabetical | A→Z / Z→A | A→Z |
| Date Created | Newest / Oldest first | Newest |
| Date Modified | Newest / Oldest first | Newest |

Clicking an active sort option toggles its direction.

## Storage

Per-section in `.order.json`:

```json
{
  "sort": "alpha-asc"
}
```

Values: `alpha-asc`, `alpha-desc`, `created-asc`, `created-desc`, `modified-asc`, `modified-desc`

Default: `alpha-asc`

## Frontmatter Standard

Dates stored in YAML frontmatter for portability (survives git clone, compatible with Obsidian/Jekyll/Hugo):

```yaml
---
created: 2024-01-15T10:30:00
modified: 2024-01-15T14:22:00
---
```

**Behavior:**
- New files: Auto-create frontmatter with both timestamps
- On save: Auto-update `modified` timestamp
- Existing files without frontmatter: Fall back to filesystem dates

## UI Components

### Sort Button
- Location: Right side of "PAGES" header
- Appearance: Small SVG sort icon (~16x16px)
- Behavior: Click toggles floating menu

### Sort Menu (floating box)
- Follows existing git-modal pattern
- Anchored below sort button
- 3 rows with sort option + direction arrow
- Active option shows current direction (↑/↓)
- Click outside closes menu

```
┌─────────────────────┐
│ Alphabetical     ↓  │
│ Date Created     ↓  │
│ Date Modified    ↓  │
└─────────────────────┘
```

## Data Changes

### Rust `Page` struct

Add timestamp fields:

```rust
pub struct Page {
    pub name: String,
    pub path: String,
    pub filename: String,
    pub created: u64,   // Unix timestamp
    pub modified: u64,  // Unix timestamp
}
```

### New Tauri commands

- `get_sort_preference(section_path)` → returns current sort string
- `set_sort_preference(section_path, sort)` → saves to `.order.json`

### Updated `list_pages`

- Parse frontmatter for created/modified times
- Fall back to filesystem dates if no frontmatter
- Sort based on preference before returning

### Updated `write_page`

- Parse existing frontmatter (if any)
- Update `modified` timestamp
- Add frontmatter if missing (with both timestamps)
- Preserve other frontmatter fields

## Frontend Implementation

### New file: `src/sortmenu.ts`

- `initSortMenu()` - initialize button and menu
- Handle click events for toggling menu and selecting options
- Close on outside click

### Changes to `src/sidebar.ts`

- Export `refreshPages()` for sort menu to trigger reload after preference change

### HTML structure

```html
<div id="sort-container">
  <button id="sort-btn"><!-- SVG icon --></button>
  <div id="sort-menu">
    <div class="sort-option" data-sort="alpha">Alphabetical <span class="sort-arrow"></span></div>
    <div class="sort-option" data-sort="created">Date Created <span class="sort-arrow"></span></div>
    <div class="sort-option" data-sort="modified">Date Modified <span class="sort-arrow"></span></div>
  </div>
</div>
```

### CSS (follows git-modal pattern)

```css
#sort-menu {
  display: none;
  position: absolute;
  background: var(--bg-primary);
  border: 1px solid var(--accent-color);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  min-width: 160px;
}

#sort-container.active #sort-menu {
  display: block;
}
```

## Behavior

1. Click sort button → toggle menu visibility
2. Click option:
   - Same as current → toggle direction
   - Different → apply with default direction
3. Save preference to `.order.json`
4. Reload pages list
5. Close menu
6. Click outside menu → close menu
