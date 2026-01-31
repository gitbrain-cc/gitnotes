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
  is_team?: boolean | null;
  is_team_override?: boolean | null;
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
  auto_commit: boolean;
}

interface EditorSettings {
  font_size: number;
  font_family: string;
  line_wrapping: boolean;
  tab_size: number;
  use_tabs: boolean;
  cursor_style: string;
  cursor_blink: boolean;
}

interface Settings {
  vaults: Vault[];
  active_vault: string | null;
  git: GitSettings;
}

let isOpen = false;
let previousMode: 'notes' | 'git' = 'notes';
let currentSettings: Settings | null = null;
let selectedBrainId: string | null = null;

export async function getSettings(): Promise<Settings> {
  return await invoke('get_settings');
}

export async function getAutoCommit(): Promise<boolean> {
  return await invoke<boolean>('get_auto_commit');
}

export async function setAutoCommit(enabled: boolean): Promise<void> {
  await invoke('set_auto_commit', { enabled });
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
  serif: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  literata: '"Literata", Georgia, serif',
  charter: 'Charter, "Bitstream Charter", "Sitka Text", Cambria, serif',
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

const PROVIDER_ICONS: Record<string, string> = {
  'github.com': '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>',
  'gitlab.com': '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M23.955 13.587l-1.342-4.135-2.664-8.189a.455.455 0 00-.867 0L16.418 9.45H7.582L4.918 1.263a.455.455 0 00-.867 0L1.387 9.452.045 13.587a.924.924 0 00.331 1.023L12 23.054l11.624-8.443a.92.92 0 00.331-1.024"/></svg>',
  'bitbucket.org': '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M.778 1.213a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z"/></svg>',
};

function providerIcon(provider: string): string {
  const icon = PROVIDER_ICONS[provider];
  return icon ? `${icon} ` : `${provider} · `;
}

async function renderBrainsList() {
  const container = document.getElementById('brains-list');
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

  // Auto-select if nothing selected or selected brain no longer exists
  if (!selectedBrainId || !currentSettings.vaults.find(v => v.id === selectedBrainId)) {
    selectedBrainId = currentSettings.active_vault || currentSettings.vaults[0]?.id || null;
  }

  container.innerHTML = currentSettings.vaults.map(vault => {
    const isSelected = vault.id === selectedBrainId;
    const isActive = vault.id === currentSettings!.active_vault;
    const stats = statsMap.get(vault.id);

    // Show provider icon + repo, or truncated path
    const subtitle = stats?.git_provider && stats?.git_repo
      ? `${providerIcon(stats.git_provider)}${stats.git_repo}`
      : truncatePath(vault.path, 30);

    const activeDot = isActive
      ? '<span class="brain-active-dot"></span>'
      : '';

    return `
      <li class="${isSelected ? 'active' : ''}" data-vault-id="${vault.id}">
        <div class="brain-name-row"><span>${vault.name}</span>${activeDot}</div>
        <div class="brain-subtitle">${subtitle}</div>
      </li>
    `;
  }).join('');

  // Add click handlers — selecting only, no vault activation
  container.querySelectorAll('li').forEach(item => {
    item.addEventListener('click', () => {
      const vaultId = item.getAttribute('data-vault-id');
      if (!vaultId) return;

      selectedBrainId = vaultId;
      container.querySelectorAll('li').forEach(li => li.classList.remove('active'));
      item.classList.add('active');
      renderBrainDetail();
    });
  });

  // Render detail for selected brain
  renderBrainDetail();
}

async function renderBrainDetail() {
  const container = document.getElementById('brain-detail');
  if (!container || !currentSettings || !selectedBrainId) return;

  const vault = currentSettings.vaults.find(v => v.id === selectedBrainId);
  if (!vault) return;

  let stats: VaultStats | null = null;
  try {
    stats = await getVaultStats(vault.id);
  } catch (e) {
    console.error('Failed to get stats for vault:', vault.id, e);
  }

  // Location line
  const locationLine = stats?.git_provider && stats?.git_repo
    ? `${providerIcon(stats.git_provider)}${stats.git_repo}`
    : truncatePath(vault.path, 50);

  // Git branch badge
  const branchBadge = stats?.git_branch
    ? `<span class="vault-git"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"></circle><line x1="1.05" y1="12" x2="7" y2="12"></line><line x1="17.01" y1="12" x2="22.96" y2="12"></line></svg>${stats.git_branch}</span>`
    : '';

  // Stats line
  const statsLine = stats
    ? `${stats.section_count} sections · ${stats.note_count} notes`
    : '';
  const lastModified = stats?.last_modified
    ? `<span class="vault-modified">${stats.last_modified}</span>`
    : '';

  // Resolve effective team value: override wins, else detected, else solo
  const isTeam = vault.is_team_override != null
    ? vault.is_team_override
    : (vault.is_team ?? false);

  const canRemove = currentSettings.vaults.length > 1;

  const isActive = vault.id === currentSettings.active_vault;

  container.innerHTML = `
    <div class="brain-detail-box">
      <div class="brain-detail-location">${locationLine}${branchBadge}</div>
      <div class="brain-detail-stats">
        <span>${statsLine}</span>
        ${lastModified}
      </div>
    </div>
    <div class="brain-detail-section">
      <label class="settings-section-label">Brain type</label>
      <div class="brain-team-options">
        <div class="team-option ${!isTeam ? 'active' : ''}" data-value="off">
          <svg class="team-option-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span class="team-option-title">Solo brain</span>
          <span class="team-option-tagline">Your private notebook</span>
        </div>
        <div class="team-option ${isTeam ? 'active' : ''}" data-value="on">
          <svg class="team-option-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span class="team-option-title">Team brain</span>
          <span class="team-option-tagline">Collaborate with others</span>
        </div>
      </div>
    </div>
    <div class="brain-detail-actions">
      ${!isActive ? `<button class="brain-activate-btn settings-action-btn" data-vault-id="${vault.id}">Set as active</button>` : ''}
      <button class="brain-remove-btn settings-action-btn danger" ${canRemove ? '' : 'disabled'} data-vault-id="${vault.id}">
        Remove brain
      </button>
    </div>
  `;

  // Team type radio handlers
  container.querySelectorAll('.team-option').forEach(opt => {
    opt.addEventListener('click', async () => {
      if (!currentSettings) return;
      const value = opt.getAttribute('data-value');
      container.querySelectorAll('.team-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      vault.is_team_override = value === 'on';
      await invoke('update_settings', { settings: currentSettings });
    });
  });

  // Set as active handler
  const activateBtn = container.querySelector('.brain-activate-btn');
  activateBtn?.addEventListener('click', async () => {
    const vaultId = activateBtn.getAttribute('data-vault-id');
    if (vaultId && currentSettings) {
      await setActiveVault(vaultId);
      currentSettings.active_vault = vaultId;
      window.location.reload();
    }
  });

  // Remove handler
  const removeBtn = container.querySelector('.brain-remove-btn');
  removeBtn?.addEventListener('click', async () => {
    const vaultId = removeBtn.getAttribute('data-vault-id');
    if (vaultId && currentSettings && currentSettings.vaults.length > 1) {
      await removeVault(vaultId);
      currentSettings.vaults = currentSettings.vaults.filter(v => v.id !== vaultId);
      if (currentSettings.active_vault === vaultId) {
        currentSettings.active_vault = currentSettings.vaults[0]?.id || null;
        window.location.reload();
      } else {
        selectedBrainId = currentSettings.vaults[0]?.id || null;
        await renderBrainsList();
      }
    }
  });
}

export async function openSettings() {
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

export function isSettingsOpen(): boolean {
  return isOpen;
}

async function loadSettingsData() {
  currentSettings = await getSettings();

  // Show brains column if brains tab is active (default)
  const activeTab = document.querySelector('#settings-nav li.settings-tab.active');
  if (activeTab?.getAttribute('data-tab') === 'brains') {
    document.getElementById('settings-brains-list')?.classList.remove('hidden');
  }

  await renderBrainsList();

  // Update commit mode cards
  if (currentSettings) {
    const commitOptions = document.querySelectorAll('#commit-mode-options .team-option');
    const activeValue = currentSettings.git.auto_commit ? 'auto' : 'manual';
    commitOptions.forEach(opt => {
      opt.classList.toggle('active', opt.getAttribute('data-value') === activeValue);
    });
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
  const backBtn = document.getElementById('settings-back');
  const addBrainBtn = document.getElementById('add-brain-btn');
  const addBrainDropdown = document.getElementById('add-brain-dropdown');
  const addBrainMenu = document.getElementById('add-brain-menu');
  const tabs = document.querySelectorAll('#settings-nav li.settings-tab');

  // Listen for menu event (Cmd+, or GitNotes > Settings)
  listen('open-settings', () => {
    openSettings();
  });

  backBtn?.addEventListener('click', closeSettings);

  // Close on Escape - close modals first, then dropdown, then settings
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (isCloneModalOpen()) {
        closeCloneModal();
      } else if (isCreateModalOpen()) {
        closeCreateModal();
      } else if (addBrainDropdown?.classList.contains('active')) {
        addBrainDropdown.classList.remove('active');
        addBrainMenu?.classList.add('hidden');
      } else if (isOpen) {
        closeSettings();
      }
    }
  });

  // Tab switching
  const brainsListColumn = document.getElementById('settings-brains-list');

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

      // Show/hide brains list column
      brainsListColumn?.classList.toggle('hidden', tabName !== 'brains');

      if (tabName === 'brains') {
        renderBrainsList();
      }
    });
  });

  // Add brain dropdown toggle
  addBrainBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isActive = addBrainDropdown?.classList.toggle('active');
    addBrainMenu?.classList.toggle('hidden', !isActive);
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (addBrainDropdown?.classList.contains('active')) {
      if (!addBrainDropdown.contains(e.target as Node)) {
        addBrainDropdown.classList.remove('active');
        addBrainMenu?.classList.add('hidden');
      }
    }
  });

  // Dropdown menu actions
  addBrainMenu?.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', async () => {
      const action = item.getAttribute('data-action');

      // Close dropdown
      addBrainDropdown?.classList.remove('active');
      addBrainMenu.classList.add('hidden');

      if (action === 'local') {
        const { vault, error } = await addLocalVault();
        if (error) {
          alert(error);
        } else if (vault && currentSettings) {
          currentSettings.vaults.push(vault);
          await renderBrainsList();
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
      await renderBrainsList();
    }
  };

  initCloneModal(onVaultAdded);
  initCreateModal(onVaultAdded);

  // Commit mode card handlers
  const commitModeOptions = document.querySelectorAll('#commit-mode-options .team-option');
  commitModeOptions.forEach(opt => {
    opt.addEventListener('click', async () => {
      const value = opt.getAttribute('data-value');
      commitModeOptions.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      await setAutoCommit(value === 'auto');
    });
  });


  // Font family options (used by both theme pairing and font panel)
  const fontOptions = document.querySelectorAll('.font-option');

  // Theme-to-font pairings: selecting certain themes auto-selects a font
  const THEME_FONT_MAP: Record<string, string> = {
    antropique: 'serif',
  };

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

        // Auto-select paired font if this theme has one
        const pairedFont = THEME_FONT_MAP[theme];
        if (pairedFont && editorSettings.font_family !== pairedFont) {
          editorSettings.font_family = pairedFont;
          fontOptions.forEach(o => o.classList.toggle('active', o.getAttribute('data-font') === pairedFont));
          applyEditorSettings(editorSettings);
          await setEditorSettings(editorSettings);
        }
      }
    });
  });

  // Editor settings
  const textSizeCards = document.querySelectorAll('#text-size-options .team-option');
  const tabSizeCards = document.querySelectorAll('#tab-size-cards .team-option');
  const tabWidthCards = document.querySelectorAll('#tab-width-cards .team-option');
  const tabSizeContainer = document.getElementById('tab-size-cards');
  const tabWidthContainer = document.getElementById('tab-width-cards');
  const cursorStyleCards = document.querySelectorAll('#cursor-style-options .team-option');
  const lineWrappingToggle = document.getElementById('line-wrapping-toggle') as HTMLInputElement;
  const useSpacesBtn = document.getElementById('use-spaces-btn') as HTMLButtonElement;
  const useTabsBtn = document.getElementById('use-tabs-btn') as HTMLButtonElement;
  const cursorBlinkToggle = document.getElementById('cursor-blink-toggle') as HTMLInputElement;

  let editorSettings: EditorSettings = {
    font_size: 16,
    font_family: 'system',
    line_wrapping: true,
    tab_size: 2,
    use_tabs: false,
    cursor_style: 'block',
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
    tabWidthCards.forEach(card => {
      card.classList.toggle('active', card.getAttribute('data-size') === String(settings.tab_size));
    });
    if (tabSizeContainer && tabWidthContainer) {
      tabSizeContainer.classList.toggle('hidden', settings.use_tabs);
      tabWidthContainer.classList.toggle('hidden', !settings.use_tabs);
    }
    cursorStyleCards.forEach(card => {
      card.classList.toggle('active', card.getAttribute('data-cursor') === settings.cursor_style);
    });
    fontOptions.forEach(opt => {
      opt.classList.toggle('active', opt.getAttribute('data-font') === settings.font_family);
    });
    if (lineWrappingToggle) lineWrappingToggle.checked = settings.line_wrapping;
    if (useSpacesBtn) useSpacesBtn.classList.toggle('active', !settings.use_tabs);
    if (useTabsBtn) useTabsBtn.classList.toggle('active', settings.use_tabs);
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

  // Tab width cards (when using tab character)
  tabWidthCards.forEach(card => {
    card.addEventListener('click', async () => {
      const size = card.getAttribute('data-size');
      if (size) {
        tabWidthCards.forEach(c => c.classList.remove('active'));
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

  // Use spaces/tabs toggle
  const handleTabModeChange = async (useTabs: boolean) => {
    editorSettings.use_tabs = useTabs;
    useSpacesBtn?.classList.toggle('active', !useTabs);
    useTabsBtn?.classList.toggle('active', useTabs);
    if (tabSizeContainer && tabWidthContainer) {
      tabSizeContainer.classList.toggle('hidden', useTabs);
      tabWidthContainer.classList.toggle('hidden', !useTabs);
    }
    applyEditorSettings(editorSettings);
    await setEditorSettings(editorSettings);
  };
  useSpacesBtn?.addEventListener('click', () => handleTabModeChange(false));
  useTabsBtn?.addEventListener('click', () => handleTabModeChange(true));

  // Cursor blink toggle
  cursorBlinkToggle?.addEventListener('change', async () => {
    editorSettings.cursor_blink = cursorBlinkToggle.checked;
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
}
