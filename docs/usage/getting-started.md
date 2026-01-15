# Getting Started

NoteOne is a lightweight markdown notes app. Your notes are plain files in a git-tracked directory.

## Layout

```
┌─────────────────────────────────────────────────────────┐
│  [Git Status]              [Search...]                  │
├──────────┬──────────┬───────────────────────────────────┤
│ SECTIONS │  PAGES   │  Page Title                       │
│          │          │  Created 2d ago · Modified info   │
│ Weekly   │ 2026-03  ├───────────────────────────────────┤
│ Todo     │ 2026-02  │                                   │
│ Projects │ 2026-01  │  Your markdown content here...    │
│          │          │                                   │
│          │          │                                   │
├──────────┴──────────┴───────────────────────────────────┤
│  Ready                                        124 words │
└─────────────────────────────────────────────────────────┘
```

- **Sections** - Folders containing your notes
- **Pages** - Individual markdown files
- **Editor** - Write with auto-save (500ms debounce)

## Quick Start

1. **Open a page** - Click a section, then click a page
2. **Search** - Press **Cmd+P** to find files or content
3. **Create** - Click "+ Add page" or "+ Add section"
4. **Organize** - Drag pages between sections, right-click for more options

## Key Features

### Auto-Save
Changes save automatically. The status bar shows "Modified..." then "Saved".

### Git Tracking
Your notes directory is a git repo. The top-left shows commit status and history.

### Markdown
Full markdown support with syntax highlighting. Headers, bold, italic, links, and code all render with visual styling.

## Files

Notes are stored as plain markdown:
- `~/tetronomis/dotfiles/notes/` (default location)
- Each section is a folder
- Each page is a `.md` file

See [Notes Directory Format](./notes-directory-format.md) for details on the file structure.

## More Help

- [Keyboard Shortcuts](./keyboard-shortcuts.md)
- [Page Management](./page-management.md)
- [Search](./search.md)
- [Git Integration](./git-integration.md)
