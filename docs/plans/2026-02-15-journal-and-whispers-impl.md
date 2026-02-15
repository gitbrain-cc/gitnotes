# Journal & Whispers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add section type awareness, journal quill icon, and generic whisper toggle to GitNotes.

**Architecture:** Rust backend reads `type` from `.section.md` and exposes it on the `Section` struct. A new `list_whispers` Tauri command discovers whisper files. Frontend adds a quill icon for journal sections and toggle pills in the note header to switch between note content and read-only whisper views.

**Tech Stack:** Rust (Tauri 2.0), TypeScript, ProseMirror, CSS

**Design doc:** `docs/plans/2026-02-15-journal-and-whispers-design.md`

---

### Task 1: Add `section_type` to Rust structs

**Files:**
- Modify: `src-tauri/src/lib.rs:14-19` (Section struct)
- Modify: `src-tauri/src/lib.rs:21-37` (SectionMetadata struct)

**Step 1: Add `section_type` to `SectionMetadata`**

In `src-tauri/src/lib.rs`, add the field to `SectionMetadata`:

```rust
#[derive(Debug, Serialize, Deserialize, Default)]
pub struct SectionMetadata {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default = "default_sort")]
    pub sort: String,
    #[serde(default)]
    pub pinned: Vec<String>,
    #[serde(default)]
    pub order: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_note: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent_instructions: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "type")]
    pub section_type: Option<String>,
}
```

**Step 2: Add `section_type` to `Section`**

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct Section {
    pub name: String,
    pub path: String,
    pub title: Option<String>,
    pub color: Option<String>,
    pub section_type: Option<String>,
}
```

**Step 3: Propagate in `list_sections`**

In the `list_sections` function (~line 594), update the `Section` construction:

```rust
Some(Section {
    name: entry.file_name().to_string_lossy().to_string(),
    path: path.to_string_lossy().to_string(),
    title: metadata.title,
    color: metadata.color,
    section_type: metadata.section_type.clone(),
})
```

**Step 4: Preserve in `save_section_metadata`**

In `save_section_metadata` (~line 399), add before the closing `---`:

```rust
if let Some(ref section_type) = metadata.section_type {
    lines.push(format!("type: {}", section_type));
}
```

Add this right after the `agent_instructions` block and before `lines.push("---".to_string());`.

**Step 5: Build and verify**

Run: `cd src-tauri && cargo check`
Expected: compiles without errors

**Step 6: Commit**

```
feat: add section_type to Rust Section and SectionMetadata structs
```

---

### Task 2: Update TypeScript Section interfaces

**Files:**
- Modify: `src/main.ts:20-23` (Section interface)
- Modify: `src/sidebar.ts:16-21` (Section interface)

**Step 1: Update `src/main.ts` Section interface**

```typescript
interface Section {
  name: string;
  path: string;
  section_type?: string;
}
```

**Step 2: Update `src/sidebar.ts` Section interface**

```typescript
interface Section {
  name: string;
  path: string;
  title?: string;
  color?: string;
  section_type?: string;
}
```

**Step 3: Verify build**

Run: `npm run tauri dev` (or just `npx vite build` for quick TS check)
Expected: no TypeScript errors

**Step 4: Commit**

```
feat: add section_type to TypeScript Section interfaces
```

---

### Task 3: Add journal quill icon to sidebar

**Files:**
- Modify: `src/sidebar.ts:322-340` (renderSections function)
- Modify: `src/styles/main.css` (section icon styles)

**Step 1: Update `renderSections()` in `src/sidebar.ts`**

Replace the current section rendering (line 330):

```typescript
li.textContent = section.title || section.name;
```

With:

```typescript
const isJournal = section.section_type === 'journal' || section.name === '1-weeks';
if (isJournal) {
  const icon = document.createElement('span');
  icon.className = 'section-icon';
  icon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 2 L20 18 C20 20 18 22 16 22 L6 22 C4 22 2 20 2 18 L2 6 C2 4.5 3 3 5 3 L7 3"/><path d="M12 2 C12 2 9 6 9 10 C9 12 10 13 12 14 C14 13 15 12 15 10 C15 6 12 2 12 2Z"/><line x1="12" y1="14" x2="12" y2="22"/></svg>`;
  li.appendChild(icon);
}
const text = document.createTextNode(section.title || section.name);
li.appendChild(text);
```

This renders a quill/nib SVG for journal sections, falling back to the `1-weeks` name check for brains without `type: journal` yet.

**Step 2: Add CSS for section icon**

In `src/styles/main.css`, add after the `.sidebar li.active` block (~line 193):

```css
.section-icon {
  display: inline-flex;
  align-items: center;
  margin-right: 6px;
  vertical-align: middle;
  opacity: 0.6;
}

.sidebar li.active .section-icon {
  opacity: 0.9;
}
```

**Step 3: Test visually**

Run: `npm run tauri dev`
Expected: Journal section shows a quill icon before the title. Other sections show text only.

**Step 4: Commit**

```
feat: add quill icon for journal sections in sidebar
```

---

### Task 4: Add `list_whispers` Rust command

**Files:**
- Modify: `src-tauri/src/lib.rs` (new struct + command)

**Step 1: Add the `Whisper` struct**

Add after the `Note` struct (~line 46):

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct Whisper {
    pub character: String,
    pub path: String,
    pub generated: Option<String>,
}
```

**Step 2: Add the `list_whispers` command**

Add before the `invoke_handler` registration:

```rust
#[tauri::command]
fn list_whispers(note_path: String) -> Result<Vec<Whisper>, String> {
    let note = PathBuf::from(&note_path);
    let note_stem = note
        .file_stem()
        .ok_or("Invalid note path")?
        .to_string_lossy()
        .to_string();

    let section_dir = note.parent().ok_or("No parent directory")?;
    let whispers_dir = section_dir.join(".whispers");

    if !whispers_dir.exists() || !whispers_dir.is_dir() {
        return Ok(vec![]);
    }

    let prefix = format!("{}.", note_stem);

    let mut whispers: Vec<Whisper> = fs::read_dir(&whispers_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let filename = entry.file_name().to_string_lossy().to_string();

            // Must match <stem>.<character>.md
            if !filename.starts_with(&prefix) || !filename.ends_with(".md") {
                return None;
            }

            // Extract character name: remove prefix and .md suffix
            let without_prefix = &filename[prefix.len()..];
            let character = without_prefix.strip_suffix(".md")?;

            // Skip bare <stem>.md (no character name)
            if character.is_empty() {
                return None;
            }

            let whisper_path = entry.path();

            // Try to read generated timestamp from frontmatter
            let generated = fs::read_to_string(&whisper_path)
                .ok()
                .and_then(|content| {
                    if content.starts_with("---\n") {
                        if let Some(end) = content[4..].find("\n---") {
                            let yaml_str = &content[4..4 + end];
                            let map: std::collections::HashMap<String, serde_yaml::Value> =
                                serde_yaml::from_str(yaml_str).ok()?;
                            map.get("generated")
                                .and_then(|v| v.as_str().map(|s| s.to_string()))
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                });

            Some(Whisper {
                character: character.to_string(),
                path: whisper_path.to_string_lossy().to_string(),
                generated,
            })
        })
        .collect();

    whispers.sort_by(|a, b| a.character.cmp(&b.character));

    Ok(whispers)
}
```

**Step 3: Register the command**

Add `list_whispers` to the `invoke_handler` list (~line 2457):

```rust
.invoke_handler(tauri::generate_handler![
    list_sections,
    list_notes,
    list_whispers,
    // ... rest of existing commands
```

**Step 4: Build and verify**

Run: `cd src-tauri && cargo check`
Expected: compiles without errors

**Step 5: Commit**

```
feat: add list_whispers Tauri command for whisper discovery
```

---

### Task 5: Add whisper toggle UI to note header

**Files:**
- Modify: `src/editor.ts:35-39` (HeaderData interface)
- Modify: `src/editor.ts:157-180` (updateHeaderData function)
- Modify: `src/styles/main.css` (whisper toggle styles)

**Step 1: Extend `HeaderData` interface**

In `src/editor.ts`, update `HeaderData`:

```typescript
export interface HeaderData {
  title: string;
  createdDate: string | null;
  modifiedInfo: string | null;
  whispers?: { character: string; path: string; generated: string | null }[];
  activeWhisper?: string | null; // character name or null for note view
}
```

**Step 2: Update `updateHeaderData` to render toggle pills**

Replace the `updateHeaderData` function:

```typescript
export function updateHeaderData(data: HeaderData) {
  const header = document.getElementById('note-header');
  if (!header) return;

  if (!data.title) {
    header.classList.remove('visible');
    return;
  }

  header.classList.add('visible');

  const parts: string[] = [];
  if (data.createdDate) {
    parts.push(`Created ${data.createdDate}`);
  }
  if (data.modifiedInfo) {
    parts.push(data.modifiedInfo);
  }

  let whisperToggleHtml = '';
  if (data.whispers && data.whispers.length > 0) {
    const noteActive = !data.activeWhisper ? 'active' : '';
    const pills = data.whispers.map(w => {
      const active = data.activeWhisper === w.character ? 'active' : '';
      const label = w.character.charAt(0).toUpperCase() + w.character.slice(1);
      return `<button class="whisper-pill ${active}" data-character="${w.character}" data-path="${w.path}">${label}</button>`;
    }).join('');

    whisperToggleHtml = `
      <div class="whisper-toggle">
        <button class="whisper-pill ${noteActive}" data-character="">Note</button>
        ${pills}
      </div>
    `;
  }

  header.innerHTML = `
    <h1>${data.title}</h1>
    <div class="meta">${parts.join(' &middot; ')}</div>
    ${whisperToggleHtml}
  `;
}
```

**Step 3: Add CSS for whisper toggle**

In `src/styles/main.css`, add after the `#note-header .meta` block:

```css
.whisper-toggle {
  display: flex;
  gap: 4px;
  margin-top: 8px;
}

.whisper-pill {
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 2px 10px;
  font-size: 0.786rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 150ms ease;
}

.whisper-pill:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.whisper-pill.active {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: white;
}
```

**Step 4: Commit**

```
feat: add whisper toggle pills to note header
```

---

### Task 6: Add read-only whisper mode to editor

**Files:**
- Modify: `src/editor.ts` (add setEditable, loadWhisperContent functions)
- Modify: `src/styles/main.css` (whisper-mode visual treatment)

**Step 1: Add `setEditable` function to `src/editor.ts`**

Add after the `reconfigureEditor` function:

```typescript
export function setEditable(editable: boolean) {
  if (!editorView) return;

  // ProseMirror doesn't have a direct setEditable - we need to
  // recreate with the editable prop or use a plugin.
  // Simplest: set the contenteditable attribute and use a prop.
  editorView.setProps({
    editable: () => editable,
  });

  const container = document.getElementById('editor-container');
  if (container) {
    container.classList.toggle('whisper-mode', !editable);
  }
}
```

**Step 2: Add `loadWhisperContent` function**

Add after `loadContent`:

```typescript
export function loadWhisperContent(content: string) {
  if (!editorView) return;

  // Parse frontmatter but don't store it (whisper frontmatter is not ours)
  const parsed = parseFrontMatter(content);

  const doc = defaultMarkdownParser.parse(parsed.body) || schema.node('doc', null, [schema.node('paragraph')]);

  editorView.updateState(
    EditorState.create({
      doc,
      plugins: editorView.state.plugins,
    })
  );

  setEditable(false);
}
```

Export both functions in the module.

**Step 3: Add whisper-mode CSS**

In `src/styles/main.css`:

```css
#editor-container.whisper-mode {
  opacity: 0.85;
}

#editor-container.whisper-mode .ProseMirror {
  cursor: default;
}

#editor-container.whisper-mode .ProseMirror-cursor,
#editor-container.whisper-mode .ProseMirror .ProseMirror-cursor-custom {
  display: none;
}
```

**Step 4: Commit**

```
feat: add read-only whisper mode to ProseMirror editor
```

---

### Task 7: Wire up whisper orchestration in main.ts

**Files:**
- Modify: `src/main.ts` (whisper state, toggle handlers, note loading)

**Step 1: Add whisper state and invoke function**

After the existing imports and before `let currentNote`, add:

```typescript
interface Whisper {
  character: string;
  path: string;
  generated: string | null;
}

let currentWhispers: Whisper[] = [];
let activeWhisper: string | null = null; // character name or null
```

Add a new invoke wrapper after the existing ones:

```typescript
export async function listWhispers(notePath: string): Promise<Whisper[]> {
  return await invoke('list_whispers', { notePath });
}
```

**Step 2: Update `loadNoteWithHeader` to discover whispers**

After the `updateHeaderData` call (~line 279), add whisper discovery:

```typescript
// Discover whispers for this note
currentWhispers = await listWhispers(note.path);
activeWhisper = null;

// Re-render header with whisper pills
updateHeaderData({ title, createdDate, modifiedInfo, whispers: currentWhispers, activeWhisper });

// Attach pill click handlers
attachWhisperHandlers();
```

Remove the earlier `updateHeaderData` call (the one without whispers) so there's no duplicate.

**Step 3: Add whisper toggle handlers**

Add a new function:

```typescript
function attachWhisperHandlers() {
  const pills = document.querySelectorAll('.whisper-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', async () => {
      const character = (pill as HTMLElement).dataset.character || '';

      if (!character) {
        // Switch back to Note view
        if (activeWhisper && currentNote) {
          activeWhisper = null;
          // Restore note content
          const rawContent = await readNote(currentNote.path);
          const parsed = parseFrontMatter(rawContent);
          currentFrontMatter = parsed.frontmatter;
          currentBody = parsed.body;
          loadContent(rawContent);
          setEditable(true);
          await refreshHeaderWithWhispers();
        }
      } else {
        // Switch to whisper view
        // Flush pending save first
        if (saveTimeout && currentNote) {
          clearTimeout(saveTimeout);
          saveTimeout = null;
          const contentToSave = serializeFrontMatter(currentFrontMatter, getContent().includes('---') ? currentBody : currentBody);
          // Quick-save current note
          const fullContent = getContent();
          const parsedSave = parseFrontMatter(fullContent);
          currentBody = parsedSave.body;
          const toSave = serializeFrontMatter(currentFrontMatter, currentBody);
          await writeNote(currentNote.path, toSave);
        }

        const whisper = currentWhispers.find(w => w.character === character);
        if (whisper) {
          activeWhisper = character;
          const whisperContent = await readNote(whisper.path);
          loadWhisperContent(whisperContent);
          await refreshHeaderWithWhispers();
        }
      }
    });
  });
}
```

**Step 4: Add `refreshHeaderWithWhispers` helper**

```typescript
async function refreshHeaderWithWhispers() {
  if (!currentNote) return;

  let createdDate: string | null = null;
  let modifiedInfo: string | null = null;

  if (activeWhisper) {
    // Show whisper metadata
    const whisper = currentWhispers.find(w => w.character === activeWhisper);
    if (whisper?.generated) {
      createdDate = formatAbsoluteDate(whisper.generated);
      modifiedInfo = `by ${whisper.character}`;
    }
  } else {
    // Show note metadata
    createdDate = currentFrontMatter.created
      ? formatAbsoluteDate(currentFrontMatter.created)
      : null;
    const gitInfo = await getGitInfo(currentNote.path);
    modifiedInfo = buildModifiedInfo(gitInfo, currentFrontMatter.created ?? null);
  }

  updateHeaderData({
    title: currentNote.name,
    createdDate,
    modifiedInfo,
    whispers: currentWhispers,
    activeWhisper,
  });

  // Re-attach handlers since innerHTML was replaced
  attachWhisperHandlers();
}
```

**Step 5: Reset whisper state on note switch**

In `loadNoteWithHeader`, ensure at the top (before reading content):

```typescript
activeWhisper = null;
currentWhispers = [];
setEditable(true);
```

**Step 6: Add imports**

Add `loadWhisperContent, setEditable` to the import from `./editor`:

```typescript
import {
  initEditor, getContent, focusEditor, getWordCount, updateHeaderData, loadContent,
  getCursorPosition, getScrollTop, getViewportHeight, getContentUpToCursor,
  setCursorPosition, setScrollTop, loadWhisperContent, setEditable
} from './editor';
```

**Step 7: Verify full flow**

Run: `npm run tauri dev`

Test:
1. Open a brain with journal whispers (e.g., `1-weeks/2026-07.md`)
2. Header should show `[Note] [Summary]` pills
3. Click "Summary" — editor shows whisper content, read-only, slightly dimmed
4. Click "Note" — returns to editable note
5. Open a note without whispers — no pills shown
6. Switch sections — pills reset correctly

**Step 8: Commit**

```
feat: wire up whisper toggle orchestration in main.ts
```

---

### Task 8: Final polish and integration test

**Files:**
- Verify: all modified files
- Test: full user flow

**Step 1: Run full build**

Run: `npm run tauri build`
Expected: compiles without errors

**Step 2: Manual integration test**

Checklist:
- [ ] Journal section shows quill icon in sidebar
- [ ] Other sections show no icon
- [ ] Notes with whispers show toggle pills in header
- [ ] Notes without whispers show no pills
- [ ] Clicking whisper pill loads whisper read-only
- [ ] Clicking Note pill restores editable note
- [ ] Switching notes resets to Note view
- [ ] Switching sections resets to Note view
- [ ] Auto-save flushes before switching to whisper
- [ ] Editor is not editable in whisper mode (can't type)
- [ ] Visual distinction (opacity) in whisper mode

**Step 3: Commit**

```
feat: journal section support and whisper toggle
```

Squash all previous commits into this one if preferred.
