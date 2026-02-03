# ProseMirror Migration - Completed

**Date:** 2026-02-03
**Status:** ✅ Core migration complete, manual testing required

## Summary

Replaced CodeMirror 6 with ProseMirror as the editor foundation. The migration preserves the existing public API — all callers (`main.ts`, `sidebar.ts`, `settings.ts`) work unchanged.

## What Changed

### Dependencies

**Removed (51 packages):**
- `@codemirror/commands`, `@codemirror/lang-markdown`, `@codemirror/language`
- `@codemirror/language-data`, `@codemirror/state`, `@codemirror/view`
- `codemirror`, `@lezer/highlight`

**Added (24 packages):**
- `prosemirror-model`, `prosemirror-state`, `prosemirror-view`
- `prosemirror-commands`, `prosemirror-keymap`, `prosemirror-history`
- `prosemirror-markdown`, `prosemirror-inputrules`, `prosemirror-schema-list`
- `prosemirror-dropcursor`, `prosemirror-gapcursor`

### Files

| File | Change |
|------|--------|
| `src/editor.ts` | Full rewrite — ProseMirror internals, same exports |
| `src/editor/schema.ts` | New — markdown schema definition |
| `src/editor/keymap.ts` | New — undo/redo, Tab/Shift-Tab list indent |
| `src/editor/input-rules.ts` | New — `# ` → heading, `- ` → list, etc. |
| `src/editor/cursor.ts` | New — cursor styling (native caret for v1) |
| `src/editor/live-preview.ts` | Deleted — ProseMirror renders rich natively |
| `src/styles/main.css` | Replaced `.cm-*` rules with `.ProseMirror` styles |
| `tsconfig.json` | Added `esModuleInterop`, `allowSyntheticDefaultImports` |
| `package.json` | Swapped dependencies |

### Behavior Changes

| Feature | Before (CM6) | After (PM) |
|---------|--------------|------------|
| Selection highlight | Custom bracket widgets `[ ]` | Native `::selection` with accent color |
| Cursor | Custom glyph overlay (⌐, \|, etc.) | Native caret with accent color |
| Cursor blink | Configurable (1200ms) | OS default (not configurable) |
| Live preview | Decoration plugin hides syntax | Rich rendering (no raw markdown visible) |
| Tab in lists | Custom handler | `sinkListItem` / `liftListItem` |
| Markdown shortcuts | None | Input rules (`# `, `- `, `> `, etc.) |

## What Works

- ✅ Load/save markdown with frontmatter
- ✅ Headings, bold, italic, links, code
- ✅ Bullet lists, ordered lists
- ✅ Tab/Shift-Tab list indentation
- ✅ Blockquotes, code blocks, horizontal rules
- ✅ Undo/redo history
- ✅ Auto-save on changes
- ✅ Settings: line wrapping, tab size
- ✅ Native selection with accent color
- ✅ Build succeeds

## What Needs Manual Testing

1. **Round-trip fidelity** — Load a note, edit, save, reload. Verify no formatting corruption.
2. **Search integration** — `scrollToLine` with search term selection
3. **Session restore** — Cursor position and scroll position persistence
4. **All markdown features** — Nested lists, code blocks with language, images

---

## v2 Roadmap

Features deferred from v1 migration:

### Custom Cursor Glyphs

**Priority:** Medium
**Effort:** Medium

Restore the custom cursor glyph system (⌐, |, ¬, ^, _, °). Requires a ProseMirror plugin that:
1. Tracks cursor position via `EditorView.update`
2. Renders a positioned DOM element at cursor location
3. Hides native caret with `caret-color: transparent`

```typescript
// Rough sketch
function cursorGlyphPlugin(style: string): Plugin {
  return new Plugin({
    view(editorView) {
      const glyph = document.createElement('span');
      glyph.className = 'cursor-glyph';
      editorView.dom.appendChild(glyph);
      return {
        update(view) {
          const pos = view.state.selection.head;
          const coords = view.coordsAtPos(pos);
          // Position glyph at coords
        },
        destroy() { glyph.remove(); }
      };
    }
  });
}
```

### Cursor Blink Control

**Priority:** Low
**Effort:** Low (if glyph plugin done)

Once custom cursor glyph exists, blink is just CSS animation control.

### Code Block Syntax Highlighting

**Priority:** Medium
**Effort:** Medium

Options:
- `prosemirror-highlightjs` — Highlight.js integration
- Custom plugin with Shiki or Prism
- CodeMirror 6 embedded in code blocks (hybrid approach)

### Markdown Source Mode Toggle

**Priority:** Low
**Effort:** High

Toggle between rich ProseMirror view and raw markdown source. Could use CodeMirror 6 for source mode (ironic but practical).

### Scroll Past End

**Priority:** Low
**Effort:** Low

Add bottom padding to `.ProseMirror` so cursor can be centered when at document end.

```css
#editor .ProseMirror::after {
  content: '';
  display: block;
  height: 50vh;
}
```

---

## Architecture Notes

### Why ProseMirror?

CodeMirror 6 is optimized for code editing:
- Line-based document model
- `drawSelection()` couples cursor and selection rendering
- Fighting it for document-editing UX (selection ghosting bug)

ProseMirror is optimized for rich text:
- Tree-based document model matches markdown structure
- Native browser selection — no ghosting
- Schema-driven — enforces valid document structure
- `prosemirror-markdown` provides bidirectional conversion

### Public API Contract

The editor module exports remain unchanged:

```typescript
// Lifecycle
initEditor(): void
reconfigureEditor(settings): void

// Content
loadContent(content: string): void
getContent(): string

// Focus & metrics
focusEditor(): void
getWordCount(): number

// Navigation
scrollToLine(line: number, searchTerm?: string): void

// Session state
getCursorPosition(): number
setCursorPosition(pos: number): void
getScrollTop(): number
setScrollTop(top: number): void
getViewportHeight(): number
getContentUpToCursor(): string

// Header (DOM only)
updateHeaderData(data: HeaderData): void
```

Callers don't know the editor changed. This is the adapter pattern working as intended.
