# Repository Quick-Switch in Git View

## Overview

Add quick repository switching directly in the git view top bar, allowing users to switch repos without going through Settings.

## Layout

**Editor view (notes mode)** — No changes:
```
┌─────────────────────────────────────────────────────────┐
│ [Active Repo]          [    Search...    ]              │
└─────────────────────────────────────────────────────────┘
```

**Git view (repository view)** — New layout:
```
┌─────────────────────────────────────────────────────────┐
│ [Active Repo] [Repo2] [Repo3] ...                       │
└─────────────────────────────────────────────────────────┘
```

- All repo boxes inline, left-aligned
- Active repo first, non-active repos follow
- Non-active repos at ~70% opacity, full opacity on hover
- Search bar hidden in git view

## Interaction

**Clicking a non-active repo:**
1. Set it as active vault (backend call)
2. Exit git view
3. Load notes mode with the new repo (soft reload, no page refresh)
4. Previously active repo moves to second position in the row

**Clicking the active repo:**
- No change — stays in git view

**Escape key:**
- No change — returns to notes mode, repo unchanged

## Implementation

### Files to modify

| File | Changes |
|------|---------|
| `index.html` | Add container for non-active repos in top bar |
| `src/styles/main.css` | Styles for repo row, muted state, hover |
| `src/git-view.ts` | Render non-active repos on enter, handle click → switch + exit |
| `src/git-status.ts` | Expose repo box rendering logic for reuse |
| `src/settings.ts` | Reuse `setActiveVault()` — already exists |

### HTML

Add `#other-repos-container` next to `#git-status-container` in the top bar.

### CSS

- `.git-repo-box.inactive` — 70% opacity, pointer cursor
- `.git-repo-box.inactive:hover` — full opacity
- Hide `#search-container` when `#git-view` is visible (or when body has git-view class)

### JavaScript (git-view.ts)

- On `enterGitMode()`: fetch all vaults via `getSettings()`, render non-active ones
- On click non-active repo:
  1. Call `setActiveVault(vaultId)`
  2. Call `exitGitMode()`
  3. Soft reload: `initSidebar()`, `loadAllNotes()`, `refreshGitStatus()`

### Soft reload

To avoid `window.location.reload()`, reinitialize the necessary components:
- `initSidebar()` — reload sections/notes for new vault
- `loadAllNotes()` — refresh search index
- `refreshGitStatus()` — update status box with new repo info
