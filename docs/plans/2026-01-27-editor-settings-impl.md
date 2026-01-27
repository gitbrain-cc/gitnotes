# Editor Settings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add editor settings with app-wide text scaling using rem units.

**Architecture:** Convert all px font-sizes to rem, store editor preferences in settings.json, apply via CSS variables and CodeMirror reconfiguration.

**Tech Stack:** Rust/Tauri backend, TypeScript frontend, CodeMirror 6, CSS custom properties.

---

## Task 1: Add EditorSettings to Rust Backend

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add EditorSettings struct after AppearanceSettings (around line 149)**

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EditorSettings {
    #[serde(default = "default_font_size")]
    pub font_size: u8,
    #[serde(default = "default_font_family")]
    pub font_family: String,
    #[serde(default = "default_line_numbers")]
    pub line_numbers: bool,
    #[serde(default = "default_line_wrapping")]
    pub line_wrapping: bool,
    #[serde(default = "default_tab_size")]
    pub tab_size: u8,
    #[serde(default = "default_use_tabs")]
    pub use_tabs: bool,
}

fn default_font_size() -> u8 { 14 }
fn default_font_family() -> String { "system".to_string() }
fn default_line_numbers() -> bool { false }
fn default_line_wrapping() -> bool { true }
fn default_tab_size() -> u8 { 2 }
fn default_use_tabs() -> bool { false }

impl Default for EditorSettings {
    fn default() -> Self {
        EditorSettings {
            font_size: default_font_size(),
            font_family: default_font_family(),
            line_numbers: default_line_numbers(),
            line_wrapping: default_line_wrapping(),
            tab_size: default_tab_size(),
            use_tabs: default_use_tabs(),
        }
    }
}
```

**Step 2: Add editor field to Settings struct**

Find the `Settings` struct and add the editor field:

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub vaults: Vec<Vault>,
    #[serde(default)]
    pub active_vault: Option<String>,
    #[serde(default)]
    pub git: GitSettings,
    #[serde(default)]
    pub appearance: AppearanceSettings,
    #[serde(default)]
    pub editor: EditorSettings,
}
```

**Step 3: Update the default Settings in load_settings()**

Find `load_settings()` and update the default return:

```rust
Settings {
    vaults: vec![],
    active_vault: None,
    git: GitSettings::default(),
    appearance: AppearanceSettings::default(),
    editor: EditorSettings::default(),
}
```

**Step 4: Add IPC commands for editor settings**

Find the existing theme commands (get_theme, set_theme) and add nearby:

```rust
#[tauri::command]
fn get_editor_settings() -> EditorSettings {
    load_settings().editor
}

#[tauri::command]
fn set_editor_settings(settings: EditorSettings) -> Result<(), String> {
    let mut current = load_settings();
    current.editor = settings;
    save_settings(&current)
}
```

**Step 5: Register the new commands in the invoke_handler**

Find `.invoke_handler(tauri::generate_handler![...])` and add:
- `get_editor_settings`
- `set_editor_settings`

**Step 6: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: No errors

**Step 7: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: add EditorSettings to Rust backend"
```

---

## Task 2: Add CSS Variables and Convert Font Sizes to Rem

**Files:**
- Modify: `src/styles/main.css`

**Step 1: Add base font-size and font-family variables to :root**

At the top of `:root` (after line 8), add:

```css
:root {
  /* Text scaling - base for rem calculations */
  --base-font-size: 14px;
  --font-family-base: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* existing variables... */
```

**Step 2: Update html, body rule to use variables**

Change the `html, body` rule (around line 88):

```css
html {
  font-size: var(--base-font-size, 14px);
}

html, body {
  height: 100%;
  font-family: var(--font-family-base);
  background: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
}
```

**Step 3: Convert all font-size px values to rem**

Use these conversions (base 14px):
- 10px → 0.714rem
- 11px → 0.786rem
- 12px → 0.857rem
- 13px → 0.929rem
- 14px → 1rem
- 16px → 1.143rem
- 18px → 1.286rem
- 24px → 1.714rem
- 28px → 2rem

Search and replace each occurrence. Key areas:
- Sidebar items: 13px → 0.929rem
- Status bar: 11px → 0.786rem
- Modals: various sizes
- Git view: various sizes

**Step 4: Verify the app still looks correct**

Run: `npm run tauri dev`
Expected: App looks identical (14px base = same as before)

**Step 5: Commit**

```bash
git add src/styles/main.css
git commit -m "refactor: convert font-sizes from px to rem for text scaling"
```

---

## Task 3: Update Editor Theme to Use Rem

**Files:**
- Modify: `src/editor.ts`

**Step 1: Convert CodeMirror theme font-size to rem**

Find the `theme` constant and update:

```typescript
const theme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '0.929rem', // was 13px
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-family-base)',
    lineHeight: '1.7',
    letterSpacing: '0.01em',
  },
  // rest unchanged...
});
```

**Step 2: Commit**

```bash
git add src/editor.ts
git commit -m "refactor: use rem and CSS variable for editor font"
```

---

## Task 4: Add Editor Tab to Settings HTML

**Files:**
- Modify: `index.html`

**Step 1: Add Editor tab button in settings nav**

Find the settings nav (around line 130) and add Editor tab between Git and Appearance:

```html
<nav class="settings-nav">
  <button class="settings-tab active" data-tab="repositories">Repositories</button>
  <button class="settings-tab" data-tab="git">Git</button>
  <button class="settings-tab" data-tab="editor">Editor</button>
  <button class="settings-tab" data-tab="appearance">Appearance</button>
</nav>
```

**Step 2: Add Editor panel after Git panel**

After `panel-git` div (around line 187), add:

```html
<div id="panel-editor" class="settings-panel">
  <label class="settings-label">Text size</label>
  <div class="text-size-control">
    <input type="range" id="font-size-slider" min="10" max="20" value="14">
    <span id="font-size-value">14px</span>
  </div>

  <label class="settings-label">Font</label>
  <div id="font-family-options" class="font-options">
    <div class="font-option active" data-font="system">
      <div class="font-radio"></div>
      <div class="font-info">
        <div class="font-name">System</div>
        <div class="font-preview" style="font-family: -apple-system, BlinkMacSystemFont, sans-serif">The quick brown fox</div>
      </div>
    </div>
    <div class="font-option" data-font="mono">
      <div class="font-radio"></div>
      <div class="font-info">
        <div class="font-name">Monospace</div>
        <div class="font-preview" style="font-family: ui-monospace, 'SF Mono', Menlo, monospace">The quick brown fox</div>
      </div>
    </div>
    <div class="font-option" data-font="serif">
      <div class="font-radio"></div>
      <div class="font-info">
        <div class="font-name">Serif</div>
        <div class="font-preview" style="font-family: Georgia, 'Times New Roman', serif">The quick brown fox</div>
      </div>
    </div>
  </div>

  <div class="editor-toggles">
    <label class="toggle-row">
      <input type="checkbox" id="line-numbers-toggle">
      <span>Show line numbers</span>
    </label>
    <label class="toggle-row">
      <input type="checkbox" id="line-wrapping-toggle" checked>
      <span>Wrap lines</span>
    </label>
    <label class="toggle-row">
      <input type="checkbox" id="use-tabs-toggle">
      <span>Indent with tabs</span>
    </label>
  </div>

  <label class="settings-label">Tab size</label>
  <div id="tab-size-options" class="tab-size-options">
    <button class="tab-size-btn active" data-size="2">2</button>
    <button class="tab-size-btn" data-size="4">4</button>
    <button class="tab-size-btn" data-size="8">8</button>
  </div>
</div>
```

**Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add Editor settings panel HTML"
```

---

## Task 5: Add Editor Settings Styles

**Files:**
- Modify: `src/styles/main.css`

**Step 1: Add styles for editor settings panel**

Add at the end of the settings styles section:

```css
/* Editor settings */
.text-size-control {
  display: flex;
  align-items: center;
  gap: 0.857rem;
  margin-bottom: 1.143rem;
}

.text-size-control input[type="range"] {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  background: var(--bg-tertiary);
  border-radius: 2px;
  outline: none;
}

.text-size-control input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 1rem;
  height: 1rem;
  background: var(--accent-color);
  border-radius: 50%;
  cursor: pointer;
}

#font-size-value {
  min-width: 3rem;
  text-align: right;
  color: var(--text-secondary);
  font-size: 0.857rem;
}

.font-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.143rem;
}

.font-option {
  display: flex;
  align-items: center;
  gap: 0.714rem;
  padding: 0.571rem 0.714rem;
  background: var(--bg-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.font-option:hover {
  background: var(--bg-tertiary);
}

.font-option.active {
  background: var(--bg-tertiary);
}

.font-option .font-radio {
  width: 1rem;
  height: 1rem;
  border: 2px solid var(--text-secondary);
  border-radius: 50%;
  position: relative;
}

.font-option.active .font-radio {
  border-color: var(--accent-color);
}

.font-option.active .font-radio::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 0.5rem;
  height: 0.5rem;
  background: var(--accent-color);
  border-radius: 50%;
}

.font-info {
  flex: 1;
}

.font-name {
  font-size: 0.929rem;
  margin-bottom: 0.214rem;
}

.font-preview {
  font-size: 0.857rem;
  color: var(--text-secondary);
}

.editor-toggles {
  display: flex;
  flex-direction: column;
  gap: 0.714rem;
  margin-bottom: 1.143rem;
  padding: 0.857rem;
  background: var(--bg-secondary);
  border-radius: 6px;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 0.714rem;
  cursor: pointer;
  font-size: 0.929rem;
}

.toggle-row input[type="checkbox"] {
  width: 1rem;
  height: 1rem;
  accent-color: var(--accent-color);
}

.tab-size-options {
  display: flex;
  gap: 0.5rem;
}

.tab-size-btn {
  padding: 0.429rem 0.857rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 0.857rem;
  cursor: pointer;
  transition: all 0.15s;
}

.tab-size-btn:hover {
  background: var(--bg-tertiary);
}

.tab-size-btn.active {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: #fff;
}
```

**Step 2: Commit**

```bash
git add src/styles/main.css
git commit -m "feat: add Editor settings panel styles"
```

---

## Task 6: Add Editor Settings TypeScript Logic

**Files:**
- Modify: `src/settings.ts`

**Step 1: Add EditorSettings interface after GitSettings**

```typescript
interface EditorSettings {
  font_size: number;
  font_family: string;
  line_numbers: boolean;
  line_wrapping: boolean;
  tab_size: number;
  use_tabs: boolean;
}
```

**Step 2: Add editor field to Settings interface**

```typescript
interface Settings {
  vaults: Vault[];
  active_vault: string | null;
  git: GitSettings;
  editor: EditorSettings;
}
```

**Step 3: Add IPC functions for editor settings**

```typescript
export async function getEditorSettings(): Promise<EditorSettings> {
  return await invoke('get_editor_settings');
}

export async function setEditorSettings(settings: EditorSettings): Promise<void> {
  return await invoke('set_editor_settings', { settings });
}
```

**Step 4: Add applyEditorSettings function**

```typescript
const FONT_STACKS: Record<string, string> = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Monaco, monospace',
  serif: 'Georgia, "Times New Roman", serif',
};

export function applyEditorSettings(settings: EditorSettings): void {
  // Apply text size
  document.documentElement.style.setProperty(
    '--base-font-size',
    `${settings.font_size}px`
  );

  // Apply font family
  document.documentElement.style.setProperty(
    '--font-family-base',
    FONT_STACKS[settings.font_family] || FONT_STACKS.system
  );

  // Editor-specific settings will be handled by editor.ts reconfigure
  window.dispatchEvent(new CustomEvent('editor-settings-changed', { detail: settings }));
}
```

**Step 5: Add editor settings UI handlers in initSettings()**

Inside `initSettings()`, after theme handling, add:

```typescript
// Editor settings
const fontSizeSlider = document.getElementById('font-size-slider') as HTMLInputElement;
const fontSizeValue = document.getElementById('font-size-value');
const fontOptions = document.querySelectorAll('.font-option');
const lineNumbersToggle = document.getElementById('line-numbers-toggle') as HTMLInputElement;
const lineWrappingToggle = document.getElementById('line-wrapping-toggle') as HTMLInputElement;
const useTabsToggle = document.getElementById('use-tabs-toggle') as HTMLInputElement;
const tabSizeBtns = document.querySelectorAll('.tab-size-btn');

let editorSettings: EditorSettings | null = null;

// Load and apply editor settings on init
getEditorSettings().then(settings => {
  editorSettings = settings;
  applyEditorSettings(settings);

  // Update UI to reflect current settings
  if (fontSizeSlider) fontSizeSlider.value = String(settings.font_size);
  if (fontSizeValue) fontSizeValue.textContent = `${settings.font_size}px`;

  fontOptions.forEach(opt => {
    opt.classList.toggle('active', opt.getAttribute('data-font') === settings.font_family);
  });

  if (lineNumbersToggle) lineNumbersToggle.checked = settings.line_numbers;
  if (lineWrappingToggle) lineWrappingToggle.checked = settings.line_wrapping;
  if (useTabsToggle) useTabsToggle.checked = settings.use_tabs;

  tabSizeBtns.forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-size') === String(settings.tab_size));
  });
});

// Font size slider
fontSizeSlider?.addEventListener('input', async () => {
  const size = parseInt(fontSizeSlider.value, 10);
  if (fontSizeValue) fontSizeValue.textContent = `${size}px`;
  if (editorSettings) {
    editorSettings.font_size = size;
    applyEditorSettings(editorSettings);
    await setEditorSettings(editorSettings);
  }
});

// Font family
fontOptions.forEach(opt => {
  opt.addEventListener('click', async () => {
    const font = opt.getAttribute('data-font');
    if (font && editorSettings) {
      fontOptions.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      editorSettings.font_family = font;
      applyEditorSettings(editorSettings);
      await setEditorSettings(editorSettings);
    }
  });
});

// Line numbers toggle
lineNumbersToggle?.addEventListener('change', async () => {
  if (editorSettings) {
    editorSettings.line_numbers = lineNumbersToggle.checked;
    applyEditorSettings(editorSettings);
    await setEditorSettings(editorSettings);
  }
});

// Line wrapping toggle
lineWrappingToggle?.addEventListener('change', async () => {
  if (editorSettings) {
    editorSettings.line_wrapping = lineWrappingToggle.checked;
    applyEditorSettings(editorSettings);
    await setEditorSettings(editorSettings);
  }
});

// Use tabs toggle
useTabsToggle?.addEventListener('change', async () => {
  if (editorSettings) {
    editorSettings.use_tabs = useTabsToggle.checked;
    applyEditorSettings(editorSettings);
    await setEditorSettings(editorSettings);
  }
});

// Tab size buttons
tabSizeBtns.forEach(btn => {
  btn.addEventListener('click', async () => {
    const size = parseInt(btn.getAttribute('data-size') || '2', 10);
    if (editorSettings) {
      tabSizeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      editorSettings.tab_size = size;
      applyEditorSettings(editorSettings);
      await setEditorSettings(editorSettings);
    }
  });
});
```

**Step 6: Commit**

```bash
git add src/settings.ts
git commit -m "feat: add Editor settings UI logic and apply function"
```

---

## Task 7: Add CodeMirror Runtime Reconfiguration

**Files:**
- Modify: `src/editor.ts`

**Step 1: Add imports for compartments and extensions**

Update imports at the top:

```typescript
import { EditorView, keymap, ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType, lineNumbers as lineNumbersExt } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { indentUnit } from '@codemirror/language';
```

**Step 2: Add compartments for dynamic settings**

After the imports, add:

```typescript
// Compartments for runtime reconfiguration
const lineNumbersCompartment = new Compartment();
const lineWrappingCompartment = new Compartment();
const tabSizeCompartment = new Compartment();
```

**Step 3: Update initEditor to use compartments**

Replace the extensions array in `EditorState.create`:

```typescript
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
      lineNumbersCompartment.of([]),
      lineWrappingCompartment.of(EditorView.lineWrapping),
      tabSizeCompartment.of([indentUnit.of('  '), EditorState.tabSize.of(2)]),
    ],
  }),
  parent: container,
});
```

**Step 4: Add reconfigureEditor function**

After initEditor, add:

```typescript
interface EditorSettingsForReconfigure {
  line_numbers: boolean;
  line_wrapping: boolean;
  tab_size: number;
  use_tabs: boolean;
}

export function reconfigureEditor(settings: EditorSettingsForReconfigure): void {
  if (!editorView) return;

  const effects = [];

  // Line numbers
  effects.push(
    lineNumbersCompartment.reconfigure(
      settings.line_numbers ? lineNumbersExt() : []
    )
  );

  // Line wrapping
  effects.push(
    lineWrappingCompartment.reconfigure(
      settings.line_wrapping ? EditorView.lineWrapping : []
    )
  );

  // Tab size and indent unit
  const indent = settings.use_tabs ? '\t' : ' '.repeat(settings.tab_size);
  effects.push(
    tabSizeCompartment.reconfigure([
      indentUnit.of(indent),
      EditorState.tabSize.of(settings.tab_size),
    ])
  );

  editorView.dispatch({ effects });
}
```

**Step 5: Listen for editor settings changes**

At the end of initEditor, add:

```typescript
// Listen for settings changes
window.addEventListener('editor-settings-changed', ((e: CustomEvent) => {
  reconfigureEditor(e.detail);
}) as EventListener);
```

**Step 6: Commit**

```bash
git add src/editor.ts
git commit -m "feat: add CodeMirror runtime reconfiguration for editor settings"
```

---

## Task 8: Apply Editor Settings on App Load

**Files:**
- Modify: `src/main.ts`

**Step 1: Import and apply editor settings in init**

Find where settings are applied (likely near theme application) and ensure editor settings are loaded:

```typescript
import { getEditorSettings, applyEditorSettings } from './settings';

// In the init function, after theme is applied:
const editorSettings = await getEditorSettings();
applyEditorSettings(editorSettings);
```

**Step 2: Commit**

```bash
git add src/main.ts
git commit -m "feat: apply editor settings on app startup"
```

---

## Task 9: Test All Editor Settings

**Step 1: Start dev server**

Run: `npm run tauri dev`

**Step 2: Test text scaling**

1. Open Settings → Editor tab
2. Move text size slider from 10 to 20
3. Verify ALL text in app scales (sidebar, status bar, modals, editor)

**Step 3: Test font family**

1. Select Monospace - verify editor and app use monospace
2. Select Serif - verify serif font applied
3. Select System - verify back to system font

**Step 4: Test line numbers**

1. Toggle "Show line numbers" on
2. Verify line numbers appear in editor
3. Toggle off, verify they disappear

**Step 5: Test line wrapping**

1. Add a very long line of text
2. Toggle "Wrap lines" off - verify horizontal scroll appears
3. Toggle on - verify text wraps

**Step 6: Test tab size**

1. Press Tab in editor with size 2 - verify 2 spaces
2. Change to 4, press Tab - verify 4 spaces
3. Toggle "Indent with tabs" - verify actual tab character

**Step 7: Test persistence**

1. Set various preferences
2. Quit and relaunch app
3. Verify all settings persisted

**Step 8: Commit if any fixes were needed**

---

## Task 10: Update Todo Documentation

**Files:**
- Modify: `docs/todo/settings.md`

**Step 1: Mark editor settings as done**

```markdown
## Editor

- [x] Font size adjustment
- [x] Font family selection
- [x] Line numbers toggle
- [x] Line wrapping preference
- [x] Tab size / spaces vs tabs
```

**Step 2: Commit**

```bash
git add docs/todo/settings.md
git commit -m "docs: mark editor settings as complete"
```
