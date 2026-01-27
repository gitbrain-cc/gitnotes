import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import {
  initCloneModal,
  openCloneModal,
  closeCloneModal,
  isCloneModalOpen,
} from './modals';

interface Vault {
  id: string;
  name: string;
  path: string;
}

interface VaultValidation {
  has_vaults: boolean;
  active_vault_valid: boolean;
  invalid_vault_id: string | null;
  invalid_vault_path: string | null;
  invalid_vault_name: string | null;
}

let invalidVaultInfo: { id: string; name: string; path: string } | null = null;

// Check if onboarding is needed (no vaults configured or active vault path missing)
export async function checkOnboarding(): Promise<boolean> {
  const validation = await invoke<VaultValidation>('validate_active_vault');

  if (!validation.has_vaults) {
    return true;
  }

  if (!validation.active_vault_valid) {
    // Vault exists in settings but path is missing
    if (validation.invalid_vault_id && validation.invalid_vault_name && validation.invalid_vault_path) {
      invalidVaultInfo = {
        id: validation.invalid_vault_id,
        name: validation.invalid_vault_name,
        path: validation.invalid_vault_path,
      };
    }
    return true;
  }

  return false;
}

export function showOnboarding(): void {
  const overlay = document.getElementById('onboarding-overlay');
  overlay?.classList.remove('hidden');

  // If vault path was missing, skip welcome and go straight to setup
  if (invalidVaultInfo) {
    showStep('setup');

    const errorBanner = document.getElementById('onboarding-error');
    if (errorBanner) {
      errorBanner.innerHTML = `
        <strong>Repository not found:</strong> "${invalidVaultInfo.name}"
        <code title="${invalidVaultInfo.path}">${invalidVaultInfo.path}</code>
        Please select or create a new repository.
      `;
      errorBanner.classList.remove('hidden');
    }
  }
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

async function completeOnboarding(): Promise<void> {
  // Remove the invalid vault from settings before reloading
  if (invalidVaultInfo) {
    try {
      await invoke('remove_vault', { vaultId: invalidVaultInfo.id });
    } catch {
      // Ignore errors - the vault might already be gone
    }
  }

  hideOnboarding();
  // Note: closeCloneModal() is called by the shared modal after success
  window.location.reload();
}

export function initOnboarding(): void {
  // Initialize clone modal for onboarding context
  initCloneModal(async () => {
    await completeOnboarding();
  });

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

  // Escape key to close clone modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isCloneModalOpen()) {
      closeCloneModal();
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
