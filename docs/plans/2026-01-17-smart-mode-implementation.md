# Smart Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Smart commit mode that batches commits based on configurable time intervals.

**Architecture:** Track last commit time and uncommitted changes flag. On triggers (inactivity, file switch, section switch, blur, close), check if threshold met and commit. Single interval setting controls both inactivity timeout and minimum time between commits.

**Tech Stack:** Rust (Tauri 2, serde), TypeScript, CSS

---

## Task 1: Add commit_interval to Rust GitSettings

**Files:**
- Modify: `src-tauri/src/lib.rs:101-115`

**Step 1: Add default function for interval**

After `default_commit_mode()` (line 108), add:

```rust
fn default_commit_interval() -> u32 {
    30
}
```

**Step 2: Add commit_interval field to GitSettings**

Update the `GitSettings` struct (lines 101-104):

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitSettings {
    #[serde(default = "default_commit_mode")]
    pub commit_mode: String,
    #[serde(default = "default_commit_interval")]
    pub commit_interval: u32,
}
```

**Step 3: Update Default impl**

Update the `Default` impl (lines 110-115):

```rust
impl Default for GitSettings {
    fn default() -> Self {
        GitSettings {
            commit_mode: default_commit_mode(),
            commit_interval: default_commit_interval(),
        }
    }
}
```

**Step 4: Verify it compiles**

Run: `cd /Users/simon/tetronomis/noteone && cargo build --manifest-path src-tauri/Cargo.toml`
Expected: Compiles without errors

---

## Task 2: Add Tauri commands for commit_interval

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add get_commit_interval command**

After `get_git_mode` command (around line 1530), add:

```rust
#[tauri::command]
fn get_commit_interval() -> u32 {
    load_settings().git.commit_interval
}
```

**Step 2: Add set_commit_interval command**

```rust
#[tauri::command]
fn set_commit_interval(interval: u32) -> Result<(), String> {
    let mut settings = load_settings();
    settings.git.commit_interval = interval;
    save_settings(&settings)
}
```

**Step 3: Register commands in invoke_handler**

Find `.invoke_handler(tauri::generate_handler![...])` and add:

```rust
get_commit_interval,
set_commit_interval,
```

**Step 4: Verify it compiles**

Run: `cd /Users/simon/tetronomis/noteone && cargo build --manifest-path src-tauri/Cargo.toml`
Expected: Compiles without errors

---

## Task 3: Change default mode to "smart"

**Files:**
- Modify: `src-tauri/src/lib.rs:106-108`

**Step 1: Update default_commit_mode**

Change:

```rust
fn default_commit_mode() -> String {
    "simple".to_string()
}
```

To:

```rust
fn default_commit_mode() -> String {
    "smart".to_string()
}
```

**Step 2: Verify it compiles**

Run: `cd /Users/simon/tetronomis/noteone && cargo build --manifest-path src-tauri/Cargo.toml`
Expected: Compiles without errors

---

## Task 4: Add Smart mode option to HTML

**Files:**
- Modify: `index.html:143-158`

**Step 1: Add Smart mode as first option (new default)**

Replace the git-mode-options div (lines 143-158):

```html
            <div id="git-mode-options">
              <div class="git-mode-option active" data-mode="smart">
                <div class="git-mode-radio"></div>
                <div class="git-mode-info">
                  <div class="git-mode-name">Smart</div>
                  <div class="git-mode-desc">Commit after interval or on file switch</div>
                </div>
              </div>
              <div class="git-mode-option" data-mode="simple">
                <div class="git-mode-radio"></div>
                <div class="git-mode-info">
                  <div class="git-mode-name">Simple</div>
                  <div class="git-mode-desc">Auto-commit on every save</div>
                </div>
              </div>
              <div class="git-mode-option" data-mode="manual">
                <div class="git-mode-radio"></div>
                <div class="git-mode-info">
                  <div class="git-mode-name">Manual</div>
                  <div class="git-mode-desc">Save only, commit via git status box</div>
                </div>
              </div>
            </div>
```

**Step 2: Add interval input after git-mode-options**

After the closing `</div>` of git-mode-options, add:

```html
            <div id="commit-interval-setting">
              <label class="settings-label">Commit interval (minutes)</label>
              <input type="number" id="commit-interval-input" min="1" max="120" value="30">
              <p class="settings-hint">Commits after this much inactivity or when switching files</p>
            </div>
```

**Step 3: Verify HTML renders**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`
Expected: Settings modal shows Smart/Simple/Manual options and interval input

---

## Task 5: Add CSS for interval input

**Files:**
- Modify: `src/styles/main.css`

**Step 1: Add styles at end of file**

```css
/* Commit interval setting */
#commit-interval-setting {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

#commit-interval-setting.hidden {
  display: none;
}

#commit-interval-input {
  width: 80px;
  padding: 8px 12px;
  font-size: 13px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
}

#commit-interval-input:focus {
  outline: none;
  border-color: var(--accent-color);
}
```

**Step 2: Verify styling**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`
Expected: Interval input is styled correctly

---

## Task 6: Update settings.ts with interval support

**Files:**
- Modify: `src/settings.ts`

**Step 1: Add getCommitInterval function after getGitMode (line 54)**

```typescript
export async function getCommitInterval(): Promise<number> {
  return await invoke('get_commit_interval');
}
```

**Step 2: Add setCommitInterval function**

```typescript
export async function setCommitInterval(interval: number): Promise<void> {
  return await invoke('set_commit_interval', { interval });
}
```

**Step 3: Update loadSettingsData to set interval value and visibility**

In `loadSettingsData()` (around line 288), after the git mode update, add:

```typescript
  // Update interval input
  const intervalInput = document.getElementById('commit-interval-input') as HTMLInputElement;
  const intervalSetting = document.getElementById('commit-interval-setting');
  if (intervalInput && currentSettings) {
    intervalInput.value = String(currentSettings.git.commit_interval || 30);
  }
  // Show/hide interval setting based on mode
  if (intervalSetting) {
    intervalSetting.classList.toggle('hidden', currentSettings?.git.commit_mode !== 'smart');
  }
```

**Step 4: Update git mode click handler to show/hide interval**

In `initSettings()`, update the gitModeOptions click handler (around line 477):

```typescript
  gitModeOptions.forEach(opt => {
    opt.addEventListener('click', async () => {
      const mode = opt.getAttribute('data-mode');
      if (mode) {
        await setGitMode(mode);
        gitModeOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        // Show/hide interval setting
        const intervalSetting = document.getElementById('commit-interval-setting');
        if (intervalSetting) {
          intervalSetting.classList.toggle('hidden', mode !== 'smart');
        }
      }
    });
  });
```

**Step 5: Add interval input change handler in initSettings()**

After the gitModeOptions handler, add:

```typescript
  // Commit interval change
  const intervalInput = document.getElementById('commit-interval-input') as HTMLInputElement;
  intervalInput?.addEventListener('change', async () => {
    const interval = parseInt(intervalInput.value, 10);
    if (interval >= 1 && interval <= 120) {
      await setCommitInterval(interval);
    }
  });
```

**Step 6: Verify settings work**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`
Expected:
- Interval input shows/hides based on mode
- Changing interval persists across app restart

---

## Task 7: Add smart commit logic to main.ts

**Files:**
- Modify: `src/main.ts`

**Step 1: Add imports**

Update the settings import (line 7):

```typescript
import { initSettings, getGitMode, getCommitInterval, isSettingsOpen, closeSettings } from './settings';
```

**Step 2: Add module-level state after imports**

```typescript
// Smart commit state
let lastCommitTime: number = Date.now();
let hasUncommittedChanges: boolean = false;
let inactivityTimer: number | null = null;
```

**Step 3: Add trySmartCommit function before scheduleSave**

```typescript
async function trySmartCommit(): Promise<void> {
  if (!hasUncommittedChanges) return;

  const gitMode = await getGitMode();
  if (gitMode !== 'smart') return;

  const interval = await getCommitInterval();
  const intervalMs = interval * 60 * 1000;
  const timeSinceLastCommit = Date.now() - lastCommitTime;

  if (timeSinceLastCommit < intervalMs) return;

  // Get current note for commit message
  const note = getCurrentNote();
  if (!note) return;

  try {
    const filename = note.filename.replace('.md', '');
    await gitCommit(note.path, `Update ${filename}`);
    lastCommitTime = Date.now();
    hasUncommittedChanges = false;
    setStatus('Committed');
    await refreshGitStatus();
  } catch {
    // Commit failed - that's ok
  }
}
```

**Step 4: Add resetInactivityTimer function**

```typescript
async function resetInactivityTimer(): Promise<void> {
  if (inactivityTimer !== null) {
    clearTimeout(inactivityTimer);
  }

  const gitMode = await getGitMode();
  if (gitMode !== 'smart') return;

  const interval = await getCommitInterval();
  const intervalMs = interval * 60 * 1000;

  inactivityTimer = window.setTimeout(() => {
    trySmartCommit();
  }, intervalMs);
}
```

**Step 5: Update scheduleSave to track uncommitted changes and reset timer**

Replace the save logic section (around lines 251-272):

```typescript
        await writeNote(currentNote.path, contentToSave);
        setStatus('Saved');

        const gitMode = await getGitMode();

        if (gitMode === 'simple') {
          // Simple mode: commit immediately
          try {
            const filename = currentNote.filename.replace('.md', '');
            await gitCommit(currentNote.path, `Update ${filename}`);
            lastCommitTime = Date.now();
            setStatus('Committed');
          } catch {
            setStatus('Saved (not committed)');
          }
        } else if (gitMode === 'smart') {
          // Smart mode: mark as uncommitted, reset timer
          hasUncommittedChanges = true;
          await resetInactivityTimer();
        }
        // Manual mode: just saved, no commit action

        await refreshHeader();
        await refreshGitStatus();
```

**Step 6: Verify save modes work**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`
Expected:
- Simple mode: commits on every save
- Smart mode: saves but doesn't commit immediately
- Manual mode: saves only

---

## Task 8: Wire up commit triggers

**Files:**
- Modify: `src/main.ts`
- Modify: `src/sidebar.ts`

**Step 1: Export trySmartCommit from main.ts**

Change the function declaration:

```typescript
export async function trySmartCommit(): Promise<void> {
```

**Step 2: Add blur and beforeunload handlers in main.ts**

In the DOMContentLoaded handler, after other init calls:

```typescript
  // Smart commit on blur/close
  window.addEventListener('blur', () => {
    trySmartCommit();
  });

  window.addEventListener('beforeunload', () => {
    // Synchronous - can't await, but trigger the commit
    trySmartCommit();
  });
```

**Step 3: Update sidebar.ts imports**

Add to imports at top:

```typescript
import { trySmartCommit } from './main';
```

**Step 4: Add commit trigger to selectSection**

At the start of `selectSection` function (line 255), add:

```typescript
async function selectSection(section: Section) {
  await trySmartCommit();

  currentSection = section;
  // ... rest of function
```

**Step 5: Add commit trigger to selectNote**

At the start of `selectNote` function (line 306), add:

```typescript
export async function selectNote(note: Note, matchLine?: number, searchTerm?: string) {
  await trySmartCommit();

  // Update UI
  // ... rest of function
```

**Step 6: Verify triggers work**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`

Test:
1. Set Smart mode with 1-minute interval
2. Edit a note, wait 1+ minute, switch files → should commit
3. Edit, switch files before 1 minute → should NOT commit
4. Edit, blur window after 1+ minute → should commit

---

## Task 9: Add keystroke tracking for timer reset

**Files:**
- Modify: `src/main.ts`

**Step 1: Export resetInactivityTimer**

Change the function declaration:

```typescript
export async function resetInactivityTimer(): Promise<void> {
```

**Step 2: Add editor change listener**

In the DOMContentLoaded handler, add:

```typescript
  // Reset inactivity timer on editor changes
  const editorEl = document.getElementById('editor-container');
  editorEl?.addEventListener('keydown', () => {
    resetInactivityTimer();
  });
```

**Step 3: Final verification**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`

Full test:
1. Smart mode, 1-minute interval
2. Type in editor, verify timer resets (no commit while typing)
3. Stop typing for 1+ minute → commit happens
4. Type, switch file before interval → no commit
5. Type, wait interval, switch file → commit happens

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Add commit_interval to GitSettings | lib.rs |
| 2 | Add get/set Tauri commands | lib.rs |
| 3 | Change default mode to "smart" | lib.rs |
| 4 | Add Smart mode HTML | index.html |
| 5 | Add interval CSS | main.css |
| 6 | Update settings.ts | settings.ts |
| 7 | Add smart commit logic | main.ts |
| 8 | Wire up triggers | main.ts, sidebar.ts |
| 9 | Add keystroke tracking | main.ts |
