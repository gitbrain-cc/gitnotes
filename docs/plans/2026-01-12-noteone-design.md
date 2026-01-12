# NoteOne - Design Document

**Date:** 2026-01-12
**Status:** Approved

## Overview

NoteOne is a lightweight, Mac-native markdown notes app to replace Microsoft OneNote. It focuses on simplicity, fast search, and a two-panel sidebar for intuitive navigation.

## Goals

- Escape Microsoft ecosystem
- Great full-text search (no paywall)
- Simple markdown editing with inline rendering
- Custom ordering of sections and pages
- Lightweight (~10-15MB)

## Non-Goals

- Cross-platform (Mac only for now)
- Multimedia embedding
- Plugin/extension system
- Cloud sync (use git)
- WYSIWYG editing
- Collaboration features

## Tech Stack

- **Shell:** Tauri 2.0 (Rust, ~5MB)
- **Frontend:** Vanilla TypeScript + HTML/CSS
- **Editor:** CodeMirror 6 with markdown extensions
- **Search:** Tantivy (Rust full-text indexing)

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Menu Bar (native macOS)                        │
├────────┬────────────┬───────────────────────────┤
│Sections│   Pages    │        Editor             │
│        │            │                           │
│ 1-todo │ 2026-01.md │  # 2026-01               │
│ 1-weeks│ 2026-02.md │                           │
│ gf-biz │ 2026-03.md │  Monday:                  │
│ gf-road│            │  - Note content here      │
│ me-home│            │                           │
│        │            │                           │
├────────┴────────────┴───────────────────────────┤
│  Status bar (word count, last saved)            │
└─────────────────────────────────────────────────┘
```

## Data Storage

Notes remain as `.md` files in the configured notes directory (default: `~/tetronomis/dotfiles/notes`).

### Order Configuration

Root level `notes/.order.json`:
```json
{
  "sections": ["1-weeks", "1-todo", "gf-roadmap", "gf-business", "me-home"],
  "defaultSort": "name-asc"
}
```

Per-section `notes/<section>/.order.json`:
```json
{
  "sort": "name-desc",
  "pinned": ["2026-03.md"]
}
```

Sort options: `name-asc`, `name-desc`, `created-asc`, `created-desc`, `modified-desc`, `manual`

### App Configuration

`~/.config/noteone/config.json`:
```json
{
  "notesPath": "~/tetronomis/dotfiles/notes",
  "theme": "system",
  "fontSize": 14,
  "fontFamily": "SF Mono",
  "defaultSort": "name-asc",
  "sidebarWidth": [150, 200]
}
```

## Features

### Sidebar Navigation

**Sections Panel (left):**
- Lists all folders in notes root
- Sorted by root `.order.json` or alphabetically
- Click to select section

**Pages Panel (middle):**
- Lists `.md` files in selected section
- Sorted by section's `.order.json` or default sort
- Shows filename and optional first-line preview
- Click to open in editor

### Editor

- CodeMirror 6 with inline markdown rendering
- Headers styled large, bold/italic rendered inline
- Syntax visible but muted (asterisks shown faintly)
- Standard shortcuts: Cmd+B bold, Cmd+I italic, Cmd+K link
- Auto-continue lists on Enter
- Auto-save (debounced 500ms)

### Search

**Full-text search (Cmd+Shift+F):**
- Tantivy-powered indexing
- Results show filename, section, snippet with highlight
- <100ms target for 1000+ notes

**Quick switcher (Cmd+P):**
- Fuzzy filename matching
- Shows section/filename
- Recent files ranked higher

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Quick switcher | Cmd+P |
| Full-text search | Cmd+Shift+F |
| New page | Cmd+N |
| Close/back | Esc |
| Next section | Cmd+Down |
| Prev section | Cmd+Up |
| Focus editor | Cmd+1 |
| Focus sidebar | Cmd+2 |

### Native macOS Integration

- Standard menu bar (File/Edit/View)
- Light/dark mode follows system
- Cmd+, opens config
- Dock icon, Cmd+Tab support

## Project Structure

```
noteone/
├── src-tauri/           # Rust backend
│   ├── src/
│   │   ├── main.rs      # Entry point
│   │   ├── search.rs    # Tantivy full-text indexing
│   │   ├── files.rs     # File system operations
│   │   └── config.rs    # App configuration
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                 # Frontend (TypeScript)
│   ├── main.ts          # App entry
│   ├── editor.ts        # CodeMirror setup
│   ├── sidebar.ts       # Two-panel navigation
│   ├── search.ts        # Search UI
│   ├── styles/
│   │   ├── main.css
│   │   └── editor.css
│   └── index.html
├── docs/
│   └── plans/
├── package.json
└── README.md
```

## Future Enhancements (not v1)

- Drag & drop reordering in sidebar
- UI for managing `.order.json`
- Global hotkey to summon app
- Spotlight integration
- Windows/Linux support
- Mobile companion (read-only)

## Implementation Notes

- No React/Vue - vanilla TS keeps bundle small
- Tauri IPC for file operations and search
- Search index stored in app data directory
- Index rebuilds on startup, updates incrementally
