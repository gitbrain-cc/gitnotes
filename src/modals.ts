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

    const nameInput = document.getElementById('create-vault-name') as HTMLInputElement;
    if (nameInput) {
      nameInput.value = '';
      nameInput.focus();
    }
    const pathInput = document.getElementById('create-vault-path') as HTMLInputElement;
    if (pathInput) {
      pathInput.value = '';
    }
    updateCreateButton();
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
