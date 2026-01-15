import {
  EditorView,
  ViewPlugin,
  ViewUpdate,
  Decoration,
  DecorationSet,
  WidgetType,
} from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';

// Markers to hide completely (bold/italic/code syntax)
const HIDDEN_MARKERS = new Set(['EmphasisMark', 'CodeMark']);

// Widget that preserves space for hidden header marks
class HeaderSpacer extends WidgetType {
  constructor(readonly width: number) {
    super();
  }
  toDOM() {
    const span = document.createElement('span');
    span.style.width = `${this.width}ch`;
    span.style.display = 'inline-block';
    return span;
  }
}

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
          builder.add(node.from, node.to, Decoration.replace({}));
        } else if (node.name === 'HeaderMark') {
          const len = node.to - node.from;
          builder.add(
            node.from,
            node.to,
            Decoration.replace({ widget: new HeaderSpacer(len) })
          );
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
