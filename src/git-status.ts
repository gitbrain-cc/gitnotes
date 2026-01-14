import { invoke } from '@tauri-apps/api/core';

interface RepoStatus {
  repo_name: string;
  is_dirty: boolean;
  dirty_count: number;
  last_commit_hash: string | null;
  last_commit_message: string | null;
  last_commit_date: string | null;
  last_commit_author: string | null;
}

interface GitLogEntry {
  hash: string;
  message: string;
  date: string;
  author: string;
  is_head: boolean;
}

let isHistoryOpen = false;

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

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function getRepoStatus(): Promise<RepoStatus> {
  return await invoke('get_repo_status');
}

async function getGitLog(limit?: number): Promise<GitLogEntry[]> {
  return await invoke('get_git_log', { limit });
}

function renderStatus(status: RepoStatus): void {
  const repoNameEl = document.getElementById('git-repo-name');
  const dirtyIndicator = document.getElementById('git-dirty-indicator');
  const lastCommitEl = document.getElementById('git-last-commit');

  if (repoNameEl) {
    repoNameEl.textContent = status.repo_name;
  }

  if (dirtyIndicator) {
    dirtyIndicator.classList.toggle('dirty', status.is_dirty);
    dirtyIndicator.title = status.is_dirty
      ? `${status.dirty_count} uncommitted change${status.dirty_count !== 1 ? 's' : ''}`
      : 'All changes committed';
  }

  if (lastCommitEl) {
    if (status.last_commit_date && status.last_commit_message) {
      const relativeTime = formatRelativeTime(status.last_commit_date);
      const truncatedMessage = status.last_commit_message.length > 40
        ? status.last_commit_message.slice(0, 40) + '...'
        : status.last_commit_message;
      lastCommitEl.textContent = `${relativeTime} · ${truncatedMessage}`;
    } else {
      lastCommitEl.textContent = 'No commits yet';
    }
  }
}

function renderHistoryPanel(entries: GitLogEntry[]): void {
  const list = document.getElementById('git-history-list');
  if (!list) return;

  list.innerHTML = '';

  for (const entry of entries) {
    const li = document.createElement('li');
    if (entry.is_head) {
      li.classList.add('current');
    }

    const relativeTime = formatRelativeTime(entry.date);

    li.innerHTML = `
      <div class="commit-header">
        <span class="commit-hash">${escapeHtml(entry.hash)}</span>
        <span class="commit-date">${escapeHtml(relativeTime)}</span>
      </div>
      <div class="commit-message">${escapeHtml(entry.message)}</div>
      <div class="commit-author">${escapeHtml(entry.author)}</div>
    `;

    list.appendChild(li);
  }
}

export function openHistoryPanel(): void {
  isHistoryOpen = true;
  const panel = document.getElementById('git-history-panel');
  if (panel) {
    panel.classList.add('open');
  }

  // Load and render history
  getGitLog(50).then(renderHistoryPanel).catch(console.error);
}

export function closeHistoryPanel(): void {
  isHistoryOpen = false;
  const panel = document.getElementById('git-history-panel');
  if (panel) {
    panel.classList.remove('open');
  }
}

export function isHistoryPanelOpen(): boolean {
  return isHistoryOpen;
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
  const closeBtn = document.getElementById('git-history-close');
  const panel = document.getElementById('git-history-panel');

  // Click status box to open history
  statusBox?.addEventListener('click', () => {
    if (isHistoryOpen) {
      closeHistoryPanel();
    } else {
      openHistoryPanel();
    }
  });

  // Close button
  closeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeHistoryPanel();
  });

  // Click outside to close
  document.addEventListener('click', (e) => {
    if (isHistoryOpen && panel && statusBox) {
      if (!panel.contains(e.target as Node) && !statusBox.contains(e.target as Node)) {
        closeHistoryPanel();
      }
    }
  });

  // Escape to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isHistoryOpen) {
      closeHistoryPanel();
    }
  });

  // Initial load
  refreshGitStatus();
}
