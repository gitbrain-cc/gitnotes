import { invoke } from '@tauri-apps/api/core';

interface DirtyFile {
  path: string;
  filename: string;
  status: string;
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

let isGitModeActive = false;
let selectedItem: { type: 'file' | 'commit'; id: string } | null = null;

async function getDirtyFiles(): Promise<DirtyFile[]> {
  return await invoke('get_dirty_files');
}

async function getFileDiff(path: string): Promise<string> {
  return await invoke('get_file_diff', { path });
}

async function getCommitDiff(hash: string): Promise<string> {
  return await invoke('get_commit_diff', { hash });
}

async function getGitLog(limit?: number): Promise<GitLogEntry[]> {
  return await invoke('get_git_log', { limit });
}


// Helper functions
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function formatNumber(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return k >= 10 ? `${Math.round(k)}k` : `${k.toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(n);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getStatusClass(status: string): string {
  if (status.includes('M')) return 'modified';
  if (status.includes('A') || status === '??') return 'added';
  if (status.includes('D')) return 'deleted';
  return '';
}

function getStatusLabel(status: string): string {
  if (status === '??') return 'A';
  return status.trim().charAt(0) || '?';
}

// Render functions
function renderDiff(diff: string): void {
  const container = document.getElementById('git-diff-content');
  if (!container) return;

  if (!diff) {
    container.innerHTML = '<div class="diff-empty">No changes</div>';
    return;
  }

  const html: string[] = [];
  let currentFile: string | null = null;

  for (const line of diff.split('\n')) {
    // Extract filename from diff header
    if (line.startsWith('diff --git')) {
      const match = line.match(/b\/(.+)$/);
      if (match) {
        currentFile = match[1];
        html.push(`<div class="diff-file-header">${escapeHtml(currentFile)}</div>`);
      }
      continue;
    }

    // Skip noisy metadata
    if (line.startsWith('index ') ||
        line.startsWith('--- ') ||
        line.startsWith('+++ ') ||
        line.startsWith('new file mode') ||
        line.startsWith('deleted file mode') ||
        line.startsWith('old mode') ||
        line.startsWith('new mode') ||
        line.startsWith('\\ No newline')) {
      continue;
    }

    // Simplify hunk headers - just show as separator
    if (line.startsWith('@@')) {
      html.push('<div class="diff-hunk-sep"></div>');
      continue;
    }

    // Actual content
    let className = 'diff-line context';
    if (line.startsWith('+')) {
      className = 'diff-line addition';
    } else if (line.startsWith('-')) {
      className = 'diff-line deletion';
    }
    html.push(`<div class="${className}">${escapeHtml(line)}</div>`);
  }

  container.innerHTML = html.join('');
}

function renderUncommittedFiles(files: DirtyFile[]): void {
  const section = document.getElementById('git-uncommitted-section');
  const list = document.getElementById('git-uncommitted-list');
  const count = document.getElementById('git-uncommitted-count');

  if (!section || !list || !count) return;

  if (files.length === 0) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  count.textContent = String(files.length);

  list.innerHTML = files.map(file => `
    <li data-path="${escapeHtml(file.path)}" data-type="file">
      <div class="git-file-row">
        <span class="git-file-status ${getStatusClass(file.status)}">${getStatusLabel(file.status)}</span>
        <span class="git-file-name">${escapeHtml(file.path.replace(/\/$/, ''))}</span>
      </div>
    </li>
  `).join('');
}

function renderCommits(commits: GitLogEntry[]): void {
  const list = document.getElementById('git-commits-list');
  if (!list) return;

  list.innerHTML = commits.map(commit => `
    <li data-hash="${escapeHtml(commit.hash)}" data-type="commit" class="${commit.is_head ? 'current' : ''}">
      <div class="git-file-row">
        <span class="commit-stats">
          ${commit.insertions > 0 ? `<span class="stat-add">+${formatNumber(commit.insertions)}</span>` : ''}
          ${commit.deletions > 0 ? `<span class="stat-del">-${formatNumber(commit.deletions)}</span>` : ''}
        </span>
        <span class="git-file-name">${escapeHtml(commit.message)}</span>
        <span class="commit-time">${formatRelativeTime(commit.date)}</span>
      </div>
    </li>
  `).join('');
}


// Selection and mode toggle
async function selectFile(path: string): Promise<void> {
  selectedItem = { type: 'file', id: path };
  updateSelection();

  const headerEl = document.getElementById('git-diff-header');
  if (headerEl) {
    const filename = path.split('/').pop() || path;
    headerEl.textContent = filename;
  }

  const diff = await getFileDiff(path);
  renderDiff(diff);
}

async function selectCommit(hash: string): Promise<void> {
  selectedItem = { type: 'commit', id: hash };
  updateSelection();

  const headerEl = document.getElementById('git-diff-header');
  if (headerEl) headerEl.textContent = `Commit ${hash.substring(0, 7)}`;

  const diff = await getCommitDiff(hash);
  renderDiff(diff);
}

function updateSelection(): void {
  document.querySelectorAll('#git-uncommitted-list li, #git-commits-list li').forEach(li => {
    li.classList.remove('selected');
  });

  if (!selectedItem) return;

  const selector = selectedItem.type === 'file'
    ? `[data-path="${selectedItem.id}"]`
    : `[data-hash="${selectedItem.id}"]`;

  document.querySelector(selector)?.classList.add('selected');
}

export async function enterGitMode(): Promise<void> {
  isGitModeActive = true;

  document.getElementById('notes-mode')?.classList.add('hidden');
  document.getElementById('git-view')?.classList.remove('hidden');
  document.getElementById('git-status-box')?.classList.add('active');

  // Load data
  const [files, commits] = await Promise.all([
    getDirtyFiles(),
    getGitLog(50),
  ]);

  renderUncommittedFiles(files);
  renderCommits(commits);

  // Auto-select first item
  if (files.length > 0) {
    await selectFile(files[0].path);
  } else if (commits.length > 0) {
    await selectCommit(commits[0].hash);
  }
}

export function exitGitMode(): void {
  isGitModeActive = false;
  selectedItem = null;

  document.getElementById('notes-mode')?.classList.remove('hidden');
  document.getElementById('git-view')?.classList.add('hidden');
  document.getElementById('git-status-box')?.classList.remove('active');
}

export function toggleGitMode(): void {
  if (isGitModeActive) {
    exitGitMode();
  } else {
    enterGitMode();
  }
}

export function isGitModeOpen(): boolean {
  return isGitModeActive;
}

// Navigation
function navigateList(direction: -1 | 1): void {
  const allItems = [
    ...document.querySelectorAll('#git-uncommitted-list li'),
    ...document.querySelectorAll('#git-commits-list li'),
  ] as HTMLElement[];

  if (allItems.length === 0) return;

  const currentIndex = allItems.findIndex(li => li.classList.contains('selected'));
  let newIndex = currentIndex + direction;

  if (newIndex < 0) newIndex = 0;
  if (newIndex >= allItems.length) newIndex = allItems.length - 1;

  const newItem = allItems[newIndex];
  if (newItem.dataset.path) {
    selectFile(newItem.dataset.path);
  } else if (newItem.dataset.hash) {
    selectCommit(newItem.dataset.hash);
  }
}

// Initialize
export function initGitView(): void {
  // Click handlers for file/commit lists
  document.getElementById('git-uncommitted-list')?.addEventListener('click', (e) => {
    const li = (e.target as HTMLElement).closest('li');
    if (li) {
      const path = li.dataset.path;
      if (path) selectFile(path);
    }
  });

  document.getElementById('git-commits-list')?.addEventListener('click', (e) => {
    const li = (e.target as HTMLElement).closest('li');
    if (li) {
      const hash = li.dataset.hash;
      if (hash) selectCommit(hash);
    }
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (!isGitModeActive) return;

    if (e.key === 'Escape') {
      exitGitMode();
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      navigateList(e.key === 'ArrowUp' ? -1 : 1);
    }
  });
}
