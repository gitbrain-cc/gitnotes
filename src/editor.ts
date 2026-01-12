import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view';
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
});

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
        lineNumbers(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        markdown(),
        syntaxHighlighting(defaultHighlightStyle),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        theme,
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
