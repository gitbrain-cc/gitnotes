# Editor Settings Design

## Overview

Add editor settings panel with app-wide text scaling and editor-specific preferences.

## Settings

| Setting | Type | Default | Range/Options |
|---------|------|---------|---------------|
| Text size | number | 14 | 10-20px |
| Font family | enum | system | system, mono, serif |
| Line numbers | bool | false | - |
| Line wrapping | bool | true | - |
| Tab size | number | 2 | 2, 4, 8 |
| Use tabs | bool | false | - |

## Text Scaling Architecture

### Current State
- 70+ hardcoded `px` font-sizes across `main.css`
- Editor has separate hardcoded `13px` in `editor.ts`
- No system text size support

### Target State
- All font-sizes use `rem` units
- Base font-size set via CSS variable on `html`
- Single setting scales entire app proportionally

### Conversion Table (14px base)

| px | rem |
|----|-----|
| 10 | 0.714rem |
| 11 | 0.786rem |
| 12 | 0.857rem |
| 13 | 0.929rem |
| 14 | 1rem |
| 16 | 1.143rem |
| 18 | 1.286rem |
| 24 | 1.714rem |
| 28 | 2rem |

## Implementation

### 1. CSS Changes (`main.css`)

Add root variable:
```css
html {
  font-size: var(--base-font-size, 14px);
}
```

Convert all `font-size: Npx` to `font-size: Xrem` using conversion table.

### 2. Editor Changes (`editor.ts`)

Update CodeMirror theme to use rem:
```typescript
const theme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '0.929rem', // was 13px
  },
  // ... other sizes converted
});
```

### 3. Rust Backend (`lib.rs`)

Add to settings struct:
```rust
#[derive(Serialize, Deserialize, Clone)]
pub struct EditorSettings {
    pub font_size: u8,        // 10-20, default 14
    pub font_family: String,  // "system", "mono", "serif"
    pub line_numbers: bool,   // default false
    pub line_wrapping: bool,  // default true
    pub tab_size: u8,         // 2, 4, 8, default 2
    pub use_tabs: bool,       // default false
}
```

Add IPC commands:
- `get_editor_settings() -> EditorSettings`
- `set_editor_settings(EditorSettings)`

### 4. Settings UI (`index.html`, `settings.ts`)

New "Editor" tab in settings modal with:
- Text size: slider + number display (10-20)
- Font family: radio buttons (System, Monospace, Serif)
- Line numbers: toggle switch
- Line wrapping: toggle switch
- Tab size: segmented control (2 / 4 / 8)
- Use tabs: toggle switch (label: "Indent with tabs")

### 5. Apply Settings (`settings.ts`)

On app load and setting change:
```typescript
function applyEditorSettings(settings: EditorSettings) {
  // Text size
  document.documentElement.style.setProperty(
    '--base-font-size',
    `${settings.font_size}px`
  );

  // Font family
  const fontStack = {
    system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'ui-monospace, "SF Mono", Menlo, Monaco, monospace',
    serif: 'Georgia, "Times New Roman", serif',
  };
  document.documentElement.style.setProperty(
    '--font-family',
    fontStack[settings.font_family]
  );

  // Editor-specific settings applied via reconfiguring CodeMirror
  reconfigureEditor(settings);
}
```

### 6. Editor Reconfiguration

CodeMirror 6 supports runtime reconfiguration. Create compartments for:
- Line numbers extension
- Line wrapping extension
- Tab size/indentation

## UI Mockup

```
┌─ Editor ─────────────────────────────────┐
│                                          │
│  Text size                               │
│  ──●────────────────────── 14px          │
│                                          │
│  Font                                    │
│  ● System  ○ Monospace  ○ Serif          │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │ ☐ Show line numbers              │    │
│  │ ☑ Wrap lines                     │    │
│  │ ☐ Indent with tabs               │    │
│  └──────────────────────────────────┘    │
│                                          │
│  Tab size                                │
│  [ 2 ] [ 4 ] [ 8 ]                       │
│        ▲                                 │
└──────────────────────────────────────────┘
```

## File Changes Summary

| File | Changes |
|------|---------|
| `src/styles/main.css` | Convert ~70 px values to rem, add CSS variables |
| `src/editor.ts` | Convert px to rem, add compartments for runtime config |
| `src/settings.ts` | Add editor settings UI logic, apply function |
| `src-tauri/src/lib.rs` | Add EditorSettings struct, IPC commands |
| `index.html` | Add Editor tab + panel HTML |
