# Git View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the floating git modal with a dedicated git view mode that takes over sidebar and editor areas.

**Architecture:** Toggle between notes mode (sidebar + editor) and git mode (commits list + diff view) via the git box in top bar. Git mode reuses existing pane widths but swaps content.

**Tech Stack:** TypeScript, Tauri IPC (Rust backend), CSS

---

## Task 1: Add Backend Commands for Dirty Files and Diffs

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add DirtyFile struct and get_dirty_files command**

Add after line ~1167 (after `get_repo_status`):

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct DirtyFile {
    pub path: String,
    pub filename: String,
    pub status: String, // M, A, D, R, etc.
}

#[tauri::command]
fn get_dirty_files() -> Result<Vec<DirtyFile>, String> {
    let notes_path = get_notes_path();

    let output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&notes_path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Ok(vec![]);
    }

    let files: Vec<DirtyFile> = String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| {
            if line.len() < 4 {
                return None;
            }
            let status = line[0..2].trim().to_string();
            let path = line[3..].to_string();
            let filename = path.split('/').last().unwrap_or(&path).to_string();
            Some(DirtyFile { path, filename, status })
        })
        .collect();

    Ok(files)
}
```

**Step 2: Add get_file_diff command**

Add after `get_dirty_files`:

```rust
#[tauri::command]
fn get_file_diff(path: String) -> Result<String, String> {
    let notes_path = get_notes_path();

    // Try staged diff first, then unstaged
    let output = Command::new("git")
        .args(["diff", "HEAD", "--", &path])
        .current_dir(&notes_path)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Ok(String::new())
    }
}
```

**Step 3: Add get_commit_diff command**

```rust
#[tauri::command]
fn get_commit_diff(hash: String) -> Result<String, String> {
    let notes_path = get_notes_path();

    let output = Command::new("git")
        .args(["show", "--format=", &hash])
        .current_dir(&notes_path)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err("Failed to get commit diff".to_string())
    }
}
```

**Step 4: Register commands in invoke_handler**

Find the `.invoke_handler(tauri::generate_handler![...])` line and add:
- `get_dirty_files`
- `get_file_diff`
- `get_commit_diff`

**Step 5: Test backend commands**

Run: `npm run tauri dev`
Open dev tools console, test:
```javascript
await window.__TAURI__.core.invoke('get_dirty_files')
await window.__TAURI__.core.invoke('get_file_diff', { path: 'some/file.md' })
```

---

## Task 2: Create Git View HTML Structure

**Files:**
- Modify: `index.html`

**Step 1: Add git-view container inside #app**

Replace lines 75-116 (the `#app` div) with:

```html
  <div id="app">
    <!-- Notes Mode -->
    <div id="notes-mode">
      <div id="sidebar-area">
        <div id="sidebars">
          <aside id="sections" class="sidebar">
            <div class="sidebar-header">Sections</div>
            <ul id="sections-list"></ul>
            <div class="sidebar-footer">
              <button id="add-section-btn" class="sidebar-add-btn">+ Add section</button>
            </div>
          </aside>
          <aside id="pages" class="sidebar">
            <div class="sidebar-header">
              <span>Notes</span>
              <div id="sort-container">
                <button id="sort-btn" title="Sort notes">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="4" y1="6" x2="16" y2="6"></line>
                    <line x1="4" y1="12" x2="12" y2="12"></line>
                    <line x1="4" y1="18" x2="8" y2="18"></line>
                    <polyline points="15 15 18 18 21 15"></polyline>
                    <line x1="18" y1="12" x2="18" y2="18"></line>
                  </svg>
                </button>
                <div id="sort-menu">
                  <div class="sort-option" data-sort="alpha">Alphabetical <span class="sort-arrow"></span></div>
                  <div class="sort-option" data-sort="created">Date Created <span class="sort-arrow"></span></div>
                  <div class="sort-option" data-sort="modified">Date Modified <span class="sort-arrow"></span></div>
                </div>
              </div>
            </div>
            <ul id="pages-list"></ul>
            <div class="sidebar-footer">
              <button id="add-page-btn" class="sidebar-add-btn">+ Add note</button>
            </div>
          </aside>
        </div>
      </div>
      <main id="editor-container">
        <div id="note-header"></div>
        <div id="editor"></div>
      </main>
    </div>

    <!-- Git Mode -->
    <div id="git-mode" class="hidden">
      <div id="git-sidebar">
        <div id="git-sidebar-header">
          <span class="git-repo-name">Loading...</span>
          <span class="git-dirty-indicator"></span>
          <div id="git-repo-stats"></div>
        </div>
        <div id="git-uncommitted-section" class="hidden">
          <div class="git-section-header">
            <span>Uncommitted</span>
            <span id="git-uncommitted-count"></span>
          </div>
          <ul id="git-uncommitted-list"></ul>
        </div>
        <div id="git-history-section">
          <div class="git-section-header">History</div>
          <ul id="git-commits-list"></ul>
        </div>
      </div>
      <main id="git-diff-container">
        <div id="git-diff-header"></div>
        <div id="git-diff-content"></div>
      </main>
    </div>
  </div>
```

**Step 2: Remove old git-modal from git-status-container**

Remove lines 28-55 (the entire `#git-modal` div). Keep only the anchor box (`#git-status-box`).

---

## Task 3: Add Git View CSS

**Files:**
- Modify: `src/styles/main.css`

**Step 1: Add git mode visibility toggle**

Add after existing git styles (~line 620):

```css
/* Git Mode Layout */
#notes-mode,
#git-mode {
  display: contents;
}

#notes-mode.hidden,
#git-mode.hidden {
  display: none;
}

/* Git Sidebar */
#git-sidebar {
  width: var(--sidebar-width, 200px);
  min-width: 150px;
  max-width: 400px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

#git-sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

#git-sidebar-header .git-repo-name {
  font-size: 14px;
  font-weight: 600;
}

#git-repo-stats {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.git-section-header {
  padding: 8px 16px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

#git-uncommitted-count {
  background: var(--accent-color);
  color: var(--bg-primary);
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 10px;
}

#git-uncommitted-list,
#git-commits-list {
  list-style: none;
  padding: 0;
  margin: 0;
  overflow-y: auto;
  flex: 1;
}

#git-uncommitted-list li,
#git-commits-list li {
  padding: 8px 16px;
  cursor: pointer;
  border-left: 3px solid transparent;
}

#git-uncommitted-list li:hover,
#git-commits-list li:hover {
  background: var(--bg-tertiary);
}

#git-uncommitted-list li.selected,
#git-commits-list li.selected {
  background: var(--bg-tertiary);
  border-left-color: var(--accent-color);
}

.git-file-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.git-file-status {
  font-size: 11px;
  font-weight: 600;
  width: 16px;
  text-align: center;
}

.git-file-status.modified { color: var(--accent-color); }
.git-file-status.added { color: #4caf50; }
.git-file-status.deleted { color: #f44336; }

.git-file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

/* Git Diff View */
#git-diff-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary);
}

#git-diff-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  font-size: 13px;
  font-weight: 500;
}

#git-diff-content {
  flex: 1;
  overflow: auto;
  padding: 16px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.diff-line {
  padding: 0 8px;
}

.diff-line.addition {
  background: rgba(76, 175, 80, 0.15);
  color: #4caf50;
}

.diff-line.deletion {
  background: rgba(244, 67, 54, 0.15);
  color: #f44336;
}

.diff-line.context {
  color: var(--text-secondary);
}

.diff-line.header {
  color: var(--text-secondary);
  font-weight: 600;
  margin-top: 16px;
}

.diff-line.header:first-child {
  margin-top: 0;
}
```

**Step 2: Add active state to git-status-box**

Add after `.git-repo-box` styles:

```css
#git-status-box.active {
  background: var(--accent-color);
  color: var(--bg-primary);
}

#git-status-box.active .git-repo-name,
#git-status-box.active .git-last-commit {
  color: var(--bg-primary);
}

#git-status-box.active .git-dirty-indicator.dirty {
  background: var(--bg-primary);
}
```

---

## Task 4: Create Git View Module

**Files:**
- Create: `src/git-view.ts`

**Step 1: Create the module with types and state**

```typescript
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

interface RepoStatus {
  repo_name: string;
  is_dirty: boolean;
  dirty_count: number;
  last_commit_hash: string | null;
  last_commit_message: string | null;
  last_commit_date: string | null;
  last_commit_author: string | null;
}

interface RepoStats {
  total_commits: number;
  first_commit_date: string | null;
  current_branch: string | null;
  branch_count: number;
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

async function getRepoStatus(): Promise<RepoStatus> {
  return await invoke('get_repo_status');
}

async function getGitLog(limit?: number): Promise<GitLogEntry[]> {
  return await invoke('get_git_log', { limit });
}

async function getRepoStats(): Promise<RepoStats> {
  return await invoke('get_repo_stats');
}
```

**Step 2: Add helper functions**

```typescript
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
```

**Step 3: Add render functions**

```typescript
function renderDiff(diff: string): void {
  const container = document.getElementById('git-diff-content');
  if (!container) return;

  if (!diff) {
    container.innerHTML = '<div class="diff-empty">No changes</div>';
    return;
  }

  const lines = diff.split('\n').map(line => {
    let className = 'diff-line context';
    if (line.startsWith('+') && !line.startsWith('+++')) {
      className = 'diff-line addition';
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      className = 'diff-line deletion';
    } else if (line.startsWith('@@') || line.startsWith('diff ') || line.startsWith('index ')) {
      className = 'diff-line header';
    }
    return `<div class="${className}">${escapeHtml(line)}</div>`;
  });

  container.innerHTML = lines.join('');
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
        <span class="git-file-name">${escapeHtml(file.filename)}</span>
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
          ${commit.insertions > 0 ? `<span class="stat-add">+${commit.insertions}</span>` : ''}
          ${commit.deletions > 0 ? `<span class="stat-del">-${commit.deletions}</span>` : ''}
        </span>
        <span class="git-file-name">${escapeHtml(commit.message)}</span>
        <span class="commit-time">${formatRelativeTime(commit.date)}</span>
      </div>
    </li>
  `).join('');
}

function renderHeader(status: RepoStatus, stats: RepoStats): void {
  const nameEl = document.querySelector('#git-sidebar-header .git-repo-name');
  const dirtyEl = document.querySelector('#git-sidebar-header .git-dirty-indicator');
  const statsEl = document.getElementById('git-repo-stats');

  if (nameEl) nameEl.textContent = status.repo_name;
  if (dirtyEl) dirtyEl.classList.toggle('dirty', status.is_dirty);
  if (statsEl) {
    const parts = [];
    if (stats.total_commits) parts.push(`${stats.total_commits} commits`);
    if (stats.current_branch) parts.push(`on ${stats.current_branch}`);
    statsEl.textContent = parts.join(' · ');
  }
}
```

**Step 4: Add selection and mode toggle**

```typescript
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
  if (headerEl) headerEl.textContent = `Commit ${hash}`;

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
  document.getElementById('git-mode')?.classList.remove('hidden');
  document.getElementById('git-status-box')?.classList.add('active');

  // Load data
  const [status, stats, files, commits] = await Promise.all([
    getRepoStatus(),
    getRepoStats(),
    getDirtyFiles(),
    getGitLog(50),
  ]);

  renderHeader(status, stats);
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
  document.getElementById('git-mode')?.classList.add('hidden');
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
```

**Step 5: Add init and event handlers**

```typescript
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
```

---

## Task 5: Update Main Module Integration

**Files:**
- Modify: `src/main.ts`
- Modify: `src/git-status.ts`

**Step 1: Import and init git-view in main.ts**

Add import at top:
```typescript
import { initGitView, isGitModeOpen, exitGitMode } from './git-view';
```

Update `init()` function to call `initGitView()`:
```typescript
initGitView();
```

Update Escape handler in `setupKeyboardShortcuts()`:
```typescript
if (e.key === 'Escape') {
  if (isSettingsOpen()) {
    closeSettings();
  } else if (isGitModeOpen()) {
    exitGitMode();
  } else if (isSearchBarOpen()) {
    closeSearchBar();
  }
}
```

**Step 2: Update git-status.ts to use toggle**

Replace modal-related code. Change the click handler for `#git-status-box`:

```typescript
import { toggleGitMode } from './git-view';

// In initGitStatus(), replace the statusBox click handler:
statusBox?.addEventListener('click', () => {
  toggleGitMode();
});
```

Remove: `openHistoryPanel`, `closeHistoryPanel`, `isHistoryPanelOpen`, and all modal-related code from `git-status.ts`.

Keep: `refreshGitStatus`, `initGitStatus` (simplified), and the status rendering functions.

---

## Task 6: Clean Up Old Modal Code

**Files:**
- Modify: `src/git-status.ts`
- Modify: `src/styles/main.css`

**Step 1: Remove modal functions from git-status.ts**

Remove these functions entirely:
- `renderHistoryPanel`
- `openHistoryPanel`
- `closeHistoryPanel`
- `isHistoryPanelOpen`
- `renderRepoInfo`

Remove the `isHistoryOpen` state variable.

Simplify `initGitStatus()` to only:
- Call `refreshGitStatus()` on init
- Set up the click handler to call `toggleGitMode()`

**Step 2: Remove modal CSS**

Remove all CSS related to `#git-modal`, `#git-repos-row`, `#git-modal-box`, `#git-add-repo`, `#git-history-list` (the old one).

---

## Task 7: Test and Verify

**Step 1: Run the app**

```bash
npm run tauri dev
```

**Step 2: Verify functionality**

- [ ] Click git box toggles between notes and git mode
- [ ] Git box shows active state (highlighted) when in git mode
- [ ] Uncommitted files show when repo is dirty
- [ ] Clicking uncommitted file shows diff
- [ ] Clicking commit shows commit diff
- [ ] Arrow keys navigate the list
- [ ] Escape exits git mode
- [ ] Exiting returns to previous note

**Step 3: Edge cases**

- [ ] Empty repo (no commits)
- [ ] Clean repo (no uncommitted files)
- [ ] Diff for new file (untracked)
- [ ] Diff for deleted file
