# Page Management Design

## Overview

Add create, rename, delete, and move functionality for pages and sections in NoteOne.

## UI Structure

### Sidebar Footer Actions

Each sidebar column gets a persistent footer link:
- Sections column: **"+ Add section"**
- Pages column: **"+ Add page"**

Styled subtly (muted text, accent color on hover).

### Right-Click Context Menus

**Pages:**
- Rename
- Delete

**Sections:**
- Rename (disabled for TODO, WEEKS)
- Delete (disabled for TODO, WEEKS)

## Behavior

### Creating Pages

- Click "Add page" → creates `Untitled.md` in current section
- Position: top if DESC sort, bottom if ASC sort
- Immediately selected and focused in editor
- **WEEKS section special case:** defaults to `YYYY-WW.md` using current week

### Creating Sections

- Click "Add section" → creates `Untitled` folder
- Position: top if DESC sort, bottom if ASC sort
- Immediately selected

### Renaming

- Right-click → Rename → inline edit in sidebar
- Enter confirms, Escape cancels
- Validation: block `/\:*?"<>|` characters
- File/folder renamed on disk

### Deleting

- Right-click → Delete → moves to OS Trash (recoverable via Finder)
- No confirmation dialog
- If deleting current page, select adjacent page

### Moving Pages

- Drag page row → drop on section → moves file to that folder

### Polish: Untitled Auto-Rename

- Clicking a page named "Untitled" opens it AND triggers inline rename mode
- Guides user to name their note naturally

## Protected Sections

**TODO** and **WEEKS** cannot be renamed or deleted.

## Backend Commands

### New Commands

```rust
rename_page(old_path: String, new_name: String) -> Result<Page>
delete_page(path: String) -> Result<()>  // uses OS trash
move_page(path: String, new_section_path: String) -> Result<Page>
create_section(name: String) -> Result<Section>
rename_section(path: String, new_name: String) -> Result<Section>
delete_section(path: String) -> Result<()>  // uses OS trash, blocked for TODO/WEEKS
```

### Existing (modify)

- `create_page` - add default naming logic for WEEKS section

## Naming Rules

- Minimal restrictions: block filesystem-invalid characters only
- WEEKS section: default format `YYYY-WW`, suffixes allowed (e.g., `2025-44 (Belgrade)`)

## Summary

| Action | Trigger | Behavior |
|--------|---------|----------|
| Add page | Click "+ Add page" | Creates Untitled (or YYYY-WW in WEEKS), selects it |
| Add section | Click "+ Add section" | Creates Untitled folder, selects it |
| Rename | Right-click → Rename | Inline edit, Enter confirms |
| Delete | Right-click → Delete | Moves to OS Trash |
| Move page | Drag & drop | Drag page onto section |
| Click Untitled | Click | Opens page + triggers rename mode |
