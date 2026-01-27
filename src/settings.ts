import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
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

interface EditorSettings {
  font_size: number;
  font_family: string;
  line_numbers: boolean;
  line_wrapping: boolean;
  tab_size: number;
  use_tabs: boolean;
}

interface Settings {
  vaults: Vault[];
  active_vault: string | null;
  git: GitSettings;
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

export async function getTheme(): Promise<string> {
  return await invoke('get_theme');
}

export async function setTheme(theme: string): Promise<void> {
  return await invoke('set_theme', { theme });
}

export async function getEditorSettings(): Promise<EditorSettings> {
  return await invoke('get_editor_settings');
}

export async function setEditorSettings(settings: EditorSettings): Promise<void> {
  return await invoke('set_editor_settings', { settings });
}

export function applyTheme(theme: string): void {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

const FONT_STACKS: Record<string, string> = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Monaco, monospace',
  serif: 'Georgia, "Times New Roman", serif',
};

export function applyEditorSettings(settings: EditorSettings): void {
  document.documentElement.style.setProperty(
    '--base-font-size',
    `${settings.font_size}px`
  );
  document.documentElement.style.setProperty(
    '--font-family-base',
    FONT_STACKS[settings.font_family] || FONT_STACKS.system
  );
  window.dispatchEvent(new CustomEvent('editor-settings-changed', { detail: settings }));
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

export async function getVaultStats(vaultId: string): Promise<VaultStats> {
  return await invoke('get_vault_stats', { vaultId });
}

export async function setActiveVault(vaultId: string): Promise<void> {
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

  // Update theme selection
  const currentTheme = await getTheme();
  applyTheme(currentTheme);
  const themeOptions = document.querySelectorAll('.theme-option');
  themeOptions.forEach(opt => {
    const theme = opt.getAttribute('data-theme');
    opt.classList.toggle('active', theme === currentTheme);
  });
}

export function initSettings() {
  const closeBtn = document.getElementById('settings-close');
  const overlay = document.getElementById('settings-overlay');
  const addRepoBtn = document.getElementById('add-repo-btn');
  const addRepoDropdown = document.getElementById('add-repo-dropdown');
  const addRepoMenu = document.getElementById('add-repo-menu');
  const gitModeOptions = document.querySelectorAll('.git-mode-option');
  const tabs = document.querySelectorAll('.settings-tab');

  // Listen for menu event (Cmd+, or GitNotes > Settings)
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

  // Editor settings
  const fontSizeSlider = document.getElementById('font-size-slider') as HTMLInputElement;
  const fontSizeValue = document.getElementById('font-size-value');
  const fontOptions = document.querySelectorAll('.font-option');
  const lineNumbersToggle = document.getElementById('line-numbers-toggle') as HTMLInputElement;
  const lineWrappingToggle = document.getElementById('line-wrapping-toggle') as HTMLInputElement;
  const useTabsToggle = document.getElementById('use-tabs-toggle') as HTMLInputElement;
  const tabSizeBtns = document.querySelectorAll('.tab-size-btn');

  let editorSettings: EditorSettings = {
    font_size: 14,
    font_family: 'system',
    line_numbers: false,
    line_wrapping: true,
    tab_size: 2,
    use_tabs: false,
  };

  // Load and apply editor settings on init
  getEditorSettings().then((settings) => {
    editorSettings = settings;
    applyEditorSettings(settings);

    // Update UI to match loaded settings
    if (fontSizeSlider) {
      fontSizeSlider.value = String(settings.font_size);
    }
    if (fontSizeValue) {
      fontSizeValue.textContent = `${settings.font_size}px`;
    }
    fontOptions.forEach(opt => {
      const font = opt.getAttribute('data-font');
      opt.classList.toggle('active', font === settings.font_family);
    });
    if (lineNumbersToggle) {
      lineNumbersToggle.checked = settings.line_numbers;
    }
    if (lineWrappingToggle) {
      lineWrappingToggle.checked = settings.line_wrapping;
    }
    if (useTabsToggle) {
      useTabsToggle.checked = settings.use_tabs;
    }
    tabSizeBtns.forEach(btn => {
      const size = btn.getAttribute('data-size');
      btn.classList.toggle('active', size === String(settings.tab_size));
    });
  });

  // Font size slider
  fontSizeSlider?.addEventListener('input', async () => {
    const size = parseInt(fontSizeSlider.value, 10);
    if (fontSizeValue) {
      fontSizeValue.textContent = `${size}px`;
    }
    editorSettings.font_size = size;
    applyEditorSettings(editorSettings);
    await setEditorSettings(editorSettings);
  });

  // Font family options
  fontOptions.forEach(opt => {
    opt.addEventListener('click', async () => {
      const font = opt.getAttribute('data-font');
      if (font) {
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
    editorSettings.line_numbers = lineNumbersToggle.checked;
    applyEditorSettings(editorSettings);
    await setEditorSettings(editorSettings);
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

  // Tab size buttons
  tabSizeBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const size = btn.getAttribute('data-size');
      if (size) {
        tabSizeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        editorSettings.tab_size = parseInt(size, 10);
        applyEditorSettings(editorSettings);
        await setEditorSettings(editorSettings);
      }
    });
  });
}
