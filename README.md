# NoteOne

Lightweight markdown notes app. OneNote replacement built with Tauri.

## Status

**v0.1** - First working build (2026-01-12)

## Features

- Two-panel sidebar (sections/pages) like OneNote
- Markdown editor with CodeMirror 6
- Auto-save (500ms debounce)
- Custom ordering via `.order.json` files
- Dark mode (follows system)

## Stack

- **Shell:** Tauri 2.0 (Rust)
- **Frontend:** Vanilla TypeScript
- **Editor:** CodeMirror 6

## Development

```bash
# Install dependencies
npm install

# Run dev mode
npm run tauri dev

# Build release
npm run tauri build
```

## Configuration

### Section ordering

Create `notes/.order.json`:
```json
{
  "sections": ["1-weeks", "1-todo", "gf-roadmap"],
  "defaultSort": "name-asc"
}
```

### Page ordering per section

Create `notes/<section>/.order.json`:
```json
{
  "sort": "name-desc",
  "pinned": ["important.md"]
}
```

Sort options: `name-asc`, `name-desc`, `created-asc`, `created-desc`, `modified-desc`, `manual`

## TODO

- [ ] Quick switcher (Cmd+P)
- [ ] Full-text search (Cmd+Shift+F)
- [ ] Inline markdown rendering (headers, bold, links)
- [ ] Keyboard shortcuts
- [ ] Create/delete pages
