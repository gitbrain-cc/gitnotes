# Search Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve global search with Cmd+F shortcut, "In This Note" match grouping, Cmd+G/Shift+G match cycling, and status bar indicator.

**Architecture:** Client-side ProseMirror doc scanning for current-note matches, new result group in existing search dropdown, find state stored in editor.ts for match cycling. No backend/Rust changes.

**Tech Stack:** TypeScript, ProseMirror, vanilla DOM

**Design doc:** `docs/plans/2026-02-25-search-improvements-design.md`

---

### Task 1: Add Find State & Doc Scanning to Editor

**Files:**
- Modify: `src/editor.ts`

**Context:** The editor module owns the ProseMirror `EditorView`. We need to add:
1. A function to scan the doc for all occurrences of a search term
2. Find state (term, positions, current index) for match cycling
3. `findNext()` / `findPrev()` / `clearFindState()` functions
4. Export the doc accessor so search-bar can scan

**Step 1: Add find state types and variables after the `editorView` declaration (line 141)**

```typescript
// Find state for in-note match cycling
interface FindMatch {
  from: number;
  to: number;
  lineNumber: number;
  snippet: string;
}

let findState: {
  term: string;
  matches: FindMatch[];
  currentIndex: number;
} | null = null;

let onFindStateChange: (() => void) | null = null;
```

**Step 2: Add `scanDocForMatches` function**

Scans the ProseMirror doc for all case-insensitive occurrences of a term. Returns an array of `FindMatch` objects with absolute doc positions, line numbers, and snippet context.

```typescript
export function scanDocForMatches(term: string): FindMatch[] {
  if (!editorView || !term) return [];
  const doc = editorView.state.doc;
  const matches: FindMatch[] = [];
  const lowerTerm = term.toLowerCase();

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      const text = node.text;
      const lowerText = text.toLowerCase();
      let searchFrom = 0;
      while (searchFrom < lowerText.length) {
        const idx = lowerText.indexOf(lowerTerm, searchFrom);
        if (idx === -1) break;
        const from = pos + idx;
        const to = from + term.length;

        // Calculate line number
        let lineNumber = 0;
        doc.nodesBetween(0, from, (n) => {
          if (n.isBlock) lineNumber++;
          return true;
        });

        // Build snippet (surrounding text)
        const blockStart = Math.max(0, idx - 30);
        const blockEnd = Math.min(text.length, idx + term.length + 30);
        let snippet = text.slice(blockStart, blockEnd);
        if (blockStart > 0) snippet = '...' + snippet;
        if (blockEnd < text.length) snippet = snippet + '...';

        matches.push({ from, to, lineNumber, snippet });
        searchFrom = idx + 1;
      }
    }
  });

  return matches;
}
```

**Step 3: Add find state management functions**

```typescript
export function setFindState(term: string, matches: FindMatch[], index: number = 0): void {
  findState = { term, matches, currentIndex: index };
  if (matches.length > 0 && index < matches.length) {
    selectMatch(matches[index]);
  }
  onFindStateChange?.();
}

export function clearFindState(): void {
  findState = null;
  onFindStateChange?.();
}

export function getFindState() {
  return findState;
}

export function onFindStateChanged(cb: () => void): void {
  onFindStateChange = cb;
}

function selectMatch(match: FindMatch): void {
  if (!editorView) return;
  const { from, to } = match;
  const doc = editorView.state.doc;
  if (from >= 0 && to <= doc.content.size) {
    editorView.dispatch(
      editorView.state.tr.setSelection(TextSelection.create(doc, from, to)).scrollIntoView()
    );
    editorView.focus();
  }
}

export function findNext(): void {
  if (!findState || findState.matches.length === 0) return;
  findState.currentIndex = (findState.currentIndex + 1) % findState.matches.length;
  selectMatch(findState.matches[findState.currentIndex]);
  onFindStateChange?.();
}

export function findPrev(): void {
  if (!findState || findState.matches.length === 0) return;
  findState.currentIndex = (findState.currentIndex - 1 + findState.matches.length) % findState.matches.length;
  selectMatch(findState.matches[findState.currentIndex]);
  onFindStateChange?.();
}
```

**Step 4: Commit**

```
feat: add find state and doc scanning to editor
```

---

### Task 2: Add "In This Note" Group to Search Bar

**Files:**
- Modify: `src/search-bar.ts`

**Context:** The search bar renders results in `renderDropdown()` with two groups: "Files" (filename matches) and "In Content" (Tantivy results). We need to:
1. Accept the current note path so we can scan for in-note matches
2. Add a new "In This Note" group at the top of results when matches exist
3. Filter the current note out of "In Content" to avoid duplicates
4. Each in-note result is a clickable item that scrolls to that match position

**Step 1: Add current note context and in-note match tracking**

At the top of the file, after existing imports, add:

```typescript
import { scanDocForMatches, setFindState, FindMatch } from './editor';
```

Add state variables after `recentSearches`:

```typescript
let currentNotePath: string | null = null;
let inNoteMatches: FindMatch[] = [];
```

Add setter:

```typescript
export function setCurrentNotePath(path: string | null): void {
  currentNotePath = path;
}
```

**Step 2: Modify `renderDropdown` to add "In This Note" group**

In the `else` branch of `renderDropdown` (when `query` exists, line 172+), before the filename/content match rendering, add in-note scanning:

```typescript
// Scan current note for matches (client-side)
inNoteMatches = [];
if (currentNotePath && query.length >= MIN_CONTENT_SEARCH_LENGTH) {
  inNoteMatches = scanDocForMatches(query);
}

// Render "In This Note" group
if (inNoteMatches.length > 0) {
  const header = document.createElement('li');
  header.className = 'results-group-header';
  header.textContent = 'In This Note';
  resultsList.appendChild(header);

  inNoteMatches.forEach((match, matchIdx) => {
    const li = document.createElement('li');
    li.className = 'in-note-match';
    li.innerHTML = `
      <div class="result-header">
        <span class="result-line-number">line ${match.lineNumber}</span>
        <span class="result-snippet">${highlightMatch(match.snippet, query)}</span>
      </div>
    `;
    li.addEventListener('click', () => {
      addRecentSearch(query);
      // Set find state so Cmd+G works after clicking
      setFindState(query, inNoteMatches, matchIdx);
      closeSearchBar();
    });
    resultsList.appendChild(li);
  });
}
```

**Step 3: Filter current note from "In Content" results**

In the content search debounce handler (around line 336-346), filter out the current note:

Change:
```typescript
const uniqueContentMatches = contentMatches.filter(r => !seenPaths.has(r.path));
```

To:
```typescript
const uniqueContentMatches = contentMatches.filter(r => !seenPaths.has(r.path) && r.path !== currentNotePath);
```

**Step 4: Update selectedIndex logic for keyboard nav**

The in-note matches are rendered as clickable `<li>` elements but aren't in `currentResults`. We need to handle the selectedIndex offset. The simplest approach: add in-note matches to `currentResults` as a special type.

Actually, rethinking — keep it simpler. The in-note matches are click-only initially. The existing arrow key navigation still works on `currentResults` (filename + content matches). The in-note items are outside the `currentResults` array. Users click them or use Cmd+G after selecting one.

**Step 5: Commit**

```
feat: add "In This Note" group to search results
```

---

### Task 3: Update Keyboard Shortcuts in main.ts

**Files:**
- Modify: `src/main.ts`

**Context:** Keyboard shortcuts are registered in `setupKeyboardShortcuts()`. We need:
1. `Cmd+F` — focus existing search bar
2. `Cmd+G` — next match in current note
3. `Cmd+Shift+G` — previous match in current note
4. Pass current note context to search bar

**Step 1: Add imports**

```typescript
import { findNext, findPrev, clearFindState, getFindState, onFindStateChanged } from './editor';
import { setCurrentNotePath } from './search-bar';
```

**Step 2: Add Cmd+F handler in `setupKeyboardShortcuts()`**

```typescript
// Cmd+F: Focus search bar
if (e.metaKey && !e.shiftKey && e.key === 'f') {
  e.preventDefault();
  if (!isSearchBarOpen()) {
    openSearchBar(handleSearchSelect);
  } else {
    // Already open — just focus the input
    const input = document.getElementById('search-input') as HTMLInputElement;
    input?.focus();
    input?.select();
  }
}
```

**Step 3: Add Cmd+G / Cmd+Shift+G handlers**

```typescript
// Cmd+G: Next match
if (e.metaKey && !e.shiftKey && e.key === 'g') {
  e.preventDefault();
  findNext();
}

// Cmd+Shift+G: Previous match
if (e.metaKey && e.shiftKey && e.key === 'g') {
  e.preventDefault();
  findPrev();
}
```

**Step 4: Update `loadNoteWithHeader` to set current note path on search bar**

In `loadNoteWithHeader()`, after `currentNote = note;`:

```typescript
setCurrentNotePath(note.path);
```

Also clear find state when switching notes:

```typescript
clearFindState();
```

**Step 5: Add Escape handler for clearing find state**

In the Escape handler block, add before the existing checks:

```typescript
if (e.key === 'Escape') {
  if (getFindState() && !isSearchBarOpen() && !isCommitModalOpen() && !isSettingsOpen() && !isGitModeOpen()) {
    clearFindState();
    return;
  }
  // ... existing escape handlers
}
```

**Step 6: Commit**

```
feat: add Cmd+F/G keyboard shortcuts for search navigation
```

---

### Task 4: Status Bar Find Indicator

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`

**Context:** The status bar has `#status-left` (status text + confidence) and `#word-count` on the right. We add a find indicator next to word count.

**Step 1: Add find-info span to index.html**

In the status bar footer, before `#word-count`:

```html
<span id="find-info"></span>
<span id="word-count"></span>
```

**Step 2: Add status bar update in main.ts**

Register the `onFindStateChanged` callback in `init()` after `setupKeyboardShortcuts()`:

```typescript
onFindStateChanged(() => {
  const findInfo = document.getElementById('find-info');
  if (!findInfo) return;
  const state = getFindState();
  if (state && state.matches.length > 0) {
    findInfo.textContent = `${state.currentIndex + 1}/${state.matches.length} matches · ⌘G next`;
  } else {
    findInfo.textContent = '';
  }
});
```

**Step 3: Commit**

```
feat: add find match indicator to status bar
```

---

### Task 5: Update Placeholder & CSS Styling

**Files:**
- Modify: `index.html`
- Modify: `src/styles/main.css`

**Step 1: Update search input placeholder**

Change:
```html
placeholder="Search notes"
```
To:
```html
placeholder="Search notes   ⌘F"
```

**Step 2: Add CSS for "In This Note" group items**

```css
/* In-note match results */
.in-note-match .result-header {
  gap: 12px;
}

.result-line-number {
  font-size: 0.786rem;
  color: var(--text-secondary);
  opacity: 0.7;
  flex-shrink: 0;
  min-width: 50px;
}

.in-note-match .result-snippet {
  margin-top: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

**Step 3: Add CSS for find-info in status bar**

```css
#find-info {
  color: var(--accent-color);
  font-size: 0.786rem;
}

#find-info:not(:empty) {
  margin-right: 12px;
}
```

**Step 4: Commit**

```
feat: search improvements — placeholder hint and styling
```

---

### Task 6: Integration Testing & Polish

**Step 1: Run dev server**

```bash
npm run tauri dev
```

**Step 2: Manual verification checklist**

- [ ] Cmd+F focuses search input
- [ ] Typing 3+ chars shows "In This Note" group when current note has matches
- [ ] "In This Note" items show line numbers and highlighted snippets
- [ ] Clicking an "In This Note" item scrolls to that match and selects the text
- [ ] Current note is NOT shown in "In Content" group (no duplicates)
- [ ] Cmd+G moves to next match, Cmd+Shift+G to previous
- [ ] Match cycling wraps around
- [ ] Status bar shows "1/5 matches · ⌘G next" while find state is active
- [ ] Pressing Escape clears find state and status bar indicator
- [ ] Switching notes clears find state
- [ ] Search placeholder shows "Search notes   ⌘F"
- [ ] Existing search (filename, content, recent files/searches) still works

**Step 3: Final commit**

```
v0.4.1 — Search improvements: Cmd+F, in-note matches, Cmd+G cycling
```
