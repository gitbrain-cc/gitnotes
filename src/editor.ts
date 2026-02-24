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
import { buildCursorPlugin, injectCursorStyles, setCursorBlink } from './editor/cursor';
import { scheduleSave } from './main';
import { FrontMatter, parseFrontMatter, serializeFrontMatter } from './frontmatter';

export interface LabeledValue {
  label: string;
  value: string;
}

export interface ContactData {
  title?: string;
  company?: string;
  role?: string;
  emails: LabeledValue[];
  phones: LabeledValue[];
  birthday?: string;
  addresses: LabeledValue[];
  social: LabeledValue[];
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatBirthday(iso: string): string {
  const date = new Date(iso + 'T00:00:00');
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

export function renderContactCard(data: ContactData | null) {
  const card = document.getElementById('contact-card');
  if (!card) return;

  if (!data) {
    card.classList.add('hidden');
    card.innerHTML = '';
    return;
  }

  card.classList.remove('hidden');

  let html = '<div class="contact-card-inner">';

  // Name heading
  if (data.title) {
    html += `<div class="contact-name">${escapeHtml(data.title)}</div>`;
  }

  // Company + role subheading
  const companyParts: string[] = [];
  if (data.company) companyParts.push(escapeHtml(data.company));
  if (data.role) companyParts.push(escapeHtml(data.role));
  if (companyParts.length > 0) {
    html += `<div class="contact-company">${companyParts.join(' · ')}</div>`;
  }

  html += '<div class="contact-fields">';

  // Emails — mail icon
  for (const email of data.emails) {
    html += `<div class="contact-field">
      <svg class="contact-field-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
      <a class="contact-link" data-href="mailto:${escapeAttr(email.value)}">${escapeHtml(email.value)}</a>
      ${email.label ? `<span class="contact-label">(${escapeHtml(email.label)})</span>` : ''}
    </div>`;
  }

  // Phones — phone icon
  for (const phone of data.phones) {
    html += `<div class="contact-field">
      <svg class="contact-field-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      <a class="contact-link" data-href="tel:${escapeAttr(phone.value)}">${escapeHtml(phone.value)}</a>
      ${phone.label ? `<span class="contact-label">(${escapeHtml(phone.label)})</span>` : ''}
    </div>`;
  }

  // Birthday — cake icon
  if (data.birthday) {
    const formatted = formatBirthday(data.birthday);
    html += `<div class="contact-field">
      <svg class="contact-field-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/></svg>
      <span>${escapeHtml(formatted)}</span>
    </div>`;
  }

  // Addresses — map-pin icon
  for (const addr of data.addresses) {
    html += `<div class="contact-field">
      <svg class="contact-field-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      <span>${escapeHtml(addr.value)}</span>
      ${addr.label ? `<span class="contact-label">(${escapeHtml(addr.label)})</span>` : ''}
    </div>`;
  }

  // Social — link icon
  for (const social of data.social) {
    html += `<div class="contact-field">
      <svg class="contact-field-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      <a class="contact-link" data-href="${escapeAttr(social.value)}">${escapeHtml(social.value)}</a>
      ${social.label ? `<span class="contact-label">(${escapeHtml(social.label)})</span>` : ''}
    </div>`;
  }

  html += '</div></div>';
  card.innerHTML = html;

  // Attach click handlers for links via Tauri shell.open
  card.querySelectorAll('.contact-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const href = (link as HTMLElement).dataset.href;
      if (href) {
        const { open } = await import('@tauri-apps/plugin-shell');
        await open(href);
      }
    });
  });
}

let editorView: EditorView | null = null;
let currentFrontMatter: FrontMatter = {};

// Header data that will be displayed
export interface HeaderData {
  title: string;
  createdDate: string | null;
  modifiedInfo: string | null;
  whispers?: { character: string; path: string; generated: string | null }[];
  activeWhisper?: string | null;
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
        buildCursorPlugin(),
        dropCursor(),
        gapCursor(),
        savePlugin(),
      ],
    }),
    attributes: {
      spellcheck: 'false',
      autocomplete: 'off',
      autocorrect: 'off',
      autocapitalize: 'off',
    },
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

  // Cursor styling
  injectCursorStyles(settings.cursor_style || 'block');
  setCursorBlink(settings.cursor_blink ?? true);
}

export function loadContent(content: string, options?: { cursorToStart?: boolean }) {
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

  if (options?.cursorToStart && editorView) {
    const tr = editorView.state.tr.setSelection(
      TextSelection.create(editorView.state.doc, 1)
    );
    editorView.dispatch(tr);
  }
}

export function setEditable(editable: boolean) {
  if (!editorView) return;
  editorView.setProps({
    editable: () => editable,
  });
  const container = document.getElementById('editor-container');
  if (container) {
    container.classList.toggle('whisper-mode', !editable);
  }
}

export function loadWhisperContent(content: string) {
  if (!editorView) return;
  const parsed = parseFrontMatter(content);
  const doc = defaultMarkdownParser.parse(parsed.body) || schema.node('doc', null, [schema.node('paragraph')]);
  editorView.updateState(
    EditorState.create({
      doc,
      plugins: editorView.state.plugins,
    })
  );
  setEditable(false);
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

  let whisperHtml = '';
  if (data.whispers && data.whispers.length > 0) {
    const pills = data.whispers.map(w => {
      const isActive = data.activeWhisper === w.character;
      const label = w.character.charAt(0).toUpperCase() + w.character.slice(1);
      return `<button class="whisper-pill${isActive ? ' active' : ''}" data-character="${w.character}" data-path="${w.path}">${label}</button>`;
    });
    const noteActive = !data.activeWhisper;
    whisperHtml = `
      <div class="whisper-toggle">
        <button class="whisper-pill${noteActive ? ' active' : ''}" data-character="">Note</button>
        ${pills.join('')}
      </div>`;
  }

  header.innerHTML = `
    <h1>${data.title}</h1>
    <div class="meta-row">
      <div class="meta">${parts.join(' · ')}</div>
      ${whisperHtml}
    </div>
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
