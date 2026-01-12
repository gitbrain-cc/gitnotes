import { EditorView, keymap, highlightActiveLine, drawSelection, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { EditorState, StateField, StateEffect, RangeSetBuilder } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { scheduleSave } from './main';
import { getFrontMatterRange } from './frontmatter';

let editorView: EditorView | null = null;

// Header data that will be displayed
export interface HeaderData {
  title: string;
  createdDate: string | null;
  modifiedInfo: string | null;
}

// Effect to update header data
const setHeaderData = StateEffect.define<HeaderData>();

// Widget that renders the note header
class NoteHeaderWidget extends WidgetType {
  constructor(readonly data: HeaderData) {
    super();
  }

  toDOM() {
    const wrapper = document.createElement('div');
    wrapper.className = 'note-header';

    const title = document.createElement('h1');
    title.className = 'note-header-title';
    title.textContent = this.data.title;
    wrapper.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'note-header-meta';

    const parts: string[] = [];
    if (this.data.createdDate) {
      parts.push(`Created ${this.data.createdDate}`);
    }
    if (this.data.modifiedInfo) {
      parts.push(this.data.modifiedInfo);
    }

    meta.textContent = parts.join(' · ');
    wrapper.appendChild(meta);

    return wrapper;
  }

  eq(other: NoteHeaderWidget) {
    return (
      this.data.title === other.data.title &&
      this.data.createdDate === other.data.createdDate &&
      this.data.modifiedInfo === other.data.modifiedInfo
    );
  }

  ignoreEvent() {
    return true;
  }
}

// StateField to manage decorations
const headerField = StateField.define<{ decorations: DecorationSet; data: HeaderData }>({
  create() {
    return {
      decorations: Decoration.none,
      data: { title: '', createdDate: null, modifiedInfo: null },
    };
  },

  update(value, tr) {
    let data = value.data;

    // Check for header data updates
    for (const effect of tr.effects) {
      if (effect.is(setHeaderData)) {
        data = effect.value;
      }
    }

    // Rebuild decorations if document changed or header data changed
    if (tr.docChanged || data !== value.data) {
      const builder = new RangeSetBuilder<Decoration>();
      const doc = tr.state.doc.toString();
      const fmRange = getFrontMatterRange(doc);

      // Add header widget at position 0
      if (data.title) {
        builder.add(0, 0, Decoration.widget({
          widget: new NoteHeaderWidget(data),
          side: -1,
          block: true,
        }));
      }

      // Hide front matter if present
      if (fmRange) {
        builder.add(fmRange.start, fmRange.end, Decoration.replace({}));
      }

      return { decorations: builder.finish(), data };
    }

    return { decorations: value.decorations, data };
  },

  provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
});

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
  // Note header styling
  '.note-header': {
    padding: '0 4px 24px 4px',
    borderBottom: '1px solid var(--border-color)',
    marginBottom: '16px',
  },
  '.note-header-title': {
    fontSize: '28px',
    fontWeight: '600',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    margin: '0 0 4px 0',
    color: 'var(--text-primary)',
  },
  '.note-header-meta': {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
        headerField,
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

export function updateHeaderData(data: HeaderData) {
  if (!editorView) return;
  editorView.dispatch({
    effects: setHeaderData.of(data),
  });
}
