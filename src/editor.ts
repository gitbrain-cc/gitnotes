import { EditorState, Plugin, TextSelection, Selection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { history } from 'prosemirror-history';
import { defaultMarkdownParser, defaultMarkdownSerializer } from 'prosemirror-markdown';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { buildKeymap } from './editor/keymap';
import { buildInputRules } from './editor/input-rules';

/**
 * Schema: We use defaultMarkdownParser.schema directly.
 *
 * The parser and serializer are tightly coupled to their schema - node types
 * are compared by reference, not by name. Using a different schema instance
 * (even with identical spec) causes subtle bugs like input rules and keymaps
 * not finding the correct node types.
 *
 * TO EXTEND THE SCHEMA (e.g., tables, task lists):
 * 1. Create custom schema: new Schema({ nodes: {...extended}, marks: {...} })
 * 2. Create custom parser: new MarkdownParser(customSchema, markdownit, tokens)
 * 3. Create custom serializer: new MarkdownSerializer(nodes, marks)
 * 4. Use all three together - they must share the same schema instance
 *
 * See: https://prosemirror.net/docs/ref/#markdown
 */
const schema = defaultMarkdownParser.schema;
import { injectCursorStyles } from './editor/cursor';
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
        buildInputRules(schema),
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

  // Line wrapping
  if (settings.line_wrapping) {
    container.style.whiteSpace = '';
  } else {
    container.style.whiteSpace = 'pre';
  }

  // Tab size as CSS property (for code blocks)
  container.style.tabSize = String(settings.tab_size);

  // Cursor styling (native caret with accent color for v1)
  injectCursorStyles(settings.cursor_style || 'block');
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
  const words = text.trim().split(/\s+/).filter((w: string) => w.length > 0);
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

  // Build selection - either search term match or line start
  let selection: Selection;

  if (searchTerm) {
    // Text content starts at targetPos + 1 (inside the block node)
    const textStart = targetPos + 1;
    const textEnd = Math.min(textStart + 500, doc.content.size);
    const text = doc.textBetween(textStart, textEnd);
    const matchIndex = text.toLowerCase().indexOf(searchTerm.toLowerCase());

    if (matchIndex !== -1) {
      const from = textStart + matchIndex;
      const to = from + searchTerm.length;
      selection = TextSelection.create(doc, from, to);
    } else {
      selection = TextSelection.near(doc.resolve(targetPos));
    }
  } else {
    selection = TextSelection.near(doc.resolve(targetPos));
  }

  // Single dispatch: set selection and scroll into view
  editorView.dispatch(
    editorView.state.tr.setSelection(selection).scrollIntoView()
  );
  editorView.focus();
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
