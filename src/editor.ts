import { EditorView, keymap, highlightActiveLine, drawSelection } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { scheduleSave } from './main';

let editorView: EditorView | null = null;

const theme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '14px',
  },
  '.cm-scroller': {
    fontFamily: '"SF Mono", Menlo, Monaco, "Courier New", monospace',
    lineHeight: '1.6',
    padding: '16px',
  },
  '.cm-content': {
    caretColor: '#333',
  },
  '.cm-line': {
    padding: '0 4px',
  },
  // Markdown styling
  '.cm-header-1': {
    fontSize: '1.8em',
    fontWeight: 'bold',
  },
  '.cm-header-2': {
    fontSize: '1.5em',
    fontWeight: 'bold',
  },
  '.cm-header-3': {
    fontSize: '1.25em',
    fontWeight: 'bold',
  },
  '.cm-strong': {
    fontWeight: 'bold',
  },
  '.cm-emphasis': {
    fontStyle: 'italic',
  },
  '.cm-link': {
    color: '#0066cc',
    textDecoration: 'underline',
  },
  '.cm-url': {
    color: '#666',
  },
  '.cm-list': {
    color: '#666',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: '#3390ff',
  },
  '.cm-selectionMatch': {
    backgroundColor: 'rgba(51, 144, 255, 0.3)',
  },
});

const darkTheme = EditorView.theme({
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: '#3390ff',
  },
  '.cm-selectionMatch': {
    backgroundColor: 'rgba(51, 144, 255, 0.3)',
  },
}, { dark: true });

export function initEditor() {
  const container = document.getElementById('editor');
  if (!container) return;

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      scheduleSave();
    }
  });

  editorView = new EditorView({
    state: EditorState.create({
      doc: '',
      extensions: [
        highlightActiveLine(),
        drawSelection(),
        history(),
        markdown(),
        syntaxHighlighting(defaultHighlightStyle),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        theme,
        darkTheme,
        updateListener,
        EditorView.lineWrapping,
      ],
    }),
    parent: container,
  });
}

export function loadContent(content: string) {
  if (!editorView) return;

  editorView.dispatch({
    changes: {
      from: 0,
      to: editorView.state.doc.length,
      insert: content,
    },
  });
}

export function getContent(): string {
  if (!editorView) return '';
  return editorView.state.doc.toString();
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
