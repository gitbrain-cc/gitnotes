import { invoke } from '@tauri-apps/api/core';
import { toggleGitMode } from './git-view';

interface RepoStatus {
  repo_name: string;
  is_dirty: boolean;
  dirty_count: number;
  insertions: number;
  deletions: number;
  last_commit_hash: string | null;
  last_commit_message: string | null;
  last_commit_date: string | null;
  last_commit_author: string | null;
  is_team: boolean;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffWeek < 4) return `${diffWeek}w ago`;

  return date.toLocaleDateString();
}

async function getRepoStatus(): Promise<RepoStatus> {
  return await invoke('get_repo_status');
}

function renderStatus(status: RepoStatus): void {
  // Update repo name in status box
  const nameEl = document.querySelector('#git-status-box .git-repo-name');
  if (nameEl) {
    nameEl.textContent = status.repo_name;
  }

  // Update dirty indicator
  const dirtyEl = document.querySelector('#git-status-box .git-dirty-indicator');
  if (dirtyEl) {
    dirtyEl.classList.toggle('dirty', status.is_dirty);
    (dirtyEl as HTMLElement).title = status.is_dirty
      ? `${status.dirty_count} uncommitted change${status.dirty_count !== 1 ? 's' : ''}`
      : 'All changes committed';
  }

  // Update status text (dirty stats or last commit)
  const commitEl = document.querySelector('#git-status-box .git-last-commit');
  if (commitEl) {
    let statusText: string;
    if (status.is_dirty) {
      // Show dirty stats: "3 changes · +15 -8"
      const fileText = `${status.dirty_count} change${status.dirty_count !== 1 ? 's' : ''}`;
      const statsText = `+${status.insertions} -${status.deletions}`;
      statusText = `${fileText} · ${statsText}`;
    } else if (status.last_commit_date && status.last_commit_message) {
      // Show last commit info when clean
      const timeText = formatRelativeTime(status.last_commit_date);
      const msgText = status.last_commit_message.length > 20
        ? status.last_commit_message.slice(0, 20) + '...'
        : status.last_commit_message;
      statusText = status.is_team && status.last_commit_author
        ? `${timeText} · ${status.last_commit_author} · ${msgText}`
        : `${timeText} · ${msgText}`;
    } else {
      statusText = 'No commits yet';
    }
    commitEl.textContent = statusText;
  }
}

export async function refreshGitStatus(): Promise<void> {
  try {
    const status = await getRepoStatus();
    renderStatus(status);
  } catch (err) {
    console.error('Failed to get repo status:', err);
  }
}

export function initGitStatus(): void {
  const statusBox = document.getElementById('git-status-box');

  // Click status box to toggle git view
  statusBox?.addEventListener('click', () => {
    toggleGitMode();
  });

  // Initial load
  refreshGitStatus();
}
