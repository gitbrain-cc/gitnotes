# GitNotes - Claude Instructions

Lightweight markdown notes app. Tauri 2.0 (Rust) + TypeScript + ProseMirror.

**Workspace Context:** First read `../.claude/CLAUDE.md` for brain, gitbrain and cross-repo structure.

## Development

```bash
npm run tauri dev   # Dev mode
npm run tauri build # Release build
```

## Architecture

| File | Purpose |
|------|---------|
| `src-tauri/src/lib.rs` | Rust backend: filesystem, git, search index |
| `src-tauri/src/search.rs` | Tantivy full-text search |
| `src/main.ts` | Frontend entry, orchestration |
| `src/sidebar.ts` | Section/note navigation |
| `src/editor.ts` | ProseMirror editor |
| `src/search-bar.ts` | Unified search UI |
| `src/git-status.ts` | Git integration UI |
| `src/settings.ts` | Settings full-page view (third view mode alongside notes/git) |
| `src/contextmenu.ts` | Right-click menus |

## Key Patterns

- Vanilla TypeScript (no React/Vue)
- Tauri IPC via `invoke()`
- Auto-save with 500ms debounce
- Worktree directory: `.worktrees/` (project-local)

## Terminology

| Concept | UI Term | Code Term | Rationale |
|---------|---------|-----------|-----------|
| Top-level container | **Brain** | `Vault` | "Brain" in UI aligns with GitBrain ecosystem |
| Individual markdown file | **Note** | `Note` | Consistent everywhere, matches app name "GitNotes" |
| Folder grouping | **Section** | `Section` | Consistent everywhere |

**Note:** Only "Brain" vs `Vault` differs between UI and code. Use "Brain" in user-facing strings, `Vault` in code.

## Documentation

- `docs/usage/` - User documentation (search, git, shortcuts, etc.)
- `docs/todo/` - Roadmap and pending features
- `docs/design/` - UI/UX specifications
- `docs/plans/` - Historical design & implementation plans (dated)
