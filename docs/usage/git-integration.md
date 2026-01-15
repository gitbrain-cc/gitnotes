# Git Integration

NoteOne tracks your notes directory as a git repository, showing commit history and sync status at a glance.

## Git Status Box

The box in the top-left corner shows:

```
┌─────────────────────────────────────┐
│  ⑂  dotfiles  ●                     │
│      just now · Update 2020-42      │
└─────────────────────────────────────┘
```

- **Repository name** - Extracted from git remote (or folder name)
- **Orange dot** - Dirty indicator (uncommitted changes exist)
- **Last commit** - Relative time + message preview

Hover over the dot to see how many files have uncommitted changes.

Click to open the repository modal.

## Dirty State

The **dirty indicator** (orange dot) appears when any files have uncommitted changes.

| Dot state | Meaning |
|-----------|---------|
| **Visible** | 1+ files with uncommitted changes |
| **Hidden** | All changes committed |

Both staged and unstaged changes count toward dirty state.

## Repository Modal

Shows detailed git information:

```
┌─────────────────────────────────────┐
│  [dotfiles ●]  [other-repo]  [+]    │
├─────────────────────────────────────┤
│  96 commits · 4d old · on master    │
├─────────────────────────────────────┤
│  +1 -1   Update 2020-42      9m ago │
│  +1 -1   Update --Summary-- 15m ago │
│  +5      Update 2020-45     16m ago │
│  ...                                │
└─────────────────────────────────────┘
```

### Info Line

- **Commit count** - Total commits in the repository
- **Age** - Time since first commit (e.g., "4d old", "2y 3mo")
- **Branch** - Current branch name

### Commit History

Each row shows:

| Column | Description |
|--------|-------------|
| **+N** (green) | Lines added |
| **-N** (red) | Lines removed |
| **Message** | Commit message (truncated) |
| **Time** | Relative timestamp |

Large numbers are abbreviated: `+1k` for 1000+ lines.

## Multiple Repositories

NoteOne can track multiple git repositories:

- **Active repo** - Shown in the status box, listed first in modal
- **Other repos** - Click to switch (becomes active)
- **+ button** - Add a new repository (coming soon)

Switching repos updates the status box and refreshes history.

## Per-File Status

The page header shows git status for the current file:

| Header shows | Meaning |
|--------------|---------|
| **New · not in git** | File exists but isn't tracked |
| **Modified · not committed** | Tracked file with uncommitted changes |
| **Author, 2h ago** | Fully committed (last commit info) |
| *(nothing)* | Not in a git repository |

## Status Bar

The bottom status bar shows save/commit progress:

| Status | Meaning |
|--------|---------|
| **Ready** | App idle |
| **Modified...** | You're typing (waiting for auto-save) |
| **Saved** | File written to disk |
| **Committed** | Git commit succeeded |
| **Saved (not committed)** | File saved but git commit failed |

## Auto-Save & Auto-Commit

1. You edit a file
2. After 500ms of no typing → **auto-save** triggers
3. File is written to disk → status shows "Saved"
4. **Auto-commit** runs immediately → status shows "Committed"
5. Commit message: `Update {page-name}`

Only the current file is committed, not the whole repo.

> **Note:** Currently commits on every save, which can create many commits during active editing. Smarter commit modes (batching, manual, etc.) are planned - see `docs/todo/settings.md`.

## Error Handling

- **Git commit fails** → File is still saved, status shows "Saved (not committed)"
- **File write fails** → Status shows "Error saving"
- **"Nothing to commit"** → Treated as success (file unchanged)

The notes directory must be initialized as a git repo (`git init`) for git features to work.

## Closing the Modal

- Click outside the modal
- Press **Escape**
- Open search (Cmd+P)
