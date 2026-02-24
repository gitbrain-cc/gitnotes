# Table Support

> Editable GFM table support for the ProseMirror editor. Tables parse from markdown pipe syntax, render as interactive HTML tables, and serialize back to clean pipe syntax.

## Context

The ProseMirror editor uses `prosemirror-markdown` for parsing and serializing. The default schema has no table nodes, so markdown-it's GFM table tokens were silently dropped — tables rendered as raw pipe text.

## Scope

**In:**
- GFM table parsing and rendering
- Inline cell editing with tab navigation
- Row/column manipulation (keyboard shortcuts + context menu)
- Table creation via input rule
- Text alignment (`:---:` syntax)
- Inline marks in cells (bold, italic, code, links)

**Out (future):**
- Block content in cells (lists, code blocks)
- Table toolbar/floating menu
- Column width persistence across sessions
- Cell merging/splitting
- Table sorting

## Schema

Four node types added via `prosemirror-tables`'s `tableNodes()`:

| Node | Content | Group | Purpose |
|------|---------|-------|---------|
| `table` | `table_row+` | `block` | Top-level table container |
| `table_row` | `(table_header \| table_cell)+` | — | Row container |
| `table_header` | `inline*` | — | Header cell (first row) |
| `table_cell` | `inline*` | — | Data cell |

`cellContent: 'inline*'` means cells support inline content only (bold, italic, code, links, hard breaks). No block elements — matches GFM table semantics.

Custom cell attribute: `textAlign` (null, `'left'`, `'center'`, `'right'`). Parsed from markdown alignment syntax, rendered as inline `text-align` style, round-trips through the separator row (`:---`, `:---:`, `---:`).

`tableGroup: 'block'` places tables wherever block nodes are allowed — same level as paragraphs, headings, lists.

## Parsing

Custom `MarkdownParser` using `markdown-it('commonmark').enable('table')`. Token mapping:

| markdown-it token | ProseMirror node | Notes |
|-------------------|-----------------|-------|
| `table` | `table` | Block container |
| `thead` | *(ignored)* | ProseMirror uses flat table model |
| `tbody` | *(ignored)* | Same — no wrapper nodes |
| `tr` | `table_row` | |
| `th` | `table_header` | `textAlign` from `style` attr |
| `td` | `table_cell` | `textAlign` from `style` attr |

Alignment is extracted from markdown-it's `style` attribute on `th`/`td` tokens (e.g. `text-align: center`). The parser uses `tok.attrGet('style')` and a regex match.

## Serialization

Custom `MarkdownSerializer` outputs GFM pipe table syntax. The `table` node serializer handles all rows — `table_row`, `table_header`, and `table_cell` serializers are no-ops (the table serializer iterates children directly).

Output format:

```
| Header 1 | Header 2 |
| --- | :---: |
| cell | cell |
```

Separator row uses alignment from the header cells' `textAlign` attribute:

| `textAlign` value | Separator |
|-------------------|-----------|
| `null` | `---` |
| `left` | `:---` |
| `center` | `:---:` |
| `right` | `---:` |

Cell content serialization (`serializeCell`):

- Text nodes: pipe characters escaped as `\|`
- `code` mark: backtick-wrapped, takes priority over other marks (code spans can't nest formatting in markdown)
- `strong` mark: `**wrapped**`
- `em` mark: `*wrapped*`
- `link` mark: `[text](href)`
- `hard_break` node: `<br>`
- Other inline nodes (e.g. images): silently dropped — GFM cells don't support them

## Editing

Two plugins from `prosemirror-tables`:

- `columnResizing()` — drag column borders to resize. Widths stored in `colwidth` cell attribute. Session-only — GFM has no width syntax, so widths are lost on save/reload.
- `tableEditing()` — cell selection (click-drag across cells), arrow key navigation within cells, structural operations.

### Keyboard Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Tab` | Next cell | In table only; falls through to list indent otherwise |
| `Shift-Tab` | Previous cell | In table only; falls through to list outdent otherwise |
| `Mod-Enter` | Add row below | In table |
| `Mod-Shift-Enter` | Add row above | In table |
| `Mod-Shift-\` | Add column right | In table |
| `Mod-Backspace` | Delete row | In table |

Tab/Shift-Tab coexistence with lists: `buildKeymap()` handles Tab first — returns `true` in list items, `false` otherwise. The table keymap runs after it. `goToNextCell` returns `false` when not in a table, so both coexist without conflicts.

## Context Menu

Right-click inside a table cell shows a context menu:

1. Insert Row Above
2. Insert Row Below
3. Insert Column Left
4. Insert Column Right
5. *(separator)*
6. Delete Row
7. Delete Column
8. *(separator)*
9. Delete Table

Menu items are disabled when their command can't execute. Menu dismisses on click outside or Escape. Positioned at click coordinates, clamped to viewport bounds.

Right-click outside a table passes through to the browser default context menu.

## Table Creation

Input rule: typing `|||` at the start of a line creates a 2-column, 2-row table (1 header row + 1 data row). The paragraph containing `|||` is replaced by the table node.

## Styling

```
border-collapse: collapse
cell padding: 6px 12px
cell border: 1px solid --border-color
header background: --bg-tertiary
header font-weight: 600
selected cell: --accent-color at 20% opacity
resize handle: 4px --accent-color bar
font-size: 0.9em (slightly smaller than body)
```

All values use CSS custom properties — works across all themes automatically.

Context menu styled with `--bg-secondary` background, `--border-color` border, 6px border-radius, drop shadow. Items highlight on hover with `--bg-tertiary`.

## Plugin Ordering

Order matters in ProseMirror — plugins are tried in array order.

```
history()
buildKeymap()          <- Tab/Shift-Tab for lists (consumes in list items)
buildInputRules()      <- ||| table creation
buildCursorPlugin()
dropCursor()
gapCursor()
columnResizing()       <- drag-to-resize columns
tableEditing()         <- cell selection, structural ops
buildTableMenuPlugin() <- right-click context menu
keymap({ Tab, ... })   <- Tab/Shift-Tab for tables (only fires outside lists)
savePlugin()           <- must be last (triggers save on any doc change)
```

## Known Limitations

- **Column widths are session-only.** GFM has no column width syntax. Resized widths are lost on save/reload.
- **No block content in cells.** `cellContent: 'inline*'` means no paragraphs, lists, or code blocks inside cells. Consistent with GFM.
- **Images in cells are dropped on serialization.** `serializeCell` doesn't handle image nodes. Rare in practice.
- **No cell merging.** `prosemirror-tables` supports colspan/rowspan, but GFM doesn't. Merge UI is not exposed.
- **First row is always the header.** The serializer assumes row 0 contains `table_header` cells. Mixed header/data rows in the first row may produce unexpected output.

## Files

| File | Status | Purpose |
|------|--------|---------|
| `src/editor/schema.ts` | New | Custom schema with table node types |
| `src/editor/markdown.ts` | New | Custom parser and serializer |
| `src/editor/table-menu.ts` | New | Context menu plugin |
| `src/editor.ts` | Modified | Wire schema/parser/serializer, add plugins |
| `src/editor/input-rules.ts` | Modified | `\|\|\|` table creation rule |
| `src/styles/main.css` | Modified | Table and context menu styles |
