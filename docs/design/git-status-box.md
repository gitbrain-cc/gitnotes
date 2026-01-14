# Git Status Box - Design Spec

Essential UI/UX elements to preserve as the app evolves.

---

## Terminology

- **Anchor Box** (`#git-status-box`) - Always visible in top-left corner. Shows current repo name, dirty indicator, last commit info. Clicking opens the modal. Maintains layout position.

- **Git Repository Modal** (`#git-modal`) - Floating overlay that appears on click. Contains its own copy of the active repo box that overlays exactly on top of the anchor box.

- **Modal Box** (`#git-modal-box`) - Copy of anchor box inside the modal. Positioned to appear in the exact same location as anchor box, creating seamless visual transition.

### Two-Box Architecture
The "anchored" behavior requires TWO identical boxes:
1. **Anchor box**: Always visible, maintains page layout
2. **Modal box**: Inside floating modal, overlays anchor when open

Both boxes display the same data (synced via `renderStatus()`). When modal opens, the modal box appears exactly over the anchor box - user sees no movement.

- **Repository Row** - Inside modal: horizontal row of repo boxes. Active repo is always first (anchored), other repos follow. Clicking another repo makes it active and moves it to first position.

- **Repository Info** - Inside modal, below the row: stats about active repo.

- **Commit History** - Inside modal, below info: scrollable list of commits.

---

## Visual Structure

**Closed state:**
```
┌──────────────────┐
│ 🔀 dotfiles ●    │  ← Active Repository Box (always visible)
│   6m ago · Upd   │
└──────────────────┘
```

**Open state (modal):**
```
┌──────────────────────────────────────────────┐
│ ┌──────────────────┐ ┌─────┐                 │
│ │ 🔀 dotfiles ●    │ │  +  │  ← Repos Row    │
│ │   6m ago · Upd   │ └─────┘    (anchored)   │
│ └──────────────────┘                         │
│ 123 commits · 2y old · on master  ← Info     │
│ ┌──────────────────────────────────────────┐ │
│ │ +1 -1  Update 2026-03            6m ago  │ │
│ │ +3     Update CUTS               3h ago  │ │ ← Commits
│ │ ...                                      │ │
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

---

## Active Repository Box

### Layout
```
┌─────────────────────────────────────┐
│  [git-icon]  reponame [dirty-dot]   │  ← Row 1: name + status
│              6m ago · Update 20...  │  ← Row 2: last commit
└─────────────────────────────────────┘
```

### Elements
- **Git icon**: 18x18px, muted color (--text-secondary)
- **Repo name**: 14px, bold (600), primary text color
- **Dirty indicator**: 8x8px circle, only visible when dirty
  - Dirty: accent color (orange in dark mode)
  - Clean: hidden (not gray, just absent)
- **Last commit line**: 11px, secondary text color
  - Format: `{relative time} · {message truncated}`
  - Message truncates with "..." if too long

### States
- **Default**: bg-tertiary background, transparent border
- **Hover**: bg-primary background, subtle border
- **Active (modal open)**: bg-primary, accent border, bottom corners squared (connects to modal)

### Behavior
- Cursor: pointer
- Click: toggle modal open/close

---

## Git Repository Modal

### Positioning
- **Floating**: Modal uses `position: absolute` to float over content (does NOT push content down)
- Anchored to Active Repository Box (top-left aligned, `top: 0; left: 0`)
- Active repo box becomes top-left corner of modal
- Modal expands rightward and downward from there
- Floats above all other content (z-index: 1001)

### Visual Treatment
- Background: bg-primary
- Border: accent color (orange)
- Border-radius: 8px, except top-left corner (0px - seamless with repo box)
- Shadow: 0 8px 24px rgba(0,0,0,0.3)

### Close Behavior
- Click outside modal → close
- Press Escape → close
- Click another repo box → switch repo, stay open

### Structure (top to bottom)
1. Repository Row (with active box anchored + other repos + add button)
2. Repository Info line
3. Commit History list

---

## Repository Row

### Layout
Horizontal flex row with gap: 8px

```
┌──────────────────┐ ┌──────────────────┐ ┌─────┐
│ active repo      │ │ other repo       │ │  +  │
└──────────────────┘ └──────────────────┘ └─────┘
```

### Repo Box (non-active)
- Same dimensions as active box
- bg-tertiary, transparent border
- On hover: bg-primary, subtle border
- On click: becomes active, moves to first position

### Add Button
- Dashed border (--border-color)
- Transparent background
- "+" character: 16px, light weight (300)
- On hover: solid border, bg-tertiary
- On click: TODO (add repository dialog)

### Switching Repos
When clicking a non-active repo:
1. That repo becomes active (moves to position 1)
2. Previous active moves to position 2
3. Modal stays open
4. Info + commit history update to new repo

---

## Repository Info

### Position
Below repository row, above commit history.
Small vertical margin (6px top), slight left padding (4px).

### Content
Single line of stats, separated by " · "

Format: `{commits} · {age} · on {branch}`
Example: `1,234 commits · 2y 3mo old · on master`

### Individual Stats
- **Commit count**: number with locale formatting (1,234 not 1234)
- **Age**: from first commit date
  - Years + months: "2y 3mo old"
  - Just months: "6mo old"
  - Just days: "15d old"
  - Same day: "today"
- **Branch**: current branch name, prefixed with "on "

### Visual
- Font size: 11px
- Color: --text-secondary
- No interactions (pure info display)

---

## Commit History

### Container
- Max height: 45vh (scrollable)
- No horizontal scroll

### Commit Row Layout
```
┌────────────────────────────────────────────────────────┐
│  +1 -3   Update 2026-03                        6m ago  │
│  [stats] [message]                             [time]  │
└────────────────────────────────────────────────────────┘
```

### Elements
- **Stats column**: fixed width (~50px), monospace 10px
  - Insertions: green (+1, +3, +1k)
  - Deletions: red (-1, -3, -1k)
  - Large numbers abbreviated (1000 → 1k)
  - Empty if no changes
- **Message**: flex-grow, truncate with ellipsis, 12px primary
- **Time**: flex-shrink-0, 10px secondary, right-aligned

### Current Commit (HEAD)
- Left border: 2px accent color
- Background: bg-tertiary
- Slightly reduced left padding to compensate for border

### Row States
- Default: transparent background
- Hover: bg-tertiary
- No click action (for now)

### Border
- Each row has bottom border (--border-color)

---

## Keyboard & Focus

### Shortcuts
- **Escape**: Close modal if open
- (No keyboard shortcut to open - mouse only for now)

### Focus
- Modal does not trap focus
- No tab navigation within modal (yet)

---

## Click Behavior Summary

| Element               | Click Action                          |
|-----------------------|---------------------------------------|
| Active repo box       | Toggle modal open/close               |
| Other repo box        | Make active, stay open, refresh data  |
| Add button            | TODO: open add repo dialog            |
| Commit row            | No action (future: show diff?)        |
| Outside modal         | Close modal                           |

---

## Data Refresh

- On app start: load active repo status + stats
- On modal open: load commit history (50 commits)
- On repo switch: reload status, stats, and history
- On file save: refresh repo status (dirty indicator)
