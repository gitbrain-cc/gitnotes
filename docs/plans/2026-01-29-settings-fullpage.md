# Settings Full-Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert the settings modal into a full-page app mode, matching the notes/git mode pattern.

**Architecture:** Settings becomes a third view mode alongside Notes and Git. A new `#settings-view` element replaces the `#settings-overlay` modal. The settings sidebar reuses the exact same CSS dimensions as the Sections sidebar (`--sidebar-width-sections: 150px`). Enter/exit follows the same pattern as `enterGitMode()`/`exitGitMode()` in `src/git-view.ts`.

**Tech Stack:** Vanilla TypeScript, CSS

**Design doc:** `docs/plans/2026-01-29-settings-fullpage-design.md`

---

### Task 1: Replace settings modal HTML with full-page view

**Files:**
- Modify: `index.html:128-288` (replace settings modal markup)

**Step 1: Replace the settings overlay block**

Replace the entire `<div id="settings-overlay">...</div>` block (lines 128-288) with:

```html
<div id="settings-view" class="hidden">
  <div id="settings-sidebar" class="sidebar">
    <div class="sidebar-header">
      <button id="settings-back" class="settings-back-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        Settings
      </button>
    </div>
    <ul id="settings-nav">
      <li class="settings-tab active" data-tab="repositories">Repositories</li>
      <li class="settings-tab" data-tab="git">Git</li>
      <li class="settings-tab" data-tab="editor">Editor</li>
      <li class="settings-tab" data-tab="appearance">Appearance</li>
    </ul>
  </div>
  <div id="settings-content">
    <div id="panel-repositories" class="settings-panel active">
      <h2 class="settings-panel-title">Repositories</h2>
      <div id="vault-list"></div>
      <div id="vault-actions">
        <div id="add-repo-dropdown" class="add-repo-dropdown">
          <button id="add-repo-btn">
            + Add Repository
            <svg class="dropdown-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          <div id="add-repo-menu" class="dropdown-menu hidden">
            <button class="dropdown-item" data-action="local">Add Local Folder</button>
            <button class="dropdown-item" data-action="clone">Clone Repository</button>
            <button class="dropdown-item" data-action="create">Create Repository</button>
          </div>
        </div>
      </div>
    </div>
    <div id="panel-git" class="settings-panel">
      <h2 class="settings-panel-title">Git</h2>
      <div class="settings-row">
        <label class="settings-toggle">
          <input type="checkbox" id="auto-commit-toggle" checked>
          <span class="toggle-slider"></span>
          <span class="toggle-label">Auto-commit</span>
        </label>
        <p class="settings-hint">Automatically commit after periods of inactivity</p>
      </div>
      <div class="setting-row">
        <div class="setting-label">
          <div class="setting-title">Team repository</div>
          <div class="setting-description">Show author names in commits and notes</div>
        </div>
        <select id="team-override-select" class="setting-select">
          <option value="auto">Auto</option>
          <option value="on">On</option>
          <option value="off">Off</option>
        </select>
      </div>
    </div>
    <div id="panel-editor" class="settings-panel">
      <h2 class="settings-panel-title">Editor</h2>
      <label class="settings-label">Text size</label>
      <div class="text-size-control">
        <input type="range" id="font-size-slider" min="10" max="20" value="14">
        <span id="font-size-value">14px</span>
      </div>
      <div class="editor-toggles">
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
    <div id="panel-appearance" class="settings-panel">
      <h2 class="settings-panel-title">Appearance</h2>
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
        <div class="theme-option" data-theme="antropique">
          <div class="theme-radio"></div>
          <div class="theme-info">
            <div class="theme-name">Antropique</div>
            <div class="theme-desc">Warm dark, Anthropic Claude homage</div>
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
            <div class="font-preview" style="font-family: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif">The quick brown fox</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

Key changes from old markup:
- `#settings-overlay` → `#settings-view` (no overlay, just a view)
- `#settings-modal` wrapper removed (no modal box)
- Sidebar uses `.sidebar` class + `#settings-sidebar` for exact dimension match with sections sidebar
- Header is `.sidebar-header` with a back button instead of close `×`
- Nav uses `<ul><li>` matching `.sidebar li` styling instead of `<button class="settings-tab">`
- `<nav class="settings-nav">` → `<ul id="settings-nav">` inside sidebar
- `.settings-panels` wrapper removed, panels sit directly in `#settings-content`
- Each panel gets an `<h2 class="settings-panel-title">` heading
- All panel IDs and control IDs stay the same (no JS changes needed for controls)

**Step 2: Verify the app builds**

Run: `cd /Users/simon/tetronomis/gitnotes && npm run tauri dev`
Expected: App compiles without errors

---

### Task 2: Replace settings modal CSS with full-page layout CSS

**Files:**
- Modify: `src/styles/main.css:855-955` (replace modal overlay + settings-modal CSS)

**Step 1: Remove old modal/settings CSS**

Remove these CSS blocks (approximately lines 855-957):
- `.modal-overlay` (lines 853-865) — keep this, it's shared with clone/create modals
- `#settings-modal` (lines 871-880)
- `.settings-header` (lines 882-888)
- `.settings-header h2` (lines 890-895)
- `.modal-close` (lines 897-905) — keep this, shared with clone/create modals
- `.modal-close:hover` (lines 907-909) — keep this
- `.settings-content` (lines 911-915)
- `.settings-nav` (lines 917-923)
- `.settings-tab` (lines 925-933)
- `.settings-tab:hover` (lines 936-938)
- `.settings-tab.active` (lines 940-943)
- `.settings-panels` (lines 945-949)

Keep `.settings-panel` and `.settings-panel.active` (lines 951-957) — still used.

**Step 2: Add new full-page settings CSS**

Add after the `.modal-close:hover` block:

```css
/* Settings View (full-page mode) */
#settings-view {
  display: flex;
  flex: 1;
  min-height: 0;
}

#settings-view.hidden {
  display: none;
}

#settings-sidebar {
  width: var(--sidebar-width-sections);
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
}

#settings-sidebar .sidebar-header {
  justify-content: flex-start;
}

.settings-back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 0.929rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.settings-back-btn:hover {
  color: var(--text-primary);
}

.settings-back-btn svg {
  flex-shrink: 0;
}

#settings-nav {
  list-style: none;
  padding: 0;
  margin: 0;
  flex: 1;
  overflow-y: auto;
}

#settings-nav li {
  padding: 10px 16px;
  cursor: pointer;
  font-size: 0.929rem;
  color: var(--text-secondary);
  border-left: 3px solid transparent;
}

#settings-nav li:hover {
  background: var(--bg-tertiary);
}

#settings-nav li.active {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-left-width: 5px;
  border-left-color: var(--accent-color);
}

#settings-content {
  flex: 1;
  padding: 32px 40px;
  overflow-y: auto;
  max-width: 700px;
}

.settings-panel-title {
  margin: 0 0 24px 0;
  font-size: 1.286rem;
  font-weight: 600;
  color: var(--text-primary);
}
```

**Step 3: Hide top bar when settings is active**

Add to the CSS:

```css
body.settings-active #top-bar {
  display: none;
}
```

**Step 4: Verify the app builds and settings view renders**

Run: `cd /Users/simon/tetronomis/gitnotes && npm run tauri dev`
Expected: App compiles. Settings view not yet wired up (will be blank), but no CSS errors.

---

### Task 3: Update settings.ts to use full-page mode instead of modal

**Files:**
- Modify: `src/settings.ts:238-253` (openSettings/closeSettings functions)
- Modify: `src/settings.ts:297-333` (initSettings — remove modal-specific listeners, add back button)

**Step 1: Track previous mode for restoring**

At the top of `src/settings.ts`, near the existing `let isOpen = false;` (line 51), add:

```typescript
let previousMode: 'notes' | 'git' = 'notes';
```

**Step 2: Rewrite openSettings()**

Replace lines 238-245:

```typescript
export function openSettings() {
  if (isOpen) return;

  const settingsView = document.getElementById('settings-view');
  if (!settingsView) return;

  // Remember which mode we came from
  const { isGitModeOpen } = await import('./git-view');
  previousMode = isGitModeOpen() ? 'git' : 'notes';

  // Hide everything
  document.getElementById('top-bar')?.classList.add('hidden');
  document.getElementById('notes-mode')?.classList.add('hidden');
  document.getElementById('git-view')?.classList.add('hidden');
  document.getElementById('status-bar')?.classList.add('hidden');
  document.body.classList.add('settings-active');

  // Show settings
  settingsView.classList.remove('hidden');
  isOpen = true;
  loadSettingsData();
}
```

Note: Since `openSettings` now uses `await`, change its signature to `async`:

```typescript
export async function openSettings() {
```

**Step 3: Rewrite closeSettings()**

Replace lines 247-253:

```typescript
export function closeSettings() {
  if (!isOpen) return;

  const settingsView = document.getElementById('settings-view');
  if (settingsView) {
    settingsView.classList.add('hidden');
  }

  // Restore previous mode
  document.getElementById('top-bar')?.classList.remove('hidden');
  document.getElementById('status-bar')?.classList.remove('hidden');
  document.body.classList.remove('settings-active');

  if (previousMode === 'git') {
    document.getElementById('git-view')?.classList.remove('hidden');
  } else {
    document.getElementById('notes-mode')?.classList.remove('hidden');
  }

  isOpen = false;
}
```

**Step 4: Update initSettings() — remove modal listeners, add back button**

In `initSettings()` (line 297), make these changes:

1. Remove these lines:
   - `const closeBtn = document.getElementById('settings-close');` (line 298)
   - `const overlay = document.getElementById('settings-overlay');` (line 299)
   - `closeBtn?.addEventListener('click', closeSettings);` (line 310)
   - The overlay backdrop click listener (lines 313-317)

2. Add back button listener:
   ```typescript
   const backBtn = document.getElementById('settings-back');
   backBtn?.addEventListener('click', closeSettings);
   ```

3. Update tab switching selectors — tabs are now `#settings-nav li.settings-tab` instead of `button.settings-tab`:
   ```typescript
   const tabs = document.querySelectorAll('#settings-nav li.settings-tab');
   ```

   (The existing tab click logic at lines 336-348 works unchanged since we kept the `data-tab` attribute and `.settings-tab` class on the `<li>` elements.)

**Step 5: Verify settings open/close works**

Run: `cd /Users/simon/tetronomis/gitnotes && npm run tauri dev`
Expected: Clicking gear icon opens full-page settings. Back arrow and Escape return to notes/git mode. All controls still function.

---

### Task 4: Update main.ts Escape key handling

**Files:**
- Modify: `src/main.ts:354-364` (Escape key handler)

**Step 1: Adjust Escape priority**

The existing Escape handler in `main.ts:354-364` already checks `isSettingsOpen()` and calls `closeSettings()`. This still works. However, the settings.ts internal Escape handler (lines 319-333) also needs updating since it references clone/create modals.

Verify the Escape handling in `settings.ts:319-333` still works — it checks clone modal, create modal, dropdown, then settings. This logic is correct since clone/create modals can still open on top of settings view. No change needed.

**Step 2: Verify Escape key chain works**

Run: `cd /Users/simon/tetronomis/gitnotes && npm run tauri dev`
Expected:
- In settings: Escape closes settings, returns to notes
- Clone modal open inside settings: Escape closes clone modal first
- Add repo dropdown open: Escape closes dropdown first

---

### Task 5: Clean up old modal CSS that is no longer needed

**Files:**
- Modify: `src/styles/main.css` (remove dead settings-modal CSS)

**Step 1: Remove orphaned CSS rules**

Search for and remove any remaining CSS that references `#settings-modal`, `.settings-header`, `.settings-nav`, `.settings-tab` (the old button variant). These were replaced in Task 2.

Specifically remove:
- `#settings-modal` block
- `.settings-header` and `.settings-header h2` blocks
- `.settings-content` block (the old flex wrapper — now replaced by `#settings-content`)
- `.settings-nav` block
- `.settings-tab`, `.settings-tab:hover`, `.settings-tab.active` blocks
- `.settings-panels` block

Keep all vault, theme, font, editor settings CSS (`.vault-item`, `.theme-option`, `.font-option`, etc.) — these are unchanged.

**Step 2: Verify no visual regressions**

Run: `cd /Users/simon/tetronomis/gitnotes && npm run tauri dev`
Expected: Settings view looks correct. Clone/create modals still work (they use `.modal-overlay` which was kept). No orphaned styles.

---

### Task 6: Commit

**Step 1: Stage and commit**

```bash
cd /Users/simon/tetronomis/gitnotes
git add index.html src/settings.ts src/styles/main.css
git commit -m "Convert settings from modal to full-page view"
```
