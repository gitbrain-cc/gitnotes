# Themes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add theme selection with 6 options: Original, Yellow-pad, Classic-light, Classic-dark, True-dark, System.

**Architecture:** Theme applied via `data-theme` attribute on `<html>`. CSS variables define colors per theme. "System" mode has no attribute (uses `prefers-color-scheme`). Theme stored in settings.json and applied on load.

**Tech Stack:** CSS variables, Tauri IPC, TypeScript

---

### Task 1: Add AppearanceSettings to Rust backend

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add AppearanceSettings struct after GitSettings**

After line ~123 (after `impl Default for GitSettings`), add:

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppearanceSettings {
    #[serde(default = "default_theme")]
    pub theme: String,
}

fn default_theme() -> String {
    "system".to_string()
}

impl Default for AppearanceSettings {
    fn default() -> Self {
        AppearanceSettings {
            theme: default_theme(),
        }
    }
}
```

**Step 2: Add appearance field to Settings struct**

Change Settings struct to include appearance:

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
}
```

**Step 3: Add Tauri commands for theme**

Near the other settings commands (around line 1630), add:

```rust
#[tauri::command]
fn get_theme() -> String {
    let settings = load_settings();
    settings.appearance.theme
}

#[tauri::command]
fn set_theme(theme: String) -> Result<(), String> {
    let mut settings = load_settings();
    settings.appearance.theme = theme;
    save_settings(&settings)
}
```

**Step 4: Register commands in builder**

Add to the `.invoke_handler(tauri::generate_handler![...])` list:
- `get_theme`
- `set_theme`

**Step 5: Verify build**

Run: `cd src-tauri && cargo check`
Expected: Compiles without errors

---

### Task 2: Define theme CSS variables

**Files:**
- Modify: `src/styles/main.css`

**Step 1: Restructure root variables**

Replace the current `:root` and `@media (prefers-color-scheme: dark)` block (lines 7-29) with:

```css
/* Base light theme (used by System mode in light OS) */
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --bg-tertiary: #e8e8e8;
  --text-primary: #333333;
  --text-secondary: #666666;
  --border-color: #dddddd;
  --accent-color: #0066cc;
  --sidebar-width-sections: 150px;
  --sidebar-width-pages: 200px;
}

/* System mode dark (when OS is dark and no data-theme set) */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    --bg-primary: #1a1a1a;
    --bg-secondary: #242424;
    --bg-tertiary: #2e2e2e;
    --text-primary: #e0e0e0;
    --text-secondary: #888888;
    --border-color: #333333;
    --accent-color: #4a9eff;
  }
}

/* Original - warm dark (current theme) */
[data-theme="original"] {
  --bg-primary: #1f1a14;
  --bg-secondary: #2a231a;
  --bg-tertiary: #362d21;
  --text-primary: #e8dfd4;
  --text-secondary: #9a8b78;
  --border-color: #362d21;
  --accent-color: #e8a849;
}

/* Yellow-pad - warm light, legal pad aesthetic */
[data-theme="yellow-pad"] {
  --bg-primary: #fffef5;
  --bg-secondary: #f5f4e8;
  --bg-tertiary: #ebe9d8;
  --text-primary: #3d3929;
  --text-secondary: #6b6450;
  --border-color: #d9d5c0;
  --accent-color: #b8860b;
}

/* Classic-light - clean light theme */
[data-theme="classic-light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --bg-tertiary: #e8e8e8;
  --text-primary: #333333;
  --text-secondary: #666666;
  --border-color: #dddddd;
  --accent-color: #0066cc;
}

/* Classic-dark - standard dark theme */
[data-theme="classic-dark"] {
  --bg-primary: #1a1a1a;
  --bg-secondary: #242424;
  --bg-tertiary: #2e2e2e;
  --text-primary: #e0e0e0;
  --text-secondary: #888888;
  --border-color: #333333;
  --accent-color: #4a9eff;
}

/* True-dark - OLED black */
[data-theme="true-dark"] {
  --bg-primary: #000000;
  --bg-secondary: #0a0a0a;
  --bg-tertiary: #141414;
  --text-primary: #e0e0e0;
  --text-secondary: #777777;
  --border-color: #222222;
  --accent-color: #4a9eff;
}
```

**Step 2: Verify styles render**

Run: `npm run dev`
Expected: App launches, dark theme displays (current behavior)

---

### Task 3: Add Appearance tab to settings HTML

**Files:**
- Modify: `index.html`

**Step 1: Add Appearance tab button**

After the Git tab button (line 127), add:

```html
          <button class="settings-tab" data-tab="appearance">Appearance</button>
```

**Step 2: Add Appearance panel**

After the git panel closing `</div>` (line 170), add:

```html
          <div id="panel-appearance" class="settings-panel">
            <label class="settings-label">Theme</label>
            <div id="theme-options">
              <div class="theme-option" data-theme="system">
                <div class="theme-radio"></div>
                <div class="theme-info">
                  <div class="theme-name">System</div>
                  <div class="theme-desc">Follow OS light/dark setting</div>
                </div>
              </div>
              <div class="theme-option" data-theme="original">
                <div class="theme-radio"></div>
                <div class="theme-info">
                  <div class="theme-name">Original</div>
                  <div class="theme-desc">Warm dark with amber accents</div>
                </div>
              </div>
              <div class="theme-option" data-theme="yellow-pad">
                <div class="theme-radio"></div>
                <div class="theme-info">
                  <div class="theme-name">Yellow Pad</div>
                  <div class="theme-desc">Warm light, legal pad aesthetic</div>
                </div>
              </div>
              <div class="theme-option" data-theme="classic-light">
                <div class="theme-radio"></div>
                <div class="theme-info">
                  <div class="theme-name">Classic Light</div>
                  <div class="theme-desc">Clean light with blue accents</div>
                </div>
              </div>
              <div class="theme-option" data-theme="classic-dark">
                <div class="theme-radio"></div>
                <div class="theme-info">
                  <div class="theme-name">Classic Dark</div>
                  <div class="theme-desc">Standard dark with blue accents</div>
                </div>
              </div>
              <div class="theme-option" data-theme="true-dark">
                <div class="theme-radio"></div>
                <div class="theme-info">
                  <div class="theme-name">True Dark</div>
                  <div class="theme-desc">OLED black</div>
                </div>
              </div>
            </div>
          </div>
```

---

### Task 4: Add theme option styles

**Files:**
- Modify: `src/styles/main.css`

**Step 1: Add theme option styles**

Find the `.git-mode-option` styles and add similar styles for theme options (these can reuse the same pattern):

```css
/* Theme options (reuse git-mode-option pattern) */
.theme-option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.theme-option:hover {
  background: var(--bg-tertiary);
}

.theme-option.active {
  background: var(--bg-tertiary);
}

.theme-radio {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--text-secondary);
  margin-top: 2px;
  flex-shrink: 0;
  transition: border-color 0.15s, background 0.15s;
}

.theme-option.active .theme-radio {
  border-color: var(--accent-color);
  background: var(--accent-color);
}

.theme-info {
  flex: 1;
}

.theme-name {
  font-weight: 500;
  margin-bottom: 2px;
}

.theme-desc {
  font-size: 12px;
  color: var(--text-secondary);
}
```

---

### Task 5: Add theme TypeScript logic

**Files:**
- Modify: `src/settings.ts`

**Step 1: Add theme API functions**

After the git mode functions (around line 67), add:

```typescript
export async function getTheme(): Promise<string> {
  return await invoke('get_theme');
}

export async function setTheme(theme: string): Promise<void> {
  return await invoke('set_theme', { theme });
}

export function applyTheme(theme: string): void {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}
```

**Step 2: Load and apply theme on settings load**

In `loadSettingsData()` function (around line 297), add theme loading:

```typescript
  // Update theme selection
  const currentTheme = await getTheme();
  applyTheme(currentTheme);
  const themeOptions = document.querySelectorAll('.theme-option');
  themeOptions.forEach(opt => {
    const theme = opt.getAttribute('data-theme');
    opt.classList.toggle('active', theme === currentTheme);
  });
```

**Step 3: Add theme change handler in initSettings**

In `initSettings()`, after the git mode handler setup, add:

```typescript
  // Theme change
  const themeOptions = document.querySelectorAll('.theme-option');
  themeOptions.forEach(opt => {
    opt.addEventListener('click', async () => {
      const theme = opt.getAttribute('data-theme');
      if (theme) {
        await setTheme(theme);
        applyTheme(theme);
        themeOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      }
    });
  });
```

---

### Task 6: Apply theme on app startup

**Files:**
- Modify: `src/main.ts`

**Step 1: Import and apply theme early**

At the top of main.ts, add import:

```typescript
import { getTheme, applyTheme } from './settings';
```

**Step 2: Apply theme before DOM renders**

At the very start of the `init()` function (or equivalent startup), add:

```typescript
  // Apply theme immediately to prevent flash
  const theme = await getTheme();
  applyTheme(theme);
```

---

### Task 7: Test all themes

**Step 1: Run dev mode**

Run: `npm run tauri dev`

**Step 2: Test each theme**

1. Open Settings (Cmd+,)
2. Go to Appearance tab
3. Click each theme option and verify:
   - Original: Warm dark, amber accent
   - Yellow-pad: Warm light, golden accent
   - Classic-light: Clean light, blue accent
   - Classic-dark: Standard dark, blue accent
   - True-dark: Pure black background
   - System: Follows OS preference

**Step 3: Test persistence**

1. Select a theme
2. Quit app
3. Reopen app
4. Verify theme persists

---

### Task 8: Commit

```bash
git add -A
git commit -m "feat(settings): add theme selection with 6 theme options

- Original (warm dark), Yellow-pad (warm light), Classic-light, Classic-dark, True-dark, System
- Theme stored in settings.json and applied on app load
- System mode follows OS light/dark preference"
```
