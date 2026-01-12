# Page Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add create, rename, delete, and move functionality for pages and sections.

**Architecture:** Backend commands in Rust handle file operations (using trash2 crate for safe deletion). Frontend adds UI elements (footer buttons, context menus, inline editing) and wires them to backend via Tauri invoke.

**Tech Stack:** Rust/Tauri backend, TypeScript frontend, trash2 crate for OS trash

---

## Task 1: Add trash2 dependency

**Files:**
- Modify: `src-tauri/Cargo.toml`

**Step 1: Add trash2 to Cargo.toml**

Add to `[dependencies]` section:

```toml
trash = "5"
```

**Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`

**Step 3: Commit**

```bash
git add src-tauri/Cargo.toml
git commit -m "feat: add trash2 crate for safe file deletion"
```

---

## Task 2: Backend - delete_page command

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add delete_page function after create_page (around line 198)**

```rust
#[tauri::command]
fn delete_page(path: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);

    if !file_path.exists() {
        return Err("Page not found".to_string());
    }

    trash::delete(&file_path).map_err(|e| e.to_string())
}
```

**Step 2: Register command in invoke_handler**

Add `delete_page` to the generate_handler! macro.

**Step 3: Verify it compiles**

Run: `cd src-tauri && cargo check`

**Step 4: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: add delete_page command with OS trash"
```

---

## Task 3: Backend - rename_page command

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add rename_page function**

```rust
#[tauri::command]
fn rename_page(old_path: String, new_name: String) -> Result<Page, String> {
    let old_file = PathBuf::from(&old_path);

    if !old_file.exists() {
        return Err("Page not found".to_string());
    }

    // Validate name - no filesystem-invalid chars
    let invalid_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
    if new_name.chars().any(|c| invalid_chars.contains(&c)) {
        return Err("Invalid characters in name".to_string());
    }

    let parent = old_file.parent().ok_or("Invalid path")?;
    let new_filename = format!("{}.md", new_name);
    let new_path = parent.join(&new_filename);

    if new_path.exists() {
        return Err("A page with that name already exists".to_string());
    }

    fs::rename(&old_file, &new_path).map_err(|e| e.to_string())?;

    Ok(Page {
        name: new_name,
        path: new_path.to_string_lossy().to_string(),
        filename: new_filename,
    })
}
```

**Step 2: Register command in invoke_handler**

**Step 3: Verify it compiles**

Run: `cd src-tauri && cargo check`

**Step 4: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: add rename_page command"
```

---

## Task 4: Backend - move_page command

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add move_page function**

```rust
#[tauri::command]
fn move_page(path: String, new_section_path: String) -> Result<Page, String> {
    let old_file = PathBuf::from(&path);

    if !old_file.exists() {
        return Err("Page not found".to_string());
    }

    let filename = old_file.file_name()
        .ok_or("Invalid filename")?
        .to_string_lossy()
        .to_string();

    let new_path = PathBuf::from(&new_section_path).join(&filename);

    if new_path.exists() {
        return Err("A page with that name already exists in the target section".to_string());
    }

    fs::rename(&old_file, &new_path).map_err(|e| e.to_string())?;

    Ok(Page {
        name: filename.trim_end_matches(".md").to_string(),
        path: new_path.to_string_lossy().to_string(),
        filename,
    })
}
```

**Step 2: Register command in invoke_handler**

**Step 3: Verify it compiles**

Run: `cd src-tauri && cargo check`

**Step 4: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: add move_page command"
```

---

## Task 5: Backend - section commands (create, rename, delete)

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add PROTECTED_SECTIONS constant at top of file (after imports)**

```rust
const PROTECTED_SECTIONS: &[&str] = &["1-todo", "1-weeks"];
```

**Step 2: Add create_section function**

```rust
#[tauri::command]
fn create_section(name: String) -> Result<Section, String> {
    let invalid_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
    if name.chars().any(|c| invalid_chars.contains(&c)) {
        return Err("Invalid characters in name".to_string());
    }

    let notes_path = get_notes_path();
    let section_path = notes_path.join(&name);

    if section_path.exists() {
        return Err("Section already exists".to_string());
    }

    fs::create_dir(&section_path).map_err(|e| e.to_string())?;

    Ok(Section {
        name,
        path: section_path.to_string_lossy().to_string(),
    })
}
```

**Step 3: Add rename_section function**

```rust
#[tauri::command]
fn rename_section(path: String, new_name: String) -> Result<Section, String> {
    let old_dir = PathBuf::from(&path);

    if !old_dir.exists() {
        return Err("Section not found".to_string());
    }

    let old_name = old_dir.file_name()
        .ok_or("Invalid path")?
        .to_string_lossy()
        .to_lowercase();

    if PROTECTED_SECTIONS.contains(&old_name.as_str()) {
        return Err("This section cannot be renamed".to_string());
    }

    let invalid_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
    if new_name.chars().any(|c| invalid_chars.contains(&c)) {
        return Err("Invalid characters in name".to_string());
    }

    let parent = old_dir.parent().ok_or("Invalid path")?;
    let new_path = parent.join(&new_name);

    if new_path.exists() {
        return Err("A section with that name already exists".to_string());
    }

    fs::rename(&old_dir, &new_path).map_err(|e| e.to_string())?;

    Ok(Section {
        name: new_name,
        path: new_path.to_string_lossy().to_string(),
    })
}
```

**Step 4: Add delete_section function**

```rust
#[tauri::command]
fn delete_section(path: String) -> Result<(), String> {
    let dir_path = PathBuf::from(&path);

    if !dir_path.exists() {
        return Err("Section not found".to_string());
    }

    let name = dir_path.file_name()
        .ok_or("Invalid path")?
        .to_string_lossy()
        .to_lowercase();

    if PROTECTED_SECTIONS.contains(&name.as_str()) {
        return Err("This section cannot be deleted".to_string());
    }

    trash::delete(&dir_path).map_err(|e| e.to_string())
}
```

**Step 5: Register all three commands in invoke_handler**

**Step 6: Verify it compiles**

Run: `cd src-tauri && cargo check`

**Step 7: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: add section management commands (create, rename, delete)"
```

---

## Task 6: Backend - smart create_page for WEEKS section

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add chrono dependency to Cargo.toml**

```toml
chrono = "0.4"
```

**Step 2: Add use statement at top of lib.rs**

```rust
use chrono::{Datelike, Local};
```

**Step 3: Add get_week_name helper function**

```rust
fn get_week_name() -> String {
    let now = Local::now();
    format!("{}-{:02}", now.year(), now.iso_week().week())
}
```

**Step 4: Add create_page_smart command (keeps old create_page for compatibility)**

```rust
#[tauri::command]
fn create_page_smart(section_path: String) -> Result<Page, String> {
    let path = PathBuf::from(&section_path);
    let section_name = path.file_name()
        .ok_or("Invalid path")?
        .to_string_lossy()
        .to_lowercase();

    let base_name = if section_name == "1-weeks" {
        get_week_name()
    } else {
        "Untitled".to_string()
    };

    // Find unique name if exists
    let mut name = base_name.clone();
    let mut counter = 1;
    loop {
        let filename = format!("{}.md", name);
        let file_path = path.join(&filename);
        if !file_path.exists() {
            break;
        }
        counter += 1;
        name = format!("{} {}", base_name, counter);
    }

    let filename = format!("{}.md", name);
    let file_path = path.join(&filename);

    fs::write(&file_path, format!("# {}\n\n", name)).map_err(|e| e.to_string())?;

    Ok(Page {
        name,
        path: file_path.to_string_lossy().to_string(),
        filename,
    })
}
```

**Step 5: Register create_page_smart in invoke_handler**

**Step 6: Verify it compiles**

Run: `cd src-tauri && cargo check`

**Step 7: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/lib.rs
git commit -m "feat: add smart page creation with WEEKS auto-naming"
```

---

## Task 7: Frontend - Add sidebar footer buttons

**Files:**
- Modify: `index.html`
- Modify: `src/styles/main.css`

**Step 1: Update index.html sidebar structure**

Replace sections sidebar:
```html
<aside id="sections" class="sidebar">
  <div class="sidebar-header">Sections</div>
  <ul id="sections-list"></ul>
  <div class="sidebar-footer">
    <button id="add-section-btn" class="sidebar-add-btn">+ Add section</button>
  </div>
</aside>
```

Replace pages sidebar:
```html
<aside id="pages" class="sidebar">
  <div class="sidebar-header">Pages</div>
  <ul id="pages-list"></ul>
  <div class="sidebar-footer">
    <button id="add-page-btn" class="sidebar-add-btn">+ Add page</button>
  </div>
</aside>
```

**Step 2: Add CSS for sidebar footer and buttons**

Add to main.css:
```css
.sidebar-footer {
  padding: 8px;
  border-top: 1px solid var(--bg-tertiary);
}

.sidebar-add-btn {
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  border-radius: 4px;
}

.sidebar-add-btn:hover {
  background: var(--bg-tertiary);
  color: var(--accent-color);
}
```

**Step 3: Commit**

```bash
git add index.html src/styles/main.css
git commit -m "feat: add sidebar footer buttons for creating pages/sections"
```

---

## Task 8: Frontend - Add context menu component

**Files:**
- Create: `src/contextmenu.ts`
- Modify: `src/styles/main.css`

**Step 1: Create contextmenu.ts**

```typescript
interface MenuItem {
  label: string;
  action: () => void;
  disabled?: boolean;
}

let activeMenu: HTMLElement | null = null;

export function showContextMenu(x: number, y: number, items: MenuItem[]) {
  hideContextMenu();

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  for (const item of items) {
    const menuItem = document.createElement('div');
    menuItem.className = 'context-menu-item';
    if (item.disabled) {
      menuItem.classList.add('disabled');
    }
    menuItem.textContent = item.label;

    if (!item.disabled) {
      menuItem.addEventListener('click', () => {
        hideContextMenu();
        item.action();
      });
    }

    menu.appendChild(menuItem);
  }

  document.body.appendChild(menu);
  activeMenu = menu;

  // Close on click outside
  setTimeout(() => {
    document.addEventListener('click', hideContextMenu, { once: true });
  }, 0);
}

export function hideContextMenu() {
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
  }
}
```

**Step 2: Add CSS for context menu**

```css
.context-menu {
  position: fixed;
  background: var(--bg-secondary);
  border: 1px solid var(--bg-tertiary);
  border-radius: 6px;
  padding: 4px 0;
  min-width: 150px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

.context-menu-item {
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
}

.context-menu-item:hover {
  background: var(--bg-tertiary);
}

.context-menu-item.disabled {
  color: var(--text-secondary);
  cursor: default;
}

.context-menu-item.disabled:hover {
  background: transparent;
}
```

**Step 3: Commit**

```bash
git add src/contextmenu.ts src/styles/main.css
git commit -m "feat: add context menu component"
```

---

## Task 9: Frontend - Wire up page management in sidebar

**Files:**
- Modify: `src/sidebar.ts`
- Modify: `src/main.ts`

**Step 1: Add invoke functions to main.ts**

```typescript
export async function createPageSmart(sectionPath: string): Promise<Page> {
  return await invoke('create_page_smart', { sectionPath });
}

export async function deletePage(path: string): Promise<void> {
  return await invoke('delete_page', { path });
}

export async function renamePage(oldPath: string, newName: string): Promise<Page> {
  return await invoke('rename_page', { oldPath, newName });
}

export async function movePage(path: string, newSectionPath: string): Promise<Page> {
  return await invoke('move_page', { path, newSectionPath });
}

export async function createSection(name: string): Promise<Section> {
  return await invoke('create_section', { name });
}

export async function renameSection(path: string, newName: string): Promise<Section> {
  return await invoke('rename_section', { path, newName });
}

export async function deleteSection(path: string): Promise<void> {
  return await invoke('delete_section', { path });
}
```

**Step 2: Update sidebar.ts imports**

```typescript
import {
  loadSections, loadPages, readPage, setCurrentPage, setStatus, updateWordCount,
  createPageSmart, deletePage, renamePage, createSection, renameSection, deleteSection
} from './main';
import { showContextMenu } from './contextmenu';
```

**Step 3: Add context menu to page items in renderPages()**

Update the page li creation:
```typescript
li.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  showContextMenu(e.clientX, e.clientY, [
    { label: 'Rename', action: () => startRename(page, li) },
    { label: 'Delete', action: () => handleDeletePage(page) }
  ]);
});
```

**Step 4: Add helper functions for page operations**

```typescript
async function handleDeletePage(page: Page) {
  try {
    await deletePage(page.path);
    if (currentSection) {
      const pages = await loadPages(currentSection.path);
      renderPages(pages);
      if (pages.length > 0) {
        await selectPage(pages[0]);
      }
    }
  } catch (err) {
    console.error('Delete error:', err);
  }
}

function startRename(page: Page, li: HTMLElement) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = page.name;
  input.className = 'inline-rename';

  li.textContent = '';
  li.appendChild(input);
  input.focus();
  input.select();

  const finishRename = async () => {
    const newName = input.value.trim();
    if (newName && newName !== page.name) {
      try {
        await renamePage(page.path, newName);
      } catch (err) {
        console.error('Rename error:', err);
      }
    }
    if (currentSection) {
      const pages = await loadPages(currentSection.path);
      renderPages(pages);
    }
  };

  input.addEventListener('blur', finishRename);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      input.blur();
    } else if (e.key === 'Escape') {
      input.value = page.name;
      input.blur();
    }
  });
}
```

**Step 5: Wire up add buttons (at end of initSidebar)**

```typescript
document.getElementById('add-section-btn')?.addEventListener('click', async () => {
  try {
    await createSection('Untitled');
    sections = await loadSections();
    renderSections();
  } catch (err) {
    console.error('Create section error:', err);
  }
});

document.getElementById('add-page-btn')?.addEventListener('click', async () => {
  if (!currentSection) return;
  try {
    const page = await createPageSmart(currentSection.path);
    const pages = await loadPages(currentSection.path);
    renderPages(pages);
    await selectPage(page);

    // Auto-trigger rename if Untitled
    if (page.name === 'Untitled' || page.name.startsWith('Untitled ')) {
      const li = document.querySelector(`[data-path="${page.path}"]`) as HTMLElement;
      if (li) startRename(page, li);
    }
  } catch (err) {
    console.error('Create page error:', err);
  }
});
```

**Step 6: Add inline-rename CSS**

```css
.inline-rename {
  width: 100%;
  padding: 2px 4px;
  font-size: 13px;
  background: var(--bg-primary);
  border: 1px solid var(--accent-color);
  color: var(--text-primary);
  outline: none;
  border-radius: 2px;
}
```

**Step 7: Commit**

```bash
git add src/main.ts src/sidebar.ts src/styles/main.css
git commit -m "feat: wire up page create/rename/delete functionality"
```

---

## Task 10: Frontend - Section context menu and Untitled click behavior

**Files:**
- Modify: `src/sidebar.ts`

**Step 1: Add context menu to section items in renderSections()**

```typescript
const isProtected = ['1-todo', '1-weeks'].includes(section.name.toLowerCase());

li.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  showContextMenu(e.clientX, e.clientY, [
    { label: 'Rename', action: () => startSectionRename(section, li), disabled: isProtected },
    { label: 'Delete', action: () => handleDeleteSection(section), disabled: isProtected }
  ]);
});
```

**Step 2: Add section operation helpers**

```typescript
async function handleDeleteSection(section: Section) {
  try {
    await deleteSection(section.path);
    sections = await loadSections();
    renderSections();
    if (sections.length > 0) {
      await selectSection(sections[0]);
    }
  } catch (err) {
    console.error('Delete section error:', err);
  }
}

function startSectionRename(section: Section, li: HTMLElement) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = section.name;
  input.className = 'inline-rename';

  li.textContent = '';
  li.appendChild(input);
  input.focus();
  input.select();

  const finishRename = async () => {
    const newName = input.value.trim();
    if (newName && newName !== section.name) {
      try {
        await renameSection(section.path, newName);
      } catch (err) {
        console.error('Rename error:', err);
      }
    }
    sections = await loadSections();
    renderSections();
  };

  input.addEventListener('blur', finishRename);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      input.blur();
    } else if (e.key === 'Escape') {
      input.value = section.name;
      input.blur();
    }
  });
}
```

**Step 3: Add Untitled auto-rename on click in selectPage()**

At the end of selectPage(), after content loads:
```typescript
// Auto-trigger rename for Untitled pages
if (page.name === 'Untitled' || page.name.startsWith('Untitled ')) {
  const li = document.querySelector(`[data-path="${page.path}"]`) as HTMLElement;
  if (li && !li.querySelector('input')) {
    startRename(page, li);
  }
}
```

**Step 4: Commit**

```bash
git add src/sidebar.ts
git commit -m "feat: add section context menu and Untitled auto-rename"
```

---

## Task 11: Frontend - Drag and drop for moving pages

**Files:**
- Modify: `src/sidebar.ts`
- Modify: `src/styles/main.css`

**Step 1: Make page items draggable in renderPages()**

```typescript
li.draggable = true;
li.addEventListener('dragstart', (e) => {
  e.dataTransfer?.setData('text/plain', page.path);
  li.classList.add('dragging');
});
li.addEventListener('dragend', () => {
  li.classList.remove('dragging');
});
```

**Step 2: Make sections drop targets in renderSections()**

```typescript
li.addEventListener('dragover', (e) => {
  e.preventDefault();
  li.classList.add('drop-target');
});
li.addEventListener('dragleave', () => {
  li.classList.remove('drop-target');
});
li.addEventListener('drop', async (e) => {
  e.preventDefault();
  li.classList.remove('drop-target');
  const pagePath = e.dataTransfer?.getData('text/plain');
  if (pagePath && section.path !== currentSection?.path) {
    try {
      await movePage(pagePath, section.path);
      if (currentSection) {
        const pages = await loadPages(currentSection.path);
        renderPages(pages);
        if (pages.length > 0) {
          await selectPage(pages[0]);
        }
      }
    } catch (err) {
      console.error('Move error:', err);
    }
  }
});
```

**Step 3: Add drag/drop CSS**

```css
.sidebar li.dragging {
  opacity: 0.5;
}

.sidebar li.drop-target {
  background: var(--accent-color);
  color: white;
}
```

**Step 4: Commit**

```bash
git add src/sidebar.ts src/styles/main.css
git commit -m "feat: add drag and drop for moving pages between sections"
```

---

## Task 12: Final integration test

**Step 1: Restart dev server**

Kill existing and run: `source ~/.cargo/env && npm run tauri dev`

**Step 2: Manual test checklist**

- [ ] Click "+ Add page" creates Untitled, opens rename mode
- [ ] Click "+ Add section" creates Untitled folder
- [ ] Right-click page → Rename works
- [ ] Right-click page → Delete moves to Trash
- [ ] Right-click section → Rename works (non-protected)
- [ ] Right-click 1-todo/1-weeks shows disabled options
- [ ] Drag page to different section moves file
- [ ] In WEEKS section, new page gets YYYY-WW name

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete page management implementation"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Add trash2 dependency |
| 2 | Backend delete_page |
| 3 | Backend rename_page |
| 4 | Backend move_page |
| 5 | Backend section commands |
| 6 | Backend smart create_page |
| 7 | Frontend sidebar buttons |
| 8 | Frontend context menu |
| 9 | Frontend page operations |
| 10 | Frontend section operations |
| 11 | Frontend drag and drop |
| 12 | Integration test |
