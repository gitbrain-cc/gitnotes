# Editor Selection Highlighting & List Indentation Improvements

## Overview

Three related editor improvements targeting selection UX and list indentation behavior.

**Files affected:** `src/editor.ts`, `src/styles/main.css`

---

## 1. Selection Highlighting (replace bracket wrapping)

### Problem
Selected text is indicated by inserting `[` and `]` bracket widgets around it. This causes layout shifts (CLS) since DOM nodes are injected, and the visual style is inconsistent with standard editor behavior.

### Solution
Remove the custom bracket decoration system entirely. Use CodeMirror's native `.cm-selectionBackground` layer with accent-color styling.

### Changes

**Remove from `src/editor.ts`:**
- `BracketWidget` class (lines ~139-150)
- `selectionBrackets` ViewPlugin (lines ~151-175)
- Remove `selectionBrackets` from the editor extensions array

**Remove from `src/styles/main.css`:**
- The rule making `::selection` transparent with accent-color text
- The rule hiding `.cm-selectionBackground` with `background: transparent !important`

**Add to `src/styles/main.css`:**
```css
#editor .cm-selectionBackground {
  background: color-mix(in srgb, var(--accent-color) 20%, transparent) !important;
}

/* Focused selection can be slightly more visible */
.cm-focused .cm-selectionBackground {
  background: color-mix(in srgb, var(--accent-color) 30%, transparent) !important;
}
```

**Remove from theme object in `src/editor.ts`:**
- The `.selection-bracket` style rule

### Why this works
CodeMirror 6 already renders `.cm-selectionBackground` divs positioned behind selected text. The current code actively hides them and replaces them with bracket widgets. By removing the hiding and styling the native layer, we get zero-CLS highlighting with no decoration plugins.

---

## 2. Multi-line Tab / Shift-Tab

### Problem
Pressing Tab or Shift-Tab with a multi-line selection only indents/dedents the first line. Users expect all selected lines to be affected.

### Solution
Rewrite the Tab and Shift-Tab keymap handlers to iterate all lines in the selection range.

### Changes

**Tab handler (`src/editor.ts` ~lines 206-220):**
```
- Get all lines from range.from to range.to
- For each line, apply indentation (details in section 3 — normalize + indent)
- Track total character offset change
- Return EditorSelection.range(newFrom, newTo) preserving the full selection
```

**Shift-Tab handler (`src/editor.ts` ~lines 222-242):**
```
- Get all lines from range.from to range.to
- For each line, apply dedentation (details in section 3 — normalize + dedent)
- Track total character offset change per line
- Return EditorSelection.range(newFrom, newTo) preserving the full selection
```

**Selection preservation:**
- `newFrom` = start of the first selected line (unchanged)
- `newTo` = original `range.to` + sum of all character offset changes (insertions minus removals)
- This keeps the selection spanning the same logical lines so the user can press Tab/Shift-Tab repeatedly

---

## 3. Tab Normalization (normalize-as-you-go)

### Problem
When the user changes their indentation preference (e.g., from 4 spaces to 2 spaces), existing content retains the old indentation. Pressing Tab adds the new indent size on top of old whitespace, creating inconsistent indentation.

### Solution
On every Tab/Shift-Tab press, normalize the line's existing indentation to the current setting before adding/removing a level.

### Logic

**Indent (Tab):**
```
1. Read line's leading whitespace
2. Convert any tab characters to spaces (using current tabSize)
3. Calculate levels = floor(whitespaceLength / currentIndentSize)
4. Replace entire leading whitespace with: currentIndent.repeat(levels + 1)
```

**Dedent (Shift-Tab):**
```
1. Read line's leading whitespace
2. Convert any tab characters to spaces (using current tabSize)
3. Calculate levels = floor(whitespaceLength / currentIndentSize)
4. If levels > 0: replace leading whitespace with currentIndent.repeat(levels - 1)
5. If levels == 0 but whitespace exists: remove all leading whitespace (clean up stray spaces)
6. If no whitespace: no change
```

**Edge cases:**
- Mixed tabs and spaces: convert tabs first, then normalize
- Stray spaces (e.g., 5 spaces with 2-space setting = 2 full levels + 1 extra): `floor(5/2) = 2`, indent to 3 levels (6 spaces), dedent to 1 level (2 spaces). Stray space absorbed.
- Lines with zero indentation on Shift-Tab: skip (already at floor)
- Applies identically in both single-line and multi-line operations

---

## Implementation Order

1. **Selection highlighting** — standalone change, no dependencies
2. **Multi-line Tab/Shift-Tab** — rewrite the handlers
3. **Tab normalization** — integrate into the rewritten handlers from step 2

Steps 2 and 3 naturally combine since the handler rewrite is the right time to add normalization logic.
