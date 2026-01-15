# Section Metadata & Color Ribbons Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add color ribbons and display names to sections, stored in `.section.md` files with YAML front matter.

**Architecture:** Each section folder can contain a `.section.md` file with YAML front matter for `title` and `color`. The Rust backend parses this when loading sections. The frontend renders colored ribbons with gradient bleed effect on selection.

**Tech Stack:** Rust (Tauri backend), TypeScript (vanilla frontend), CSS variables for theming

---

## Task 1: Add SectionMetadata struct and parsing in Rust

**Files:**
- Modify: `src-tauri/src/lib.rs:14-17` (Section struct)
- Modify: `src-tauri/src/lib.rs:165-207` (list_sections function)

**Step 1: Add SectionMetadata struct after Section struct (around line 17)**

```rust
#[derive(Debug, Serialize, Deserialize, Default)]
pub struct SectionMetadata {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
}
```

**Step 2: Update Section struct to include metadata fields**

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct Section {
    pub name: String,
    pub path: String,
    pub title: Option<String>,
    pub color: Option<String>,
}
```

**Step 3: Add helper function to parse section metadata (after `parse_frontmatter` function, around line 80)**

```rust
fn load_section_metadata(section_path: &PathBuf) -> SectionMetadata {
    let metadata_file = section_path.join(".section.md");
    if !metadata_file.exists() {
        return SectionMetadata::default();
    }

    if let Ok(content) = fs::read_to_string(&metadata_file) {
        if content.starts_with("---\n") {
            if let Some(end) = content[4..].find("\n---") {
                let yaml_str = &content[4..4 + end];
                if let Ok(metadata) = serde_yaml::from_str::<SectionMetadata>(yaml_str) {
                    return metadata;
                }
            }
        }
    }

    SectionMetadata::default()
}
```

**Step 4: Update list_sections to load metadata (modify the filter_map closure around line 176)**

Replace:
```rust
Some(Section {
    name: entry.file_name().to_string_lossy().to_string(),
    path: path.to_string_lossy().to_string(),
})
```

With:
```rust
let metadata = load_section_metadata(&path);
Some(Section {
    name: entry.file_name().to_string_lossy().to_string(),
    path: path.to_string_lossy().to_string(),
    title: metadata.title,
    color: metadata.color,
})
```

**Step 5: Verify it compiles**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`
Expected: App launches without errors

---

## Task 2: Add save_section_metadata Tauri command

**Files:**
- Modify: `src-tauri/src/lib.rs` (add new command)

**Step 1: Add the save function (after load_section_metadata)**

```rust
fn save_section_metadata(section_path: &PathBuf, metadata: &SectionMetadata) -> Result<(), String> {
    let metadata_file = section_path.join(".section.md");

    let mut lines = vec!["---".to_string()];
    if let Some(ref title) = metadata.title {
        lines.push(format!("title: \"{}\"", title));
    }
    if let Some(ref color) = metadata.color {
        lines.push(format!("color: \"{}\"", color));
    }
    lines.push("---".to_string());

    let content = lines.join("\n");
    fs::write(&metadata_file, content).map_err(|e| e.to_string())
}
```

**Step 2: Add Tauri command wrapper**

```rust
#[tauri::command]
fn set_section_metadata(section_path: String, title: Option<String>, color: Option<String>) -> Result<(), String> {
    let path = PathBuf::from(&section_path);
    let metadata = SectionMetadata { title, color };
    save_section_metadata(&path, &metadata)
}
```

**Step 3: Register the command in the invoke_handler (around line 1131)**

Add `set_section_metadata` to the list:
```rust
.invoke_handler(tauri::generate_handler![
    list_sections,
    list_pages,
    // ... existing commands ...
    set_section_metadata,
])
```

**Step 4: Verify it compiles**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`
Expected: App launches without errors

---

## Task 3: Update rename_section to use metadata instead of folder rename

**Files:**
- Modify: `src-tauri/src/lib.rs:596-631` (rename_section function)

**Step 1: Replace the rename_section implementation**

```rust
#[tauri::command]
fn rename_section(path: String, new_name: String) -> Result<Section, String> {
    let section_path = PathBuf::from(&path);

    if !section_path.exists() {
        return Err("Section not found".to_string());
    }

    let folder_name = section_path.file_name()
        .ok_or("Invalid path")?
        .to_string_lossy()
        .to_string();

    let old_name_lower = folder_name.to_lowercase();
    if PROTECTED_SECTIONS.contains(&old_name_lower.as_str()) {
        return Err("This section cannot be renamed".to_string());
    }

    // Load existing metadata to preserve color
    let mut metadata = load_section_metadata(&section_path);
    metadata.title = Some(new_name.clone());

    // Save updated metadata
    save_section_metadata(&section_path, &metadata)?;

    Ok(Section {
        name: folder_name,
        path: path,
        title: metadata.title,
        color: metadata.color,
    })
}
```

**Step 2: Verify it compiles and test**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`
Test: Right-click a section → Rename → Enter new name
Expected: Display name changes but folder stays the same

---

## Task 4: Add CSS for colored ribbons

**Files:**
- Modify: `src/styles/main.css:83-101` (sidebar li styles)

**Step 1: Update the base sidebar li style (around line 83)**

Add after existing `.sidebar li` rule:
```css
.sidebar li {
  padding: 10px 16px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-left: 3px solid transparent;
  transition: border-width 150ms ease, background 150ms ease, border-color 150ms ease;
}
```

**Step 2: Update the active state (replace existing .sidebar li.active)**

```css
.sidebar li.active {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-left-width: 5px;
  padding-left: 11px;
}

/* Section with custom color */
#sections-list li[data-color] {
  border-left-color: var(--section-color);
  border-left-style: solid;
  opacity: 0.85;
}

#sections-list li[data-color]:hover {
  opacity: 1;
}

#sections-list li[data-color].active {
  opacity: 1;
  background: linear-gradient(90deg,
    color-mix(in srgb, var(--section-color) 25%, transparent) 0%,
    transparent 40%
  );
}

/* Fallback for sections without custom color */
#sections-list li:not([data-color]).active {
  border-left-color: var(--accent-color);
}
```

**Step 3: Verify styles load**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`
Expected: App launches, active section has accent-colored left border

---

## Task 5: Update frontend Section interface and rendering

**Files:**
- Modify: `src/sidebar.ts:10-13` (Section interface)
- Modify: `src/sidebar.ts:174-231` (renderSections function)

**Step 1: Update Section interface (line 10-13)**

```typescript
interface Section {
  name: string;
  path: string;
  title?: string;
  color?: string;
}
```

**Step 2: Update renderSections to display title and set color (around line 182)**

Replace:
```typescript
li.textContent = section.name;
```

With:
```typescript
li.textContent = section.title || section.name;

if (section.color) {
  li.dataset.color = section.color;
  li.style.setProperty('--section-color', section.color);
}
```

**Step 3: Verify rendering works**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`
Expected: Sections display names (unchanged for now, no .section.md files exist yet)

---

## Task 6: Create color picker component

**Files:**
- Create: `src/colorpicker.ts`

**Step 1: Create the color picker file**

```typescript
const PRESET_COLORS = [
  '#e8a849', // orange/gold (accent)
  '#e85d5d', // coral red
  '#d65db1', // magenta
  '#845ec2', // purple
  '#4a9f4a', // green
  '#00b4d8', // cyan
  '#5b8def', // blue
  '#8b7355', // brown/earth
];

let activePicker: HTMLElement | null = null;
let currentCallback: ((color: string | null) => void) | null = null;

export function showColorPicker(x: number, y: number, currentColor: string | null, onSelect: (color: string | null) => void) {
  hideColorPicker();
  currentCallback = onSelect;

  const picker = document.createElement('div');
  picker.className = 'color-picker';
  picker.style.left = `${x}px`;
  picker.style.top = `${y}px`;

  // Preset swatches
  const swatches = document.createElement('div');
  swatches.className = 'color-swatches';

  for (const color of PRESET_COLORS) {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.backgroundColor = color;
    if (color === currentColor) {
      swatch.classList.add('selected');
    }
    swatch.addEventListener('click', () => {
      hideColorPicker();
      onSelect(color);
    });
    swatches.appendChild(swatch);
  }

  picker.appendChild(swatches);

  // Clear button
  const clearBtn = document.createElement('button');
  clearBtn.className = 'color-clear-btn';
  clearBtn.textContent = 'Clear color';
  clearBtn.addEventListener('click', () => {
    hideColorPicker();
    onSelect(null);
  });
  picker.appendChild(clearBtn);

  document.body.appendChild(picker);
  activePicker = picker;

  // Close on click outside
  setTimeout(() => {
    document.addEventListener('click', handleOutsideClick);
  }, 0);
}

function handleOutsideClick(e: MouseEvent) {
  if (activePicker && !activePicker.contains(e.target as Node)) {
    hideColorPicker();
  }
}

export function hideColorPicker() {
  if (activePicker) {
    activePicker.remove();
    activePicker = null;
  }
  document.removeEventListener('click', handleOutsideClick);
  currentCallback = null;
}
```

**Step 2: Verify file created**

Run: `ls -la /Users/simon/tetronomis/noteone/src/colorpicker.ts`
Expected: File exists

---

## Task 7: Add color picker CSS styles

**Files:**
- Modify: `src/styles/main.css` (add at end of file)

**Step 1: Add color picker styles**

```css
/* Color Picker */
.color-picker {
  position: fixed;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1001;
}

.color-swatches {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.color-swatch {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: transform 100ms ease, border-color 100ms ease;
}

.color-swatch:hover {
  transform: scale(1.1);
}

.color-swatch.selected {
  border-color: var(--text-primary);
}

.color-clear-btn {
  width: 100%;
  padding: 6px 12px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.color-clear-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
```

**Step 2: Verify styles added**

Run: `grep -c "color-picker" /Users/simon/tetronomis/noteone/src/styles/main.css`
Expected: Output shows matches

---

## Task 8: Wire up context menu "Set Color" action

**Files:**
- Modify: `src/sidebar.ts:1-8` (imports)
- Modify: `src/sidebar.ts:222-228` (context menu items)
- Modify: `src/main.ts` (add setSectionMetadata export)

**Step 1: Add import for color picker in sidebar.ts (after line 8)**

```typescript
import { showColorPicker } from './colorpicker';
```

**Step 2: Add setSectionMetadata to main.ts exports**

In `main.ts`, add the invoke wrapper:
```typescript
export async function setSectionMetadata(sectionPath: string, title: string | null, color: string | null) {
  await invoke('set_section_metadata', {
    sectionPath,
    title: title || null,
    color: color || null,
  });
}
```

**Step 3: Add import in sidebar.ts**

Update the import from main.ts to include setSectionMetadata:
```typescript
import {
  loadSections, loadPages, setCurrentPage, setStatus,
  createPageSmart, deletePage, renamePage, createSection, renameSection, deleteSection, movePage,
  loadPageWithHeader, setSectionMetadata
} from './main';
```

**Step 4: Add "Set Color" to context menu (in renderSections, around line 224)**

Replace the context menu items:
```typescript
li.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  showContextMenu(e.clientX, e.clientY, [
    { label: 'Rename', action: () => startSectionRename(section, li), disabled: isProtected },
    {
      label: 'Set Color',
      action: () => {
        showColorPicker(e.clientX, e.clientY, section.color || null, async (color) => {
          try {
            await setSectionMetadata(section.path, section.title || null, color);
            sections = await loadSections();
            renderSections();
          } catch (err) {
            console.error('Set color error:', err);
          }
        });
      }
    },
    { label: 'Delete', action: () => handleDeleteSection(section), disabled: isProtected }
  ]);
});
```

**Step 5: Test the full flow**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`
Test:
1. Right-click any section
2. Click "Set Color"
3. Select a color
4. Verify ribbon appears with that color
5. Click section to verify gradient bleed effect

Expected: Section shows colored ribbon, selected state shows gradient bleed

---

## Task 9: Update startSectionRename to preserve color

**Files:**
- Modify: `src/sidebar.ts:93-126` (startSectionRename function)

**Step 1: Update the finishRename callback**

Replace the finishRename function:
```typescript
const finishRename = async () => {
  const newName = input.value.trim();
  if (newName && newName !== (section.title || section.name)) {
    try {
      await setSectionMetadata(section.path, newName, section.color || null);
    } catch (err) {
      console.error('Rename error:', err);
    }
  }
  sections = await loadSections();
  renderSections();
};
```

**Step 2: Update the input default value**

Replace:
```typescript
input.value = section.name;
```

With:
```typescript
input.value = section.title || section.name;
```

**Step 3: Test renaming**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`
Test:
1. Set a color on a section
2. Rename the section
3. Verify color is preserved
4. Verify folder name unchanged (check in Finder)

Expected: Rename updates display name, preserves color, folder unchanged

---

## Task 10: Manual end-to-end verification

**Step 1: Fresh start test**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`

**Step 2: Verify existing sections load**

Expected: All sections display with folder names (no .section.md files yet)

**Step 3: Set color on a section**

1. Right-click "gf-roadmap"
2. Click "Set Color"
3. Pick green (#4a9f4a)
Expected: Green ribbon appears on left

**Step 4: Verify .section.md created**

Run: `cat ~/tetronomis/dotfiles/notes/gf-roadmap/.section.md`
Expected:
```
---
color: "#4a9f4a"
---
```

**Step 5: Rename the section**

1. Right-click "gf-roadmap"
2. Click "Rename"
3. Type "Roadmap"
4. Press Enter
Expected: Section shows "Roadmap", color preserved

**Step 6: Verify .section.md updated**

Run: `cat ~/tetronomis/dotfiles/notes/gf-roadmap/.section.md`
Expected:
```
---
title: "Roadmap"
color: "#4a9f4a"
---
```

**Step 7: Verify folder unchanged**

Run: `ls -d ~/tetronomis/dotfiles/notes/gf-roadmap`
Expected: Folder still named "gf-roadmap"

**Step 8: Clear color test**

1. Right-click "Roadmap"
2. Click "Set Color"
3. Click "Clear color"
Expected: Ribbon returns to default accent color

**Step 9: Restart app and verify persistence**

1. Close app
2. Run: `npm run tauri dev`
Expected: "Roadmap" displays with no custom color (or whatever state you left it in)

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | SectionMetadata struct and parsing | lib.rs |
| 2 | save_section_metadata command | lib.rs |
| 3 | Update rename_section to use metadata | lib.rs |
| 4 | CSS for colored ribbons | main.css |
| 5 | Update frontend Section interface | sidebar.ts |
| 6 | Create color picker component | colorpicker.ts (new) |
| 7 | Color picker CSS styles | main.css |
| 8 | Wire up context menu | sidebar.ts, main.ts |
| 9 | Update rename to preserve color | sidebar.ts |
| 10 | End-to-end verification | manual testing |
