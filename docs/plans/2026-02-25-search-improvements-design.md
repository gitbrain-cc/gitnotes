# Search Improvements — In-Note Matches & Navigation

**Date:** 2026-02-25
**Status:** Design

## Summary

Improve the existing global search to show multiple matches in the current note, prioritize them in results, and support cycling through matches with keyboard shortcuts. No new UI panels — builds on the existing search bar and status bar.

## Current State

- Global search via Tantivy full-text index (Rust backend)
- Fuzzy filename matching for short queries, content search for 3+ chars
- One result per file with a single snippet
- Selecting a result scrolls to the match line and selects the term
- No way to cycle through multiple matches in a note
- No Cmd+F shortcut

## Changes

### 1. Cmd+F Focuses Search Bar

`Cmd+F` puts cursor in the existing search input. Same as clicking it. No new UI.

Update placeholder text from "Search notes" to "Search notes  Cmd+F" to teach the shortcut.

### 2. Results Prioritize Current Note

When a note is open and the search query matches content in it, a new group appears at the top of results:

```
IN THIS NOTE
  line 12   "...i hung up. three hundred..."
  line 47   "...hung the painting on..."

FILES
  1-weeks   1998-40

IN CONTENT
  gigs      current-clients              3 matches
             "...hung jury on the deal..."
```

**"In This Note" group:**
- Only shown when the open note has matches
- Lists every match location individually (line number + snippet context)
- Matches found via client-side scan of the ProseMirror doc (already in memory)
- Clicking a match scrolls to that position using existing `scrollToLine` flow

**"In Content" group:**
- Same as today (Tantivy results) but excludes the current note (already shown above)
- Adds match count badge when Tantivy reports multiple hits ("3 matches")

### 3. Match Count on Other Notes

Other notes in the "In Content" group show a count badge next to the snippet when there are multiple matches. This requires the Tantivy search to return a count per file — either via term frequency or a secondary count query.

If the backend change is too heavy, skip the count badge initially. It's a nice-to-have.

### 4. Cmd+G / Cmd+Shift+G Navigation

After jumping to a match from search results, the user can cycle through all matches in the current note:

- **Cmd+G** — next match
- **Cmd+Shift+G** — previous match
- Wraps around at the end/beginning

**Find state:**
- Stored in memory: search term, array of match positions, current index
- Populated when "In This Note" results are computed (client-side scan)
- Cleared when: note changes, content is edited, or user presses Escape
- Match positions are ProseMirror doc offsets (from/to pairs)

**On each Cmd+G:**
1. Increment current index (wrap if at end)
2. Set selection to match range
3. Scroll into view
4. Update status bar

### 5. Status Bar Indicator

While find state is active, the status bar (bottom-right, where word count shows) displays:

```
2/5 matches · Cmd+G next · 316 words
```

- Shows current match index / total matches
- Includes shortcut hint
- Disappears when find state clears

## Technical Notes

### Client-Side Note Scanning

Scan the ProseMirror doc for all occurrences of the search term:

```
doc.descendants((node, pos) => {
  if (node.isText) {
    // find all indexOf matches in node.text
    // map to absolute doc positions using pos + offset
  }
})
```

Case-insensitive. Returns array of `{ from, to, lineNumber, snippet }`. This is fast — the doc is already in memory and notes are small.

### Search Bar Changes

- `search-bar.ts`: Accept current note path + content accessor so it can compute "In This Note" matches
- `renderDropdown()`: New group rendering for "In This Note" before existing groups
- Filter current note out of "In Content" group to avoid duplicates

### Keyboard Shortcuts

- `Cmd+F`: Register in `main.ts` via `window.addEventListener('keydown')` — calls `openSearchBar()` and focuses input
- `Cmd+G` / `Cmd+Shift+G`: Register same way — calls `findNext()` / `findPrev()` on the stored find state
- `Escape` (when find state active and editor focused): Clears find state

### Files Touched

| File | Change |
|------|--------|
| `src/search-bar.ts` | "In This Note" group, current note scanning, match count display |
| `src/main.ts` | Cmd+F/G/Shift+G handlers, pass current note context to search bar |
| `src/editor.ts` | Export doc accessor for scanning, find state (positions, index, cycle) |
| `src/styles/main.css` | "In This Note" group styling, match count badge, status bar find indicator |

### What's NOT Changing

- Tantivy backend — no Rust changes needed (client-side scan handles current note)
- Search bar UI structure — same input, same dropdown, just better grouping
- Global search behavior — still searches all notes the same way
