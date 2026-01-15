# Search

NoteOne includes unified search for quickly finding files and content across all your notes.

## Opening Search

| Shortcut | Action |
|----------|--------|
| **Cmd+P** | Open search |
| **Cmd+Shift+F** | Open search (alias) |
| **Escape** | Close search |

## How Search Works

### Short queries (1-2 characters)
Fuzzy matches against **file names only**. Instant, client-side filtering.

### Longer queries (3+ characters)
Searches both **file names** and **full content**. Uses full-text indexing for fast results across thousands of notes.

Results are grouped:
- **Files** - Pages where the name matches
- **In Content** - Pages containing the search term, with a snippet preview

## Navigating Results

| Key | Action |
|-----|--------|
| **Arrow Down/Up** | Move selection |
| **Enter** | Open selected result |
| **Click** | Open result |

Content matches navigate directly to the matching line in the file.

## Recent Files & Searches

When you open search with an empty query, you'll see:

- **Recent Files** (last 7 opened) - Quick access to recently edited pages
- **Recent Searches** (last 5) - Click to re-run a previous search

These persist across sessions.

## Search Details

- **Case-insensitive** - "magento" finds "Magento" and "MAGENTO"
- **Searches all sections** - No way to limit to current section (yet)
- **Index location** - `~/.config/noteone/search-index/`
- **Auto-updates** - Index refreshes automatically when files change
