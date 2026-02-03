let cursorStyleElement: HTMLStyleElement | null = null;

const CURSOR_GLYPHS: Record<string, { glyph: string; fontSize: string; bottom: string; left: string; extra?: string }> = {
  line: { glyph: '|', fontSize: '1em', bottom: '0.75em', left: '-0.3em', extra: 'font-weight: 900; -webkit-text-stroke: 0.5px var(--accent-color);' },
  block: { glyph: '⌐', fontSize: '1.2em', bottom: '0', left: '0' },
  underline: { glyph: '¬', fontSize: '1.2em', bottom: '0', left: '-0.15em' },
  caret: { glyph: '^', fontSize: '0.9em', bottom: '-0.3em', left: '-0.5em' },
  underscore: { glyph: '_', fontSize: '1em', bottom: '0.55em', left: '0' },
  dot: { glyph: '°', fontSize: '1em', bottom: '-0.25em', left: '-0.1em' },
};

export function injectCursorStyles(_style: string = 'block') {
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

export function setCursorBlink(_blink: boolean) {
  // Native caret blink is controlled by the OS
  // ProseMirror doesn't provide blink rate control
  // This is a no-op for now — acceptable tradeoff for migration
}

// Export CURSOR_GLYPHS for settings UI (cursor style selection cards)
export { CURSOR_GLYPHS };
