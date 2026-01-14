# Unified Search Bar

**Date:** 2026-01-14
**Status:** Draft

## Overview

Replace the Quick Switcher modal with a unified search bar at the top of the window. Combines filename navigation and full-text content search into a single entry point, similar to VS Code's command palette.

## UI Behavior

**Trigger:** Click the search bar or press `Cmd+P` to focus it.

**Dropdown states:**

| State | Behavior |
|-------|----------|
| Focused, empty query | Shows "Recent Files" (last 5-8) and "Recent Searches" (last 5 queries) |
| Typing < 3 chars | Fuzzy filename matches only (fast navigation) |
| Typing ≥ 3 chars | Filename matches first, then content matches with snippets |

**Result format for content matches:**
```
1-weeks / 2024-03.md
...working on the Magento migration next week...
```

**Keyboard navigation:**
- `↑/↓` - Move selection
- `Enter` - Open selected result
- `Esc` - Close dropdown, return focus to editor

**Selection behavior:** Opening a content match scrolls to the first matching line and briefly highlights it.

## Layout

```
┌─────────────────────────────────────────────────┐
│  🔍 Search files and content...                 │  ← Search bar (always visible)
├────────┬────────────┬───────────────────────────┤
│Sections│   Pages    │        Editor             │
│        │            │                           │
```

Search bar fixed at top, full width. Dropdown appears below, max height ~400px with scroll.

## Search Backend (Tantivy)

**Index location:** `~/.config/noteone/search-index/`

**Indexed fields per document:**

| Field | Purpose |
|-------|---------|
| `path` | Full file path (stored, for retrieval) |
| `filename` | Filename without extension (for filename search) |
| `section` | Parent folder name (for display) |
| `content` | Full markdown content (tokenized, for full-text search) |
| `modified` | Last modified timestamp (for ranking recency) |

**Index lifecycle:**

1. **Startup:** Check if index exists. If not, full rebuild. If yes, quick integrity check.
2. **File watcher:** Monitor notes directory using `notify` crate. Debounce 500ms to handle git operations.
3. **On file change:** Update only the affected document.
4. **On save from app:** Immediate index update (don't wait for watcher).

**Query execution:**
- Under 3 chars: Skip Tantivy, fuzzy match on in-memory filename list
- 3+ chars: Query Tantivy, return top 20 results with snippets

## Frontend Implementation

**New file: `src/search-bar.ts`**

HTML structure:
```html
<div id="search-container">
  <input id="search-input" placeholder="Search files and content..." />
  <div id="search-dropdown">
    <section id="recent-files">...</section>
    <section id="recent-searches">...</section>
    <section id="search-results">...</section>
  </div>
</div>
```

**State:**
- `recentFiles: string[]` - localStorage, updated on file open
- `recentSearches: string[]` - localStorage, updated when user selects a result (3+ char query)
- `isOpen: boolean` - Dropdown visibility

**Rust commands (Tauri IPC):**

```rust
#[tauri::command]
fn search(query: String) -> Vec<SearchResult>

struct SearchResult {
    path: String,
    filename: String,
    section: String,
    snippet: Option<String>,      // None for filename-only matches
    match_position: Option<usize>, // Line number for scrolling
}
```

**Snippet generation:** ~80 chars around first match, query terms wrapped in `<mark>` tags.

## Styling

```css
--search-bg: var(--bg-secondary);
--search-border: var(--border-color);
--search-result-hover: var(--bg-hover);
--search-highlight: var(--accent-color);
```

- Dropdown same width as search bar
- Sections separated by subtle dividers
- Selected item has background highlight
- Snippets in muted color, highlights use accent color

## Migration

**Remove:**
- `src/search.ts` (old quick switcher)

**Modify:**
- `src/main.ts` - Replace quick switcher init with search bar
- `src/styles/main.css` - Remove modal styles, add search bar styles
- `index.html` - Remove overlay HTML, add search bar at top

**Add:**
- `src/search-bar.ts` - Frontend search logic
- `src-tauri/src/search.rs` - Tantivy indexing and queries

**Dependencies:**
```toml
tantivy = "0.22"
notify = "6"
```

**Keyboard shortcuts:**
- `Cmd+P` - Focus search bar
- `Cmd+Shift+F` - Alias for Cmd+P (both focus search)
- `Esc` - Close dropdown

**Data migration:** None. Recent files/searches start fresh. Index builds on first launch.
