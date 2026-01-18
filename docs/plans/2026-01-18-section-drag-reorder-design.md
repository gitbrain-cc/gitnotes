# Section Drag-and-Drop Reordering

**Date:** 2026-01-18
**Status:** Approved

## Overview

Allow users to reorder sections in the sidebar via drag-and-drop, with order persisted to `.gitnotes` at the vault root.

## User Interaction

**Interaction flow:**

1. User clicks and holds a section row for ~200ms
2. Row enters "dragging" state (opacity 0.5, cursor changes to `grabbing`)
3. As user drags vertically, a 2px accent-colored insertion line appears between rows to show drop position
4. User releases — section moves to new position, order saves immediately

**Visual states:**

| State | Appearance |
|-------|------------|
| Normal | Standard row |
| Holding (pre-drag) | Subtle scale (1.02) to signal "almost dragging" |
| Dragging | Opacity 0.5, cursor: grabbing |
| Drop indicator | 2px horizontal line in `--accent-color` between rows |

**Cancellation:**

- Drag outside sidebar bounds → cancels, returns to original position
- Press Escape during drag → cancels
- Drop in same position → no-op (no save triggered)

## Data Storage

**File:** `.gitnotes` (root of active vault/repository)

```json
{
  "sectionOrder": ["1-weeks", "1-todo", "gf-roadmap", "me-home", "projects"]
}
```

**Behavior:**

- **File doesn't exist:** Sections display alphabetically. File created on first reorder.
- **Section not in array:** Appended to end (handles newly created sections)
- **Section in array but folder deleted:** Ignored (stale entries cleaned on save)
- **`sectionOrder` missing or empty:** Falls back to alphabetical
- **Parse error:** Log warning, fall back to alphabetical

## Backend Changes

**Modified:** `list_sections()`
- Read `.gitnotes` from current vault path
- Sort sections by `sectionOrder` array index
- Sections not in array appended alphabetically at end

**New command:** `save_section_order(order: Vec<String>)`
- Read existing `.gitnotes` (or create empty object)
- Update `sectionOrder` field
- Write back, preserving other fields

## Frontend Implementation

**Files to modify:**
- `src/sidebar.ts` — Add drag logic to `renderSections()`
- `src/styles/main.css` — Add drag states and insertion line styles

**Hold-to-drag logic:**

```
mousedown → start 200ms timer
  ├─ mouseup before timer → normal click (select section)
  ├─ mousemove > 5px before timer → normal click (prevent jitter)
  └─ timer fires → enter drag mode
```

**During drag:**
- Track mouse Y position
- Calculate insertion index based on row midpoints
- Show insertion line via `<div class="drop-indicator">`

**On drop:**
- Reorder local `sections` array
- Call `save_section_order()` with new order
- Re-render sections list

## CSS Styles

```css
/* Hold-to-drag pre-drag state */
#sections-list li.drag-pending {
  transform: scale(1.02);
  transition: transform 100ms ease;
}

/* Active dragging state */
#sections-list li.dragging {
  opacity: 0.5;
  cursor: grabbing;
}

/* Insertion line indicator */
#sections-list .drop-indicator {
  height: 2px;
  background: var(--accent-color);
  margin: -1px 8px;
  border-radius: 1px;
  pointer-events: none;
}
```

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Single section | Drag disabled (nothing to reorder) |
| Drag to same position | No-op, no save triggered |
| Drag outside sidebar | Cancel, return to original position |
| Escape key during drag | Cancel drag |
| New section created | Appended to end of `sectionOrder` |
| Section deleted | Removed from `sectionOrder` on next save |

## Out of Scope

- Keyboard reordering (Alt+Up/Down)
- Multi-select drag
- Animation on reorder
- Protected section pinning (all sections fully draggable)

## Summary

| Decision | Choice |
|----------|--------|
| Draggable sections | All (including protected) |
| Drag initiation | Hold 200ms |
| Visual feedback | Opacity 0.5 + insertion line |
| Persistence | Immediate on drop |
| Storage location | `.gitnotes` at vault root |
