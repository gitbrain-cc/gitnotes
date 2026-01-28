import { EditorView, keymap, ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, indentUnit } from '@codemirror/language';
import { scheduleSave } from './main';
import { FrontMatter, parseFrontMatter, serializeFrontMatter } from './frontmatter';
import { livePreview } from './editor/live-preview';

let editorView: EditorView | null = null;
let currentFrontMatter: FrontMatter = {};

// Compartments for runtime reconfiguration
const lineWrappingCompartment = new Compartment();
const tabSizeCompartment = new Compartment();

// Header data that will be displayed
export interface HeaderData {
  title: string;
  createdDate: string | null;
  modifiedInfo: string | null;
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
    borderLeftColor: 'var(--text-primary)',
  },
  '.selection-bracket': {
    color: '#e85d4c',
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
        syntaxHighlighting(defaultHighlightStyle),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        theme,
        selectionBrackets,
        livePreview,
        updateListener,
        lineWrappingCompartment.of(EditorView.lineWrapping),
        tabSizeCompartment.of([indentUnit.of('  '), EditorState.tabSize.of(2)]),
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
