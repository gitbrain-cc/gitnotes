# Editor v2 Features

Post-ProseMirror migration improvements.

**Context:** Migrated from CodeMirror 6 to ProseMirror on 2026-02-03. See `docs/plans/2026-02-03-prosemirror-migration-complete.md`.

---

## ~~Custom Cursor Glyphs~~ ✅ Done

**Priority:** Medium | **Effort:** Medium

Restore the custom cursor glyph system from CodeMirror era:
- `block` → ⌐
- `line` → |
- `underline` → ¬
- `caret` → ^
- `underscore` → _
- `dot` → °

**Implementation:** ProseMirror plugin that tracks cursor position and renders a positioned DOM element. Hide native caret with `caret-color: transparent`.

**Files:** `src/editor/cursor.ts` (extend), `src/settings.ts` (already has UI)

---

## ~~Cursor Blink Control~~ ✅ Done

**Priority:** Low | **Effort:** Low

Settings UI already exists for cursor blink toggle. Currently no-op after migration.

**Depends on:** Custom cursor glyphs (CSS animation on the glyph element)

---

## Code Block Syntax Highlighting

**Priority:** Medium | **Effort:** Medium

Code blocks currently render as plain monospace text.

**Options:**
1. `prosemirror-highlightjs` — Highlight.js integration
2. Custom plugin with Shiki (VS Code's highlighter)
3. Embed CodeMirror 6 inside code block nodes (hybrid)

**Consideration:** Need to preserve language identifier in markdown (```` ```python ````)

---

## ~~Scroll Past End~~ ✅ Done

**Priority:** Low | **Effort:** Low

Allow cursor to be centered when at document end.

```css
#editor .ProseMirror::after {
  content: '';
  display: block;
  height: 50vh;
}
```

---

## Table Support

**Priority:** Low | **Effort:** Medium

ProseMirror has `prosemirror-tables` for table editing. Would require:
1. Extend schema with table nodes
2. Add table input rules or toolbar
3. Extend markdown serializer

---

## Link Autodetection

**Priority:** Low | **Effort:** Low

Auto-convert URLs to links while typing. Input rule for URL patterns.

---

## Find & Replace

**Priority:** Medium | **Effort:** Medium

In-editor find/replace (separate from global search):
1. Cmd+F to open find bar
2. Highlight matches
3. Replace/Replace All

**Note:** ProseMirror has community plugins for this.
