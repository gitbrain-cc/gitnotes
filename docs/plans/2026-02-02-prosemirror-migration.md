# ProseMirror Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace CodeMirror 6 with ProseMirror as the editor foundation, gaining native selection, proper list handling, and a document model that matches the notes domain.

**Architecture:** ProseMirror with `prosemirror-markdown` for bidirectional markdown conversion. The editor stores a rich document tree internally; markdown is the serialization format for disk. The existing public API surface (`loadContent`, `getContent`, `focusEditor`, etc.) stays identical — callers don't know the editor changed.

**Tech Stack:** `prosemirror-model`, `prosemirror-state`, `prosemirror-view`, `prosemirror-commands`, `prosemirror-keymap`, `prosemirror-history`, `prosemirror-markdown`, `prosemirror-inputrules`, `prosemirror-schema-list`

---

## Migration Strategy

**Approach: Adapter pattern.** The editor module (`src/editor.ts`) is the only interface between the editor and the rest of the app. Every other module (`main.ts`, `sidebar.ts`, `settings.ts`) calls editor functions — never touches CodeMirror directly. We replace the internals of `src/editor.ts`, keep the exports identical, and nothing else changes.

**What stays the same:**
- `src/frontmatter.ts` — unchanged, still strips/reattaches frontmatter before/after editor
- `src/main.ts` — unchanged, calls same editor exports
- `src/sidebar.ts` — unchanged, calls same editor exports
- `src/settings.ts` — dispatches same `editor-settings-changed` event (but some settings may map differently)

**What gets replaced:**
- `src/editor.ts` — full rewrite (same exports, ProseMirror internals)
- `src/editor/live-preview.ts` — deleted (ProseMirror renders rich output natively)
- `src/styles/main.css` — remove all `.cm-*` rules, add ProseMirror styles
- `package.json` — swap CodeMirror deps for ProseMirror deps

**What needs new code:**
- `src/editor/schema.ts` — ProseMirror schema (document structure definition)
- `src/editor/keymap.ts` — custom keybindings (Tab/Shift-Tab list indentation, etc.)
- `src/editor/theme.ts` — CSS class injection for heading sizes, cursor, etc.

---

## Current Editor Public API (contract to preserve)

```typescript
// Lifecycle
initEditor(): void
reconfigureEditor(settings: EditorSettingsForReconfigure): void

// Content
loadContent(content: string): void        // markdown string → editor
getContent(): string                       // editor → markdown string

// Focus
focusEditor(): void

// Metrics
getWordCount(): number

// Header (unchanged, just DOM manipulation)
updateHeaderData(data: HeaderData): void

// Navigation
scrollToLine(lineNumber: number, searchTerm?: string): void

// Cursor/scroll state (session restore + commit engine)
getCursorPosition(): number
getScrollTop(): number
getViewportHeight(): number
getContentUpToCursor(): string
setCursorPosition(pos: number): void
setScrollTop(top: number): void

// Interface
export interface HeaderData { title: string; createdDate: string | null; modifiedInfo: string | null; }
```

---

## Task 1: Install ProseMirror dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install ProseMirror packages**

Run:
```bash
npm install prosemirror-model prosemirror-state prosemirror-view prosemirror-commands prosemirror-keymap prosemirror-history prosemirror-markdown prosemirror-inputrules prosemirror-schema-list prosemirror-dropcursor prosemirror-gapcursor
```

**Step 2: Remove CodeMirror packages**

Run:
```bash
npm uninstall @codemirror/commands @codemirror/lang-markdown @codemirror/language @codemirror/language-data @codemirror/state @codemirror/view codemirror
```

**Step 3: Verify install**

Run: `npm ls prosemirror-model`
Expected: installed successfully, no peer dep errors

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "Swap CodeMirror deps for ProseMirror"
```

---

## Task 2: Create ProseMirror schema

**Files:**
- Create: `src/editor/schema.ts`

The schema defines the document structure. Based on `prosemirror-markdown`'s default schema, extended with our needs.

**Step 1: Create schema file**

```typescript
import { Schema } from 'prosemirror-model';
import { schema as markdownSchema } from 'prosemirror-markdown';

// Extend the default markdown schema
// Default includes: doc, paragraph, blockquote, horizontal_rule,
//   heading, code_block, text, image, hard_break
// Marks: link, em, strong, code

export const schema = new Schema({
  nodes: markdownSchema.spec.nodes,
  marks: markdownSchema.spec.marks,
});
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/editor/schema.ts
git commit -m "Add ProseMirror markdown schema"
```

---

## Task 3: Create keymap with list indentation

**Files:**
- Create: `src/editor/keymap.ts`

**Step 1: Create keymap file**

```typescript
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';
import { undo, redo } from 'prosemirror-history';
import {
  sinkListItem,
  liftListItem,
  splitListItem,
} from 'prosemirror-schema-list';
import { schema } from './schema';
import { Plugin } from 'prosemirror-state';

const listItem = schema.nodes.list_item;

export function buildKeymap(): Plugin {
  return keymap({
    'Mod-z': undo,
    'Mod-Shift-z': redo,
    'Mod-y': redo,
    'Tab': sinkListItem(listItem),
    'Shift-Tab': liftListItem(listItem),
    'Enter': splitListItem(listItem),
    ...baseKeymap,
  });
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/editor/keymap.ts
git commit -m "Add ProseMirror keymap with list indentation"
```

---

## Task 4: Rewrite editor.ts with ProseMirror

**Files:**
- Rewrite: `src/editor.ts`
- Delete: `src/editor/live-preview.ts`

This is the core task. The file must export the exact same functions with the same signatures. Internal implementation changes entirely.

**Step 1: Rewrite editor.ts**

```typescript
import { EditorState, Plugin, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { history } from 'prosemirror-history';
import { defaultMarkdownParser, defaultMarkdownSerializer } from 'prosemirror-markdown';
import { inputRules, smartQuotes, emDash, ellipsis } from 'prosemirror-inputrules';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { buildInputRules } from 'prosemirror-example-setup';
import { schema } from './editor/schema';
import { buildKeymap } from './editor/keymap';
import { scheduleSave } from './main';
import { FrontMatter, parseFrontMatter, serializeFrontMatter } from './frontmatter';

let editorView: EditorView | null = null;
let currentFrontMatter: FrontMatter = {};

// Header data that will be displayed
export interface HeaderData {
  title: string;
  createdDate: string | null;
  modifiedInfo: string | null;
}

// Settings interface (preserved for callers)
interface EditorSettingsForReconfigure {
  line_wrapping: boolean;
  tab_size: number;
  use_tabs: boolean;
  cursor_style: string;
  cursor_blink: boolean;
}

// Plugin to detect doc changes and trigger save
function savePlugin(): Plugin {
  return new Plugin({
    view() {
      return {
        update(view, prevState) {
          if (!view.state.doc.eq(prevState.doc)) {
            scheduleSave();
          }
        },
      };
    },
  });
}

export function initEditor() {
  const container = document.getElementById('editor');
  if (!container) return;

  // Clean up existing editor
  if (editorView) {
    editorView.destroy();
    editorView = null;
  }

  const doc = schema.node('doc', null, [schema.node('paragraph')]);

  editorView = new EditorView(container, {
    state: EditorState.create({
      doc,
      plugins: [
        history(),
        buildKeymap(),
        dropCursor(),
        gapCursor(),
        savePlugin(),
      ],
    }),
  });

  // Listen for settings changes
  window.addEventListener('editor-settings-changed', ((e: CustomEvent) => {
    reconfigureEditor(e.detail);
  }) as EventListener);
}

export function reconfigureEditor(settings: EditorSettingsForReconfigure): void {
  if (!editorView) return;

  const container = editorView.dom;

  // Font size applied via CSS variable
  // Line wrapping
  if (settings.line_wrapping) {
    container.style.whiteSpace = '';
  } else {
    container.style.whiteSpace = 'pre';
  }

  // Tab size as CSS property (for code blocks)
  container.style.tabSize = String(settings.tab_size);

  // Cursor blink
  container.style.caretColor = 'var(--accent-color)';
}

export function loadContent(content: string) {
  if (!editorView) return;

  const parsed = parseFrontMatter(content);
  currentFrontMatter = parsed.frontmatter;

  const doc = defaultMarkdownParser.parse(parsed.body) || schema.node('doc', null, [schema.node('paragraph')]);

  editorView.updateState(
    EditorState.create({
      doc,
      plugins: editorView.state.plugins,
    })
  );
}

export function getContent(): string {
  if (!editorView) return '';
  const body = defaultMarkdownSerializer.serialize(editorView.state.doc);
  return serializeFrontMatter(currentFrontMatter, body);
}

export function focusEditor() {
  editorView?.focus();
}

export function getWordCount(): number {
  if (!editorView) return 0;
  const text = editorView.state.doc.textContent;
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  return words.length;
}

export function updateHeaderData(data: HeaderData) {
  const header = document.getElementById('note-header');
  if (!header) return;

  if (!data.title) {
    header.classList.remove('visible');
    return;
  }

  header.classList.add('visible');

  const parts: string[] = [];
  if (data.createdDate) {
    parts.push(`Created ${data.createdDate}`);
  }
  if (data.modifiedInfo) {
    parts.push(data.modifiedInfo);
  }

  header.innerHTML = `
    <h1>${data.title}</h1>
    <div class="meta">${parts.join(' · ')}</div>
  `;
}

export function scrollToLine(lineNumber: number, searchTerm?: string) {
  if (!editorView) return;

  // Convert line number to ProseMirror position
  const doc = editorView.state.doc;
  let currentLine = 0;
  let targetPos = 0;

  doc.descendants((node, pos) => {
    if (node.isBlock && currentLine <= lineNumber) {
      targetPos = pos;
      currentLine++;
    }
    return currentLine <= lineNumber;
  });

  // Scroll to position
  editorView.dispatch(
    editorView.state.tr.setSelection(TextSelection.near(doc.resolve(targetPos)))
  );
  editorView.focus();

  // If search term provided, find and select it
  if (searchTerm) {
    const text = editorView.state.doc.textBetween(targetPos, Math.min(targetPos + 500, doc.content.size));
    const matchIndex = text.toLowerCase().indexOf(searchTerm.toLowerCase());
    if (matchIndex !== -1) {
      const from = targetPos + matchIndex;
      const to = from + searchTerm.length;
      editorView.dispatch(
        editorView.state.tr.setSelection(TextSelection.create(doc, from, to))
      );
    }
  }

  // Scroll into view
  editorView.dispatch(editorView.state.tr.scrollIntoView());
}

// Commit engine accessor functions
export function getCursorPosition(): number {
  if (!editorView) return 0;
  return editorView.state.selection.head;
}

export function getScrollTop(): number {
  if (!editorView) return 0;
  return editorView.dom.scrollTop;
}

export function getViewportHeight(): number {
  if (!editorView) return 0;
  return editorView.dom.clientHeight;
}

export function getContentUpToCursor(): string {
  if (!editorView) return '';
  const pos = editorView.state.selection.head;
  return editorView.state.doc.textBetween(0, pos);
}

export function setCursorPosition(pos: number) {
  if (!editorView) return;
  const docSize = editorView.state.doc.content.size;
  const safePos = Math.min(pos, docSize);
  try {
    editorView.dispatch(
      editorView.state.tr.setSelection(TextSelection.near(editorView.state.doc.resolve(safePos)))
    );
  } catch {
    // Position may not be valid in new doc structure, silently ignore
  }
}

export function setScrollTop(top: number) {
  if (!editorView) return;
  editorView.dom.scrollTop = top;
}
```

**Step 2: Delete live-preview.ts**

Delete `src/editor/live-preview.ts` — ProseMirror renders the rich view natively, no decoration plugin needed.

**Step 3: Verify it compiles**

Run: `npx tsc --noEmit`

Fix any type errors. Common issues:
- `prosemirror-example-setup` may not be installed — remove the `buildInputRules` import if unused, or install it
- `TextSelection` import may need adjustment

**Step 4: Commit**

```bash
git add src/editor.ts
git rm src/editor/live-preview.ts
git commit -m "Rewrite editor with ProseMirror, delete live-preview plugin"
```

---

## Task 5: Update CSS for ProseMirror

**Files:**
- Modify: `src/styles/main.css`

**Step 1: Remove CodeMirror CSS rules**

Remove these blocks from `main.css`:
- `#editor .cm-editor` (height: 100%)
- `#editor .cm-selectionBackground` (selection color)
- `#editor .cm-editor.cm-focused .cm-selectionBackground` (focused selection)

**Step 2: Add ProseMirror base styles**

Replace the removed rules with:

```css
/* ProseMirror editor */
#editor .ProseMirror {
  height: 100%;
  padding: 16px;
  outline: none;
  font-family: var(--font-family-base);
  font-size: 0.929rem;
  line-height: 1.7;
  letter-spacing: 0.01em;
  color: var(--text-primary);
  caret-color: var(--accent-color);
  overflow-y: auto;
}

#editor .ProseMirror ::selection {
  background: color-mix(in srgb, var(--accent-color) 25%, transparent);
}

/* Headings */
#editor .ProseMirror h1 {
  font-size: 1.6em;
  font-weight: 600;
  color: var(--text-primary);
}

#editor .ProseMirror h2 {
  font-size: 1.35em;
  font-weight: 600;
  color: var(--text-primary);
}

#editor .ProseMirror h3 {
  font-size: 1.15em;
  font-weight: 600;
  color: var(--text-primary);
}

#editor .ProseMirror h4,
#editor .ProseMirror h5,
#editor .ProseMirror h6 {
  font-size: 1em;
  font-weight: 600;
  color: var(--text-primary);
}

/* Inline styles */
#editor .ProseMirror strong {
  font-weight: bold;
}

#editor .ProseMirror em {
  font-style: italic;
}

#editor .ProseMirror a {
  color: var(--accent-color);
  text-decoration: underline;
}

/* Code */
#editor .ProseMirror code {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 0.9em;
  background: var(--bg-tertiary);
  padding: 2px 4px;
  border-radius: 3px;
}

#editor .ProseMirror pre {
  background: var(--bg-secondary);
  padding: 12px 16px;
  border-radius: 6px;
  overflow-x: auto;
}

#editor .ProseMirror pre code {
  background: none;
  padding: 0;
}

/* Lists */
#editor .ProseMirror ul,
#editor .ProseMirror ol {
  padding-left: 1.5em;
}

/* Blockquote */
#editor .ProseMirror blockquote {
  border-left: 3px solid var(--accent-color);
  padding-left: 1em;
  color: var(--text-secondary);
  margin-left: 0;
}

/* Horizontal rule */
#editor .ProseMirror hr {
  border: none;
  border-top: 1px solid var(--border-color);
  margin: 1em 0;
}

/* Images */
#editor .ProseMirror img {
  max-width: 100%;
}

/* Gap cursor */
#editor .ProseMirror .ProseMirror-gapcursor {
  position: relative;
}

#editor .ProseMirror .ProseMirror-gapcursor::after {
  border-top: 1px solid var(--accent-color);
}
```

**Step 3: Verify it compiles and renders**

Run: `npm run tauri dev`
Open a note, verify headings, lists, bold, italic, links render correctly.

**Step 4: Commit**

```bash
git add src/styles/main.css
git commit -m "Replace CodeMirror CSS with ProseMirror styles"
```

---

## Task 6: Input rules (markdown shortcuts while typing)

**Files:**
- Create: `src/editor/input-rules.ts`
- Modify: `src/editor.ts` (add plugin)

ProseMirror doesn't auto-convert markdown syntax by default. Input rules let users type `# ` to create a heading, `- ` for a list, etc.

**Step 1: Create input rules**

```typescript
import {
  inputRules,
  wrappingInputRule,
  textblockTypeInputRule,
  smartQuotes,
  emDash,
  ellipsis,
} from 'prosemirror-inputrules';
import { schema } from './schema';
import { Plugin } from 'prosemirror-state';

// # Heading → h1, ## → h2, etc.
function headingRule(level: number) {
  return textblockTypeInputRule(
    new RegExp(`^(#{1,${level}})\\s$`),
    schema.nodes.heading,
    (match) => ({ level: match[1].length }),
  );
}

// - or * → bullet list
const bulletListRule = wrappingInputRule(
  /^\s*([*-])\s$/,
  schema.nodes.bullet_list,
);

// 1. → ordered list
const orderedListRule = wrappingInputRule(
  /^\s*(\d+)\.\s$/,
  schema.nodes.ordered_list,
  (match) => ({ order: +match[1] }),
  (match, node) => node.childCount + node.attrs.order === +match[1],
);

// > → blockquote
const blockquoteRule = wrappingInputRule(
  /^\s*>\s$/,
  schema.nodes.blockquote,
);

// ``` → code block
const codeBlockRule = textblockTypeInputRule(
  /^```$/,
  schema.nodes.code_block,
);

// --- → horizontal rule
// (handled separately since it creates a node, not wraps)

export function buildInputRules(): Plugin {
  return inputRules({
    rules: [
      ...smartQuotes,
      emDash,
      ellipsis,
      headingRule(6),
      bulletListRule,
      orderedListRule,
      blockquoteRule,
      codeBlockRule,
    ],
  });
}
```

**Step 2: Add to editor plugins**

In `src/editor.ts`, import and add to plugins array:

```typescript
import { buildInputRules } from './editor/input-rules';

// In initEditor(), add to plugins:
plugins: [
  history(),
  buildKeymap(),
  buildInputRules(),
  dropCursor(),
  gapCursor(),
  savePlugin(),
],
```

**Step 3: Verify it compiles**

Run: `npx tsc --noEmit`

**Step 4: Test input rules manually**

Run: `npm run tauri dev`
- Type `# ` at start of line → should become h1
- Type `- ` → should create bullet list
- Type `1. ` → should create ordered list
- Type `> ` → should create blockquote

**Step 5: Commit**

```bash
git add src/editor/input-rules.ts src/editor.ts
git commit -m "Add markdown input rules for headings, lists, quotes"
```

---

## Task 7: Cursor style customization

**Files:**
- Create: `src/editor/cursor.ts`
- Modify: `src/editor.ts`

The cursor glyph system (⌐, |, ¬, ^, _, °) needs to be reimplemented for ProseMirror. Since ProseMirror uses the native browser caret, we need a different approach — a CSS-only solution using `caret-color: transparent` + a positioned pseudo-element on the cursor position.

**Step 1: Create cursor module**

```typescript
let cursorStyleElement: HTMLStyleElement | null = null;

const CURSOR_GLYPHS: Record<string, { glyph: string; fontSize: string; bottom: string; left: string; extra?: string }> = {
  line: { glyph: '|', fontSize: '1em', bottom: '0.75em', left: '-0.3em', extra: 'font-weight: 900; -webkit-text-stroke: 0.5px var(--accent-color);' },
  block: { glyph: '⌐', fontSize: '1.2em', bottom: '0', left: '0' },
  underline: { glyph: '¬', fontSize: '1.2em', bottom: '0', left: '-0.15em' },
  caret: { glyph: '^', fontSize: '0.9em', bottom: '-0.3em', left: '-0.5em' },
  underscore: { glyph: '_', fontSize: '1em', bottom: '0.55em', left: '0' },
  dot: { glyph: '°', fontSize: '1em', bottom: '-0.25em', left: '-0.1em' },
};

export function injectCursorStyles(style: string = 'block') {
  const config = CURSOR_GLYPHS[style] || CURSOR_GLYPHS.block;
  // NOTE: ProseMirror uses native caret. Custom glyph cursors require
  // a cursor overlay plugin or accepting native caret with accent color.
  // For v1 of migration: use native caret with accent color.
  // Custom glyph cursor can be added later as a ProseMirror plugin
  // that tracks selection and renders a positioned element.
  const css = `
    #editor .ProseMirror {
      caret-color: var(--accent-color);
    }
  `;

  if (cursorStyleElement) {
    cursorStyleElement.textContent = css;
  } else {
    cursorStyleElement = document.createElement('style');
    cursorStyleElement.textContent = css;
    document.head.appendChild(cursorStyleElement);
  }
}

export function setCursorBlink(blink: boolean) {
  // Native caret blink is controlled by the OS
  // ProseMirror doesn't provide blink rate control
  // This is a no-op for now — acceptable tradeoff for migration
}
```

**Note:** Custom cursor glyphs are a **v2 feature** — the native accent-colored caret is a good default. Reimplementing the glyph overlay as a ProseMirror plugin is possible but non-trivial and should be a separate task after the migration is stable.

**Step 2: Update editor.ts to use cursor module**

Replace cursor-related code in `reconfigureEditor`:
```typescript
import { injectCursorStyles } from './editor/cursor';

// In reconfigureEditor():
injectCursorStyles(settings.cursor_style || 'block');
```

**Step 3: Commit**

```bash
git add src/editor/cursor.ts src/editor.ts
git commit -m "Add cursor styling module (native caret for v1)"
```

---

## Task 8: Markdown serialization fidelity testing

**Files:**
- No new files — manual testing and fixes

The most critical part of this migration: markdown round-trips must be lossless. Content loaded → edited → saved must not corrupt formatting.

**Step 1: Test round-trip fidelity**

Run `npm run tauri dev` and test these scenarios:

1. **Load a note with frontmatter** → verify body appears correctly, frontmatter preserved on save
2. **Headings** → `# H1` through `###### H6` survive round-trip
3. **Lists** → bullet lists (`- item`), ordered lists (`1. item`), nested lists
4. **Emphasis** → `*italic*`, `**bold**`, `***bold italic***`, `` `code` ``
5. **Links** → `[text](url)` preserved
6. **Code blocks** → fenced code blocks with language preserved
7. **Blockquotes** → `> quote` with nested content
8. **Horizontal rules** → `---` preserved
9. **Hard line breaks** → trailing spaces or `\` at end of line
10. **Empty lines** → paragraph spacing preserved

**Step 2: Fix serialization issues**

Common issues with `prosemirror-markdown` default serializer:
- Tight vs loose lists (may add/remove blank lines between items)
- Heading style (may use different ATX format)
- Link reference vs inline (default is inline, should be fine)
- Code block fence style (default is ```, should be fine)

Fix by customizing `MarkdownSerializer` options if needed.

**Step 3: Commit fixes**

```bash
git add -A
git commit -m "Fix markdown serialization fidelity issues"
```

---

## Task 9: Integration testing

**Files:**
- No new files — testing all integration points

**Step 1: Test editor lifecycle**

- App startup → editor initializes
- Switch notes → content loads correctly
- Edit and wait → auto-save triggers (check file on disk)
- Switch away and back → content preserved

**Step 2: Test search integration**

- Search for text → click result → editor scrolls to match
- Verify `scrollToLine` works with ProseMirror positions

**Step 3: Test session restore**

- Edit a note, place cursor somewhere specific
- Close and reopen app
- Cursor and scroll position should be restored

**Step 4: Test settings**

- Change font size → editor updates
- Change line wrapping → editor updates
- Change tab size → list indentation follows

**Step 5: Test commit engine**

- Edit content → verify `getCursorPosition`, `getScrollTop`, `getContentUpToCursor` return sane values
- Commit confidence bar should still function

**Step 6: Fix any integration issues found, commit**

---

## Task 10: Cleanup

**Files:**
- Modify: `package.json`

**Step 1: Verify no CodeMirror references remain**

Run:
```bash
grep -r "codemirror\|@codemirror" src/ --include="*.ts"
grep -r "\.cm-" src/styles/ --include="*.css"
```

Expected: zero results

**Step 2: Remove any unused files**

Check `src/editor/` — only `schema.ts`, `keymap.ts`, `input-rules.ts`, `cursor.ts` should remain.

**Step 3: Final build**

Run: `npm run tauri build`
Expected: builds successfully

**Step 4: Commit**

```bash
git add -A
git commit -m "Complete ProseMirror migration, remove CodeMirror remnants"
```

---

## Known tradeoffs & v2 items

| Feature | v1 (this migration) | v2 (future) |
|---------|---------------------|-------------|
| Cursor glyphs | Native caret with accent color | Custom glyph overlay plugin |
| Cursor blink control | OS default | Custom blink plugin |
| Live preview | ProseMirror native rich rendering | Already done |
| Code block syntax highlighting | None (plain text in code blocks) | `prosemirror-highlightjs` or similar |
| Markdown source mode | Not available | Toggle between rich and source view (could use CM6 for source) |
| Scroll past end | Not available | Add padding to bottom of editor |

---

## Risk assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Markdown round-trip loses formatting | Medium | High | Task 8 specifically tests this. Customize serializer early. |
| `scrollToLine` position mapping breaks | Medium | Medium | ProseMirror positions are node-based, not line-based. May need to convert. |
| Session restore cursor positions invalid | Low | Low | `setCursorPosition` already has try/catch. Positions from old CM6 sessions won't match, but that's a one-time issue. |
| Custom cursor glyphs not available | Certain | Low | Acceptable tradeoff — native caret with accent color is clean. |
| List indentation behavior differs | Medium | Medium | Test Tab/Shift-Tab thoroughly. `sinkListItem`/`liftListItem` are well-tested. |
