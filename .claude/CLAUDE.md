# NoteOne - Claude Instructions

Lightweight markdown notes app. Tauri 2.0 (Rust) + TypeScript + CodeMirror 6.

## Development

```bash
npm run tauri dev   # Dev mode
npm run tauri build # Release build
```

## Architecture

| File | Purpose |
|------|---------|
| `src-tauri/src/lib.rs` | Rust backend: filesystem, git, search index |
| `src/main.ts` | Frontend entry, orchestration |
| `src/sidebar.ts` | Section/page navigation |
| `src/editor.ts` | CodeMirror setup |
| `src/search-bar.ts` | Unified search UI |
| `src/git-status.ts` | Git integration UI |

## Key Patterns

- Vanilla TypeScript (no React/Vue)
- Tauri IPC via `invoke()`
- Auto-save with 500ms debounce

## Documentation

- `docs/usage/` - User documentation (search, git, shortcuts, etc.)
- `docs/todo/` - Roadmap and pending features
- `docs/design/` - UI/UX specifications
- `docs/plans/` - Historical design & implementation plans (dated)
