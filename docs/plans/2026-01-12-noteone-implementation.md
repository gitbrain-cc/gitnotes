# NoteOne - Implementation Plan

**Date:** 2026-01-12
**Target:** First working build

## Phase 1: Project Scaffold

1. Initialize Tauri 2.0 project with TypeScript frontend
2. Configure for macOS (Apple Silicon + Intel)
3. Set up basic HTML shell with three-panel layout
4. Verify dev mode works (`npm run tauri dev`)

## Phase 2: File System Backend (Rust)

1. Create `files.rs` module:
   - `list_sections(path)` - list directories in notes root
   - `list_pages(section_path)` - list .md files in section
   - `read_page(path)` - read file content
   - `write_page(path, content)` - save file content
   - `get_file_metadata(path)` - created/modified dates

2. Create `config.rs` module:
   - Load app config from `~/.config/noteone/config.json`
   - Load `.order.json` files for sorting
   - Provide defaults if files don't exist

3. Register Tauri commands for frontend access

## Phase 3: Sidebar UI (TypeScript)

1. Build sections panel:
   - Fetch sections list via Tauri IPC
   - Render as clickable list
   - Apply ordering from config
   - Highlight active section

2. Build pages panel:
   - Fetch pages for selected section
   - Render with filename (strip .md)
   - Apply section sort order
   - Highlight active page

3. Wire up click handlers to select section/page

## Phase 4: Editor Integration

1. Install CodeMirror 6 + markdown extensions:
   - `@codemirror/lang-markdown`
   - `@codemirror/theme-one-dark` (for dark mode)
   - Extensions for inline rendering

2. Create editor component:
   - Initialize CodeMirror with markdown mode
   - Load content when page selected
   - Style headers, bold, italic inline

3. Implement auto-save:
   - Debounce changes (500ms)
   - Call Rust backend to write file
   - Update status bar

## Phase 5: Basic Styling

1. Three-column layout with resizable panels
2. Light theme matching macOS
3. Dark theme following system preference
4. Clean typography for editor

## Phase 6: Search (Basic)

1. Quick switcher (Cmd+P):
   - Modal overlay with input
   - Fuzzy match against all filenames
   - Navigate to selected file

2. Full-text search deferred to v1.1 (Tantivy integration is complex)

## Phase 7: Keyboard Shortcuts & Polish

1. Wire up shortcuts:
   - Cmd+P: quick switcher
   - Cmd+N: new page
   - Cmd+1/2: focus editor/sidebar
   - Esc: close modals

2. Native menu bar integration

3. Status bar (saved status, word count)

## First Build Milestone

At end of Phase 7, we have:
- Working .app that opens
- Can browse sections and pages
- Can edit and auto-save markdown
- Basic quick switcher
- Looks decent

## Files to Create

```
src-tauri/
  src/main.rs
  src/files.rs
  src/config.rs
  Cargo.toml
  tauri.conf.json

src/
  index.html
  main.ts
  sidebar.ts
  editor.ts
  search.ts
  styles/main.css
  styles/editor.css

package.json
tsconfig.json
```

## Dependencies

**Rust (Cargo.toml):**
- tauri
- serde + serde_json

**Frontend (package.json):**
- @tauri-apps/api
- @tauri-apps/cli
- codemirror
- @codemirror/lang-markdown
- @codemirror/view
- @codemirror/state
- typescript
- vite
