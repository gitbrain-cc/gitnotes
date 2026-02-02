import { EditorView, keymap, ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType, drawSelection } from '@codemirror/view';
import { EditorState, EditorSelection, Compartment } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, HighlightStyle, indentUnit } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { scheduleSave } from './main';
import { FrontMatter, parseFrontMatter, serializeFrontMatter } from './frontmatter';
import { livePreview } from './editor/live-preview';

let editorView: EditorView | null = null;
let currentFrontMatter: FrontMatter = {};
let tabCursorTimeout: number | null = null;

function hideCursorDuringTab(view: EditorView) {
  const cursorLayer = view.dom.querySelector('.cm-cursorLayer') as HTMLElement | null;
  if (cursorLayer) {
    cursorLayer.style.opacity = '0';
    if (tabCursorTimeout) clearTimeout(tabCursorTimeout);
    tabCursorTimeout = window.setTimeout(() => {
      cursorLayer.style.opacity = '';
      tabCursorTimeout = null;
    }, 150);
  }
}

// Compartments for runtime reconfiguration
const lineWrappingCompartment = new Compartment();
const tabSizeCompartment = new Compartment();
const cursorStyleCompartment = new Compartment();

// Header data that will be displayed
export interface HeaderData {
  title: string;
  createdDate: string | null;
  modifiedInfo: string | null;
}

// Cursor glyphs — ⌐ family variants (see docs/design/cursor.md)
const CURSOR_GLYPHS: Record<string, { glyph: string; fontSize: string; bottom: string; left: string; extra?: string }> = {
  line: { glyph: '|', fontSize: '1em', bottom: '0.75em', left: '-0.3em', extra: 'font-weight: 900; -webkit-text-stroke: 0.5px var(--accent-color);' },
  block: { glyph: '⌐', fontSize: '1.2em', bottom: '0', left: '0' },
  underline: { glyph: '¬', fontSize: '1.2em', bottom: '0', left: '-0.15em' },
  caret: { glyph: '^', fontSize: '0.9em', bottom: '-0.3em', left: '-0.5em' },
  underscore: { glyph: '_', fontSize: '1em', bottom: '0.55em', left: '0' },
  dot: { glyph: '°', fontSize: '1em', bottom: '-0.25em', left: '-0.1em' },
};

let cursorStyleElement: HTMLStyleElement | null = null;

function injectCursorStyles(style: string = 'block') {
  const config = CURSOR_GLYPHS[style] || CURSOR_GLYPHS.block;
  const css = `
    .cm-cursor::after {
      content: '${config.glyph}';
      color: var(--accent-color);
      position: absolute;
      bottom: ${config.bottom};
      left: ${config.left};
      font-size: ${config.fontSize};
      line-height: 0;
      pointer-events: none;
      ${config.extra || ''}
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

const theme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '0.929rem',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-family-base)',
    lineHeight: '1.7',
    letterSpacing: '0.01em',
  },
  '.cm-content': {
    caretColor: 'var(--text-primary)',
    padding: '16px',
  },
  // Markdown styling - headings
  '.cm-header-1': {
    fontSize: '1.6em',
    fontWeight: '600',
    textDecoration: 'none',
    color: 'var(--text-primary)',
  },
  '.cm-header-2': {
    fontSize: '1.35em',
    fontWeight: '600',
    textDecoration: 'none',
    color: 'var(--text-primary)',
  },
  '.cm-header-3': {
    fontSize: '1.15em',
    fontWeight: '600',
    textDecoration: 'none',
    color: 'var(--text-primary)',
  },
  '.cm-header-4, .cm-header-5, .cm-header-6': {
    fontSize: '1em',
    fontWeight: '600',
    textDecoration: 'none',
    color: 'var(--text-primary)',
  },
  '.cm-strong': {
    fontWeight: 'bold',
  },
  '.cm-emphasis': {
    fontStyle: 'italic',
  },
  '.cm-link': {
    color: 'var(--accent-color)',
    textDecoration: 'underline',
  },
  '.cm-url': {
    color: 'var(--text-secondary)',
  },
  '.cm-cursor': {
    borderLeft: 'none',
    borderBottom: 'none',
    width: '0',
    marginLeft: '0',
  },
  '.selection-bracket': {
    color: 'var(--accent-color)',
    fontWeight: 'bold',
  },
});

// Widget for selection brackets
class BracketWidget extends WidgetType {
  constructor(readonly bracket: string) {
    super();
  }
  toDOM() {
    const span = document.createElement('span');
    span.className = 'selection-bracket';
    span.textContent = this.bracket;
    return span;
  }
}

// Plugin to show brackets around selection
const selectionBrackets = ViewPlugin.fromClass(class {
  decorations: DecorationSet = Decoration.none;

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.selectionSet || update.docChanged) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  buildDecorations(view: EditorView): DecorationSet {
    const sel = view.state.selection.main;
    if (sel.empty) return Decoration.none;

    return Decoration.set([
      Decoration.widget({ widget: new BracketWidget('['), side: -1 }).range(sel.from),
      Decoration.widget({ widget: new BracketWidget(']'), side: 1 }).range(sel.to),
    ]);
  }
}, { decorations: v => v.decorations });

export function initEditor() {
  const container = document.getElementById('editor');
  if (!container) return;

  injectCursorStyles();

  // Clean up existing editor (for hot reload)
  if (editorView) {
    editorView.destroy();
    editorView = null;
  }

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      scheduleSave();
    }
  });

  editorView = new EditorView({
    state: EditorState.create({
      doc: '',
      extensions: [
        history(),
        markdown(),
        drawSelection({ cursorBlinkRate: 1200 }),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        syntaxHighlighting(HighlightStyle.define([
          { tag: tags.meta, color: 'var(--text-secondary)' },
        ])),
        keymap.of([
          {
            key: 'Tab',
            run: (view) => {
              hideCursorDuringTab(view);
              const { state } = view;
              const indent = state.facet(indentUnit);
              view.dispatch(state.changeByRange(range => {
                const line = state.doc.lineAt(range.from);
                return {
                  changes: { from: line.from, insert: indent },
                  range: EditorSelection.cursor(range.from + indent.length),
                };
              }));
              return true;
            },
          },
          {
            key: 'Shift-Tab',
            run: (view) => {
              hideCursorDuringTab(view);
              const { state } = view;
              const indent = state.facet(indentUnit);
              view.dispatch(state.changeByRange(range => {
                const line = state.doc.lineAt(range.from);
                const lineText = state.doc.sliceString(line.from, line.from + indent.length);
                if (lineText === indent) {
                  return {
                    changes: { from: line.from, to: line.from + indent.length },
                    range: EditorSelection.cursor(Math.max(line.from, range.from - indent.length)),
                  };
                }
                return { range };
              }));
              return true;
            },
          },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        theme,
        selectionBrackets,
        livePreview,
        updateListener,
        lineWrappingCompartment.of(EditorView.lineWrapping),
        tabSizeCompartment.of([indentUnit.of('  '), EditorState.tabSize.of(2)]),
        cursorStyleCompartment.of(drawSelection({ cursorBlinkRate: 1200 })),
      ],
    }),
    parent: container,
  });

  // Listen for settings changes
  window.addEventListener('editor-settings-changed', ((e: CustomEvent) => {
    reconfigureEditor(e.detail);
  }) as EventListener);
}

interface EditorSettingsForReconfigure {
  line_wrapping: boolean;
  tab_size: number;
  use_tabs: boolean;
  cursor_style: string;
  cursor_blink: boolean;
}

export function reconfigureEditor(settings: EditorSettingsForReconfigure): void {
  if (!editorView) return;

  const effects = [];

  effects.push(
    lineWrappingCompartment.reconfigure(
      settings.line_wrapping ? EditorView.lineWrapping : []
    )
  );

  const indent = settings.use_tabs ? '\t' : ' '.repeat(settings.tab_size);
  effects.push(
    tabSizeCompartment.reconfigure([
      indentUnit.of(indent),
      EditorState.tabSize.of(settings.tab_size),
    ])
  );

  // Cursor glyph
  injectCursorStyles(settings.cursor_style || 'block');

  // Cursor blink
  effects.push(
    cursorStyleCompartment.reconfigure(
      drawSelection({ cursorBlinkRate: settings.cursor_blink ? 1200 : 0 })
    )
  );

  editorView.dispatch({ effects });
}

export function loadContent(content: string) {
  if (!editorView) return;

  // Parse and store front matter, load only body into editor
  const parsed = parseFrontMatter(content);
  currentFrontMatter = parsed.frontmatter;

  editorView.dispatch({
    changes: {
      from: 0,
      to: editorView.state.doc.length,
      insert: parsed.body,
    },
  });
}

export function getContent(): string {
  if (!editorView) return '';
  const body = editorView.state.doc.toString();
  // Serialize front matter back with the body
  return serializeFrontMatter(currentFrontMatter, body);
}

export function focusEditor() {
  editorView?.focus();
}

export function getWordCount(): number {
  if (!editorView) return 0;
  const text = editorView.state.doc.toString();
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

  // CodeMirror lines are 1-based, but our match_line from search is 0-based
  const line = editorView.state.doc.line(Math.min(lineNumber + 1, editorView.state.doc.lines));

  editorView.dispatch({
    effects: EditorView.scrollIntoView(line.from, { y: 'center' })
  });

  // If search term provided, find and select it on this line
  if (searchTerm) {
    const lineText = line.text.toLowerCase();
    const termLower = searchTerm.toLowerCase();
    const matchIndex = lineText.indexOf(termLower);

    if (matchIndex !== -1) {
      const from = line.from + matchIndex;
      const to = from + searchTerm.length;
      editorView.dispatch({
        selection: { anchor: from, head: to }
      });
      editorView.focus();
      return;
    }
  }

  // Fallback: just place cursor at line start
  editorView.dispatch({
    selection: { anchor: line.from }
  });
}

// Commit engine accessor functions
export function getCursorPosition(): number {
  if (!editorView) return 0;
  return editorView.state.selection.main.head;
}

export function getScrollTop(): number {
  if (!editorView) return 0;
  return editorView.scrollDOM.scrollTop;
}

export function getViewportHeight(): number {
  if (!editorView) return 0;
  return editorView.scrollDOM.clientHeight;
}

export function getContentUpToCursor(): string {
  if (!editorView) return '';
  const pos = editorView.state.selection.main.head;
  return editorView.state.doc.sliceString(0, pos);
}

export function setCursorPosition(pos: number) {
  if (!editorView) return;
  const docLength = editorView.state.doc.length;
  const safePos = Math.min(pos, docLength);
  editorView.dispatch({
    selection: { anchor: safePos }
  });
}

export function setScrollTop(top: number) {
  if (!editorView) return;
  editorView.scrollDOM.scrollTop = top;
}
