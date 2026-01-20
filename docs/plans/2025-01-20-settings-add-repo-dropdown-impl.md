# Settings Add Repository Dropdown Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the two buttons ("+ Add Local Folder", "+ Clone Repository") in Settings with a single "+ Add Repository" dropdown that includes all three options: Add Local, Clone, and Create.

**Architecture:** Extract shared modal code to `src/modals.ts`, update `index.html` with dropdown UI and create modal, refactor both `settings.ts` and `onboarding.ts` to use shared module.

**Tech Stack:** Vanilla TypeScript, Tauri IPC, CSS dropdowns (no library)

---

### Task 1: Create shared modals module

**Files:**
- Create: `src/modals.ts`

**Step 1: Create the modals module with clone modal helpers**

```typescript
// src/modals.ts
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

interface Vault {
  id: string;
  name: string;
  path: string;
}

type ClonePathStatus = 'Empty' | 'SameRemote' | 'DifferentRemote' | 'NotGit' | 'NotEmpty';

// ============ Clone Modal ============

let cloneModalOpen = false;

export function isCloneModalOpen(): boolean {
  return cloneModalOpen;
}

export function openCloneModal(): void {
  const overlay = document.getElementById('clone-overlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    cloneModalOpen = true;
    document.getElementById('clone-url')?.focus();
  }
}

export function closeCloneModal(): void {
  const overlay = document.getElementById('clone-overlay');
  const urlInput = document.getElementById('clone-url') as HTMLInputElement;
  const pathInput = document.getElementById('clone-path') as HTMLInputElement;
  const errorDiv = document.getElementById('clone-error');
  const progressDiv = document.getElementById('clone-progress');
  const submitBtn = document.getElementById('clone-submit-btn') as HTMLButtonElement;

  if (overlay) {
    overlay.classList.add('hidden');
    cloneModalOpen = false;
  }

  // Reset form
  if (urlInput) urlInput.value = '';
  if (pathInput) pathInput.value = '';
  if (errorDiv) errorDiv.classList.add('hidden');
  if (progressDiv) progressDiv.classList.add('hidden');
  if (submitBtn) submitBtn.disabled = true;
}

export function showCloneError(message: string): void {
  const errorDiv = document.getElementById('clone-error');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
  }
}

export function hideCloneError(): void {
  const errorDiv = document.getElementById('clone-error');
  if (errorDiv) errorDiv.classList.add('hidden');
}

export function showCloneProgress(): void {
  const progressDiv = document.getElementById('clone-progress');
  const submitBtn = document.getElementById('clone-submit-btn') as HTMLButtonElement;
  const cancelBtn = document.getElementById('clone-cancel-btn') as HTMLButtonElement;

  if (progressDiv) progressDiv.classList.remove('hidden');
  if (submitBtn) submitBtn.disabled = true;
  if (cancelBtn) cancelBtn.disabled = true;
}

export function hideCloneProgress(): void {
  const progressDiv = document.getElementById('clone-progress');
  const cancelBtn = document.getElementById('clone-cancel-btn') as HTMLButtonElement;

  if (progressDiv) progressDiv.classList.add('hidden');
  if (cancelBtn) cancelBtn.disabled = false;
}

export function isValidSshUrl(url: string): boolean {
  return /^git@[\w.-]+:[\w./-]+$/.test(url) || /^ssh:\/\/[\w@.-]+\/[\w./-]+$/.test(url);
}

export function updateCloneButton(): void {
  const urlInput = document.getElementById('clone-url') as HTMLInputElement;
  const submitBtn = document.getElementById('clone-submit-btn') as HTMLButtonElement;

  if (urlInput && submitBtn) {
    submitBtn.disabled = !isValidSshUrl(urlInput.value.trim());
  }
}

async function checkClonePath(url: string, path: string): Promise<ClonePathStatus> {
  return await invoke('check_clone_path', { url, path });
}

async function cloneVault(url: string, path: string): Promise<Vault> {
  return await invoke('clone_vault', { url, path });
}

async function getDefaultClonePath(url: string): Promise<string> {
  return await invoke('get_default_clone_path', { url });
}

export function initCloneModal(onSuccess: (vault: Vault) => Promise<void>): void {
  const cloneUrlInput = document.getElementById('clone-url') as HTMLInputElement;
  const clonePathInput = document.getElementById('clone-path') as HTMLInputElement;
  const cloneBrowseBtn = document.getElementById('clone-browse-btn');
  const cloneSubmitBtn = document.getElementById('clone-submit-btn') as HTMLButtonElement;
  const cloneCancelBtn = document.getElementById('clone-cancel-btn');
  const cloneModalCloseBtn = document.getElementById('clone-modal-close');
  const cloneOverlay = document.getElementById('clone-overlay');

  // Close handlers
  cloneModalCloseBtn?.addEventListener('click', closeCloneModal);
  cloneCancelBtn?.addEventListener('click', closeCloneModal);

  // Backdrop click
  cloneOverlay?.addEventListener('click', (e) => {
    if (e.target === cloneOverlay) {
      closeCloneModal();
    }
  });

  // URL input - update path suggestion
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

  // Browse button
  cloneBrowseBtn?.addEventListener('click', async () => {
    const selected = await open({
      directory: true,
      title: 'Select clone destination',
    });
    if (selected && clonePathInput) {
      clonePathInput.value = selected as string;
    }
  });

  // Submit
  cloneSubmitBtn?.addEventListener('click', async () => {
    const url = cloneUrlInput?.value.trim();
    const path = clonePathInput?.value.trim();

    if (!url || !path) return;

    hideCloneError();

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
        try {
          const added = await invoke<Vault>('add_existing_vault', { path });
          await onSuccess(added);
          closeCloneModal();
        } catch (e) {
          showCloneError(e as string);
        }
        return;
      }

      // Clone it
      showCloneProgress();
      const vault = await cloneVault(url, path);
      await onSuccess(vault);
      closeCloneModal();
    } catch (error) {
      hideCloneProgress();
      showCloneError(error as string);
    }
  });
}

// ============ Create Modal ============

let createModalOpen = false;

export function isCreateModalOpen(): boolean {
  return createModalOpen;
}

export function openCreateModal(): void {
  const overlay = document.getElementById('create-overlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    createModalOpen = true;

    // Initialize with defaults
    const nameInput = document.getElementById('create-vault-name') as HTMLInputElement;
    const pathInput = document.getElementById('create-vault-path') as HTMLInputElement;
    if (nameInput && pathInput) {
      nameInput.value = 'notes';
      getDefaultVaultPath('notes').then(path => {
        pathInput.value = path;
      }).catch(() => {});
      updateCreateButton();
      nameInput.focus();
      nameInput.select();
    }
  }
}

export function closeCreateModal(): void {
  const overlay = document.getElementById('create-overlay');
  const nameInput = document.getElementById('create-vault-name') as HTMLInputElement;
  const pathInput = document.getElementById('create-vault-path') as HTMLInputElement;
  const errorDiv = document.getElementById('create-vault-error');
  const submitBtn = document.getElementById('create-vault-btn') as HTMLButtonElement;

  if (overlay) {
    overlay.classList.add('hidden');
    createModalOpen = false;
  }

  // Reset form
  if (nameInput) nameInput.value = '';
  if (pathInput) pathInput.value = '';
  if (errorDiv) errorDiv.classList.add('hidden');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Create';
  }
}

export function showCreateError(message: string): void {
  const errorDiv = document.getElementById('create-vault-error');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
  }
}

export function hideCreateError(): void {
  const errorDiv = document.getElementById('create-vault-error');
  if (errorDiv) errorDiv.classList.add('hidden');
}

export function updateCreateButton(): void {
  const nameInput = document.getElementById('create-vault-name') as HTMLInputElement;
  const pathInput = document.getElementById('create-vault-path') as HTMLInputElement;
  const createBtn = document.getElementById('create-vault-btn') as HTMLButtonElement;

  if (nameInput && pathInput && createBtn) {
    const isValid = nameInput.value.trim().length > 0 && pathInput.value.trim().length > 0;
    createBtn.disabled = !isValid;
  }
}

async function createVault(path: string, name: string): Promise<Vault> {
  return await invoke('create_vault', { path, name });
}

async function getDefaultVaultPath(name: string): Promise<string> {
  return await invoke('get_default_vault_path', { name });
}

export function initCreateModal(onSuccess: (vault: Vault) => Promise<void>): void {
  const nameInput = document.getElementById('create-vault-name') as HTMLInputElement;
  const pathInput = document.getElementById('create-vault-path') as HTMLInputElement;
  const browseBtn = document.getElementById('create-browse-btn');
  const submitBtn = document.getElementById('create-vault-btn') as HTMLButtonElement;
  const cancelBtn = document.getElementById('create-cancel-btn');
  const closeBtn = document.getElementById('create-modal-close');
  const overlay = document.getElementById('create-overlay');

  // Close handlers
  closeBtn?.addEventListener('click', closeCreateModal);
  cancelBtn?.addEventListener('click', closeCreateModal);

  // Backdrop click
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeCreateModal();
    }
  });

  // Name input - update path suggestion
  let nameDebounceTimer: number;
  nameInput?.addEventListener('input', () => {
    hideCreateError();
    updateCreateButton();

    clearTimeout(nameDebounceTimer);
    nameDebounceTimer = window.setTimeout(async () => {
      const name = nameInput.value.trim();
      if (name && pathInput) {
        try {
          const defaultPath = await getDefaultVaultPath(name);
          pathInput.value = defaultPath;
        } catch (e) {
          // Ignore
        }
      }
    }, 300);
  });

  // Browse button
  browseBtn?.addEventListener('click', async () => {
    const selected = await open({
      directory: true,
      title: 'Select vault location',
    });
    if (selected && pathInput) {
      pathInput.value = selected as string;
      updateCreateButton();
    }
  });

  // Submit
  submitBtn?.addEventListener('click', async () => {
    const name = nameInput?.value.trim();
    const path = pathInput?.value.trim();

    if (!name || !path) return;

    hideCreateError();

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating...';
      const vault = await createVault(path, name);
      await onSuccess(vault);
      closeCreateModal();
    } catch (error) {
      showCreateError(error as string);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create';
    }
  });
}
```

**Step 2: Verify the file compiles**

Run: `npm run tauri dev` (check for TypeScript errors in console)
Expected: No import/compile errors

---

### Task 2: Add Create Modal HTML to index.html

**Files:**
- Modify: `index.html:258` (after clone-overlay)

**Step 1: Add the create modal HTML**

Insert after the `</div>` closing `#clone-overlay` (line 258):

```html
  <div id="create-overlay" class="modal-overlay hidden">
    <div id="create-modal" class="clone-modal">
      <div class="clone-modal-header">
        <h3>Create Repository</h3>
        <button id="create-modal-close" class="modal-close">&times;</button>
      </div>
      <div class="clone-modal-content">
        <div class="clone-field">
          <label for="create-vault-name">Repository name</label>
          <input type="text" id="create-vault-name" placeholder="notes" autocomplete="off" spellcheck="false">
        </div>
        <div class="clone-field">
          <label for="create-vault-path">Location</label>
          <div class="clone-path-row">
            <input type="text" id="create-vault-path" readonly>
            <button id="create-browse-btn" class="clone-browse">Browse</button>
          </div>
        </div>
        <div id="create-vault-error" class="clone-error hidden"></div>
        <div class="clone-actions">
          <button id="create-cancel-btn" class="settings-action-btn secondary">Cancel</button>
          <button id="create-vault-btn" class="settings-action-btn" disabled>Create</button>
        </div>
      </div>
    </div>
  </div>
```

**Step 2: Verify modal renders correctly**

Run: `npm run tauri dev`
Expected: No HTML errors, modal hidden by default

---

### Task 3: Replace two buttons with dropdown in index.html

**Files:**
- Modify: `index.html:138-141` (vault-actions div)

**Step 1: Replace the vault-actions content**

Change from:
```html
<div id="vault-actions">
  <button id="add-local-btn" class="settings-action-btn">+ Add Local Folder</button>
  <button id="clone-repo-btn" class="settings-action-btn secondary">+ Clone Repository</button>
</div>
```

To:
```html
<div id="vault-actions">
  <div id="add-repo-dropdown" class="add-repo-dropdown">
    <button id="add-repo-btn" class="settings-action-btn">
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
```

---

### Task 4: Add dropdown CSS styles

**Files:**
- Modify: `src/styles/main.css` (after vault-actions section ~line 1208)

**Step 1: Add dropdown styles**

Insert after line 1208 (after `#vault-actions .settings-action-btn.secondary`):

```css
/* Add repo dropdown */
.add-repo-dropdown {
  position: relative;
  width: 100%;
}

#add-repo-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

#add-repo-btn .dropdown-chevron {
  transition: transform 0.15s ease;
}

.add-repo-dropdown.active #add-repo-btn .dropdown-chevron {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 100;
  margin-top: 4px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.dropdown-menu.hidden {
  display: none;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 10px 12px;
  font-size: 13px;
  color: var(--text-primary);
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
}

.dropdown-item:hover {
  background: var(--bg-tertiary);
}
```

**Step 2: Verify dropdown renders**

Run: `npm run tauri dev`, open Settings
Expected: Single button with chevron visible

---

### Task 5: Update settings.ts to use shared modals and add dropdown

**Files:**
- Modify: `src/settings.ts`

**Step 1: Remove duplicated clone modal code**

Remove lines 32-36 (checkClonePath, cloneVault, getDefaultClonePath functions).
Remove lines 120-195 (clone modal state and helpers: cloneModalOpen, openCloneModal, closeCloneModal, showCloneError, hideCloneError, showCloneProgress, hideCloneProgress, isValidSshUrl, updateCloneButton).

**Step 2: Add imports from modals.ts**

At top of file, add:
```typescript
import {
  initCloneModal,
  initCreateModal,
  openCloneModal,
  closeCloneModal,
  openCreateModal,
  closeCreateModal,
  isCloneModalOpen,
  isCreateModalOpen,
} from './modals';
```

**Step 3: Update initSettings function**

Replace the old button event listeners and clone modal setup with:

```typescript
export function initSettings() {
  const closeBtn = document.getElementById('settings-close');
  const overlay = document.getElementById('settings-overlay');
  const addRepoBtn = document.getElementById('add-repo-btn');
  const addRepoDropdown = document.getElementById('add-repo-dropdown');
  const addRepoMenu = document.getElementById('add-repo-menu');
  const gitModeOptions = document.querySelectorAll('.git-mode-option');
  const tabs = document.querySelectorAll('.settings-tab');

  // Listen for menu event (Cmd+, or Git Notes > Settings)
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

  // Close on Escape - close modals first, then dropdown, then settings
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (isCloneModalOpen()) {
        closeCloneModal();
      } else if (isCreateModalOpen()) {
        closeCreateModal();
      } else if (addRepoDropdown?.classList.contains('active')) {
        addRepoDropdown.classList.remove('active');
        addRepoMenu?.classList.add('hidden');
      } else if (isOpen) {
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

  // Add repo dropdown toggle
  addRepoBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isActive = addRepoDropdown?.classList.toggle('active');
    addRepoMenu?.classList.toggle('hidden', !isActive);
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (addRepoDropdown?.classList.contains('active')) {
      if (!addRepoDropdown.contains(e.target as Node)) {
        addRepoDropdown.classList.remove('active');
        addRepoMenu?.classList.add('hidden');
      }
    }
  });

  // Dropdown menu actions
  addRepoMenu?.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', async () => {
      const action = item.getAttribute('data-action');

      // Close dropdown
      addRepoDropdown?.classList.remove('active');
      addRepoMenu.classList.add('hidden');

      if (action === 'local') {
        const { vault, error } = await addLocalVault();
        if (error) {
          alert(error);
        } else if (vault && currentSettings) {
          currentSettings.vaults.push(vault);
          await renderVaultList();
        }
      } else if (action === 'clone') {
        openCloneModal();
      } else if (action === 'create') {
        openCreateModal();
      }
    });
  });

  // Initialize shared modals
  const onVaultAdded = async (vault: Vault) => {
    if (currentSettings) {
      currentSettings.vaults.push(vault);
      await renderVaultList();
    }
  };

  initCloneModal(onVaultAdded);
  initCreateModal(onVaultAdded);

  // Git mode change
  gitModeOptions.forEach(opt => {
    opt.addEventListener('click', async () => {
      const mode = opt.getAttribute('data-mode');
      if (mode) {
        await setGitMode(mode);
        gitModeOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        // Show/hide interval setting
        const intervalSetting = document.getElementById('commit-interval-setting');
        if (intervalSetting) {
          intervalSetting.classList.toggle('hidden', mode !== 'smart');
        }
      }
    });
  });

  // Commit interval change
  const intervalInput = document.getElementById('commit-interval-input') as HTMLInputElement;
  intervalInput?.addEventListener('change', async () => {
    const interval = parseInt(intervalInput.value, 10);
    if (interval >= 1 && interval <= 120) {
      await setCommitInterval(interval);
    }
  });

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
}
```

---

### Task 6: Update onboarding.ts to use shared modals

**Files:**
- Modify: `src/onboarding.ts`

**Step 1: Remove duplicated code**

Remove the following duplicated functions:
- Lines 59-69: `checkClonePath`, `cloneVault`, `getDefaultClonePath`
- Lines 71-142: Clone modal helpers (`openCloneModal`, `closeCloneModal`, `showCloneError`, etc.)

**Step 2: Add imports**

At top of file:
```typescript
import {
  initCloneModal,
  openCloneModal,
  closeCloneModal,
  isCloneModalOpen,
} from './modals';
```

**Step 3: Simplify initOnboarding**

Keep the onboarding-specific create vault flow inline (since it uses a different HTML structure in the onboarding step), but use shared clone modal.

Update the vault option click handler for 'clone':
```typescript
} else if (action === 'clone') {
  openCloneModal();
}
```

Remove the clone modal event listener setup (lines 264-356) and replace with:
```typescript
// Initialize clone modal for onboarding context
initCloneModal(async () => {
  await completeOnboarding();
});
```

---

### Task 7: Test end-to-end

**Step 1: Test Settings dropdown**
- Open Settings > Repositories
- Click "+ Add Repository"
- Verify dropdown shows three options
- Click outside - dropdown closes
- Press Escape - dropdown closes

**Step 2: Test Add Local Folder**
- Click dropdown > "Add Local Folder"
- Native folder picker opens
- Select folder - repo added to list

**Step 3: Test Clone Repository**
- Click dropdown > "Clone Repository"
- Clone modal opens
- Enter valid SSH URL
- Path auto-populates
- Clone works

**Step 4: Test Create Repository**
- Click dropdown > "Create Repository"
- Create modal opens
- Enter name, path auto-populates
- Create works - new repo with git init

**Step 5: Test Onboarding**
- Reset app (remove all vaults from settings)
- Onboarding appears
- All three options work: Local, Clone, Create

---

### Task 8: Commit

```bash
git add src/modals.ts src/settings.ts src/onboarding.ts index.html src/styles/main.css
git commit -m "feat: add unified 'Add Repository' dropdown in settings

- Replace two buttons with single dropdown menu
- Add 'Create Repository' option (init new git repo)
- Extract shared modal code to src/modals.ts
- Reuse clone/create modals between settings and onboarding"
```
