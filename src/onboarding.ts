import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { getSettings, applyTheme, getTheme } from './settings';

interface Vault {
  id: string;
  name: string;
  path: string;
}

interface Settings {
  vaults: Vault[];
  active_vault: string | null;
}

type ClonePathStatus = 'Empty' | 'SameRemote' | 'DifferentRemote' | 'NotGit' | 'NotEmpty';

// Check if onboarding is needed (no vaults configured)
export async function checkOnboarding(): Promise<boolean> {
  const settings = await getSettings();
  return settings.vaults.length === 0;
}

export function showOnboarding(): void {
  const overlay = document.getElementById('onboarding-overlay');
  overlay?.classList.remove('hidden');
}

function hideOnboarding(): void {
  const overlay = document.getElementById('onboarding-overlay');
  overlay?.classList.add('hidden');
}

function showStep(stepName: string): void {
  const steps = document.querySelectorAll('.onboarding-step');
  steps.forEach(step => {
    const name = step.getAttribute('data-step');
    step.classList.toggle('hidden', name !== stepName);
  });
}

async function addLocalVault(): Promise<{ vault: Vault | null; error: string | null }> {
  try {
    const vault = await invoke<Vault | null>('add_vault');
    return { vault, error: null };
  } catch (error) {
    return { vault: null, error: error as string };
  }
}

async function createVault(path: string, name: string): Promise<Vault> {
  return await invoke('create_vault', { path, name });
}

async function getDefaultVaultPath(name: string): Promise<string> {
  return await invoke('get_default_vault_path', { name });
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

// Open clone modal (reuse from settings)
function openCloneModal(): void {
  const overlay = document.getElementById('clone-overlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    document.getElementById('clone-url')?.focus();
  }
}

function closeCloneModal(): void {
  const overlay = document.getElementById('clone-overlay');
  const urlInput = document.getElementById('clone-url') as HTMLInputElement;
  const pathInput = document.getElementById('clone-path') as HTMLInputElement;
  const errorDiv = document.getElementById('clone-error');
  const progressDiv = document.getElementById('clone-progress');
  const submitBtn = document.getElementById('clone-submit-btn') as HTMLButtonElement;

  if (overlay) {
    overlay.classList.add('hidden');
  }

  // Reset form
  if (urlInput) urlInput.value = '';
  if (pathInput) pathInput.value = '';
  if (errorDiv) errorDiv.classList.add('hidden');
  if (progressDiv) progressDiv.classList.add('hidden');
  if (submitBtn) submitBtn.disabled = true;
}

function showCloneError(message: string): void {
  const errorDiv = document.getElementById('clone-error');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
  }
}

function hideCloneError(): void {
  const errorDiv = document.getElementById('clone-error');
  if (errorDiv) errorDiv.classList.add('hidden');
}

function showCloneProgress(): void {
  const progressDiv = document.getElementById('clone-progress');
  const submitBtn = document.getElementById('clone-submit-btn') as HTMLButtonElement;
  const cancelBtn = document.getElementById('clone-cancel-btn') as HTMLButtonElement;

  if (progressDiv) progressDiv.classList.remove('hidden');
  if (submitBtn) submitBtn.disabled = true;
  if (cancelBtn) cancelBtn.disabled = true;
}

function hideCloneProgress(): void {
  const progressDiv = document.getElementById('clone-progress');
  const cancelBtn = document.getElementById('clone-cancel-btn') as HTMLButtonElement;

  if (progressDiv) progressDiv.classList.add('hidden');
  if (cancelBtn) cancelBtn.disabled = false;
}

function isValidSshUrl(url: string): boolean {
  return /^git@[\w.-]+:[\w./-]+$/.test(url) || /^ssh:\/\/[\w@.-]+\/[\w./-]+$/.test(url);
}

function updateCloneButton(): void {
  const urlInput = document.getElementById('clone-url') as HTMLInputElement;
  const submitBtn = document.getElementById('clone-submit-btn') as HTMLButtonElement;

  if (urlInput && submitBtn) {
    submitBtn.disabled = !isValidSshUrl(urlInput.value.trim());
  }
}

async function completeOnboarding(): Promise<void> {
  hideOnboarding();
  closeCloneModal();
  window.location.reload();
}

export function initOnboarding(): void {
  // Get Started button
  const startBtn = document.getElementById('onboarding-start');
  startBtn?.addEventListener('click', () => {
    showStep('setup');
  });

  // Vault options
  const vaultOptions = document.querySelectorAll('.vault-option');
  vaultOptions.forEach(option => {
    option.addEventListener('click', async () => {
      const action = option.getAttribute('data-action');

      if (action === 'open-local') {
        const { vault, error } = await addLocalVault();
        if (error) {
          alert(error);
        } else if (vault) {
          await completeOnboarding();
        }
      } else if (action === 'clone') {
        openCloneModal();
      } else if (action === 'create') {
        showStep('create');
        // Initialize default path
        const nameInput = document.getElementById('new-vault-name') as HTMLInputElement;
        const pathInput = document.getElementById('new-vault-path') as HTMLInputElement;
        if (nameInput && pathInput) {
          nameInput.value = 'notes';
          try {
            const defaultPath = await getDefaultVaultPath('notes');
            pathInput.value = defaultPath;
          } catch (e) {
            // Ignore - user can browse
          }
          updateCreateButton();
          nameInput.focus();
          nameInput.select();
        }
      }
    });
  });

  // Back button from create step
  const backBtn = document.getElementById('create-back-btn');
  backBtn?.addEventListener('click', () => {
    showStep('setup');
  });

  // Create vault form
  const nameInput = document.getElementById('new-vault-name') as HTMLInputElement;
  const pathInput = document.getElementById('new-vault-path') as HTMLInputElement;
  const browseBtn = document.getElementById('browse-vault-path');
  const createBtn = document.getElementById('create-vault-btn') as HTMLButtonElement;
  const errorDiv = document.getElementById('create-vault-error');

  // Update path when name changes
  let nameDebounceTimer: number;
  nameInput?.addEventListener('input', () => {
    clearTimeout(nameDebounceTimer);
    updateCreateButton();

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

  // Browse for location
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

  // Create button
  createBtn?.addEventListener('click', async () => {
    const name = nameInput?.value.trim();
    const path = pathInput?.value.trim();

    if (!name || !path) return;

    // Clear previous error
    if (errorDiv) {
      errorDiv.classList.add('hidden');
    }

    try {
      createBtn.disabled = true;
      createBtn.textContent = 'Creating...';
      await createVault(path, name);
      await completeOnboarding();
    } catch (error) {
      if (errorDiv) {
        errorDiv.textContent = error as string;
        errorDiv.classList.remove('hidden');
      }
      createBtn.disabled = false;
      createBtn.textContent = 'Create';
    }
  });

  // Clone modal handlers (for onboarding context)
  const cloneUrlInput = document.getElementById('clone-url') as HTMLInputElement;
  const clonePathInput = document.getElementById('clone-path') as HTMLInputElement;
  const cloneBrowseBtn = document.getElementById('clone-browse-btn');
  const cloneSubmitBtn = document.getElementById('clone-submit-btn') as HTMLButtonElement;
  const cloneCancelBtn = document.getElementById('clone-cancel-btn');
  const cloneModalCloseBtn = document.getElementById('clone-modal-close');
  const cloneOverlay = document.getElementById('clone-overlay');

  // Clone modal close
  cloneModalCloseBtn?.addEventListener('click', closeCloneModal);
  cloneCancelBtn?.addEventListener('click', closeCloneModal);

  // Clone modal backdrop click
  cloneOverlay?.addEventListener('click', (e) => {
    if (e.target === cloneOverlay) {
      closeCloneModal();
    }
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
          // Ignore
        }
      }
    }, 300);
  });

  // Clone browse button
  cloneBrowseBtn?.addEventListener('click', async () => {
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
          await invoke('add_existing_vault', { path });
          await completeOnboarding();
        } catch (e) {
          showCloneError(e as string);
        }
        return;
      }

      // Clone it
      showCloneProgress();
      await cloneVault(url, path);
      await completeOnboarding();
    } catch (error) {
      hideCloneProgress();
      showCloneError(error as string);
    }
  });

  // Escape key to close clone modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const cloneOverlay = document.getElementById('clone-overlay');
      if (cloneOverlay && !cloneOverlay.classList.contains('hidden')) {
        closeCloneModal();
      }
    }
  });
}

function updateCreateButton(): void {
  const nameInput = document.getElementById('new-vault-name') as HTMLInputElement;
  const pathInput = document.getElementById('new-vault-path') as HTMLInputElement;
  const createBtn = document.getElementById('create-vault-btn') as HTMLButtonElement;

  if (nameInput && pathInput && createBtn) {
    const isValid = nameInput.value.trim().length > 0 && pathInput.value.trim().length > 0;
    createBtn.disabled = !isValid;
  }
}
