# GitNotes Learnings

## Tauri/Rust Patterns

- `trash` crate (v5) for OS-native file deletion - recoverable via Finder
- `chrono` for date handling (ISO week: `now.iso_week().week()`)
- Icons: multiple sizes + `.icns` for macOS, use `iconutil` to generate
- macOS icons: transparent background OR full-bleed square (no baked-in rounded corners)

## UX Decisions

- OneNote-style persistent "+ Add" buttons at bottom of sidebars
- New items position based on sort order (DESC = top, ASC = bottom)
- Clicking "Untitled" auto-triggers rename mode
- Protected sections (1-todo, 1-weeks): disable menu options, don't hide them

## Design Principles

- **Git as source of truth** - Don't duplicate what git already tracks (modified dates, authorship). Query git instead of storing redundant data.
- **Transparent to user** - Solutions shouldn't add visible clutter. Hide implementation details (front matter hidden in editor, no sidecar files).
- **Audience: geeks/nerds** - Abstract git by default, but stay transparent for power users. Future expert mode for manual commit control.

## Work Style

- **Atomic commits** - "build all, one commit at the end" - focused implementation sessions with clean, single-purpose commits.
