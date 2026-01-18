# Git View Design

## Overview

Replace the floating git modal with a dedicated git view that takes over the left pane and editor area. The git box in the top bar acts as a toggle between notes mode and git mode.

## Architecture

**Notes mode (default):**
```
┌─────────────────────────────────────────┐
│ Top Bar: [Git Box] [Search]             │
├──────────┬──────────────────────────────┤
│ Sidebar  │ Editor                       │
│ (notes)  │                              │
└──────────┴──────────────────────────────┘
```

**Git mode (git box clicked):**
```
┌─────────────────────────────────────────┐
│ Top Bar: [Git Box•] [Search]            │
├──────────┬──────────────────────────────┤
│ Commits  │ Diff View                    │
│ List     │                              │
└──────────┴──────────────────────────────┘
```

The git box gets a visual indicator (border/highlight) when git mode is active.

## Left Pane: Commits & Changes List

### Header (always visible)
- Repo name + dirty indicator
- Stats line: "140 commits · 6d old · on master"

### When Dirty

```
┌─────────────────────┐
│ dotfiles ●          │
│ 140 commits · master│
├─────────────────────┤
│ ▼ Uncommitted (3)   │  ← collapsible, open by default
│   M  README.md      │
│   A  docs/new.md    │
│   D  old-file.md    │
├─────────────────────┤
│   History           │
│   +1 -1  Update...  │
│   +12 -3 Fix bug... │
└─────────────────────┘
```

### When Clean

```
┌─────────────────────┐
│ dotfiles            │
│ 140 commits · master│
├─────────────────────┤
│   History           │
│   +1 -1  Update...  │
│   +12 -3 Fix bug... │
└─────────────────────┘
```

### File Status Indicators
- **M** - Modified
- **A** - Added
- **D** - Deleted
- **R** - Renamed

## Right Pane: Diff View

### Initial State
Auto-select first item when entering git mode:
- If dirty: select first uncommitted file
- If clean: select latest commit

### Uncommitted File Selected

```
┌────────────────────────────────────────┐
│ README.md                    Modified  │
├────────────────────────────────────────┤
│  10   │ - old line                     │
│  10   │ + new line                     │
│  11   │   unchanged context            │
└────────────────────────────────────────┘
```

Standard unified diff with:
- Line numbers
- Red/green highlighting for deletions/additions
- Syntax highlighting preserved

### Commit Selected

- Header: commit message, author, date, hash
- Single file: show diff directly
- Multiple files: show file list, click to see individual diff

## Transitions

### Entering Git Mode
- Click git box in top bar
- Git box shows active state
- Left pane and editor swap to git view
- Remember currently open note

### Exiting Git Mode
- Click git box again (toggle)
- Press `Escape`
- Click a note in search results
- Returns to previously open note

## Edge Cases

| Case | Behavior |
|------|----------|
| Unsaved changes | Auto-save handles this, no conflict |
| Editing a dirty file | Diff shows in git view, returns to editing on exit |
| Empty repo | Show "No commits yet", uncommitted files still visible if dirty |

## Keyboard Navigation

- `↑/↓` - Navigate files/commits in left pane
- `Escape` - Exit git mode
- Diff view updates as selection changes
