# Section Drag-and-Drop Reordering Implementation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable drag-and-drop reordering of sections in the sidebar with persistence to `.gitnotes`.

**Architecture:** Backend reads/writes section order from `.gitnotes` JSON file at vault root. Frontend adds hold-to-drag (200ms) interaction with insertion line indicator. Order saved immediately on drop.

**Tech Stack:** Rust (Tauri backend), TypeScript (vanilla frontend), CSS

---

## Task 1: Add GitNotesConfig struct and loader in Rust

**Files:**
- Modify: `src-tauri/src/lib.rs:44-68` (after OrderConfig struct)

**Step 1: Add GitNotesConfig struct after OrderConfig (around line 68)**

```rust
#[derive(Debug, Serialize, Deserialize, Default)]
pub struct GitNotesConfig {
    #[serde(default, rename = "sectionOrder")]
    pub section_order: Vec<String>,
}
```

**Step 2: Add load_gitnotes_config function after load_order_config (around line 436)**

```rust
fn load_gitnotes_config(vault_path: &PathBuf) -> GitNotesConfig {
    let config_file = vault_path.join(".gitnotes");
    if config_file.exists() {
        if let Ok(content) = fs::read_to_string(&config_file) {
            if let Ok(config) = serde_json::from_str(&content) {
                return config;
            }
        }
    }
    GitNotesConfig::default()
}
```

**Step 3: Verify it compiles**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`
Expected: App launches without errors

---

## Task 2: Update list_sections to use GitNotesConfig

**Files:**
- Modify: `src-tauri/src/lib.rs:454-499` (list_sections function)

**Step 1: Replace order_config usage with gitnotes_config**

In `list_sections()`, replace line 461:
```rust
let order_config = load_order_config(&notes_path);
```

With:
```rust
let gitnotes_config = load_gitnotes_config(&notes_path);
```

**Step 2: Update the sorting logic (lines 482-496)**

Replace:
```rust
// Sort by order config or alphabetically
if !order_config.sections.is_empty() {
    sections.sort_by(|a, b| {
        let a_idx = order_config.sections.iter().position(|x| x == &a.name);
        let b_idx = order_config.sections.iter().position(|x| x == &b.name);
        match (a_idx, b_idx) {
            (Some(ai), Some(bi)) => ai.cmp(&bi),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => a.name.cmp(&b.name),
        }
    });
} else {
    sections.sort_by(|a, b| a.name.cmp(&b.name));
}
```

With:
```rust
// Sort by .gitnotes sectionOrder or alphabetically
if !gitnotes_config.section_order.is_empty() {
    sections.sort_by(|a, b| {
        let a_idx = gitnotes_config.section_order.iter().position(|x| x == &a.name);
        let b_idx = gitnotes_config.section_order.iter().position(|x| x == &b.name);
        match (a_idx, b_idx) {
            (Some(ai), Some(bi)) => ai.cmp(&bi),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => a.name.cmp(&b.name),
        }
    });
} else {
    sections.sort_by(|a, b| a.name.cmp(&b.name));
}
```

**Step 3: Verify it compiles and sections still load**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`
Expected: App launches, sections display alphabetically (no .gitnotes exists yet)

---

## Task 3: Add save_section_order Tauri command

**Files:**
- Modify: `src-tauri/src/lib.rs` (add new command, register in invoke_handler)

**Step 1: Add save_section_order function after load_gitnotes_config**

```rust
#[tauri::command]
fn save_section_order(order: Vec<String>) -> Result<(), String> {
    let vault_path = get_notes_path();
    let config_file = vault_path.join(".gitnotes");

    // Load existing config to preserve other fields
    let mut config = load_gitnotes_config(&vault_path);
    config.section_order = order;

    let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&config_file, content).map_err(|e| e.to_string())
}
```

**Step 2: Register command in invoke_handler (around line 2061)**

Add `save_section_order` to the generate_handler! macro, after `set_section_metadata`:
```rust
set_section_metadata,
save_section_order,
get_settings,
```

**Step 3: Verify it compiles**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`
Expected: App launches without errors

---

## Task 4: Add saveSectionOrder to frontend main.ts

**Files:**
- Modify: `src/main.ts` (add export function)

**Step 1: Add saveSectionOrder function after existing section functions**

Find the section management exports (around line 70-90) and add:

```typescript
export async function saveSectionOrder(order: string[]): Promise<void> {
  await invoke('save_section_order', { order });
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`
Expected: App launches without errors

---

## Task 5: Add CSS styles for section drag

**Files:**
- Modify: `src/styles/main.css:504-512` (after existing drag styles)

**Step 1: Add new drag styles after existing .drop-target rule**

```css
/* Section drag reordering */
#sections-list li.drag-pending {
  transform: scale(1.02);
  transition: transform 100ms ease;
}

#sections-list .drop-indicator {
  height: 2px;
  background: var(--accent-color);
  margin: 0 8px;
  border-radius: 1px;
  pointer-events: none;
}
```

**Step 2: Verify styles load**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`
Expected: App launches (styles won't be visible yet)

---

## Task 6: Add section drag state and imports to sidebar.ts

**Files:**
- Modify: `src/sidebar.ts:1-10` (imports)
- Modify: `src/sidebar.ts` (add state variables after imports)

**Step 1: Update imports to include saveSectionOrder**

Find the import from './main' and add `saveSectionOrder`:
```typescript
import {
  loadSections, loadNotes, setCurrentNote, setStatus,
  createNoteWithSelection, deleteNote, renameNote, createSection, renameSection, deleteSection, moveNote,
  loadNoteWithHeader, setSectionMetadata, saveSectionOrder
} from './main';
```

**Step 2: Add drag state variables after the sections variable declaration**

Find `let sections: Section[] = [];` and add after it:
```typescript
// Section drag state
let dragState: {
  active: boolean;
  sectionIndex: number;
  startY: number;
  holdTimer: number | null;
} | null = null;
```

**Step 3: Verify TypeScript compiles**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`
Expected: App launches without errors

---

## Task 7: Implement hold-to-drag logic in renderSections

**Files:**
- Modify: `src/sidebar.ts:177-253` (renderSections function)

**Step 1: Add mousedown handler for hold-to-drag**

Inside the `for (const section of sections)` loop, after setting up `li.dataset.path`, add:

```typescript
    const sectionIndex = sections.indexOf(section);

    // Hold-to-drag for reordering
    li.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Left click only

      const startY = e.clientY;

      const holdTimer = window.setTimeout(() => {
        // Enter drag mode
        li.classList.add('dragging');
        dragState = { active: true, sectionIndex, startY, holdTimer: null };
        document.addEventListener('mousemove', handleSectionDragMove);
        document.addEventListener('mouseup', handleSectionDragEnd);
      }, 200);

      dragState = { active: false, sectionIndex, startY, holdTimer };
      li.classList.add('drag-pending');

      const cancelHold = () => {
        if (dragState?.holdTimer) {
          clearTimeout(dragState.holdTimer);
        }
        li.classList.remove('drag-pending');
        if (!dragState?.active) {
          dragState = null;
        }
        document.removeEventListener('mouseup', cancelHold);
        document.removeEventListener('mousemove', checkMovement);
      };

      const checkMovement = (moveEvent: MouseEvent) => {
        // Cancel if moved > 5px before hold timer fires
        if (Math.abs(moveEvent.clientY - startY) > 5 && !dragState?.active) {
          cancelHold();
        }
      };

      document.addEventListener('mouseup', cancelHold);
      document.addEventListener('mousemove', checkMovement);
    });
```

**Step 2: Verify it compiles (handlers not yet defined)**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`
Expected: TypeScript error about undefined handlers (expected, we add them next)

---

## Task 8: Implement drag move and drop handlers

**Files:**
- Modify: `src/sidebar.ts` (add functions before renderSections)

**Step 1: Add helper functions before renderSections function**

```typescript
function getDropIndex(clientY: number): number {
  const list = document.getElementById('sections-list');
  if (!list) return 0;

  const items = Array.from(list.querySelectorAll('li:not(.drop-indicator)'));

  for (let i = 0; i < items.length; i++) {
    const rect = items[i].getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    if (clientY < midpoint) {
      return i;
    }
  }
  return items.length;
}

function showDropIndicator(index: number) {
  removeDropIndicator();
  const list = document.getElementById('sections-list');
  if (!list) return;

  const indicator = document.createElement('div');
  indicator.className = 'drop-indicator';

  const items = list.querySelectorAll('li:not(.drop-indicator)');
  if (index >= items.length) {
    list.appendChild(indicator);
  } else {
    list.insertBefore(indicator, items[index]);
  }
}

function removeDropIndicator() {
  document.querySelector('#sections-list .drop-indicator')?.remove();
}

function handleSectionDragMove(e: MouseEvent) {
  if (!dragState?.active) return;

  const list = document.getElementById('sections-list');
  if (!list) return;

  const rect = list.getBoundingClientRect();

  // Cancel if outside sidebar
  if (e.clientX < rect.left || e.clientX > rect.right) {
    removeDropIndicator();
    return;
  }

  const dropIndex = getDropIndex(e.clientY);
  showDropIndicator(dropIndex);
}

async function handleSectionDragEnd(e: MouseEvent) {
  document.removeEventListener('mousemove', handleSectionDragMove);
  document.removeEventListener('mouseup', handleSectionDragEnd);

  const list = document.getElementById('sections-list');
  if (!list || !dragState?.active) {
    removeDropIndicator();
    dragState = null;
    return;
  }

  const fromIndex = dragState.sectionIndex;
  const toIndex = getDropIndex(e.clientY);

  removeDropIndicator();

  // Remove dragging class from all items
  list.querySelectorAll('li.dragging').forEach(el => el.classList.remove('dragging'));

  dragState = null;

  // Skip if dropped in same position
  if (toIndex === fromIndex || toIndex === fromIndex + 1) {
    return;
  }

  // Reorder sections array
  const [moved] = sections.splice(fromIndex, 1);
  const insertAt = toIndex > fromIndex ? toIndex - 1 : toIndex;
  sections.splice(insertAt, 0, moved);

  // Save new order
  const order = sections.map(s => s.name);
  try {
    await saveSectionOrder(order);
  } catch (err) {
    console.error('Save section order error:', err);
  }

  // Re-render
  renderSections();
}
```

**Step 2: Add Escape key handler for cancellation**

Add at the end of the drag setup in mousedown handler:

```typescript
      const handleEscape = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key === 'Escape' && dragState?.active) {
          document.removeEventListener('mousemove', handleSectionDragMove);
          document.removeEventListener('mouseup', handleSectionDragEnd);
          removeDropIndicator();
          list?.querySelectorAll('li.dragging').forEach(el => el.classList.remove('dragging'));
          dragState = null;
        }
        document.removeEventListener('keydown', handleEscape);
      };
      document.addEventListener('keydown', handleEscape);
```

**Step 3: Verify it compiles and test basic interaction**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`
Test: Hold a section for 200ms, drag up/down, release
Expected: Section reorders and persists

---

## Task 9: Handle single-section edge case

**Files:**
- Modify: `src/sidebar.ts:177-180` (start of renderSections)

**Step 1: Skip drag setup if only one section**

At the start of renderSections, after `list.innerHTML = ''`, add early return check inside the loop:

In the mousedown handler setup, wrap it with a condition:
```typescript
    // Only enable drag if more than one section
    if (sections.length > 1) {
      li.addEventListener('mousedown', (e) => {
        // ... existing mousedown code
      });
    }
```

**Step 2: Verify it compiles**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`
Expected: App launches, drag only enabled with multiple sections

---

## Task 10: End-to-end verification

**Step 1: Fresh start test**

Run: `cd /Users/simon/tetronomis/noteone && npm run tauri dev`

**Step 2: Test hold-to-drag**

1. Click and release quickly on a section
   Expected: Section selects normally (no drag)

2. Click and hold 200ms on a section
   Expected: Row scales slightly (drag-pending), then enters drag mode

3. Drag up/down while holding
   Expected: Insertion line appears between rows

4. Release to drop
   Expected: Section moves to new position

**Step 3: Verify persistence**

1. Reorder sections
2. Close and reopen app
   Expected: Order preserved

**Step 4: Verify .gitnotes created**

Run: `cat ~/tetronomis/brain/.gitnotes` (or active vault path)
Expected:
```json
{
  "sectionOrder": ["section1", "section2", ...]
}
```

**Step 5: Test cancellation**

1. Start dragging, press Escape
   Expected: Drag cancels, no change

2. Start dragging, move cursor outside sidebar
   Expected: Indicator disappears, drop cancels

**Step 6: Test edge cases**

1. Drag section to same position
   Expected: No-op, no save triggered

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | GitNotesConfig struct and loader | lib.rs |
| 2 | Update list_sections to use GitNotesConfig | lib.rs |
| 3 | Add save_section_order command | lib.rs |
| 4 | Add saveSectionOrder to frontend | main.ts |
| 5 | Add CSS drag styles | main.css |
| 6 | Add drag state and imports | sidebar.ts |
| 7 | Implement hold-to-drag mousedown | sidebar.ts |
| 8 | Implement drag move and drop handlers | sidebar.ts |
| 9 | Handle single-section edge case | sidebar.ts |
| 10 | End-to-end verification | manual testing |
