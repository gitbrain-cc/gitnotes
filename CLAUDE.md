# NoteOne - Claude Instructions

## Project Overview

NoteOne is a lightweight markdown notes app replacing OneNote. Built with Tauri 2.0 (Rust) + TypeScript + CodeMirror 6.

## Architecture

- **src-tauri/src/lib.rs** - Rust backend: file system operations, config loading
- **src/main.ts** - Frontend entry, orchestration, auto-save
- **src/sidebar.ts** - Two-panel navigation (sections/pages)
- **src/editor.ts** - CodeMirror setup and content management
- **src/styles/main.css** - Styling with CSS variables for theming

## Key Patterns

- No React/Vue - vanilla TypeScript only
- Tauri IPC for frontend-backend communication via `invoke()`
- Auto-save with 500ms debounce
- Custom ordering via `.order.json` files in notes directory

## Development

```bash
npm run tauri dev   # Run dev mode
npm run tauri build # Build release
```

## Current State (v0.1)

Working:
- Section/page navigation
- Markdown editing with auto-save
- Custom ordering
- Dark mode

TODO:
- Quick switcher (Cmd+P)
- Full-text search (Cmd+Shift+F)
- Inline markdown rendering
- Keyboard shortcuts
- Create/rename/delete pages

## Notes Directory

Default: `~/tetronomis/dotfiles/notes/`

Structure:
```
notes/
├── .order.json        # Section ordering
├── 1-weeks/
│   ├── .order.json    # Page ordering for this section
│   └── *.md
└── other-sections/
```
