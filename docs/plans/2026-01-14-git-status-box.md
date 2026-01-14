# Git Status Box Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a git status box above the Sections sidebar showing repo name, dirty status, and last commit, with a clickable history panel.

**Architecture:** New Rust commands for repo-level git info (`get_repo_status`, `get_git_log`). New TypeScript module `git-status.ts` for the status box and history panel overlay. Follows existing search-bar overlay pattern.

**Tech Stack:** Tauri 2.0, TypeScript, CSS (dark mode via CSS variables), git CLI commands from Rust.

---

## Task 1: Add Rust command for repo status

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add RepoStatus struct and get_repo_status command**

Add after line 486 (after GitInfo struct):

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct RepoStatus {
    pub repo_name: String,
    pub is_dirty: bool,
    pub dirty_count: u32,
    pub last_commit_hash: Option<String>,
    pub last_commit_message: Option<String>,
    pub last_commit_date: Option<String>,
    pub last_commit_author: Option<String>,
}

#[tauri::command]
fn get_repo_status() -> Result<RepoStatus, String> {
    let notes_path = get_notes_path();

    // Get repo name from remote or folder name
    let repo_name = Command::new("git")
        .args(["remote", "get-url", "origin"])
        .current_dir(&notes_path)
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                let url = String::from_utf8_lossy(&o.stdout).trim().to_string();
                // Extract repo name from URL (e.g., "repo.git" -> "repo")
                url.split('/').last()
                    .map(|s| s.trim_end_matches(".git").to_string())
            } else {
                None
            }
        })
        .unwrap_or_else(|| {
            notes_path.file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| "notes".to_string())
        });

    // Check dirty status (count of uncommitted files)
    let status_output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&notes_path)
        .output()
        .map_err(|e| e.to_string())?;

    let dirty_count = if status_output.status.success() {
        String::from_utf8_lossy(&status_output.stdout)
            .lines()
            .count() as u32
    } else {
        0
    };

    let is_dirty = dirty_count > 0;

    // Get last commit info
    let log_output = Command::new("git")
        .args(["log", "-1", "--format=%H|%s|%aI|%an"])
        .current_dir(&notes_path)
        .output();

    let (last_commit_hash, last_commit_message, last_commit_date, last_commit_author) = match log_output {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let parts: Vec<&str> = stdout.trim().split('|').collect();
            if parts.len() == 4 {
                (
                    Some(parts[0][..7].to_string()), // Short hash
                    Some(parts[1].to_string()),
                    Some(parts[2].to_string()),
                    Some(parts[3].to_string()),
                )
            } else {
                (None, None, None, None)
            }
        }
        _ => (None, None, None, None),
    };

    Ok(RepoStatus {
        repo_name,
        is_dirty,
        dirty_count,
        last_commit_hash,
        last_commit_message,
        last_commit_date,
        last_commit_author,
    })
}
```

**Step 2: Register the command**

In the `invoke_handler` macro (around line 634), add `get_repo_status`:

```rust
.invoke_handler(tauri::generate_handler![
    list_sections,
    list_pages,
    read_page,
    write_page,
    create_page,
    create_page_smart,
    delete_page,
    rename_page,
    move_page,
    list_all_pages,
    create_section,
    rename_section,
    delete_section,
    get_file_metadata,
    get_git_info,
    git_commit,
    search_notes,
    get_repo_status,
])
```

**Step 3: Verify it compiles**

Run: `cd /Users/simon/tetronomis/noteone && cargo build -p noteone`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: add get_repo_status Tauri command"
```

---

## Task 2: Add Rust command for git log

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add GitLogEntry struct and get_git_log command**

Add after the `get_repo_status` function:

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct GitLogEntry {
    pub hash: String,
    pub message: String,
    pub date: String,
    pub author: String,
    pub is_head: bool,
}

#[tauri::command]
fn get_git_log(limit: Option<u32>) -> Result<Vec<GitLogEntry>, String> {
    let notes_path = get_notes_path();
    let limit = limit.unwrap_or(50);

    // Get current HEAD hash
    let head_output = Command::new("git")
        .args(["rev-parse", "HEAD"])
        .current_dir(&notes_path)
        .output();

    let head_hash = head_output
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());

    // Get log entries
    let log_output = Command::new("git")
        .args([
            "log",
            &format!("-{}", limit),
            "--format=%H|%s|%aI|%an",
        ])
        .current_dir(&notes_path)
        .output()
        .map_err(|e| e.to_string())?;

    if !log_output.status.success() {
        return Err("Failed to get git log".to_string());
    }

    let entries: Vec<GitLogEntry> = String::from_utf8_lossy(&log_output.stdout)
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() == 4 {
                let hash = parts[0].to_string();
                let is_head = head_hash.as_ref().map(|h| h == &hash).unwrap_or(false);
                Some(GitLogEntry {
                    hash: hash[..7].to_string(), // Short hash
                    message: parts[1].to_string(),
                    date: parts[2].to_string(),
                    author: parts[3].to_string(),
                    is_head,
                })
            } else {
                None
            }
        })
        .collect();

    Ok(entries)
}
```

**Step 2: Register the command**

Add `get_git_log` to the invoke_handler.

**Step 3: Verify it compiles**

Run: `cd /Users/simon/tetronomis/noteone && cargo build -p noteone`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: add get_git_log Tauri command"
```

---

## Task 3: Add HTML structure for git status box

**Files:**
- Modify: `index.html`

**Step 1: Add git-status element**

Add before `<aside id="sections">` (line 30):

```html
<div id="git-status-box">
  <div id="git-status-content">
    <span id="git-repo-name">Loading...</span>
    <span id="git-dirty-indicator"></span>
  </div>
  <div id="git-last-commit"></div>
</div>

<div id="git-history-panel">
  <div id="git-history-header">
    <span>History</span>
    <button id="git-history-close">&times;</button>
  </div>
  <ul id="git-history-list"></ul>
</div>
```

**Step 2: Commit**

```bash
git add index.html
git commit -m "feat: add git status box HTML structure"
```

---

## Task 4: Add CSS styles for git status box

**Files:**
- Modify: `src/styles/main.css`

**Step 1: Add git status box styles**

Add at end of file:

```css
/* Git Status Box */
#git-status-box {
  padding: 12px 16px;
  background: var(--bg-secondary);
  cursor: pointer;
  border-bottom: 1px solid var(--border-color);
}

#git-status-box:hover {
  background: var(--bg-tertiary);
}

#git-status-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

#git-repo-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

#git-dirty-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: transparent;
}

#git-dirty-indicator.dirty {
  background: var(--accent-color);
}

#git-last-commit {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Git History Panel */
#git-history-panel {
  display: none;
  position: fixed;
  top: 52px;
  left: 0;
  width: 400px;
  max-height: calc(100vh - 76px);
  background: var(--bg-primary);
  border: 1px solid var(--accent-color);
  border-radius: 0 12px 12px 0;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  z-index: 1001;
  overflow: hidden;
  flex-direction: column;
}

#git-history-panel.open {
  display: flex;
}

#git-history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  font-weight: 600;
  font-size: 14px;
}

#git-history-close {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 20px;
  cursor: pointer;
  padding: 0 4px;
}

#git-history-close:hover {
  color: var(--text-primary);
}

#git-history-list {
  list-style: none;
  overflow-y: auto;
  flex: 1;
}

#git-history-list li {
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color);
  cursor: default;
}

#git-history-list li:hover {
  background: var(--bg-tertiary);
}

#git-history-list li.current {
  background: var(--bg-tertiary);
  border-left: 3px solid var(--accent-color);
  padding-left: 13px;
}

.commit-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.commit-hash {
  font-family: monospace;
  font-size: 11px;
  color: var(--accent-color);
}

.commit-date {
  font-size: 11px;
  color: var(--text-secondary);
}

.commit-message {
  font-size: 13px;
  color: var(--text-primary);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.commit-author {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 2px;
}
```

**Step 2: Commit**

```bash
git add src/styles/main.css
git commit -m "feat: add git status box and history panel styles"
```

---

## Task 5: Create git-status.ts module

**Files:**
- Create: `src/git-status.ts`

**Step 1: Create the module**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/git-status.ts
git commit -m "feat: add git-status.ts module"
```

---

## Task 6: Wire up git status in main.ts

**Files:**
- Modify: `src/main.ts`

**Step 1: Import and initialize**

Add import at top:

```typescript
import { initGitStatus, refreshGitStatus, closeHistoryPanel, isHistoryPanelOpen } from './git-status';
```

**Step 2: Call initGitStatus in init()**

In the `init()` function, add after `initSearchBar(handleSearchSelect);`:

```typescript
initGitStatus();
```

**Step 3: Refresh git status after save**

In the `scheduleSave` function, after `await refreshHeader();` (around line 255), add:

```typescript
await refreshGitStatus();
```

**Step 4: Handle Escape key for history panel**

In `setupKeyboardShortcuts()`, update the Escape handler:

```typescript
// Esc: Close search or history panel
if (e.key === 'Escape') {
  if (isSearchBarOpen()) {
    closeSearchBar();
  } else if (isHistoryPanelOpen()) {
    closeHistoryPanel();
  }
}
```

**Step 5: Verify the app runs**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`
Expected: App shows git status box above Sections, clicking opens history panel

**Step 6: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire up git status in main.ts"
```

---

## Task 7: Final testing and polish

**Step 1: Test all functionality**

- [ ] Repo name displays correctly
- [ ] Dirty indicator shows when there are uncommitted changes
- [ ] Last commit message and time display
- [ ] Clicking status box opens history panel
- [ ] History panel shows commits with current highlighted
- [ ] Clicking outside closes panel
- [ ] Escape key closes panel
- [ ] Status refreshes after saving a file

**Step 2: Close the GitHub issue**

```bash
gh issue close 1 --comment "Implemented git status box with history panel"
```
