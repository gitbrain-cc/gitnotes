# GitNotes

Lightweight markdown notes app for developers. Git-native OneNote replacement built with Tauri.

## Features

- **Two-panel sidebar** - Sections and notes, like OneNote
- **Live markdown preview** - Inline rendering of headers, bold, links, code
- **Full-text search** - Tantivy-powered instant search (Cmd+P)
- **Git integration** - Visual git status, commit history, diffs
- **Multi-vault support** - Switch between multiple note repositories
- **Smart commits** - Auto-commit with configurable intervals
- **6 themes** - System, Original, Yellow Pad, Classic Light/Dark, True Dark

## Stack

- **Shell:** Tauri 2.0 (Rust)
- **Frontend:** Vanilla TypeScript
- **Editor:** CodeMirror 6
- **Search:** Tantivy

## Development

```bash
npm install
npm run tauri dev    # Dev mode
npm run tauri build  # Release build
```

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Search | Cmd+P |
| Settings | Cmd+, |
| New note | Cmd+N |
| Save | Cmd+S |

## Configuration

Settings stored in `~/Library/Application Support/gitnotes/settings.json`

### Section ordering

Create `.section.md` in any section folder:
```yaml
---
displayName: My Section
color: "#f59e0b"
---
```

### Note ordering

Sort options available per section: Alphabetical, Date Created, Date Modified
