# Editor Settings Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the Editor settings panel to use card-based selectors (like Git settings), add cursor style/blink settings, and replace the text size slider with preset cards.

**Architecture:** Replace flat controls with card-based UI (reusing `.team-option` pattern from Git/Brains settings). Add `cursor_style` and `cursor_blink` fields to `EditorSettings` in both Rust backend and TypeScript frontend. Wire cursor settings through the existing `editor-settings-changed` custom event into CodeMirror reconfiguration.

**Tech Stack:** Rust (Tauri backend), TypeScript, CodeMirror 6, vanilla CSS

---

### Task 1: Add cursor fields to Rust EditorSettings

**Files:**
- Modify: `src-tauri/src/lib.rs:156-185`

**Step 1: Add default functions and struct fields**

Add after line 173 (`fn default_use_tabs`):

```rust
fn default_cursor_style() -> String { "line".to_string() }
fn default_cursor_blink() -> bool { true }
```

Add to `EditorSettings` struct (after `use_tabs` field):

```rust
    #[serde(default = "default_cursor_style")]
    pub cursor_style: String,
    #[serde(default = "default_cursor_blink")]
    pub cursor_blink: bool,
```

Add to `Default` impl (after `use_tabs` line):

```rust
            cursor_style: default_cursor_style(),
            cursor_blink: default_cursor_blink(),
```

**Step 2: Verify it compiles**

Run: `cd gitnotes && cargo check --manifest-path src-tauri/Cargo.toml`
Expected: compiles with no errors (serde defaults handle existing settings.json)

---

### Task 2: Add cursor fields to TypeScript EditorSettings

**Files:**
- Modify: `src/settings.ts:37-43` (interface)
- Modify: `src/settings.ts:567-573` (default state)

**Step 1: Update TypeScript interface**

```typescript
interface EditorSettings {
  font_size: number;
  font_family: string;
  line_wrapping: boolean;
  tab_size: number;
  use_tabs: boolean;
  cursor_style: string;  // "line" | "block" | "underline"
  cursor_blink: boolean;
}
```

**Step 2: Update default editorSettings object** (line ~567)

```typescript
  let editorSettings: EditorSettings = {
    font_size: 16,
    font_family: 'system',
    line_wrapping: true,
    tab_size: 2,
    use_tabs: false,
    cursor_style: 'line',
    cursor_blink: true,
  };
```

---

### Task 3: Redesign Editor panel HTML

**Files:**
- Modify: `index.html:173-196`

**Step 1: Replace entire `#panel-editor` div**

Replace lines 173-196 with:

```html
        <div id="panel-editor" class="settings-panel">
          <p class="settings-panel-subtitle">Customize how you write</p>

          <div class="brain-detail-section" style="border-top: none; padding-top: 0;">
            <label class="settings-section-label">Text size</label>
            <div class="brain-team-options" id="text-size-options">
              <div class="team-option" data-size="13">
                <span class="team-option-title" style="font-size: 13px">Aa</span>
                <span class="team-option-tagline">Small</span>
              </div>
              <div class="team-option" data-size="15">
                <span class="team-option-title" style="font-size: 15px">Aa</span>
                <span class="team-option-tagline">Medium</span>
              </div>
              <div class="team-option" data-size="17">
                <span class="team-option-title" style="font-size: 17px">Aa</span>
                <span class="team-option-tagline">Large</span>
              </div>
              <div class="team-option" data-size="20">
                <span class="team-option-title" style="font-size: 20px">Aa</span>
                <span class="team-option-tagline">Extra Large</span>
              </div>
            </div>
          </div>

          <div class="brain-detail-section">
            <label class="settings-section-label">Tabulation</label>
            <div class="brain-team-options" id="tab-size-cards">
              <div class="team-option" data-size="2">
                <pre class="team-option-preview">if (x) {
··return y;
}</pre>
                <span class="team-option-tagline">2 spaces</span>
              </div>
              <div class="team-option" data-size="4">
                <pre class="team-option-preview">if (x) {
····return y;
}</pre>
                <span class="team-option-tagline">4 spaces</span>
              </div>
              <div class="team-option" data-size="8">
                <pre class="team-option-preview">if (x) {
········return y;
}</pre>
                <span class="team-option-tagline">8 spaces</span>
              </div>
            </div>
          </div>

          <div class="brain-detail-section">
            <label class="settings-section-label">Cursor</label>
            <div class="brain-team-options" id="cursor-style-options">
              <div class="team-option" data-cursor="line">
                <svg class="team-option-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="4" x2="12" y2="20"/></svg>
                <span class="team-option-title">Line</span>
                <span class="team-option-tagline">Thin vertical bar</span>
              </div>
              <div class="team-option" data-cursor="block">
                <svg class="team-option-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="4" width="8" height="16" rx="1" fill="currentColor" opacity="0.3"/><rect x="8" y="4" width="8" height="16" rx="1"/></svg>
                <span class="team-option-title">Block</span>
                <span class="team-option-tagline">Filled rectangle</span>
              </div>
              <div class="team-option" data-cursor="underline">
                <svg class="team-option-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="18" x2="18" y2="18" stroke-width="3"/></svg>
                <span class="team-option-title">Underline</span>
                <span class="team-option-tagline">Bottom bar</span>
              </div>
            </div>
          </div>

          <div class="brain-detail-section">
            <label class="settings-section-label">Options</label>
            <div class="editor-toggles">
              <label class="toggle-row">
                <input type="checkbox" id="line-wrapping-toggle" checked>
                <span>Wrap lines</span>
              </label>
              <label class="toggle-row">
                <input type="checkbox" id="use-tabs-toggle">
                <span>Indent with tabs</span>
              </label>
              <label class="toggle-row">
                <input type="checkbox" id="cursor-blink-toggle" checked>
                <span>Blink cursor</span>
              </label>
            </div>
          </div>
        </div>
```

---

### Task 4: Add CSS for new card elements

**Files:**
- Modify: `src/styles/main.css` (add after existing `.tab-size-btn.active` block, around line 1664)

**Step 1: Add preview styles for tab cards**

```css
/* Editor card previews */
.team-option-preview {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 0.714rem;
  line-height: 1.4;
  color: var(--text-secondary);
  margin: 0;
  text-align: left;
  white-space: pre;
}

.team-option.active .team-option-preview {
  color: var(--accent-color);
}
```

**Step 2: Remove old editor control styles that are no longer needed**

Remove `.text-size-control` and its children (lines ~1518-1548). Remove `.tab-size-options`, `.tab-size-btn` styles (lines ~1640-1664). Keep `.editor-toggles` and `.toggle-row` (still used for Options section).

---

### Task 5: Update TypeScript — rewire editor settings logic

**Files:**
- Modify: `src/settings.ts:559-654`

**Step 1: Replace the entire editor settings section** (lines 559-654)

Replace with code that:
- Queries the new card elements (`#text-size-options .team-option`, `#tab-size-cards .team-option`, `#cursor-style-options .team-option`)
- Queries the toggle elements (`#cursor-blink-toggle`)
- Removes old slider logic (`fontSizeSlider`, `fontSizeValue`)
- Uses click handlers on cards (same pattern as Git commit mode cards)
- Updates `editorSettings` and calls `applyEditorSettings` + `setEditorSettings` on each change

```typescript
  // Editor settings
  const textSizeCards = document.querySelectorAll('#text-size-options .team-option');
  const tabSizeCards = document.querySelectorAll('#tab-size-cards .team-option');
  const cursorStyleCards = document.querySelectorAll('#cursor-style-options .team-option');
  const lineWrappingToggle = document.getElementById('line-wrapping-toggle') as HTMLInputElement;
  const useTabsToggle = document.getElementById('use-tabs-toggle') as HTMLInputElement;
  const cursorBlinkToggle = document.getElementById('cursor-blink-toggle') as HTMLInputElement;

  let editorSettings: EditorSettings = {
    font_size: 16,
    font_family: 'system',
    line_wrapping: true,
    tab_size: 2,
    use_tabs: false,
    cursor_style: 'line',
    cursor_blink: true,
  };

  // Load and apply editor settings on init
  getEditorSettings().then((settings) => {
    editorSettings = settings;
    applyEditorSettings(settings);

    // Update UI to match loaded settings
    textSizeCards.forEach(card => {
      card.classList.toggle('active', card.getAttribute('data-size') === String(settings.font_size));
    });
    tabSizeCards.forEach(card => {
      card.classList.toggle('active', card.getAttribute('data-size') === String(settings.tab_size));
    });
    cursorStyleCards.forEach(card => {
      card.classList.toggle('active', card.getAttribute('data-cursor') === settings.cursor_style);
    });
    if (lineWrappingToggle) lineWrappingToggle.checked = settings.line_wrapping;
    if (useTabsToggle) useTabsToggle.checked = settings.use_tabs;
    if (cursorBlinkToggle) cursorBlinkToggle.checked = settings.cursor_blink;
  });

  // Text size cards
  textSizeCards.forEach(card => {
    card.addEventListener('click', async () => {
      const size = card.getAttribute('data-size');
      if (size) {
        textSizeCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        editorSettings.font_size = parseInt(size, 10);
        applyEditorSettings(editorSettings);
        await setEditorSettings(editorSettings);
      }
    });
  });

  // Tab size cards
  tabSizeCards.forEach(card => {
    card.addEventListener('click', async () => {
      const size = card.getAttribute('data-size');
      if (size) {
        tabSizeCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        editorSettings.tab_size = parseInt(size, 10);
        applyEditorSettings(editorSettings);
        await setEditorSettings(editorSettings);
      }
    });
  });

  // Cursor style cards
  cursorStyleCards.forEach(card => {
    card.addEventListener('click', async () => {
      const style = card.getAttribute('data-cursor');
      if (style) {
        cursorStyleCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        editorSettings.cursor_style = style;
        applyEditorSettings(editorSettings);
        await setEditorSettings(editorSettings);
      }
    });
  });

  // Line wrapping toggle
  lineWrappingToggle?.addEventListener('change', async () => {
    editorSettings.line_wrapping = lineWrappingToggle.checked;
    applyEditorSettings(editorSettings);
    await setEditorSettings(editorSettings);
  });

  // Use tabs toggle
  useTabsToggle?.addEventListener('change', async () => {
    editorSettings.use_tabs = useTabsToggle.checked;
    applyEditorSettings(editorSettings);
    await setEditorSettings(editorSettings);
  });

  // Cursor blink toggle
  cursorBlinkToggle?.addEventListener('change', async () => {
    editorSettings.cursor_blink = cursorBlinkToggle.checked;
    applyEditorSettings(editorSettings);
    await setEditorSettings(editorSettings);
  });
```

---

### Task 6: Wire cursor settings into CodeMirror

**Files:**
- Modify: `src/editor.ts:1` (imports)
- Modify: `src/editor.ts:27-29` (add compartment)
- Modify: `src/editor.ts:~233` (add to initial extensions)
- Modify: `src/editor.ts:246-272` (reconfigure function)

**Step 1: Add a cursorStyle compartment**

At line 29, after `tabSizeCompartment`:

```typescript
const cursorStyleCompartment = new Compartment();
```

**Step 2: Add drawSelection with default config to extensions**

In the extensions array (around line 233), add:

```typescript
        cursorStyleCompartment.of(drawSelection({ cursorBlinkRate: 1200 })),
```

Note: `drawSelection` is already imported on line 1.

**Step 3: Update `EditorSettingsForReconfigure` interface**

```typescript
interface EditorSettingsForReconfigure {
  line_wrapping: boolean;
  tab_size: number;
  use_tabs: boolean;
  cursor_style: string;
  cursor_blink: boolean;
}
```

**Step 4: Update `reconfigureEditor` to handle cursor settings**

Add to the effects array in `reconfigureEditor`:

```typescript
  // Cursor style via CSS class on editor
  const cursorClass = `cursor-${settings.cursor_style || 'line'}`;
  editorView.dom.className = editorView.dom.className
    .replace(/cursor-(line|block|underline)/g, '')
    .trim() + ' ' + cursorClass;

  // Cursor blink
  effects.push(
    cursorStyleCompartment.reconfigure(
      drawSelection({ cursorBlinkRate: settings.cursor_blink ? 1200 : 0 })
    )
  );
```

**Step 5: Add cursor style CSS to the `injectCursorStyles` function or main.css**

Add to `src/styles/main.css`:

```css
/* Cursor styles */
.cursor-line .cm-cursor {
  border-left-width: 2px;
}

.cursor-block .cm-cursor {
  border-left-width: 0;
  background: var(--accent-color);
  opacity: 0.5;
  width: 0.6em !important;
}

.cursor-underline .cm-cursor {
  border-left-width: 0;
  border-bottom: 2px solid var(--accent-color);
  width: 0.6em !important;
}
```

Note: The existing custom cursor glyph (`injectCursorStyles` with `::after` content) may need to be disabled or adjusted to work alongside the new cursor styles. If the glyph approach conflicts, remove it and rely on native CodeMirror `drawSelection`.

---

### Task 7: Clean up removed elements

**Files:**
- Modify: `src/settings.ts` — remove references to `fontSizeSlider`, `fontSizeValue`, `fontOptions` (font family is on Font panel, not Editor)
- Modify: `src/styles/main.css` — remove `.text-size-control` and `.tab-size-*` styles

---

### Task 8: Test and verify

**Steps:**
1. Run `cd gitnotes && npm run tauri dev`
2. Open Settings > Editor
3. Verify: Text size cards display with "Aa" preview at different sizes, clicking changes font size
4. Verify: Tab size cards display with indent preview, clicking changes tab size
5. Verify: Cursor style cards work — line, block, underline all visually change the cursor
6. Verify: Blink cursor toggle works
7. Verify: Wrap lines and indent with tabs toggles still work
8. Verify: Settings persist after closing and reopening settings
9. Verify: Existing settings.json files load correctly (serde defaults kick in for new fields)
