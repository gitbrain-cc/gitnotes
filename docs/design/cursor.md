# Cursor - Design Spec

The editor cursor is rendered as a Unicode glyph via CSS `::after` on CodeMirror's `.cm-cursor` element.

---

## Architecture

All cursor styling lives in `src/editor.ts`:

- `cursorGlyph` — the Unicode character used as the cursor
- `injectCursorStyles()` — injects a `<style>` tag rendering the glyph via `::after`
- The CM theme sets `.cm-cursor` borders to `none`, letting the glyph do all the work

This approach replaces CSS border/pseudo-element hacks that fought CodeMirror's overflow clipping.

---

## Current Default

`⌐` (U+2310, Reversed Not Sign) — a flat horizontal line with a short vertical tick dropping from the left edge. Pinpoints where typing will insert.

---

## Available Glyphs

Candidates for settings:

| Glyph | Unicode | Name | Description |
|-------|---------|------|-------------|
| `⌐` | U+2310 | Reversed Not Sign | Flat line, tick drops left (default) |
| `¬` | U+00AC | Not Sign | Flat line, tick drops right |
| `_` | U+005F | Underscore | Simple underline |
| `▁` | U+2581 | Lower One Eighth Block | Thin block underline |
| `│` | U+2502 | Box Light Vertical | Classic vertical bar |
| `▏` | U+258F | Left One Eighth Block | Thin vertical bar |

---

## Customization

The cursor glyph is a single variable (`cursorGlyph`). To make it a user setting, wire it to the settings system and call `injectCursorStyles()` on change.

The glyph color is always `var(--accent-color)`, inheriting from the active theme.
