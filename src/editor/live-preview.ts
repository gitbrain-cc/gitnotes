import {
  EditorView,
  ViewPlugin,
  ViewUpdate,
  Decoration,
  DecorationSet,
} from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';

// Markers to hide completely (bold/italic/code syntax and header marks)
const HIDDEN_MARKERS = new Set(['EmphasisMark', 'CodeMark', 'HeaderMark']);

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const cursorLine = view.state.doc.lineAt(view.state.selection.main.head).number;

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        const line = view.state.doc.lineAt(node.from).number;
        if (line === cursorLine) return;

        if (HIDDEN_MARKERS.has(node.name)) {
          // For header marks, also hide the trailing space
          if (node.name === 'HeaderMark') {
            const nextChar = view.state.doc.sliceString(node.to, node.to + 1);
            const hideEnd = nextChar === ' ' ? node.to + 1 : node.to;
            builder.add(node.from, hideEnd, Decoration.replace({}));
          } else {
            builder.add(node.from, node.to, Decoration.replace({}));
          }
        }
      },
    });
  }

  return builder.finish();
}

export const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);
