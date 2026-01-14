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
  insertions: number;
  deletions: number;
}

interface RepoStats {
  total_commits: number;
  first_commit_date: string | null;
  current_branch: string | null;
  branch_count: number;
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

async function getRepoStats(): Promise<RepoStats> {
  return await invoke('get_repo_stats');
}

function formatRepoAge(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffYears >= 1) {
    const remainingMonths = Math.floor((diffDays % 365) / 30);
    if (remainingMonths > 0) {
      return `${diffYears}y ${remainingMonths}mo`;
    }
    return `${diffYears}y`;
  }
  if (diffMonths >= 1) return `${diffMonths}mo`;
  if (diffDays >= 1) return `${diffDays}d`;
  return 'today';
}

function renderRepoInfo(stats: RepoStats): void {
  const infoEl = document.getElementById('git-repo-info');
  if (!infoEl) return;

  const parts: string[] = [];

  if (stats.total_commits > 0) {
    parts.push(`${stats.total_commits.toLocaleString()} commits`);
  }

  if (stats.first_commit_date) {
    parts.push(`${formatRepoAge(stats.first_commit_date)} old`);
  }

  if (stats.current_branch) {
    parts.push(`on ${stats.current_branch}`);
  }

  infoEl.textContent = parts.join(' · ');
}

function renderStatus(status: RepoStatus): void {
  // Update all repo name elements (anchor + modal)
  document.querySelectorAll('.git-repo-name').forEach(el => {
    el.textContent = status.repo_name;
  });

  // Update all dirty indicators
  document.querySelectorAll('.git-dirty-indicator').forEach(el => {
    el.classList.toggle('dirty', status.is_dirty);
    (el as HTMLElement).title = status.is_dirty
      ? `${status.dirty_count} uncommitted change${status.dirty_count !== 1 ? 's' : ''}`
      : 'All changes committed';
  });

  // Update all last commit elements
  const commitText = status.last_commit_date && status.last_commit_message
    ? `${formatRelativeTime(status.last_commit_date)} · ${
        status.last_commit_message.length > 20
          ? status.last_commit_message.slice(0, 20) + '...'
          : status.last_commit_message
      }`
    : 'No commits yet';

  document.querySelectorAll('.git-last-commit').forEach(el => {
    el.textContent = commitText;
  });
}

function formatStat(num: number): string {
  if (num >= 1000) {
    return Math.floor(num / 1000) + 'k';
  }
  return num.toString();
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
    const hasChanges = entry.insertions > 0 || entry.deletions > 0;

    let statsHtml = '';
    if (hasChanges) {
      if (entry.insertions > 0) {
        statsHtml += `<span class="stat-add">+${formatStat(entry.insertions)}</span>`;
      }
      if (entry.deletions > 0) {
        statsHtml += `<span class="stat-del">-${formatStat(entry.deletions)}</span>`;
      }
    }

    li.innerHTML = `
      <div class="commit-row">
        <span class="commit-stats">${statsHtml}</span>
        <span class="commit-message">${escapeHtml(entry.message)}</span>
        <span class="commit-meta">${escapeHtml(relativeTime)}</span>
      </div>
    `;

    list.appendChild(li);
  }
}

export function openHistoryPanel(): void {
  isHistoryOpen = true;
  const container = document.getElementById('git-status-container');
  if (container) {
    container.classList.add('active');
  }

  // Load history and stats
  Promise.all([
    getGitLog(50),
    getRepoStats(),
  ]).then(([log, stats]) => {
    renderHistoryPanel(log);
    renderRepoInfo(stats);
  }).catch(console.error);
}

export function closeHistoryPanel(): void {
  isHistoryOpen = false;
  const container = document.getElementById('git-status-container');
  if (container) {
    container.classList.remove('active');
  }
}

export function isHistoryPanelOpen(): boolean {
  return isHistoryOpen;
}

export async function refreshGitStatus(): Promise<void> {
  try {
    const [status, stats] = await Promise.all([
      getRepoStatus(),
      getRepoStats(),
    ]);
    renderStatus(status);
    renderRepoInfo(stats);
  } catch (err) {
    console.error('Failed to get repo status:', err);
  }
}

export function initGitStatus(): void {
  const statusBox = document.getElementById('git-status-box');
  const addRepoBtn = document.getElementById('git-add-repo');
  const container = document.getElementById('git-status-container');

  // Click status box to toggle dropdown
  statusBox?.addEventListener('click', () => {
    if (isHistoryOpen) {
      closeHistoryPanel();
    } else {
      openHistoryPanel();
    }
  });

  // Add repository button (TODO: implement)
  addRepoBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    console.log('TODO: Add repository dialog');
  });

  // Click outside to close
  document.addEventListener('click', (e) => {
    if (isHistoryOpen && container) {
      if (!container.contains(e.target as Node)) {
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
