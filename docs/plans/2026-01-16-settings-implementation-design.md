# Settings Implementation Design

## Overview

Settings modal for NoteOne with two sections: Repositories and Git. Accessible via native macOS menu (Cmd+, or Git Notes > Settings).

## Modal Structure

```
┌─────────────────────────────────────────┐
│  Settings                          [×]  │
├──────────┬──────────────────────────────┤
│  Repos   │  [Active section content]    │
│  ────    │                              │
│  Git     │                              │
└──────────┴──────────────────────────────┘
```

- Fixed size: 500px × 350px
- Left sidebar: section tabs
- Right content: active section settings
- Close via × button, backdrop click, or Escape

## Repositories Section

- List of vaults with radio selection (● active, ○ inactive)
- Each vault shows: name, truncated path
- Click vault row to switch (reloads app)
- Hover shows remove button
- "Add vault" opens native folder picker
- Switching vault saves current page first, then reloads

## Git Section

- Radio-style options for commit mode (same design as vault list)
- Two modes: Simple | Manual
- Smart mode deferred to v2

**Mode behavior**:
- Simple: Auto-commit on every save (current behavior)
- Manual: Save writes file, no auto-commit. User commits via git status box.

## Storage

File: `~/Library/Application Support/noteone/settings.json` (macOS)

```json
{
  "vaults": [
    { "id": "abc123", "name": "notes", "path": "/Users/simon/tetronomis/dotfiles/notes" }
  ],
  "active_vault": "abc123",
  "git": {
    "commit_mode": "simple"
  }
}
```

## Implementation

**Backend (Rust)**:
- `get_settings`, `update_settings` - read/write settings
- `add_vault` - native folder picker dialog via tauri-plugin-dialog
- `remove_vault`, `set_active_vault` - vault management
- `get_git_mode`, `set_git_mode` - commit mode
- `get_notes_path()` reads active vault from settings
- Native menu with Settings item (Cmd+,) emits `open-settings` event

**Frontend (TypeScript)**:
- `src/settings.ts` - modal logic, vault list rendering, event handlers
- Listens for `open-settings` event from native menu
- Settings modal HTML in `index.html`
- Git mode change controls auto-commit in save flow
