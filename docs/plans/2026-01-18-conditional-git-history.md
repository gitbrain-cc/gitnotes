# Conditional Git History Display

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show uncommitted files when dirty, show history only when clean.

**Architecture:** Toggle visibility of history section based on dirty file count. When dirty, show uncommitted files and their diffs. When clean, show commit history.

**Tech Stack:** TypeScript, DOM manipulation

---

## Task 1: Toggle History Section Visibility

**Files:**
- Modify: `src/git-view.ts:221-243` (enterGitMode function)

**Step 1: Update enterGitMode to conditionally show/hide history**

In `enterGitMode()`, after loading data, toggle the history section visibility based on whether there are dirty files:

```typescript
export async function enterGitMode(): Promise<void> {
  isGitModeActive = true;

  document.getElementById('notes-mode')?.classList.add('hidden');
  document.getElementById('git-view')?.classList.remove('hidden');
  document.getElementById('git-status-box')?.classList.add('active');

  // Load dirty files first to determine state
  const files = await getDirtyFiles();
  const isDirty = files.length > 0;

  // Toggle sections based on dirty state
  const historySection = document.getElementById('git-history-section');
  if (historySection) {
    historySection.classList.toggle('hidden', isDirty);
  }

  renderUncommittedFiles(files);

  // Only load history when clean
  if (!isDirty) {
    const commits = await getGitLog(50);
    renderCommits(commits);
  }

  // Auto-select first item
  if (files.length > 0) {
    await selectFile(files[0].path);
  } else {
    const commits = await getGitLog(50);
    if (commits.length > 0) {
      await selectCommit(commits[0].hash);
    }
  }
}
```

**Step 2: Run dev mode to test**

Run: `npm run tauri dev`

Test:
1. Open a repository with uncommitted changes → should see only uncommitted files, no history
2. Open a repository with no uncommitted changes → should see only history

**Step 3: Commit**

```bash
git add src/git-view.ts
git commit -m "feat(git): hide history when repository has uncommitted changes"
```

---

## Task 2: Optimize to Avoid Double getGitLog Call

**Files:**
- Modify: `src/git-view.ts:221-243` (enterGitMode function)

**Step 1: Refactor to single getGitLog call**

The previous implementation calls `getGitLog` twice when clean. Optimize:

```typescript
export async function enterGitMode(): Promise<void> {
  isGitModeActive = true;

  document.getElementById('notes-mode')?.classList.add('hidden');
  document.getElementById('git-view')?.classList.remove('hidden');
  document.getElementById('git-status-box')?.classList.add('active');

  // Load dirty files first to determine state
  const files = await getDirtyFiles();
  const isDirty = files.length > 0;

  // Toggle sections based on dirty state
  const historySection = document.getElementById('git-history-section');
  if (historySection) {
    historySection.classList.toggle('hidden', isDirty);
  }

  renderUncommittedFiles(files);

  // Auto-select first item based on state
  if (isDirty) {
    await selectFile(files[0].path);
  } else {
    const commits = await getGitLog(50);
    renderCommits(commits);
    if (commits.length > 0) {
      await selectCommit(commits[0].hash);
    }
  }
}
```

**Step 2: Run dev mode to verify**

Run: `npm run tauri dev`

Test both dirty and clean states work correctly.

**Step 3: Commit**

```bash
git add src/git-view.ts
git commit -m "refactor(git): optimize enterGitMode to single getGitLog call"
```

---

## Summary

Two small tasks:
1. Add conditional visibility toggle for history section
2. Optimize the async calls to avoid redundant work

Total changes: ~10 lines modified in `src/git-view.ts`
