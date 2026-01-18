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

## Git View

Click the git status box to enter **Git View** - a full-screen mode for reviewing changes.

```
┌─────────────────────────────────────────────────────────────┐
│ UNCOMMITTED (4)           │  notes/1-weeks/Today.md        │
│ M  notes/1-weeks/Today.md │                                │
│ A  notes/ideas/new.md     │  +Added this line              │
│                           │  -Removed this line            │
│ HISTORY                   │   Context line                 │
│ +6 -2  Update Today  1h   │                                │
│ +1 -1  Fix typo      2h   │  another-file.md               │
│ +21k   Initial import 3d  │                                │
│                           │  +New content here             │
└─────────────────────────────────────────────────────────────┘
```

### Sidebar

**UNCOMMITTED** section shows files with changes:
- **M** (yellow) - Modified
- **A** (green) - Added/new file
- **D** (red) - Deleted

Full paths shown (e.g., `notes/1-weeks/Today.md`) to distinguish files with same name.

**HISTORY** section shows recent commits:
- **+N/-N** - Lines added/removed (uses `k` suffix for thousands: `+21k`)
- **Message** - Commit summary
- **Time** - Relative timestamp

### Diff Viewer

Select any file or commit to see its diff:
- **Green lines** - Additions
- **Red lines** - Deletions
- **Faded lines** - Context (unchanged)

For commits with multiple files, each file gets a header separator.

### Navigation

| Key | Action |
|-----|--------|
| **↑/↓** | Navigate files/commits |
| **Escape** | Exit git view |
| **Click** | Select file or commit |

## Multiple Repositories

Configure repositories in Settings (Cmd+,):

- **Active repo** - Shown in status box, used for git view
- **Switch** - Click a different repo to make it active
- **Add** - Add local folder or clone from SSH URL

Switching repos updates the status box and reloads the sidebar.

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
