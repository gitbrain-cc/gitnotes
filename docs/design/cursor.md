# Cursor - Design Spec

**Status:** v1 uses native browser caret. Custom glyph system planned for v2.

---

## Current Implementation (v1)

After migrating from CodeMirror 6 to ProseMirror (2026-02-03), the cursor uses the native browser caret styled with the accent color:

```css
#editor .ProseMirror {
  caret-color: var(--accent-color);
}
```

This is handled by `src/editor/cursor.ts` via `injectCursorStyles()`.

**Trade-off:** Native caret is reliable and has no rendering bugs, but cursor style/blink settings in the UI are currently no-ops.

---

## v2 Roadmap: Custom Glyph Cursor

See `docs/todo/editor-v2.md` for the full plan.

The goal is to restore the custom cursor glyph system:

| Style | Glyph |
|-------|-------|
| block | ⌐ |
| line | \| |
| underline | ¬ |
| caret | ^ |
| underscore | _ |
| dot | ° |

**Implementation approach:** ProseMirror plugin that:
1. Tracks cursor position via `EditorView.update`
2. Renders a positioned DOM element at cursor location
3. Hides native caret with `caret-color: transparent`

Once implemented, cursor blink control becomes a CSS animation toggle on the glyph element.

---

## Files

| File | Purpose |
|------|---------|
| `src/editor/cursor.ts` | Cursor style injection, glyph definitions |
| `src/settings.ts` | Cursor style/blink UI (currently no-op) |
