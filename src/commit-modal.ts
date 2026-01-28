// src/commit-modal.ts
import { generateCommitMessage, recordCommit, hasUncommittedChanges } from './commit-engine';
import { gitCommit, flashCommitted, getCurrentNote } from './main';
import { refreshGitStatus } from './git-status';

let isOpen = false;

export function openCommitModal(): void {
  if (!hasUncommittedChanges()) return;

  const modal = document.getElementById('commit-modal');
  const input = document.getElementById('commit-message-input') as HTMLInputElement;

  if (!modal || !input) return;

  // Pre-fill with generated message
  input.value = generateCommitMessage();

  modal.classList.remove('hidden');
  input.focus();
  input.select();
  isOpen = true;
}

export function closeCommitModal(): void {
  const modal = document.getElementById('commit-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
  isOpen = false;
}

export function isCommitModalOpen(): boolean {
  return isOpen;
}

export async function confirmCommit(): Promise<void> {
  const input = document.getElementById('commit-message-input') as HTMLInputElement;
  const note = getCurrentNote();

  if (!input || !note) {
    closeCommitModal();
    return;
  }

  const message = input.value.trim() || generateCommitMessage();

  try {
    await gitCommit(note.path, message);
    recordCommit();
    flashCommitted();
    await refreshGitStatus();
  } catch {
    // Commit failed
  }

  closeCommitModal();
}

export function initCommitModal(): void {
  const modal = document.getElementById('commit-modal');
  const input = document.getElementById('commit-message-input') as HTMLInputElement;
  const cancelBtn = document.getElementById('commit-cancel');
  const confirmBtn = document.getElementById('commit-confirm');

  // Close on backdrop click
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeCommitModal();
  });

  // Close on cancel
  cancelBtn?.addEventListener('click', closeCommitModal);

  // Confirm on button click
  confirmBtn?.addEventListener('click', confirmCommit);

  // Enter to confirm, Escape to cancel
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmCommit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeCommitModal();
    }
  });
}
