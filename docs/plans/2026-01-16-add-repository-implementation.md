# Add Repository Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Two distinct paths to add repositories: local folder (must be git repo) or clone from SSH URL.

**Architecture:** Replace single "Add repository" button with two buttons. Clone shows inline form. Backend validates git repos and handles cloning.

**Tech Stack:** Tauri 2.0 (Rust), TypeScript, CSS

---

## Task 1: Update HTML - Two Buttons + Clone Form

**Files:**
- Modify: `index.html:134-137`

**Step 1: Replace the single button with new structure**

Find in `index.html`:
```html
<div id="panel-repositories" class="settings-panel active">
  <div id="vault-list"></div>
  <button id="add-vault-btn" class="settings-action-btn">+ Add repository</button>
</div>
```

Replace with:
```html
<div id="panel-repositories" class="settings-panel active">
  <div id="vault-list"></div>
  <div id="vault-actions">
    <button id="add-local-btn" class="settings-action-btn">+ Add Local Folder</button>
    <button id="clone-repo-btn" class="settings-action-btn secondary">+ Clone Repository</button>
  </div>
  <div id="clone-form" class="hidden">
    <div class="clone-field">
      <label for="clone-url">Repository URL</label>
      <input type="text" id="clone-url" placeholder="git@github.com:user/repo.git" autocomplete="off" spellcheck="false">
    </div>
    <div class="clone-field">
      <label for="clone-path">Clone to</label>
      <div class="clone-path-row">
        <input type="text" id="clone-path" readonly>
        <button id="clone-browse-btn" class="clone-browse">Browse</button>
      </div>
    </div>
    <div id="clone-error" class="clone-error hidden"></div>
    <div id="clone-progress" class="clone-progress hidden">
      <span>Cloning repository...</span>
      <div class="progress-bar"><div class="progress-fill"></div></div>
    </div>
    <div class="clone-actions">
      <button id="clone-cancel-btn" class="settings-action-btn secondary">Cancel</button>
      <button id="clone-submit-btn" class="settings-action-btn" disabled>Clone</button>
    </div>
  </div>
</div>
```

**Step 2: Verify HTML is valid**

Run: `npm run tauri dev`
Expected: App loads without errors, settings panel shows two buttons

---

## Task 2: Add CSS for Clone Form

**Files:**
- Modify: `src/styles/main.css` (append after vault styles, around line 1020)

**Step 1: Add styles for the new elements**

Append to `src/styles/main.css`:
```css
/* Vault actions - two buttons */
#vault-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

#vault-actions .settings-action-btn {
  flex: 1;
}

#vault-actions .settings-action-btn.secondary {
  background: transparent;
  border: 1px solid var(--border-color, rgba(255,255,255,0.1));
}

#vault-actions .settings-action-btn.secondary:hover {
  background: var(--bg-secondary);
}

/* Clone form */
#clone-form {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

#clone-form.hidden {
  display: none;
}

.clone-field {
  margin-bottom: 12px;
}

.clone-field label {
  display: block;
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.clone-field input {
  width: 100%;
  padding: 8px 10px;
  background: var(--bg-tertiary, rgba(0,0,0,0.2));
  border: 1px solid var(--border-color, rgba(255,255,255,0.1));
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
}

.clone-field input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.clone-path-row {
  display: flex;
  gap: 8px;
}

.clone-path-row input {
  flex: 1;
}

.clone-browse {
  padding: 8px 12px;
  background: var(--bg-tertiary, rgba(255,255,255,0.05));
  border: 1px solid var(--border-color, rgba(255,255,255,0.1));
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
}

.clone-browse:hover {
  background: var(--bg-secondary);
}

.clone-error {
  color: #ef4444;
  font-size: 12px;
  margin-bottom: 12px;
  padding: 8px 10px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 6px;
}

.clone-error.hidden {
  display: none;
}

.clone-progress {
  margin-bottom: 12px;
}

.clone-progress.hidden {
  display: none;
}

.clone-progress span {
  font-size: 12px;
  color: var(--text-secondary);
}

.progress-bar {
  height: 4px;
  background: var(--bg-tertiary, rgba(255,255,255,0.1));
  border-radius: 2px;
  margin-top: 8px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent-color);
  width: 0%;
  animation: progress-indeterminate 1.5s ease-in-out infinite;
}

@keyframes progress-indeterminate {
  0% { width: 0%; margin-left: 0%; }
  50% { width: 30%; margin-left: 35%; }
  100% { width: 0%; margin-left: 100%; }
}

.clone-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.clone-actions .settings-action-btn {
  padding: 8px 16px;
}

.clone-actions .settings-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

**Step 2: Verify styles applied**

Run: `npm run tauri dev`
Expected: Clone form has proper styling when shown

---

## Task 3: Rust Backend - Validate Git Repository

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add function to check if path is git repo**

Add near other vault functions (around line 1405):
```rust
fn is_git_repository(path: &str) -> bool {
    let git_dir = std::path::Path::new(path).join(".git");
    git_dir.exists() && git_dir.is_dir()
}
```

**Step 2: Update add_vault to validate git**

Find `add_vault` function and modify to check for git:
```rust
#[tauri::command]
async fn add_vault(app: tauri::AppHandle) -> Result<Option<Vault>, String> {
    use tauri_plugin_dialog::DialogExt;

    let folder = app.dialog().file().blocking_pick_folder();

    match folder {
        Some(path) => {
            let path_str = path.to_string();

            // Validate it's a git repository
            if !is_git_repository(&path_str) {
                return Err("Not a git repository. Please select a folder with git initialized.".to_string());
            }

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

            // Save to settings
            let settings_path = get_settings_path(&app);
            let mut settings = load_settings(&settings_path);
            settings.vaults.push(vault.clone());
            save_settings(&settings_path, &settings);

            Ok(Some(vault))
        }
        None => Ok(None),
    }
}
```

**Step 3: Test add_vault validation**

Run: `npm run tauri dev`
Test: Try adding a non-git folder
Expected: Error message "Not a git repository..."

---

## Task 4: Rust Backend - Clone Commands

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add parse_repo_name helper**

```rust
fn parse_repo_name(url: &str) -> Option<String> {
    // Handle git@github.com:user/repo.git or ssh://git@github.com/user/repo.git
    let url = url.trim();

    // Extract last path component
    let name = if url.contains(':') && !url.starts_with("ssh://") {
        // git@github.com:user/repo.git format
        url.split(':').last()?.split('/').last()?
    } else {
        // ssh://git@github.com/user/repo.git or other URL format
        url.split('/').last()?
    };

    // Remove .git suffix
    let name = name.strip_suffix(".git").unwrap_or(name);

    if name.is_empty() {
        None
    } else {
        Some(name.to_string())
    }
}
```

**Step 2: Add check_clone_path command**

```rust
#[derive(serde::Serialize)]
enum ClonePathStatus {
    Empty,
    SameRemote,
    DifferentRemote,
    NotGit,
    NotEmpty,
}

#[tauri::command]
fn check_clone_path(url: String, path: String) -> Result<ClonePathStatus, String> {
    let path = std::path::Path::new(&path);

    if !path.exists() {
        return Ok(ClonePathStatus::Empty);
    }

    // Check if it's a git repo
    let git_dir = path.join(".git");
    if !git_dir.exists() {
        // Folder exists but not a git repo - check if empty
        if std::fs::read_dir(path).map(|mut d| d.next().is_none()).unwrap_or(false) {
            return Ok(ClonePathStatus::Empty);
        }
        return Ok(ClonePathStatus::NotEmpty);
    }

    // It's a git repo - check if same remote
    let output = std::process::Command::new("git")
        .args(["remote", "get-url", "origin"])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Ok(ClonePathStatus::NotGit);
    }

    let existing_remote = String::from_utf8_lossy(&output.stdout).trim().to_string();

    // Normalize URLs for comparison (remove .git suffix, trailing slashes)
    let normalize = |u: &str| u.trim().trim_end_matches('/').trim_end_matches(".git").to_string();

    if normalize(&existing_remote) == normalize(&url) {
        Ok(ClonePathStatus::SameRemote)
    } else {
        Ok(ClonePathStatus::DifferentRemote)
    }
}
```

**Step 3: Add clone_vault command**

```rust
#[tauri::command]
async fn clone_vault(app: tauri::AppHandle, url: String, path: String) -> Result<Vault, String> {
    // Create parent directory if needed
    let parent = std::path::Path::new(&path).parent();
    if let Some(parent) = parent {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    // Run git clone
    let output = std::process::Command::new("git")
        .args(["clone", &url, &path])
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Clone failed: {}", stderr.trim()));
    }

    // Create vault
    let name = parse_repo_name(&url).unwrap_or_else(|| "notes".to_string());
    let vault = Vault {
        id: generate_id(),
        name,
        path: path.clone(),
    };

    // Save to settings
    let settings_path = get_settings_path(&app);
    let mut settings = load_settings(&settings_path);
    settings.vaults.push(vault.clone());
    save_settings(&settings_path, &settings);

    Ok(vault)
}

#[tauri::command]
fn get_default_clone_path(url: String) -> Result<String, String> {
    let name = parse_repo_name(&url).ok_or("Invalid repository URL")?;
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let path = home.join("GitNotes").join(&name);
    Ok(path.to_string_lossy().to_string())
}
```

**Step 4: Register commands**

Find the `.invoke_handler` section and add new commands:
```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands ...
    add_vault,
    remove_vault,
    set_active_vault,
    check_clone_path,
    clone_vault,
    get_default_clone_path,
    // ... rest ...
])
```

**Step 5: Test compilation**

Run: `npm run tauri dev`
Expected: Compiles without errors

---

## Task 5: TypeScript - Wire Up Clone Form

**Files:**
- Modify: `src/settings.ts`

**Step 1: Add new invoke wrappers at top of file**

After existing interfaces (around line 30):
```typescript
type ClonePathStatus = 'Empty' | 'SameRemote' | 'DifferentRemote' | 'NotGit' | 'NotEmpty';

async function checkClonePath(url: string, path: string): Promise<ClonePathStatus> {
  return await invoke('check_clone_path', { url, path });
}

async function cloneVault(url: string, path: string): Promise<Vault> {
  return await invoke('clone_vault', { url, path });
}

async function getDefaultClonePath(url: string): Promise<string> {
  return await invoke('get_default_clone_path', { url });
}
```

**Step 2: Update addVault to handle errors**

Replace the existing `addVault` function:
```typescript
async function addVault(): Promise<Vault | null> {
  try {
    return await invoke('add_vault');
  } catch (error) {
    return null;
  }
}

async function addLocalVault(): Promise<{ vault: Vault | null; error: string | null }> {
  try {
    const vault = await invoke<Vault | null>('add_vault');
    return { vault, error: null };
  } catch (error) {
    return { vault: null, error: error as string };
  }
}
```

**Step 3: Add clone form state and helpers**

After the invoke wrappers:
```typescript
let cloneFormVisible = false;

function showCloneForm() {
  const form = document.getElementById('clone-form');
  const actions = document.getElementById('vault-actions');
  if (form && actions) {
    form.classList.remove('hidden');
    actions.style.display = 'none';
    cloneFormVisible = true;
    // Focus URL input
    document.getElementById('clone-url')?.focus();
  }
}

function hideCloneForm() {
  const form = document.getElementById('clone-form');
  const actions = document.getElementById('vault-actions');
  const urlInput = document.getElementById('clone-url') as HTMLInputElement;
  const pathInput = document.getElementById('clone-path') as HTMLInputElement;
  const errorDiv = document.getElementById('clone-error');
  const progressDiv = document.getElementById('clone-progress');
  const submitBtn = document.getElementById('clone-submit-btn') as HTMLButtonElement;

  if (form && actions) {
    form.classList.add('hidden');
    actions.style.display = 'flex';
    cloneFormVisible = false;
  }

  // Reset form
  if (urlInput) urlInput.value = '';
  if (pathInput) pathInput.value = '';
  if (errorDiv) errorDiv.classList.add('hidden');
  if (progressDiv) progressDiv.classList.add('hidden');
  if (submitBtn) submitBtn.disabled = true;
}

function showCloneError(message: string) {
  const errorDiv = document.getElementById('clone-error');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
  }
}

function hideCloneError() {
  const errorDiv = document.getElementById('clone-error');
  if (errorDiv) {
    errorDiv.classList.add('hidden');
  }
}

function showCloneProgress() {
  const progressDiv = document.getElementById('clone-progress');
  const submitBtn = document.getElementById('clone-submit-btn') as HTMLButtonElement;
  const cancelBtn = document.getElementById('clone-cancel-btn') as HTMLButtonElement;

  if (progressDiv) progressDiv.classList.remove('hidden');
  if (submitBtn) submitBtn.disabled = true;
  if (cancelBtn) cancelBtn.disabled = true;
}

function hideCloneProgress() {
  const progressDiv = document.getElementById('clone-progress');
  const cancelBtn = document.getElementById('clone-cancel-btn') as HTMLButtonElement;

  if (progressDiv) progressDiv.classList.add('hidden');
  if (cancelBtn) cancelBtn.disabled = false;
}

function isValidSshUrl(url: string): boolean {
  // git@host:user/repo.git or ssh://git@host/user/repo.git
  return /^git@[\w.-]+:[\w./-]+$/.test(url) || /^ssh:\/\/[\w@.-]+\/[\w./-]+$/.test(url);
}

function updateCloneButton() {
  const urlInput = document.getElementById('clone-url') as HTMLInputElement;
  const submitBtn = document.getElementById('clone-submit-btn') as HTMLButtonElement;

  if (urlInput && submitBtn) {
    submitBtn.disabled = !isValidSshUrl(urlInput.value.trim());
  }
}
```

**Step 4: Update initSettings to wire up new buttons**

Replace the add vault button handler in `initSettings`:
```typescript
export function initSettings() {
  const closeBtn = document.getElementById('settings-close');
  const overlay = document.getElementById('settings-overlay');
  const addLocalBtn = document.getElementById('add-local-btn');
  const cloneRepoBtn = document.getElementById('clone-repo-btn');
  const cloneCancelBtn = document.getElementById('clone-cancel-btn');
  const cloneSubmitBtn = document.getElementById('clone-submit-btn');
  const cloneUrlInput = document.getElementById('clone-url') as HTMLInputElement;
  const clonePathInput = document.getElementById('clone-path') as HTMLInputElement;
  const cloneBrowseBtn = document.getElementById('clone-browse-btn');
  const gitModeOptions = document.querySelectorAll('.git-mode-option');
  const tabs = document.querySelectorAll('.settings-tab');

  // Listen for menu event
  listen('open-settings', () => {
    openSettings();
  });

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
      if (cloneFormVisible) {
        hideCloneForm();
      } else {
        closeSettings();
      }
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

  // Add local folder
  addLocalBtn?.addEventListener('click', async () => {
    const { vault, error } = await addLocalVault();
    if (error) {
      // Show error inline - could use a toast or inline message
      alert(error);
    } else if (vault && currentSettings) {
      currentSettings.vaults.push(vault);
      await renderVaultList();
    }
  });

  // Clone repository - show form
  cloneRepoBtn?.addEventListener('click', () => {
    showCloneForm();
  });

  // Clone cancel
  cloneCancelBtn?.addEventListener('click', () => {
    hideCloneForm();
  });

  // Clone URL input - update path suggestion
  let urlDebounceTimer: number;
  cloneUrlInput?.addEventListener('input', () => {
    hideCloneError();
    updateCloneButton();

    clearTimeout(urlDebounceTimer);
    urlDebounceTimer = window.setTimeout(async () => {
      const url = cloneUrlInput.value.trim();
      if (isValidSshUrl(url)) {
        try {
          const path = await getDefaultClonePath(url);
          if (clonePathInput) clonePathInput.value = path;
        } catch (e) {
          // Ignore - user can set path manually
        }
      }
    }, 300);
  });

  // Clone browse button
  cloneBrowseBtn?.addEventListener('click', async () => {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      directory: true,
      title: 'Select clone destination',
    });
    if (selected && clonePathInput) {
      clonePathInput.value = selected as string;
    }
  });

  // Clone submit
  cloneSubmitBtn?.addEventListener('click', async () => {
    const url = cloneUrlInput?.value.trim();
    const path = clonePathInput?.value.trim();

    if (!url || !path) return;

    hideCloneError();

    // Check path status
    try {
      const status = await checkClonePath(url, path);

      if (status === 'DifferentRemote') {
        showCloneError('Folder contains a different repository. Choose another location.');
        return;
      }

      if (status === 'NotEmpty') {
        showCloneError("Folder exists but isn't empty. Choose another location.");
        return;
      }

      if (status === 'SameRemote') {
        // Already cloned - just add it
        const name = path.split('/').pop() || 'notes';
        const vault: Vault = {
          id: crypto.randomUUID(),
          name,
          path,
        };
        // Note: We need a command to just add existing path as vault
        // For now, show message and add
        if (currentSettings) {
          // Add vault via backend
          const added = await invoke<Vault>('add_existing_vault', { path });
          currentSettings.vaults.push(added);
          await renderVaultList();
          hideCloneForm();
        }
        return;
      }

      // Clone it
      showCloneProgress();
      const vault = await cloneVault(url, path);

      if (currentSettings) {
        currentSettings.vaults.push(vault);
        await renderVaultList();
      }

      hideCloneForm();
    } catch (error) {
      hideCloneProgress();
      showCloneError(error as string);
    }
  });

  // Git mode change
  gitModeOptions.forEach(opt => {
    opt.addEventListener('click', async () => {
      const mode = opt.getAttribute('data-mode');
      if (mode) {
        await setGitMode(mode);
        gitModeOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      }
    });
  });
}
```

**Step 5: Test the complete flow**

Run: `npm run tauri dev`
Test:
1. Click "Add Local Folder" with non-git folder → error
2. Click "Add Local Folder" with git folder → success
3. Click "Clone Repository" → form appears
4. Enter valid SSH URL → path auto-fills
5. Click Clone → repository cloned and added

---

## Task 6: Rust - Add Existing Vault Command

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add command to add existing git repo path**

```rust
#[tauri::command]
async fn add_existing_vault(app: tauri::AppHandle, path: String) -> Result<Vault, String> {
    if !is_git_repository(&path) {
        return Err("Not a git repository".to_string());
    }

    let name = std::path::Path::new(&path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("notes")
        .to_string();

    let vault = Vault {
        id: generate_id(),
        name,
        path,
    };

    let settings_path = get_settings_path(&app);
    let mut settings = load_settings(&settings_path);
    settings.vaults.push(vault.clone());
    save_settings(&settings_path, &settings);

    Ok(vault)
}
```

**Step 2: Register command**

Add `add_existing_vault` to the invoke_handler.

**Step 3: Test SameRemote case**

Run: `npm run tauri dev`
Test: Clone to existing matching repo path → should add without cloning

---

## Task 7: Final Testing & Commit

**Step 1: Test all flows**

- [ ] Add Local Folder - non-git folder → error
- [ ] Add Local Folder - git folder → success
- [ ] Clone Repository - form appears/hides
- [ ] Clone - invalid URL → button disabled
- [ ] Clone - valid URL → path auto-fills
- [ ] Clone - new path → clones and adds
- [ ] Clone - existing same remote → adds without cloning
- [ ] Clone - existing different remote → error
- [ ] Clone - existing non-empty folder → error
- [ ] Clone - network error → shows git error

**Step 2: Commit**

```bash
git add -A
git commit -m "feat(settings): add repository from local folder or clone from SSH"
```
