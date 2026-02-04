import { Plugin, PluginKey, EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';

const cursorPluginKey = new PluginKey('customCursor');

// Glyph definitions with positioning adjustments
const CURSOR_GLYPHS: Record<string, { glyph: string; fontSize: string; bottom: string; left: string; extra?: string }> = {
  line: { glyph: '|', fontSize: '1em', bottom: '-0.1em', left: '-0.2em', extra: 'font-weight: 900;' },
  block: { glyph: '⌐', fontSize: '1.2em', bottom: '-0.9em', left: '-0.15em' },
  underline: { glyph: '¬', fontSize: '1.2em', bottom: '-0.9em', left: '-0.15em' },
  caret: { glyph: '^', fontSize: '0.9em', bottom: '-1.25em', left: '-0.35em' },
  underscore: { glyph: '_', fontSize: '1em', bottom: '-0.45em', left: '0' },
  dot: { glyph: '°', fontSize: '1em', bottom: '-1.1em', left: '-0.1em' },
};

let currentStyle = 'block';
let currentBlink = true;
let styleElement: HTMLStyleElement | null = null;

function injectStyles() {
  const config = CURSOR_GLYPHS[currentStyle] || CURSOR_GLYPHS.block;
  const blinkAnimation = currentBlink ? 'animation: cursor-blink 1s step-end infinite;' : '';

  const css = `
    #editor .ProseMirror {
      caret-color: transparent;
    }

    .pm-cursor {
      position: relative;
      pointer-events: none;
    }

    .pm-cursor::after {
      content: '${config.glyph}';
      position: absolute;
      bottom: ${config.bottom};
      left: ${config.left};
      font-size: ${config.fontSize};
      color: var(--accent-color);
      pointer-events: none;
      ${config.extra || ''}
      ${blinkAnimation}
    }

    @keyframes cursor-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
  `;

  if (styleElement) {
    styleElement.textContent = css;
  } else {
    styleElement = document.createElement('style');
    styleElement.textContent = css;
    document.head.appendChild(styleElement);
  }
}

function createCursorDecoration(state: EditorState): DecorationSet {
  if (!state.selection.empty) {
    return DecorationSet.empty;
  }

  const widget = Decoration.widget(state.selection.head, () => {
    const span = document.createElement('span');
    span.className = 'pm-cursor';
    return span;
  }, { side: 0 });

  return DecorationSet.create(state.doc, [widget]);
}

export function buildCursorPlugin(): Plugin {
  return new Plugin({
    key: cursorPluginKey,

    props: {
      decorations(state) {
        return createCursorDecoration(state);
      },
    },

    view(editorView: EditorView) {
      // Inject initial styles
      injectStyles();

      // Handle focus/blur for cursor visibility
      const handleFocus = () => {
        editorView.dom.classList.add('focused');
      };
      const handleBlur = () => {
        editorView.dom.classList.remove('focused');
      };

      editorView.dom.addEventListener('focus', handleFocus);
      editorView.dom.addEventListener('blur', handleBlur);

      // Set initial focus state
      if (document.activeElement === editorView.dom) {
        editorView.dom.classList.add('focused');
      }

      return {
        destroy() {
          editorView.dom.removeEventListener('focus', handleFocus);
          editorView.dom.removeEventListener('blur', handleBlur);
        },
      };
    },
  });
}

export function injectCursorStyles(style: string = 'block') {
  currentStyle = style;
  injectStyles();
}

export function setCursorBlink(blink: boolean) {
  currentBlink = blink;
  injectStyles();
}

// Export for settings UI
export { CURSOR_GLYPHS };
