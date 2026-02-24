# Table Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add editable markdown table support to the ProseMirror editor so GFM tables render as proper HTML tables and can be edited inline with tab navigation, row/column manipulation via keyboard shortcuts and context menu.

**Architecture:** Extend the existing ProseMirror schema with table node types (`table`, `table_row`, `table_header`, `table_cell`). Create a custom `MarkdownParser` and `MarkdownSerializer` that handle GFM table tokens from `markdown-it` (which already parses them by default). Wire in `prosemirror-tables` for interactive editing (cell selection, tab navigation, add/remove rows and columns). Tables are created via an input rule (`|||` at line start). Row/column operations are accessible via both keyboard shortcuts and right-click context menu.

**Tech Stack:** `prosemirror-tables` (new dependency), `prosemirror-markdown` (existing — custom parser/serializer), `markdown-it` (bundled in prosemirror-markdown, already parses GFM tables)

---

## Background

GitNotes uses `defaultMarkdownParser` and `defaultMarkdownSerializer` from `prosemirror-markdown`. These use a schema that has no table nodes, so `markdown-it`'s table tokens are silently dropped and tables render as raw pipe text.

The editor comment in `src/editor.ts:18-24` documents the extension pattern:
1. Create custom schema with table nodes
2. Create custom `MarkdownParser` using the custom schema
3. Create custom `MarkdownSerializer` with table serialization
4. All three must share the same schema instance (node types compared by reference)

**No test infrastructure exists** in the gitnotes project. Tasks use manual verification (`npm run dev` → open a note with tables).

**Key files to understand before starting:**
- `src/editor.ts` — current editor setup, uses `defaultMarkdownParser.schema`
- `src/editor/keymap.ts` — current keybindings (Tab/Shift-Tab handle list indent)
- `src/editor/input-rules.ts` — current input rules (headings, lists, blockquote, code)
- `src/styles/main.css` — all styles, ProseMirror rules at line ~435-605

---

## Task 1: Install prosemirror-tables

**Files:**
- Modify: `package.json`

**Step 1: Install the dependency**

Run:
```bash
cd /Users/simon/tetronomis/gitnotes && npm install prosemirror-tables
```

Expected: `prosemirror-tables` added to `dependencies` in `package.json`.

**Step 2: Verify it installed correctly**

Run:
```bash
cd /Users/simon/tetronomis/gitnotes && node -e "require('prosemirror-tables')" 2>&1 || echo "ESM module, checking differently..." && ls node_modules/prosemirror-tables/package.json
```

Expected: File exists, no errors.

**Step 3: Commit**

```bash
cd /Users/simon/tetronomis/gitnotes && git add package.json package-lock.json && git commit -m "feat: add prosemirror-tables dependency"
```

---

## Task 2: Create custom schema with table nodes

**Files:**
- Create: `src/editor/schema.ts`

**Step 1: Create the schema file**

Create `src/editor/schema.ts` that:
1. Imports `Schema` from `prosemirror-model`
2. Imports `schema as defaultSchema` from `prosemirror-markdown` (this is the same as `defaultMarkdownParser.schema`)
3. Defines four new node types: `table`, `table_row`, `table_header`, `table_cell`
4. Exports the new schema

```typescript
import { Schema } from 'prosemirror-model';
import { schema as markdownSchema } from 'prosemirror-markdown';
import { tableNodes } from 'prosemirror-tables';

// Generate table node specs from prosemirror-tables
const tableNodeSpecs = tableNodes({
  tableGroup: 'block',
  cellContent: 'inline*',
  cellAttributes: {
    textAlign: {
      default: null,
      getFromDOM(dom: HTMLElement) {
        return dom.style.textAlign || null;
      },
      setDOMAttr(value: string | null, attrs: Record<string, string>) {
        if (value) attrs.style = (attrs.style || '') + `text-align: ${value};`;
      },
    },
  },
});

// Build new schema extending the default markdown schema with table nodes
const nodes = markdownSchema.spec.nodes.append(tableNodeSpecs);

export const schema = new Schema({
  nodes,
  marks: markdownSchema.spec.marks,
});
```

**Notes on the schema:**
- `tableGroup: 'block'` makes tables appear wherever block nodes are allowed (paragraphs, headings, etc.)
- `cellContent: 'inline*'` means cells contain inline content (bold, italic, code, links — but not block elements like paragraphs or lists). This matches GFM table semantics.
- `textAlign` custom cell attribute captures alignment from markdown's `:---:` syntax
- `tableNodes()` generates `table`, `table_row`, `table_header`, `table_cell` with the correct `colspan`, `rowspan`, `colwidth` attrs that `prosemirror-tables` needs for cell selection and editing

**Step 2: Verify TypeScript compiles**

Run:
```bash
cd /Users/simon/tetronomis/gitnotes && npx tsc --noEmit
```

Expected: No errors. If `schema as markdownSchema` import doesn't work, check the `prosemirror-markdown` exports — may need `import { defaultMarkdownParser } from 'prosemirror-markdown'` and use `defaultMarkdownParser.schema.spec` instead.

**Step 3: Commit**

```bash
cd /Users/simon/tetronomis/gitnotes && git add src/editor/schema.ts && git commit -m "feat: add table node types to ProseMirror schema"
```

---

## Task 3: Create custom markdown parser with table token support

**Files:**
- Create: `src/editor/markdown.ts`

**Step 1: Create the parser/serializer module**

Create `src/editor/markdown.ts` that builds a custom `MarkdownParser` mapping `markdown-it` table tokens to our schema's table nodes.

```typescript
import markdownit from 'markdown-it';
import { MarkdownParser, MarkdownSerializer } from 'prosemirror-markdown';
import { defaultMarkdownParser, defaultMarkdownSerializer } from 'prosemirror-markdown';
import { schema } from './schema';
import { Node as PMNode } from 'prosemirror-model';

// --- PARSER ---

// Get the default token spec and extend with table tokens
const defaultTokens = (defaultMarkdownParser as any).tokens;

export const markdownParser = new MarkdownParser(
  schema,
  markdownit('commonmark', { html: false }).enable('table'),
  {
    ...defaultTokens,
    table: { block: 'table' },
    thead: { ignore: true },
    tbody: { ignore: true },
    tr: { block: 'table_row' },
    th: {
      block: 'table_header',
      getAttrs: (tok: any) => {
        const style = tok.attrGet?.('style') || '';
        const match = style.match(/text-align:\s*(\w+)/);
        return match ? { textAlign: match[1] } : {};
      },
    },
    td: {
      block: 'table_cell',
      getAttrs: (tok: any) => {
        const style = tok.attrGet?.('style') || '';
        const match = style.match(/text-align:\s*(\w+)/);
        return match ? { textAlign: match[1] } : {};
      },
    },
  },
);

// --- SERIALIZER ---

const defaultNodes = defaultMarkdownSerializer.nodes;
const defaultMarks = defaultMarkdownSerializer.marks;

function serializeCell(node: PMNode): string {
  // Serialize inline content of a cell to a markdown string
  let text = '';
  node.forEach((inline: PMNode) => {
    if (inline.isText) {
      let t = inline.text || '';
      // Escape pipes in cell content
      t = t.replace(/\|/g, '\\|');
      inline.marks.forEach(mark => {
        if (mark.type.name === 'strong') t = `**${t}**`;
        if (mark.type.name === 'em') t = `*${t}*`;
        if (mark.type.name === 'code') t = `\`${t}\``;
      });
      text += t;
    }
  });
  return text;
}

function getAlignmentSeparator(align: string | null): string {
  switch (align) {
    case 'left': return ':---';
    case 'center': return ':---:';
    case 'right': return '---:';
    default: return '---';
  }
}

export const markdownSerializer = new MarkdownSerializer(
  {
    ...defaultNodes,
    table(state: any, node: PMNode) {
      // Collect rows
      const rows: PMNode[] = [];
      node.forEach((row: PMNode) => rows.push(row));

      if (rows.length === 0) return;

      // Determine column count from first row
      const colCount = rows[0].childCount;

      // Serialize header row (first row, assumed to be table_header cells)
      const headerRow = rows[0];
      const headerCells: string[] = [];
      const alignments: (string | null)[] = [];
      headerRow.forEach((cell: PMNode) => {
        headerCells.push(serializeCell(cell, state));
        alignments.push(cell.attrs.textAlign || null);
      });

      // Write header
      state.write('| ' + headerCells.join(' | ') + ' |\n');

      // Write separator
      const separators = alignments.map((a: string | null) => getAlignmentSeparator(a));
      state.write('| ' + separators.join(' | ') + ' |\n');

      // Write data rows
      for (let i = 1; i < rows.length; i++) {
        const cells: string[] = [];
        rows[i].forEach((cell: PMNode) => {
          cells.push(serializeCell(cell, state));
        });
        state.write('| ' + cells.join(' | ') + ' |\n');
      }

      state.closeBlock(node);
    },
    table_row() {
      // Handled by table serializer
    },
    table_header(state: any, node: PMNode) {
      // Handled by table serializer — shouldn't be called directly
      state.renderInline(node);
    },
    table_cell(state: any, node: PMNode) {
      // Handled by table serializer — shouldn't be called directly
      state.renderInline(node);
    },
  },
  {
    ...defaultMarks,
  },
);
```

**Important:** The exact `markdown-it` import and token `getAttrs` API may need adjustment. The `tok.attrGet` method is markdown-it's Token API. Check actual token objects during dev if attrs aren't picked up — fallback is `tok.attrs` as an array of `[key, value]` pairs.

**Step 2: Verify TypeScript compiles**

Run:
```bash
cd /Users/simon/tetronomis/gitnotes && npx tsc --noEmit
```

Expected: No errors. Likely issues to fix:
- The `state` parameter types — `prosemirror-markdown`'s `MarkdownSerializerState` may need explicit typing
- The `markdown-it` import — may need `import MarkdownIt from 'markdown-it'` or check how `prosemirror-markdown` exposes it
- The `defaultTokens` access — if `tokens` is private, inspect the `defaultMarkdownParser` object at runtime to get the right property name

**Step 3: Commit**

```bash
cd /Users/simon/tetronomis/gitnotes && git add src/editor/markdown.ts && git commit -m "feat: add custom markdown parser and serializer with table support"
```

---

## Task 4: Wire custom schema/parser/serializer into the editor

**Files:**
- Modify: `src/editor.ts:1-30` (imports and schema), `src/editor.ts:246-267` (loadContent), `src/editor.ts:293-297` (getContent)

This is the integration step. Replace the three default imports with our custom versions.

**Step 1: Update imports in editor.ts**

Replace the import on line 4:
```typescript
// BEFORE
import { defaultMarkdownParser, defaultMarkdownSerializer } from 'prosemirror-markdown';

// AFTER
import { markdownParser, markdownSerializer } from './editor/markdown';
import { schema } from './editor/schema';
```

Remove line 26:
```typescript
// DELETE THIS LINE
const schema = defaultMarkdownParser.schema;
```

**Step 2: Update loadContent function (~line 252)**

Replace `defaultMarkdownParser.parse` with `markdownParser.parse`:

```typescript
// BEFORE
const doc = defaultMarkdownParser.parse(parsed.body) || schema.node('doc', null, [schema.node('paragraph')]);

// AFTER
const doc = markdownParser.parse(parsed.body) || schema.node('doc', null, [schema.node('paragraph')]);
```

Do the same in `loadWhisperContent` (~line 283).

**Step 3: Update getContent function (~line 295)**

Replace `defaultMarkdownSerializer.serialize` with `markdownSerializer.serialize`:

```typescript
// BEFORE
const body = defaultMarkdownSerializer.serialize(editorView.state.doc);

// AFTER
const body = markdownSerializer.serialize(editorView.state.doc);
```

**Step 4: Verify it builds**

Run:
```bash
cd /Users/simon/tetronomis/gitnotes && npx tsc --noEmit
```

**Step 5: Manual test — tables render**

Run:
```bash
cd /Users/simon/tetronomis/gitnotes && npm run dev
```

Open the `gf-acc-plan` note in the Business section. Tables should now render as HTML `<table>` elements instead of raw pipe text. They won't be editable yet (that's Task 6), but they should display properly.

**Step 6: Manual test — roundtrip**

Edit the note (change some text above a table), save, close, reopen. Verify:
- Tables are still in the markdown (not lost)
- Pipe syntax is preserved
- Alignment separators are preserved
- No extra blank lines or formatting drift

**Step 7: Commit**

```bash
cd /Users/simon/tetronomis/gitnotes && git add src/editor.ts && git commit -m "feat: wire custom schema and parser/serializer into editor"
```

---

## Task 5: Add table CSS

**Files:**
- Modify: `src/styles/main.css` (insert after the image styles at ~line 577)

**Step 1: Add table styles**

Insert these styles after the `#editor .ProseMirror img` block (~line 577):

```css
/* Tables */
#editor .ProseMirror table {
  border-collapse: collapse;
  width: auto;
  margin: 0 0 1em 0;
  font-size: 0.9em;
}

#editor .ProseMirror th,
#editor .ProseMirror td {
  border: 1px solid var(--border-color);
  padding: 6px 12px;
  vertical-align: top;
  min-width: 60px;
}

#editor .ProseMirror th {
  background: var(--bg-tertiary);
  font-weight: 600;
}

/* Cell selection (prosemirror-tables adds .selectedCell class) */
#editor .ProseMirror .selectedCell {
  background: color-mix(in srgb, var(--accent-color) 20%, transparent);
}

/* Column resize handle */
#editor .ProseMirror .column-resize-handle {
  position: absolute;
  right: -2px;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--accent-color);
  pointer-events: none;
}

/* When resizing, show resize cursor */
#editor .ProseMirror.resize-cursor {
  cursor: col-resize;
}
```

**Step 2: Verify visually**

Run `npm run dev`, open a note with tables. Verify:
- Cells have subtle borders
- Header row has darker background
- Looks good in both dark and light themes (check theme selector if available)

**Step 3: Commit**

```bash
cd /Users/simon/tetronomis/gitnotes && git add src/styles/main.css && git commit -m "feat: add table styles for ProseMirror editor"
```

---

## Task 6: Add prosemirror-tables editing plugins

**Files:**
- Modify: `src/editor.ts:199-211` (plugin list in initEditor)
- Modify: `src/editor/keymap.ts` (add table-aware Tab/Shift-Tab)

**Step 1: Add table plugins to initEditor**

In `src/editor.ts`, add imports at the top:

```typescript
import { tableEditing, columnResizing, goToNextCell } from 'prosemirror-tables';
import { keymap } from 'prosemirror-keymap';
```

In the `initEditor` function, add table plugins to the plugin array (before `savePlugin()`):

```typescript
plugins: [
  history(),
  buildKeymap(),
  buildInputRules(schema),
  buildCursorPlugin(),
  dropCursor(),
  gapCursor(),
  columnResizing(),
  tableEditing(),
  keymap({
    'Tab': goToNextCell(1),
    'Shift-Tab': goToNextCell(-1),
  }),
  savePlugin(),
],
```

**Important ordering:** The table `Tab`/`Shift-Tab` keymap must come AFTER `buildKeymap()` in the plugin array. ProseMirror tries plugins in order — `buildKeymap()` handles Tab for list indentation, and if the cursor is not in a list, it falls through to the table keymap. But since `goToNextCell` returns false when not in a table, this coexists naturally. However, the current `buildKeymap` Tab handler consumes Tab even when not in a list item (lines 28-34 of keymap.ts). This needs fixing.

**Step 2: Fix Tab handling in keymap.ts**

The current `buildKeymap` Tab handler (line 22-35) consumes Tab when inside a list item even if `sinkListItem` fails. It needs to return `false` when not in a list item so tables can handle it.

In `src/editor/keymap.ts`, the Tab handler currently does:
```typescript
// Consume Tab in list items to prevent focus loss
const { $from } = state.selection;
for (let d = $from.depth; d > 0; d--) {
  if ($from.node(d).type.name === 'list_item') {
    return true;
  }
}
return false;
```

This is already correct — it returns `false` when not in a list. The `goToNextCell` keymap after it will handle Tab in tables. No changes needed to keymap.ts.

**Step 3: Add table keyboard shortcuts for row/column operations**

In the table keymap block in `src/editor.ts`, add:

```typescript
import {
  tableEditing, columnResizing, goToNextCell,
  addRowAfter, addRowBefore, addColumnAfter,
  deleteRow, deleteColumn, deleteTable,
} from 'prosemirror-tables';

// In the plugins array:
keymap({
  'Tab': goToNextCell(1),
  'Shift-Tab': goToNextCell(-1),
  'Mod-Enter': addRowAfter,
  'Mod-Shift-Enter': addRowBefore,
  'Mod-Shift-\\': addColumnAfter,
  'Mod-Backspace': deleteRow,
}),
```

**Step 4: Verify builds and test editing**

Run:
```bash
cd /Users/simon/tetronomis/gitnotes && npx tsc --noEmit && npm run dev
```

Test in browser:
- Click inside a table cell → cursor appears, can type
- Tab → moves to next cell
- Shift-Tab → moves to previous cell
- Click-drag across cells → cells highlight with selectedCell background
- Cmd+Enter → adds row below current
- Cmd+Shift+Enter → adds row above
- Edit a cell, save, reopen → changes preserved in markdown

**Step 5: Commit**

```bash
cd /Users/simon/tetronomis/gitnotes && git add src/editor.ts src/editor/keymap.ts && git commit -m "feat: add table editing plugins with Tab navigation and row/column shortcuts"
```

---

## Task 7: Add context menu for table operations

**Files:**
- Create: `src/editor/table-menu.ts`
- Modify: `src/editor.ts` (register the context menu plugin)
- Modify: `src/styles/main.css` (context menu styles)

**Step 1: Create the context menu module**

Create `src/editor/table-menu.ts`:

```typescript
import { Plugin } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import {
  addRowBefore, addRowAfter,
  addColumnBefore, addColumnAfter,
  deleteRow, deleteColumn, deleteTable,
  CellSelection,
} from 'prosemirror-tables';

interface MenuItem {
  label: string;
  command: (state: any, dispatch: any) => boolean;
  separator?: boolean;
}

const menuItems: MenuItem[] = [
  { label: 'Insert Row Above', command: addRowBefore },
  { label: 'Insert Row Below', command: addRowAfter },
  { label: 'Insert Column Left', command: addColumnBefore },
  { label: 'Insert Column Right', command: addColumnAfter },
  { label: 'Delete Row', command: deleteRow, separator: true },
  { label: 'Delete Column', command: deleteColumn },
  { label: 'Delete Table', command: deleteTable, separator: true },
];

function isInTable(view: EditorView): boolean {
  const { $from } = view.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === 'table') return true;
  }
  // Also check CellSelection
  return view.state.selection instanceof CellSelection;
}

function removeMenu() {
  const existing = document.querySelector('.pm-table-menu');
  if (existing) existing.remove();
}

function showMenu(view: EditorView, x: number, y: number) {
  removeMenu();

  const menu = document.createElement('div');
  menu.className = 'pm-table-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  for (const item of menuItems) {
    if (item.separator) {
      const sep = document.createElement('div');
      sep.className = 'pm-table-menu-separator';
      menu.appendChild(sep);
    }

    const btn = document.createElement('button');
    btn.className = 'pm-table-menu-item';
    btn.textContent = item.label;

    // Disable if command can't execute
    if (!item.command(view.state, undefined)) {
      btn.disabled = true;
    }

    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      item.command(view.state, view.dispatch);
      removeMenu();
      view.focus();
    });

    menu.appendChild(btn);
  }

  document.body.appendChild(menu);

  // Remove on click outside or Escape
  const cleanup = (e: Event) => {
    if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
    removeMenu();
    document.removeEventListener('mousedown', cleanup);
    document.removeEventListener('keydown', cleanup);
  };
  // Delay to avoid catching the contextmenu event itself
  setTimeout(() => {
    document.addEventListener('mousedown', cleanup);
    document.addEventListener('keydown', cleanup);
  }, 0);
}

export function buildTableMenuPlugin(): Plugin {
  return new Plugin({
    props: {
      handleDOMEvents: {
        contextmenu(view: EditorView, event: MouseEvent) {
          if (!isInTable(view)) return false;
          event.preventDefault();
          showMenu(view, event.clientX, event.clientY);
          return true;
        },
      },
    },
  });
}
```

**Step 2: Add context menu styles to main.css**

Append after the table styles added in Task 5:

```css
/* Table context menu */
.pm-table-menu {
  position: fixed;
  z-index: 1000;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 4px 0;
  min-width: 180px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.pm-table-menu-item {
  display: block;
  width: 100%;
  padding: 6px 14px;
  border: none;
  background: none;
  color: var(--text-primary);
  font-size: 0.85rem;
  text-align: left;
  cursor: pointer;
  font-family: var(--font-family-base);
}

.pm-table-menu-item:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.pm-table-menu-item:disabled {
  color: var(--text-secondary);
  cursor: default;
  opacity: 0.5;
}

.pm-table-menu-separator {
  height: 1px;
  background: var(--border-color);
  margin: 4px 0;
}
```

**Step 3: Register the plugin in editor.ts**

Import and add to plugin array:

```typescript
import { buildTableMenuPlugin } from './editor/table-menu';

// In initEditor, add to plugins array (after tableEditing()):
plugins: [
  // ... existing plugins ...
  tableEditing(),
  buildTableMenuPlugin(),
  // ... rest ...
],
```

**Step 4: Test the context menu**

Run `npm run dev`. Right-click inside a table cell:
- Menu appears at cursor position
- "Insert Row Below" → adds a new row
- "Delete Row" → removes the row
- "Delete Table" → removes the entire table
- Click outside menu → menu dismisses
- Esc → menu dismisses
- Right-click outside a table → no menu (browser default context menu)

**Step 5: Commit**

```bash
cd /Users/simon/tetronomis/gitnotes && git add src/editor/table-menu.ts src/editor.ts src/styles/main.css && git commit -m "feat: add right-click context menu for table operations"
```

---

## Task 8: Add table creation input rule

**Files:**
- Modify: `src/editor/input-rules.ts`

**Step 1: Add the table input rule**

Typing `|||` at the start of a line creates a 2-column, 2-row table (1 header row + 1 data row).

In `src/editor/input-rules.ts`, add a new rule function:

```typescript
import { InputRule } from 'prosemirror-inputrules';
import { Fragment } from 'prosemirror-model';

// ||| → create a 2x2 table
function tableRule(schema: Schema) {
  return new InputRule(/^\|\|\|$/, (state, match, start, end) => {
    const headerCell = schema.nodes.table_header?.createAndFill();
    const dataCell = schema.nodes.table_cell?.createAndFill();
    if (!headerCell || !dataCell) return null;

    const headerRow = schema.nodes.table_row.create(null, Fragment.from([headerCell, headerCell.copy(headerCell.content)]));
    const dataRow = schema.nodes.table_row.create(null, Fragment.from([dataCell, dataCell.copy(dataCell.content)]));
    const table = schema.nodes.table.create(null, Fragment.from([headerRow, dataRow]));

    return state.tr.replaceWith(start - 1, end, table);
  });
}
```

Add `tableRule(schema)` to the rules array in `buildInputRules`.

**Important:** The `start - 1` accounts for the paragraph node that wraps the typed text. Verify the exact offset during dev — if the table appears with a stray empty paragraph before it, adjust.

**Step 2: Test table creation**

Run `npm run dev`. In any note:
1. Place cursor on an empty line
2. Type `|||`
3. A 2×2 table should appear
4. Cursor should be in the first header cell
5. Tab through cells, type content, save → markdown output has proper pipe table

**Step 3: Commit**

```bash
cd /Users/simon/tetronomis/gitnotes && git add src/editor/input-rules.ts && git commit -m "feat: add ||| input rule to create new tables"
```

---

## Task 9: Final integration test and squash

**Step 1: Full roundtrip test**

Run `npm run dev` and test the complete flow:

1. **Open existing table note** (`gf-acc-plan` in Business section)
   - [ ] Tables render as HTML tables (not raw pipe text)
   - [ ] Header cells have distinct background
   - [ ] Cell borders visible

2. **Edit existing table**
   - [ ] Click a cell → cursor appears
   - [ ] Type text → cell updates
   - [ ] Tab → next cell, Shift-Tab → previous cell
   - [ ] Click-drag across cells → blue selection highlight

3. **Add/remove rows and columns**
   - [ ] Cmd+Enter → new row below
   - [ ] Right-click → context menu with all options
   - [ ] Delete Row → removes row
   - [ ] Insert Column Right → adds column

4. **Create new table**
   - [ ] Type `|||` on empty line → 2×2 table appears
   - [ ] Fill in cells, save

5. **Roundtrip**
   - [ ] Save note with edits
   - [ ] Close and reopen → all changes preserved
   - [ ] Markdown in VS Code shows clean pipe syntax
   - [ ] No formatting drift after multiple saves

6. **Non-table content unaffected**
   - [ ] Headings, lists, blockquotes, code blocks still work
   - [ ] Tab still indents lists (not captured by table handler)
   - [ ] Existing keybindings preserved

**Step 2: Squash into single feature commit**

Once everything works, squash the task commits into one:

```bash
cd /Users/simon/tetronomis/gitnotes && git rebase -i HEAD~8
```

Squash all into: `feat: add editable markdown table support`

---

## Potential Issues and Debugging Tips

**Parser doesn't pick up tables:**
- `markdown-it` must have the table rule enabled. The `commonmark` preset may not include it. Try `markdownit('default')` or `markdownit()` instead of `markdownit('commonmark')` — the default preset includes GFM tables.

**Token names don't match:**
- Run `markdownit().parse('| a | b |\n|---|---|\n| c | d |')` in a Node REPL to see exact token names. They should be `table_open`, `thead_open`, `tr_open`, `th_open`, `td_open`, etc.

**Serializer produces garbled output:**
- The `serializeCell` function is the most fragile piece. If inline marks (bold, italic) aren't serialized correctly, simplify to `node.textContent` first, then add mark support incrementally.

**TypeScript errors with prosemirror-tables types:**
- `prosemirror-tables` ships its own types. If there are conflicts, check that the prosemirror version ranges are compatible. Run `npm ls prosemirror-model` to verify a single version is resolved.

**Tab key fights between lists and tables:**
- The `goToNextCell(1)` command returns `false` when not in a table, so it won't interfere with list Tab handling. But verify this during testing — if Tab stops working in lists, the plugin ordering needs adjustment.

**Column widths lost on roundtrip:**
- `columnResizing()` stores widths in `colwidth` cell attributes. GFM markdown has no syntax for column widths, so widths are lost on save/reload. This is expected — the visual resizing is session-only. Acceptable tradeoff for read-only-first scope.
