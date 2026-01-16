# Settings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add settings modal with vault management and git commit mode selection.

**Architecture:** Settings stored in JSON file at Tauri config dir. Rust backend provides get/save/pick_folder commands. Frontend renders modal with two sections. Git mode controls auto-commit behavior in save flow.

**Tech Stack:** Rust (Tauri 2, serde, dirs, tauri-plugin-dialog), TypeScript, CSS

---

## Task 1: Add Dialog Plugin

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/capabilities/default.json`

**Step 1: Add dialog dependency to Cargo.toml**

In `src-tauri/Cargo.toml`, add to `[dependencies]`:

```toml
tauri-plugin-dialog = "2"
```

**Step 2: Enable dialog plugin in tauri.conf.json**

In `src-tauri/tauri.conf.json`, add to the `plugins` object (create if not exists):

```json
"plugins": {
  "dialog": {}
}
```

**Step 3: Add dialog capability**

In `src-tauri/capabilities/default.json`, add to `permissions` array:

```json
"dialog:default"
```

**Step 4: Register plugin in lib.rs**

In `src-tauri/src/lib.rs`, in the `run()` function's builder chain, add:

```rust
.plugin(tauri_plugin_dialog::init())
```

**Step 5: Verify it compiles**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri build -- --no-bundle`
Expected: Compiles without errors

---

## Task 2: Settings Structs and Storage (Rust)

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add Settings structs after existing structs (around line 70)**

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Vault {
    pub id: String,
    pub name: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitSettings {
    #[serde(default = "default_commit_mode")]
    pub commit_mode: String,
}

fn default_commit_mode() -> String {
    "simple".to_string()
}

impl Default for GitSettings {
    fn default() -> Self {
        GitSettings {
            commit_mode: default_commit_mode(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub vaults: Vec<Vault>,
    #[serde(default)]
    pub active_vault: Option<String>,
    #[serde(default)]
    pub git: GitSettings,
}
```

**Step 2: Add settings path helper and load/save functions**

```rust
fn get_settings_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_default())
        .join("noteone")
        .join("settings.json")
}

fn load_settings() -> Settings {
    let path = get_settings_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(settings) = serde_json::from_str(&content) {
                return settings;
            }
        }
    }
    // Default: create vault from current hardcoded path
    let default_path = dirs::home_dir()
        .unwrap_or_default()
        .join("tetronomis/dotfiles/notes");
    Settings {
        vaults: vec![Vault {
            id: generate_id(),
            name: "notes".to_string(),
            path: default_path.to_string_lossy().to_string(),
        }],
        active_vault: None,
        git: GitSettings::default(),
    }
}

fn save_settings(settings: &Settings) -> Result<(), String> {
    let path = get_settings_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

fn generate_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{:x}", duration.as_millis())
}
```

**Step 3: Update get_notes_path() to use settings**

Replace the existing `get_notes_path()` function:

```rust
fn get_notes_path() -> PathBuf {
    let settings = load_settings();

    // Find active vault, or use first vault, or fall back to default
    let vault_path = settings.active_vault
        .and_then(|id| settings.vaults.iter().find(|v| v.id == id))
        .or_else(|| settings.vaults.first())
        .map(|v| v.path.clone());

    match vault_path {
        Some(p) => PathBuf::from(p),
        None => dirs::home_dir()
            .unwrap_or_default()
            .join("tetronomis/dotfiles/notes")
    }
}
```

**Step 4: Verify it compiles**

Run: `cd /Users/simon/tetronomis/noteone && cargo build --manifest-path src-tauri/Cargo.toml`
Expected: Compiles without errors

---

## Task 3: Settings Tauri Commands (Rust)

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add get_settings command**

```rust
#[tauri::command]
fn get_settings() -> Settings {
    load_settings()
}
```

**Step 2: Add update_settings command**

```rust
#[tauri::command]
fn update_settings(settings: Settings) -> Result<(), String> {
    save_settings(&settings)
}
```

**Step 3: Add add_vault command with dialog**

```rust
#[tauri::command]
async fn add_vault(app: tauri::AppHandle) -> Result<Option<Vault>, String> {
    use tauri_plugin_dialog::DialogExt;

    let folder = app.dialog().file().blocking_pick_folder();

    match folder {
        Some(path) => {
            let path_str = path.to_string();
            let name = std::path::Path::new(&path_str)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("notes")
                .to_string();

            let vault = Vault {
                id: generate_id(),
                name,
                path: path_str,
            };

            let mut settings = load_settings();
            settings.vaults.push(vault.clone());
            save_settings(&settings)?;

            Ok(Some(vault))
        }
        None => Ok(None)
    }
}
```

**Step 4: Add remove_vault command**

```rust
#[tauri::command]
fn remove_vault(vault_id: String) -> Result<(), String> {
    let mut settings = load_settings();
    settings.vaults.retain(|v| v.id != vault_id);

    // If we removed the active vault, clear active_vault
    if settings.active_vault.as_ref() == Some(&vault_id) {
        settings.active_vault = settings.vaults.first().map(|v| v.id.clone());
    }

    save_settings(&settings)
}
```

**Step 5: Add set_active_vault command**

```rust
#[tauri::command]
fn set_active_vault(vault_id: String) -> Result<(), String> {
    let mut settings = load_settings();
    if settings.vaults.iter().any(|v| v.id == vault_id) {
        settings.active_vault = Some(vault_id);
        save_settings(&settings)
    } else {
        Err("Vault not found".to_string())
    }
}
```

**Step 6: Add set_git_mode command**

```rust
#[tauri::command]
fn set_git_mode(mode: String) -> Result<(), String> {
    let mut settings = load_settings();
    settings.git.commit_mode = mode;
    save_settings(&settings)
}
```

**Step 7: Add get_git_mode command**

```rust
#[tauri::command]
fn get_git_mode() -> String {
    load_settings().git.commit_mode
}
```

**Step 8: Register all commands in the invoke_handler**

Find the `.invoke_handler(tauri::generate_handler![...])` call and add:

```rust
get_settings,
update_settings,
add_vault,
remove_vault,
set_active_vault,
set_git_mode,
get_git_mode,
```

**Step 9: Verify it compiles**

Run: `cd /Users/simon/tetronomis/noteone && cargo build --manifest-path src-tauri/Cargo.toml`
Expected: Compiles without errors

---

## Task 4: Settings Modal HTML

**Files:**
- Modify: `index.html`

**Step 1: Add gear icon button in top-bar (before git-status-container)**

Find `<div id="git-status-container">` and add before it:

```html
<button id="settings-btn" title="Settings">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>
  </svg>
</button>
```

**Step 2: Add settings modal overlay (before closing </body>)**

```html
<div id="settings-overlay" class="modal-overlay hidden">
  <div id="settings-modal">
    <div class="settings-header">
      <h2>Settings</h2>
      <button id="settings-close" class="modal-close">&times;</button>
    </div>
    <div class="settings-content">
      <nav class="settings-nav">
        <button class="settings-tab active" data-tab="repositories">Repositories</button>
        <button class="settings-tab" data-tab="git">Git</button>
      </nav>
      <div class="settings-panels">
        <div id="panel-repositories" class="settings-panel active">
          <div id="vault-list"></div>
          <button id="add-vault-btn" class="settings-action-btn">+ Add vault</button>
        </div>
        <div id="panel-git" class="settings-panel">
          <label class="settings-label">Commit mode</label>
          <select id="git-mode-select" class="settings-select">
            <option value="simple">Simple</option>
            <option value="manual">Manual</option>
          </select>
          <p class="settings-hint" id="git-mode-hint">Auto-commit on every save</p>
          <div class="settings-info">
            <p><strong>Simple:</strong> Commit every save (current behavior)</p>
            <p><strong>Manual:</strong> Save only, commit via git status box</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

**Step 3: Verify HTML is valid**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`
Expected: App launches (styling will be off, that's fine)

---

## Task 5: Settings Modal CSS

**Files:**
- Modify: `src/styles/main.css`

**Step 1: Add modal overlay styles (at end of file)**

```css
/* Settings Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-overlay.hidden {
  display: none;
}

#settings-modal {
  width: 500px;
  max-height: 70vh;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.settings-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.modal-close:hover {
  color: var(--text-primary);
}

.settings-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.settings-nav {
  display: flex;
  flex-direction: column;
  padding: 12px;
  border-right: 1px solid var(--border-color);
  min-width: 120px;
}

.settings-tab {
  background: none;
  border: none;
  padding: 8px 12px;
  text-align: left;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 6px;
  font-size: 13px;
}

.settings-tab:hover {
  background: var(--bg-secondary);
}

.settings-tab.active {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.settings-panels {
  flex: 1;
  padding: 16px 20px;
  overflow-y: auto;
}

.settings-panel {
  display: none;
}

.settings-panel.active {
  display: block;
}

/* Settings button in top bar */
#settings-btn {
  background: none;
  border: none;
  padding: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  margin-right: 12px;
}

#settings-btn:hover {
  color: var(--text-primary);
}

/* Vault list */
#vault-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.vault-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
  cursor: pointer;
  gap: 12px;
}

.vault-item:hover {
  background: var(--bg-tertiary, var(--bg-secondary));
}

.vault-item.active {
  border: 1px solid var(--accent-color);
}

.vault-radio {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.vault-item.active .vault-radio {
  border-color: var(--accent-color);
}

.vault-item.active .vault-radio::after {
  content: '';
  width: 8px;
  height: 8px;
  background: var(--accent-color);
  border-radius: 50%;
}

.vault-info {
  flex: 1;
  min-width: 0;
}

.vault-name {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}

.vault-path {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vault-remove {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.vault-item:hover .vault-remove {
  opacity: 1;
}

.vault-remove:hover {
  color: #e74c3c;
}

.settings-action-btn {
  background: none;
  border: 1px dashed var(--border-color);
  padding: 10px 16px;
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  width: 100%;
  font-size: 13px;
}

.settings-action-btn:hover {
  border-color: var(--accent-color);
  color: var(--text-primary);
}

/* Git settings */
.settings-label {
  display: block;
  font-size: 13px;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.settings-select {
  width: 100%;
  padding: 8px 12px;
  font-size: 13px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  cursor: pointer;
}

.settings-select:focus {
  outline: none;
  border-color: var(--accent-color);
}

.settings-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 8px 0 16px 0;
}

.settings-info {
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.settings-info p {
  margin: 4px 0;
}

.settings-info strong {
  color: var(--text-primary);
}
```

**Step 2: Verify styling looks correct**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`
Expected: Settings button visible, modal opens with proper styling

---

## Task 6: Settings TypeScript Module

**Files:**
- Create: `src/settings.ts`

**Step 1: Create the settings module**

```typescript
import { invoke } from '@tauri-apps/api/core';

interface Vault {
  id: string;
  name: string;
  path: string;
}

interface GitSettings {
  commit_mode: string;
}

interface Settings {
  vaults: Vault[];
  active_vault: string | null;
  git: GitSettings;
}

let isOpen = false;
let currentSettings: Settings | null = null;

const GIT_MODE_HINTS: Record<string, string> = {
  simple: 'Auto-commit on every save',
  manual: 'Save only, commit manually via git status box',
};

export async function getSettings(): Promise<Settings> {
  return await invoke('get_settings');
}

export async function getGitMode(): Promise<string> {
  return await invoke('get_git_mode');
}

export async function setGitMode(mode: string): Promise<void> {
  return await invoke('set_git_mode', { mode });
}

async function addVault(): Promise<Vault | null> {
  return await invoke('add_vault');
}

async function removeVault(vaultId: string): Promise<void> {
  return await invoke('remove_vault', { vaultId });
}

async function setActiveVault(vaultId: string): Promise<void> {
  return await invoke('set_active_vault', { vaultId });
}

function truncatePath(path: string, maxLength: number = 35): string {
  if (path.length <= maxLength) return path;
  const parts = path.split('/');
  let result = parts[parts.length - 1];
  for (let i = parts.length - 2; i >= 0; i--) {
    const next = parts[i] + '/' + result;
    if (next.length > maxLength - 3) {
      return '.../' + result;
    }
    result = next;
  }
  return result;
}

function renderVaultList() {
  const container = document.getElementById('vault-list');
  if (!container || !currentSettings) return;

  container.innerHTML = currentSettings.vaults.map(vault => {
    const isActive = vault.id === currentSettings!.active_vault ||
                     (!currentSettings!.active_vault && currentSettings!.vaults[0]?.id === vault.id);
    return `
      <div class="vault-item ${isActive ? 'active' : ''}" data-vault-id="${vault.id}">
        <div class="vault-radio"></div>
        <div class="vault-info">
          <div class="vault-name">${vault.name}</div>
          <div class="vault-path">${truncatePath(vault.path)}</div>
        </div>
        <button class="vault-remove" data-vault-id="${vault.id}" title="Remove vault">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
  }).join('');

  // Add click handlers
  container.querySelectorAll('.vault-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.vault-remove')) return;

      const vaultId = item.getAttribute('data-vault-id');
      if (vaultId && currentSettings) {
        await setActiveVault(vaultId);
        currentSettings.active_vault = vaultId;
        renderVaultList();
        // Reload app with new vault
        window.location.reload();
      }
    });
  });

  container.querySelectorAll('.vault-remove').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const vaultId = (e.currentTarget as HTMLElement).getAttribute('data-vault-id');
      if (vaultId && currentSettings && currentSettings.vaults.length > 1) {
        await removeVault(vaultId);
        currentSettings.vaults = currentSettings.vaults.filter(v => v.id !== vaultId);
        if (currentSettings.active_vault === vaultId) {
          currentSettings.active_vault = currentSettings.vaults[0]?.id || null;
          window.location.reload();
        } else {
          renderVaultList();
        }
      }
    });
  });
}

function updateGitModeHint(mode: string) {
  const hint = document.getElementById('git-mode-hint');
  if (hint) {
    hint.textContent = GIT_MODE_HINTS[mode] || '';
  }
}

export function openSettings() {
  const overlay = document.getElementById('settings-overlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    isOpen = true;
    loadSettingsData();
  }
}

export function closeSettings() {
  const overlay = document.getElementById('settings-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
    isOpen = false;
  }
}

export function isSettingsOpen(): boolean {
  return isOpen;
}

async function loadSettingsData() {
  currentSettings = await getSettings();
  renderVaultList();

  const gitSelect = document.getElementById('git-mode-select') as HTMLSelectElement;
  if (gitSelect && currentSettings) {
    gitSelect.value = currentSettings.git.commit_mode;
    updateGitModeHint(currentSettings.git.commit_mode);
  }
}

export function initSettings() {
  const settingsBtn = document.getElementById('settings-btn');
  const closeBtn = document.getElementById('settings-close');
  const overlay = document.getElementById('settings-overlay');
  const modal = document.getElementById('settings-modal');
  const addVaultBtn = document.getElementById('add-vault-btn');
  const gitSelect = document.getElementById('git-mode-select');
  const tabs = document.querySelectorAll('.settings-tab');

  settingsBtn?.addEventListener('click', openSettings);
  closeBtn?.addEventListener('click', closeSettings);

  // Close on backdrop click
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeSettings();
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      closeSettings();
    }
  });

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      if (!tabName) return;

      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      document.querySelectorAll('.settings-panel').forEach(panel => {
        panel.classList.remove('active');
      });
      document.getElementById(`panel-${tabName}`)?.classList.add('active');
    });
  });

  // Add vault
  addVaultBtn?.addEventListener('click', async () => {
    const vault = await addVault();
    if (vault && currentSettings) {
      currentSettings.vaults.push(vault);
      renderVaultList();
    }
  });

  // Git mode change
  gitSelect?.addEventListener('change', async (e) => {
    const mode = (e.target as HTMLSelectElement).value;
    await setGitMode(mode);
    updateGitModeHint(mode);
  });
}
```

**Step 2: Verify no TypeScript errors**

Run: `cd /Users/simon/tetronomis/noteone && npx tsc --noEmit`
Expected: No errors

---

## Task 7: Integrate Settings into Main

**Files:**
- Modify: `src/main.ts`

**Step 1: Add import at top of file**

```typescript
import { initSettings, getGitMode, isSettingsOpen, closeSettings } from './settings';
```

**Step 2: Update scheduleSave to check git mode**

Replace the auto-commit section in `scheduleSave()` (around line 253-261):

```typescript
        // Auto-commit only if git mode is 'simple'
        const gitMode = await getGitMode();
        if (gitMode === 'simple') {
          try {
            const filename = currentPage.filename.replace('.md', '');
            await gitCommit(currentPage.path, `Update ${filename}`);
            setStatus('Committed');
          } catch {
            // Git commit failed - that's ok, file is still saved
            setStatus('Saved (not committed)');
          }
        } else {
          // Manual mode - just mark as saved
          setStatus('Saved');
        }
```

**Step 3: Update keyboard shortcut handler to close settings on Escape**

In `setupKeyboardShortcuts()`, update the Escape handling:

```typescript
    if (e.key === 'Escape') {
      if (isSettingsOpen()) {
        closeSettings();
      } else if (isSearchBarOpen()) {
        closeSearchBar();
      } else if (isHistoryPanelOpen()) {
        closeHistoryPanel();
      }
    }
```

**Step 4: Call initSettings in the main init flow**

In the DOMContentLoaded handler (around line 300), add after other init calls:

```typescript
initSettings();
```

**Step 5: Verify app works end-to-end**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`
Expected:
- Gear icon appears in top bar
- Clicking opens settings modal
- Vaults list shows current vault
- Can add new vault via folder picker
- Git mode dropdown works
- Changing to Manual prevents auto-commit

---

## Task 8: Final Testing and Build

**Step 1: Test vault switching**
- Add a second vault
- Switch to it
- Verify app reloads with new vault's content

**Step 2: Test git modes**
- Set to Manual, edit a file, verify no auto-commit
- Set to Simple, edit a file, verify auto-commit happens

**Step 3: Create release build**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri build`
Expected: Build completes, `.dmg` created in `src-tauri/target/release/bundle/dmg/`

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Dialog plugin | Cargo.toml, tauri.conf.json, capabilities |
| 2 | Settings structs | lib.rs |
| 3 | Tauri commands | lib.rs |
| 4 | Modal HTML | index.html |
| 5 | Modal CSS | main.css |
| 6 | Settings TS | settings.ts (new) |
| 7 | Integration | main.ts |
| 8 | Test & build | - |
