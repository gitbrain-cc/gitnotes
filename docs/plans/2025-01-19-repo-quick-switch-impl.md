# Repository Quick-Switch Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add quick repository switching in git view - all repos shown inline, click non-active to switch and exit to notes mode.

**Architecture:** Modify git-view.ts to render non-active repo boxes on enter, handle clicks to switch vault and soft-reload. Hide search bar when in git view via CSS.

**Tech Stack:** TypeScript, CSS, Tauri IPC (existing `setActiveVault` command)

---

### Task 1: Add HTML container for other repos

**Files:**
- Modify: `index.html:10-28`

**Step 1: Add the container**

In `index.html`, add `#other-repos-container` after `#git-status-container`:

```html
  <div id="top-bar">
    <div id="git-status-container">
      <!-- Anchor box: always visible, maintains layout -->
      <div id="git-status-box" class="git-repo-box">
        <svg class="git-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="18" cy="18" r="3"></circle>
          <circle cx="6" cy="6" r="3"></circle>
          <path d="M13 6h3a2 2 0 0 1 2 2v7"></path>
          <line x1="6" y1="9" x2="6" y2="21"></line>
        </svg>
        <div class="git-status-info">
          <div class="git-status-content">
            <span class="git-repo-name">Loading...</span>
            <span class="git-dirty-indicator"></span>
          </div>
          <div class="git-last-commit"></div>
        </div>
      </div>
    </div>
    <div id="other-repos-container"></div>
    <div id="search-container">
```

**Step 2: Verify HTML is valid**

Run: `npm run tauri dev`
Expected: App loads without errors, no visual change yet (container is empty)

---

### Task 2: Add CSS for inactive repos and git-view mode

**Files:**
- Modify: `src/styles/main.css`

**Step 1: Add styles after the existing `.git-repo-box` styles (around line 310)**

Find the line `#search-container {` and add these styles BEFORE it:

```css
/* Other repos container - only visible in git view */
#other-repos-container {
  display: none;
  align-items: center;
  gap: 8px;
  margin-left: 8px;
}

body.git-view-active #other-repos-container {
  display: flex;
}

body.git-view-active #search-container {
  display: none;
}

/* Inactive repo box styling */
.git-repo-box.inactive {
  opacity: 0.7;
  cursor: pointer;
}

.git-repo-box.inactive:hover {
  opacity: 1;
  background: var(--bg-primary);
  border-color: var(--border-color);
}
```

**Step 2: Verify styles compile**

Run: `npm run tauri dev`
Expected: App loads, no visual change yet (git view not active)

---

### Task 3: Add body class toggle in git-view.ts

**Files:**
- Modify: `src/git-view.ts:240-282`

**Step 1: Add body class in enterGitMode**

In `enterGitMode()` function, after line `isGitModeActive = true;`, add:

```typescript
document.body.classList.add('git-view-active');
```

**Step 2: Remove body class in exitGitMode**

In `exitGitMode()` function, after line `isGitModeActive = false;`, add:

```typescript
document.body.classList.remove('git-view-active');
```

**Step 3: Verify toggle works**

Run: `npm run tauri dev`
1. Click the repo box to enter git view
2. Expected: Search bar disappears
3. Press Escape to exit
4. Expected: Search bar reappears

---

### Task 4: Render non-active repos in git view

**Files:**
- Modify: `src/git-view.ts`

**Step 1: Add imports at top of file**

Add to existing imports:

```typescript
import { getSettings, setActiveVault } from './settings';
```

**Step 2: Add helper function to create repo box HTML**

Add after the `escapeHtml` function (around line 80):

```typescript
function createRepoBoxHtml(vault: { id: string; name: string }, stats: { is_dirty: boolean; dirty_count: number; git_branch: string | null } | null): string {
  const dirtyClass = stats?.is_dirty ? 'dirty' : '';
  const dirtyTitle = stats?.is_dirty
    ? `${stats.dirty_count} uncommitted change${stats.dirty_count !== 1 ? 's' : ''}`
    : 'All changes committed';
  const branch = stats?.git_branch || 'main';

  return `
    <div class="git-repo-box inactive" data-vault-id="${vault.id}">
      <svg class="git-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="18" cy="18" r="3"></circle>
        <circle cx="6" cy="6" r="3"></circle>
        <path d="M13 6h3a2 2 0 0 1 2 2v7"></path>
        <line x1="6" y1="9" x2="6" y2="21"></line>
      </svg>
      <div class="git-status-info">
        <div class="git-status-content">
          <span class="git-repo-name">${escapeHtml(vault.name)}</span>
          <span class="git-dirty-indicator ${dirtyClass}" title="${dirtyTitle}"></span>
        </div>
        <div class="git-last-commit">${escapeHtml(branch)}</div>
      </div>
    </div>
  `;
}
```

**Step 3: Add function to render other repos**

Add after `createRepoBoxHtml`:

```typescript
async function renderOtherRepos(): Promise<void> {
  const container = document.getElementById('other-repos-container');
  if (!container) return;

  const settings = await getSettings();
  const activeId = settings.active_vault || settings.vaults[0]?.id;
  const otherVaults = settings.vaults.filter(v => v.id !== activeId);

  if (otherVaults.length === 0) {
    container.innerHTML = '';
    return;
  }

  // For now, render without stats (we'll add stats in next step if needed)
  container.innerHTML = otherVaults.map(vault =>
    createRepoBoxHtml(vault, null)
  ).join('');
}
```

**Step 4: Call renderOtherRepos in enterGitMode**

In `enterGitMode()`, after `document.body.classList.add('git-view-active');`, add:

```typescript
await renderOtherRepos();
```

**Step 5: Clear other repos in exitGitMode**

In `exitGitMode()`, after `document.body.classList.remove('git-view-active');`, add:

```typescript
const otherReposContainer = document.getElementById('other-repos-container');
if (otherReposContainer) otherReposContainer.innerHTML = '';
```

**Step 6: Verify repos render**

Run: `npm run tauri dev`
1. Click repo box to enter git view
2. Expected: Other repos appear to the right of active repo (muted)
3. Hover over them
4. Expected: Opacity increases to 100%

---

### Task 5: Handle click on inactive repo

**Files:**
- Modify: `src/git-view.ts`

**Step 1: Add imports for soft reload**

Update the import from main.ts (if not already present, add a new import):

```typescript
import { loadSections } from './main';
```

Also update sidebar import:

```typescript
import { initSidebar } from './sidebar';
```

And search-bar import:

```typescript
import { loadAllNotes } from './search-bar';
```

**Step 2: Add click handler function**

Add after `renderOtherRepos`:

```typescript
async function handleRepoSwitch(vaultId: string): Promise<void> {
  // 1. Set new active vault
  await setActiveVault(vaultId);

  // 2. Exit git view
  exitGitMode();

  // 3. Soft reload - reinitialize components
  await initSidebar();
  await loadAllNotes();
  await refreshGitStatus();
}
```

**Step 3: Add click listener in initGitView**

In `initGitView()`, add at the end (before the closing brace):

```typescript
// Click handler for other repos
document.getElementById('other-repos-container')?.addEventListener('click', (e) => {
  const box = (e.target as HTMLElement).closest('.git-repo-box');
  if (box) {
    const vaultId = box.getAttribute('data-vault-id');
    if (vaultId) handleRepoSwitch(vaultId);
  }
});
```

**Step 4: Export initSidebar from sidebar.ts (if not already)**

Check `src/sidebar.ts` - if `initSidebar` is not exported, add `export` to its declaration.

**Step 5: Test the full flow**

Run: `npm run tauri dev`
1. Click repo box to enter git view
2. Click on a non-active repo
3. Expected:
   - Git view closes
   - Notes mode appears
   - Sidebar shows sections/notes from new repo
   - Git status box shows new repo name

---

### Task 6: Show branch in inactive repos (polish)

**Files:**
- Modify: `src/git-view.ts`

**Step 1: Import getVaultStats from settings**

Update import:

```typescript
import { getSettings, setActiveVault, getVaultStats } from './settings';
```

**Step 2: Export getVaultStats from settings.ts (if not already)**

Check `src/settings.ts` - the function exists but may not be exported. Add `export` if needed:

```typescript
export async function getVaultStats(vaultId: string): Promise<VaultStats> {
```

**Step 3: Update renderOtherRepos to fetch stats**

Replace the `renderOtherRepos` function:

```typescript
async function renderOtherRepos(): Promise<void> {
  const container = document.getElementById('other-repos-container');
  if (!container) return;

  const settings = await getSettings();
  const activeId = settings.active_vault || settings.vaults[0]?.id;
  const otherVaults = settings.vaults.filter(v => v.id !== activeId);

  if (otherVaults.length === 0) {
    container.innerHTML = '';
    return;
  }

  // Fetch stats for all other vaults in parallel
  const statsMap = new Map<string, { is_dirty: boolean; dirty_count: number; git_branch: string | null }>();
  await Promise.all(
    otherVaults.map(async (vault) => {
      try {
        const stats = await getVaultStats(vault.id);
        statsMap.set(vault.id, {
          is_dirty: false, // We don't have dirty status cross-vault yet
          dirty_count: 0,
          git_branch: stats.git_branch,
        });
      } catch {
        // Ignore - render without stats
      }
    })
  );

  container.innerHTML = otherVaults.map(vault =>
    createRepoBoxHtml(vault, statsMap.get(vault.id) || null)
  ).join('');
}
```

**Step 4: Test branch display**

Run: `npm run tauri dev`
1. Enter git view
2. Expected: Other repos show their branch name under the repo name

---

### Task 7: Final verification

**Step 1: Full flow test**

1. Start with repo A active
2. Click repo box → git view opens
3. See repo B on the right (muted, shows branch)
4. Click repo B
5. Expected: exits to notes mode, repo B now active
6. Click repo box again → git view opens
7. See repo A on the right now
8. Press Escape → exits to notes mode, repo B still active

**Step 2: Edge cases**

- Single repo: No other repos shown (just active)
- Three+ repos: All non-active repos shown inline

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Add HTML container |
| 2 | Add CSS for inactive state + git-view toggle |
| 3 | Toggle body class in git-view.ts |
| 4 | Render non-active repos |
| 5 | Handle click → switch + soft reload |
| 6 | Polish: show branch in inactive repos |
| 7 | Final verification |
