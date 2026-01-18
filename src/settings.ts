import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface Vault {
  id: string;
  name: string;
  path: string;
}

interface VaultStats {
  vault_id: string;
  section_count: number;
  note_count: number;
  last_modified: string | null;
  is_git_repo: boolean;
  git_branch: string | null;
  git_provider: string | null;
  git_repo: string | null;
}

interface GitSettings {
  commit_mode: string;
  commit_interval: number;
}

interface Settings {
  vaults: Vault[];
  active_vault: string | null;
  git: GitSettings;
}

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

let isOpen = false;
let currentSettings: Settings | null = null;

export async function getSettings(): Promise<Settings> {
  return await invoke('get_settings');
}

export async function getGitMode(): Promise<string> {
  return await invoke('get_git_mode');
}

export async function setGitMode(mode: string): Promise<void> {
  return await invoke('set_git_mode', { mode });
}

export async function getCommitInterval(): Promise<number> {
  return await invoke('get_commit_interval');
}

export async function setCommitInterval(interval: number): Promise<void> {
  return await invoke('set_commit_interval', { interval });
}

async function addLocalVault(): Promise<{ vault: Vault | null; error: string | null }> {
  try {
    const vault = await invoke<Vault | null>('add_vault');
    return { vault, error: null };
  } catch (error) {
    return { vault: null, error: error as string };
  }
}

async function removeVault(vaultId: string): Promise<void> {
  return await invoke('remove_vault', { vaultId });
}

async function getVaultStats(vaultId: string): Promise<VaultStats> {
  return await invoke('get_vault_stats', { vaultId });
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

// Clone modal state and helpers
let cloneModalOpen = false;

function openCloneModal() {
  const overlay = document.getElementById('clone-overlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    cloneModalOpen = true;
    document.getElementById('clone-url')?.focus();
  }
}

function closeCloneModal() {
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

function showCloneError(message: string) {
  const errorDiv = document.getElementById('clone-error');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
  }
}

function hideCloneError() {
  const errorDiv = document.getElementById('clone-error');
  if (errorDiv) errorDiv.classList.add('hidden');
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
  return /^git@[\w.-]+:[\w./-]+$/.test(url) || /^ssh:\/\/[\w@.-]+\/[\w./-]+$/.test(url);
}

function updateCloneButton() {
  const urlInput = document.getElementById('clone-url') as HTMLInputElement;
  const submitBtn = document.getElementById('clone-submit-btn') as HTMLButtonElement;

  if (urlInput && submitBtn) {
    submitBtn.disabled = !isValidSshUrl(urlInput.value.trim());
  }
}

async function renderVaultList() {
  const container = document.getElementById('vault-list');
  if (!container || !currentSettings) return;

  // Fetch stats for all vaults in parallel
  const statsMap = new Map<string, VaultStats>();
  await Promise.all(
    currentSettings.vaults.map(async (vault) => {
      try {
        const stats = await getVaultStats(vault.id);
        statsMap.set(vault.id, stats);
      } catch (e) {
        console.error('Failed to get stats for vault:', vault.id, e);
      }
    })
  );

  container.innerHTML = currentSettings.vaults.map(vault => {
    const isActive = vault.id === currentSettings!.active_vault ||
                     (!currentSettings!.active_vault && currentSettings!.vaults[0]?.id === vault.id);
    const stats = statsMap.get(vault.id);
    const statsLine = stats
      ? `${stats.section_count} sections · ${stats.note_count} notes`
      : '';
    const lastModified = stats?.last_modified || '';

    // Show git provider/repo if available, otherwise show truncated local path
    const locationLine = stats?.git_provider && stats?.git_repo
      ? `${stats.git_provider} · ${stats.git_repo}`
      : truncatePath(vault.path, 50);

    const gitBranch = stats?.git_branch
      ? `<span class="vault-git"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"></circle><line x1="1.05" y1="12" x2="7" y2="12"></line><line x1="17.01" y1="12" x2="22.96" y2="12"></line></svg>${stats.git_branch}</span>`
      : '';

    return `
      <div class="vault-item ${isActive ? 'active' : ''}" data-vault-id="${vault.id}">
        <div class="vault-radio"></div>
        <div class="vault-info">
          <div class="vault-header">
            <div class="vault-name">${vault.name}</div>
            ${gitBranch}
          </div>
          <div class="vault-path">${locationLine}</div>
          <div class="vault-stats">
            <span class="vault-counts">${statsLine}</span>
            ${lastModified ? `<span class="vault-modified">${lastModified}</span>` : ''}
          </div>
        </div>
        <button class="vault-remove" data-vault-id="${vault.id}" title="Remove repository">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18"></path>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
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
          await renderVaultList();
        }
      }
    });
  });
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
  await renderVaultList();

  // Update git mode selection
  if (currentSettings) {
    const options = document.querySelectorAll('.git-mode-option');
    options.forEach(opt => {
      const mode = opt.getAttribute('data-mode');
      opt.classList.toggle('active', mode === currentSettings!.git.commit_mode);
    });
  }

  // Update interval input
  const intervalInput = document.getElementById('commit-interval-input') as HTMLInputElement;
  const intervalSetting = document.getElementById('commit-interval-setting');
  if (intervalInput && currentSettings) {
    intervalInput.value = String(currentSettings.git.commit_interval || 30);
  }
  // Show/hide interval setting based on mode
  if (intervalSetting) {
    intervalSetting.classList.toggle('hidden', currentSettings?.git.commit_mode !== 'smart');
  }
}

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
  const cloneModalCloseBtn = document.getElementById('clone-modal-close');
  const cloneOverlay = document.getElementById('clone-overlay');
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

  // Clone modal close button
  cloneModalCloseBtn?.addEventListener('click', closeCloneModal);

  // Clone modal backdrop click
  cloneOverlay?.addEventListener('click', (e) => {
    if (e.target === cloneOverlay) {
      closeCloneModal();
    }
  });

  // Close on Escape - close clone modal first, then settings modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (cloneModalOpen) {
        closeCloneModal();
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

  // Add local folder
  addLocalBtn?.addEventListener('click', async () => {
    const { vault, error } = await addLocalVault();
    if (error) {
      alert(error);
    } else if (vault && currentSettings) {
      currentSettings.vaults.push(vault);
      await renderVaultList();
    }
  });

  // Clone repository - open modal
  cloneRepoBtn?.addEventListener('click', () => {
    openCloneModal();
  });

  // Clone cancel
  cloneCancelBtn?.addEventListener('click', () => {
    closeCloneModal();
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
        // Already cloned - just add it via backend
        // Note: add_existing_vault command will be added in Task 6
        try {
          const added = await invoke<Vault>('add_existing_vault', { path });
          if (currentSettings) {
            currentSettings.vaults.push(added);
            await renderVaultList();
          }
          closeCloneModal();
        } catch (e) {
          showCloneError(e as string);
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

      closeCloneModal();
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
}
