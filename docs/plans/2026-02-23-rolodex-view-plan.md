# Rolodex View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render the rolodex section as a dedicated contact browsing experience — enhanced sidebar items, sort cycling, and a contact header card above the editor.

**Architecture:** Extend existing `Note` struct with optional contact metadata fields. The Rust backend parses rolodex frontmatter during `collect_notes_from_dir` when the section is `type: rolodex`. Frontend renders enhanced sidebar items and a contact card above the editor. No new Tauri commands — extend existing `list_notes` response and add a new `get_contact_data` command for the full card.

**Tech Stack:** Rust (Tauri backend), TypeScript (vanilla), ProseMirror, CSS

**Spec:** `docs/specs/rolodex-view.md`

---

### Task 1: Extend Note struct with contact metadata (Rust)

Add optional contact fields to the `Note` struct so `list_notes` can return sidebar-relevant data for rolodex contacts without a separate command.

**Files:**
- Modify: `src-tauri/src/lib.rs:43-50` (Note struct)
- Modify: `src-tauri/src/lib.rs:646-705` (collect_notes_from_dir)

**Step 1: Add contact fields to Note struct**

In `lib.rs`, extend the `Note` struct:

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct Note {
    pub name: String,
    pub path: String,
    pub filename: String,
    pub created: u64,
    pub modified: u64,
    pub subfolder: Option<String>,
    // Rolodex contact fields (populated only for type: rolodex sections)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_company: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_role: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub imported: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_call: Option<String>,
}
```

**Step 2: Update collect_notes_from_dir to accept section_type parameter**

Change the function signature to take an optional section type:

```rust
fn collect_notes_from_dir(dir: &PathBuf, subfolder: Option<String>, section_type: Option<&str>) -> Vec<Note> {
```

Inside the function, when building a `Note`, if `section_type` is `Some("rolodex")`, extract contact fields from the frontmatter's `other` HashMap:

```rust
// After existing frontmatter parsing, extract contact fields for rolodex
let (contact_title, contact_company, contact_role, contact_email, imported, last_call) =
    if section_type == Some("rolodex") {
        let fm_ref = fm.as_ref();
        let other = fm_ref.map(|f| &f.other);
        (
            other.and_then(|o| o.get("title")).and_then(|v| v.as_str()).map(String::from),
            other.and_then(|o| o.get("company")).and_then(|v| v.as_str()).map(String::from),
            other.and_then(|o| o.get("role")).and_then(|v| v.as_str()).map(String::from),
            other.and_then(|o| o.get("emails")).and_then(|v| {
                v.as_sequence()
                    .and_then(|seq| seq.first())
                    .and_then(|first| first.as_mapping())
                    .and_then(|m| m.get(serde_yaml::Value::String("value".into())))
                    .and_then(|v| v.as_str())
                    .map(String::from)
            }),
            other.and_then(|o| o.get("imported")).and_then(|v| v.as_str()).map(String::from),
            other.and_then(|o| o.get("last_call")).and_then(|v| v.as_str()).map(String::from),
        )
    } else {
        (None, None, None, None, None, None)
    };
```

And include them in the Note construction:

```rust
Some(Note {
    name: filename.trim_end_matches(".md").to_string(),
    path: path.to_string_lossy().to_string(),
    filename,
    created,
    modified,
    subfolder: subfolder.clone(),
    contact_title,
    contact_company,
    contact_role,
    contact_email,
    imported,
    last_call,
})
```

**Step 3: Update list_notes to pass section_type to collect_notes_from_dir**

In `list_notes` (line ~708), the section metadata is already loaded. Pass `section_type`:

```rust
let section_type = section_meta.section_type.as_deref();
let mut notes = collect_notes_from_dir(&path, None, section_type);

// And in the subdirectory loop:
notes.extend(collect_notes_from_dir(&sub_path, Some(dir_name), section_type));
```

**Step 4: Add rolodex-specific sort modes to list_notes**

After the existing sort `match` block (line ~734), add new sort modes. The existing sort string format is `type-direction` (e.g., `alpha-asc`). Add:

```rust
"imported-asc" => notes.sort_by(|a, b| {
    let a_val = a.imported.as_deref().unwrap_or("");
    let b_val = b.imported.as_deref().unwrap_or("");
    a_val.cmp(b_val)
}),
"imported-desc" => notes.sort_by(|a, b| {
    let a_val = a.imported.as_deref().unwrap_or("");
    let b_val = b.imported.as_deref().unwrap_or("");
    b_val.cmp(a_val)
}),
"lastcall-asc" => notes.sort_by(|a, b| {
    match (&a.last_call, &b.last_call) {
        (Some(a_val), Some(b_val)) => a_val.cmp(b_val),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    }
}),
"lastcall-desc" => notes.sort_by(|a, b| {
    match (&a.last_call, &b.last_call) {
        (Some(a_val), Some(b_val)) => b_val.cmp(a_val),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    }
}),
```

**Step 5: Verify it compiles**

Run: `cd /Users/simon/tetronomis/gitnotes && npm run tauri build -- --no-bundle 2>&1 | tail -20`

Or faster: `cd /Users/simon/tetronomis/gitnotes/src-tauri && cargo check 2>&1 | tail -20`

Expected: No errors.

**Step 6: Commit**

```
Rolodex contact metadata in Note struct and sort modes
```

---

### Task 2: Add rolodex section icon in sidebar

**Files:**
- Modify: `src/sidebar.ts:336-342` (renderSections, after journal icon block)

**Step 1: Add rolodex icon after the journal icon block**

In `renderSections()`, after the `if (isJournal) { ... }` block (line ~342), add:

```typescript
const isRolodex = section.section_type === 'rolodex';
if (isRolodex) {
  const icon = document.createElement('span');
  icon.className = 'section-icon';
  icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
  li.appendChild(icon);
}
```

This is the Lucide `users` icon SVG.

**Step 2: Verify visually**

Run: `npm run tauri dev`

Expected: Rolodex section shows a people icon on the right side, matching the journal quill's position and style.

**Step 3: Commit**

```
Add rolodex section icon (users) in sidebar
```

---

### Task 3: Enhanced sidebar list items for rolodex

Show contact title + company subtitle instead of filenames for rolodex sections.

**Files:**
- Modify: `src/sidebar.ts:16-29` (Note interface)
- Modify: `src/sidebar.ts:497-535` (renderNotes)
- Modify: `src/styles/main.css` (add subtitle styles)

**Step 1: Extend Note interface in sidebar.ts**

Add the contact fields that the Rust backend now returns:

```typescript
interface Note {
  name: string;
  path: string;
  filename: string;
  subfolder?: string;
  // Rolodex contact fields
  contact_title?: string;
  contact_company?: string;
  contact_role?: string;
  contact_email?: string;
  imported?: string;
  last_call?: string;
}
```

**Step 2: Update renderNotes to show enhanced items for rolodex**

We need to know if the current section is rolodex. `currentSection` is already available in scope. In `renderNotes()` (line ~497), modify the note rendering:

```typescript
function renderNotes(notes: Note[]) {
  const list = document.getElementById('pages-list');
  if (!list) return;

  list.innerHTML = '';
  const isRolodex = currentSection?.section_type === 'rolodex';

  for (const note of notes) {
    const li = document.createElement('li');

    if (isRolodex && note.contact_title) {
      // Enhanced rolodex list item
      const nameSpan = document.createElement('span');
      nameSpan.className = 'note-name';
      nameSpan.textContent = note.contact_title;
      li.appendChild(nameSpan);

      // Subtitle: company + role > company > role > email > nothing
      const subtitle = buildContactSubtitle(note);
      if (subtitle) {
        const subSpan = document.createElement('span');
        subSpan.className = 'contact-subtitle';
        subSpan.textContent = subtitle;
        li.appendChild(subSpan);
      }

      li.classList.add('rolodex-item');
    } else {
      // Standard note list item
      const nameSpan = document.createElement('span');
      nameSpan.className = 'note-name';
      nameSpan.textContent = note.name;
      li.appendChild(nameSpan);
      if (note.subfolder) {
        const badge = document.createElement('span');
        badge.className = 'subfolder-badge';
        badge.textContent = note.subfolder.slice(0, 3);
        badge.title = note.subfolder;
        li.appendChild(badge);
      }
    }

    li.dataset.path = note.path;
    li.draggable = true;
    li.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData('text/plain', note.path);
      li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
    });
    li.addEventListener('click', () => selectNote(note));
    li.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, [
        { label: 'Rename', action: () => startRename(note, li) },
        { label: 'Delete', action: () => handleDeleteNote(note) }
      ]);
    });
    list.appendChild(li);
  }
}
```

**Step 3: Add buildContactSubtitle helper**

Add this function above `renderNotes`:

```typescript
function buildContactSubtitle(note: Note): string | null {
  if (note.contact_company && note.contact_role) {
    return `${note.contact_company} · ${note.contact_role}`;
  }
  if (note.contact_company) return note.contact_company;
  if (note.contact_role) return note.contact_role;
  if (note.contact_email) return note.contact_email;
  return null;
}
```

**Step 4: Add CSS for rolodex list items**

In `src/styles/main.css`, after the `#pages-list li` block (~line 196):

```css
/* Rolodex contact list items */
#pages-list li.rolodex-item {
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  padding-top: 4px;
  padding-bottom: 4px;
}

.contact-subtitle {
  font-size: 0.75rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
```

**Step 5: Verify visually**

Run: `npm run tauri dev`

Expected: Rolodex section shows contact names with company subtitles. Other sections unchanged.

**Step 6: Commit**

```
Enhanced sidebar list items for rolodex contacts
```

---

### Task 4: Sort cycling for rolodex sections

Add `imported` and `lastcall` sort types to the sort menu, visible only for rolodex sections.

**Files:**
- Modify: `src/sortmenu.ts` (add sort types, section-aware options)
- Modify: `index.html` (add sort option entries)

**Step 1: Extend SortType in sortmenu.ts**

```typescript
type SortType = 'alpha' | 'created' | 'modified' | 'imported' | 'lastcall';
```

**Step 2: Update parseSortString**

Add to the `typeMap`:

```typescript
const typeMap: Record<string, SortType> = {
  'alpha': 'alpha',
  'name': 'alpha',
  'created': 'created',
  'modified': 'modified',
  'imported': 'imported',
  'lastcall': 'lastcall',
};
```

**Step 3: Add HTML sort options in index.html**

After the existing sort options (modified), add two more entries inside the `#sort-container` dropdown:

```html
<div class="sort-option rolodex-sort" data-sort="imported" style="display:none">
  Added <span class="sort-arrow"></span>
</div>
<div class="sort-option rolodex-sort" data-sort="lastcall" style="display:none">
  Last call <span class="sort-arrow"></span>
</div>
```

They're hidden by default and shown only when the active section is rolodex.

**Step 4: Make sort menu section-aware**

In `sortmenu.ts`, export a function to toggle rolodex sort options visibility. Modify `updateSortForSection` to accept the section type:

```typescript
export async function updateSortForSection(sectionPath: string, sectionType?: string) {
  currentSectionPath = sectionPath;

  // Show/hide rolodex-specific sort options
  const rolodexOptions = document.querySelectorAll('.rolodex-sort');
  rolodexOptions.forEach(el => {
    (el as HTMLElement).style.display = sectionType === 'rolodex' ? '' : 'none';
  });

  try {
    const sortStr = await getSortPreference(sectionPath);
    currentSort = parseSortString(sortStr);
    updateMenuUI();
  } catch (err) {
    console.error('Error loading sort preference:', err);
    currentSort = { type: 'alpha', direction: 'asc' };
    updateMenuUI();
  }
}
```

**Step 5: Update selectSection in sidebar.ts**

Pass the section type when updating sort:

```typescript
// In selectSection(), change:
await updateSortForSection(section.path);
// To:
await updateSortForSection(section.path, section.section_type);
```

**Step 6: Update handleOptionClick default directions**

In `handleOptionClick`, set sensible defaults for new types:

```typescript
currentSort.direction = (sortType === 'alpha') ? 'asc' : 'desc';
```

This already works — `imported` and `lastcall` default to `desc` (newest first), which is correct.

**Step 7: Register click handlers for new sort options**

The existing `initSortMenu` uses `document.querySelectorAll('.sort-option')` which will automatically pick up the new HTML elements. No code change needed.

**Step 8: Verify**

Run: `npm run tauri dev`

Expected: When rolodex section is active, sort menu shows "Added" and "Last call" options. When other sections active, they're hidden. Sorting works correctly.

**Step 9: Commit**

```
Sort cycling for rolodex: name, added, last call
```

---

### Task 5: Add get_contact_data Tauri command (Rust)

A dedicated command to return full structured contact data for the header card when a rolodex note is opened.

**Files:**
- Modify: `src-tauri/src/lib.rs` (new structs + command)

**Step 1: Add ContactData and LabeledValue structs**

After the `Whisper` struct (~line 57):

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct LabeledValue {
    pub label: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContactData {
    pub title: Option<String>,
    pub company: Option<String>,
    pub role: Option<String>,
    pub emails: Vec<LabeledValue>,
    pub phones: Vec<LabeledValue>,
    pub birthday: Option<String>,
    pub addresses: Vec<LabeledValue>,
    pub social: Vec<LabeledValue>,
}
```

**Step 2: Add get_contact_data command**

```rust
#[tauri::command]
fn get_contact_data(note_path: String) -> Result<Option<ContactData>, String> {
    let path = PathBuf::from(&note_path);

    // Check if note is in a rolodex section
    let parent = path.parent().ok_or("No parent directory")?;
    let section_meta = load_section_metadata(&PathBuf::from(parent));
    if section_meta.section_type.as_deref() != Some("rolodex") {
        return Ok(None);
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let (fm, _) = parse_frontmatter(&content);
    let fm = match fm {
        Some(f) => f,
        None => return Ok(None),
    };

    let other = &fm.other;

    fn extract_labeled_values(other: &std::collections::HashMap<String, serde_yaml::Value>, key: &str) -> Vec<LabeledValue> {
        other.get(key)
            .and_then(|v| v.as_sequence())
            .map(|seq| {
                seq.iter().filter_map(|item| {
                    let mapping = item.as_mapping()?;
                    let label = mapping.get(serde_yaml::Value::String("label".into()))?.as_str()?;
                    let value = mapping.get(serde_yaml::Value::String("value".into()))?.as_str()?;
                    Some(LabeledValue { label: label.to_string(), value: value.to_string() })
                }).collect()
            })
            .unwrap_or_default()
    }

    let contact = ContactData {
        title: other.get("title").and_then(|v| v.as_str()).map(String::from),
        company: other.get("company").and_then(|v| v.as_str()).map(String::from),
        role: other.get("role").and_then(|v| v.as_str()).map(String::from),
        emails: extract_labeled_values(other, "emails"),
        phones: extract_labeled_values(other, "phones"),
        birthday: other.get("birthday").and_then(|v| v.as_str()).map(String::from),
        addresses: extract_labeled_values(other, "addresses"),
        social: extract_labeled_values(other, "social"),
    };

    Ok(Some(contact))
}
```

**Step 3: Register the command**

Add `get_contact_data` to the `invoke_handler` list in the `tauri::Builder` chain (~line 2585).

**Step 4: Verify it compiles**

Run: `cd /Users/simon/tetronomis/gitnotes/src-tauri && cargo check`

Expected: No errors.

**Step 5: Commit**

```
Add get_contact_data Tauri command for rolodex card
```

---

### Task 6: Contact header card in editor

Render structured contact data as a read-only card above the ProseMirror editor.

**Files:**
- Modify: `src/editor.ts` (add contact card rendering)
- Modify: `src/main.ts` (call get_contact_data, pass to editor)
- Modify: `src/styles/main.css` (card styles)
- Modify: `index.html` (add contact-card div)

**Step 1: Add contact card container in index.html**

Between `#note-header` and `#editor`:

```html
<div id="contact-card" class="hidden"></div>
```

**Step 2: Add TypeScript interfaces and render function in editor.ts**

Export a new function:

```typescript
export interface LabeledValue {
  label: string;
  value: string;
}

export interface ContactData {
  title?: string;
  company?: string;
  role?: string;
  emails: LabeledValue[];
  phones: LabeledValue[];
  birthday?: string;
  addresses: LabeledValue[];
  social: LabeledValue[];
}

export function renderContactCard(data: ContactData | null) {
  const card = document.getElementById('contact-card');
  if (!card) return;

  if (!data) {
    card.classList.add('hidden');
    card.innerHTML = '';
    return;
  }

  card.classList.remove('hidden');

  let html = '<div class="contact-card-inner">';

  // Name
  if (data.title) {
    html += `<div class="contact-name">${escapeHtml(data.title)}</div>`;
  }

  // Company + role
  const companyParts: string[] = [];
  if (data.company) companyParts.push(escapeHtml(data.company));
  if (data.role) companyParts.push(escapeHtml(data.role));
  if (companyParts.length > 0) {
    html += `<div class="contact-company">${companyParts.join(' · ')}</div>`;
  }

  // Fields
  html += '<div class="contact-fields">';

  // Emails
  for (const email of data.emails) {
    html += `<div class="contact-field">
      <svg class="contact-field-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
      <a class="contact-link" data-href="mailto:${escapeAttr(email.value)}">${escapeHtml(email.value)}</a>
      ${email.label ? `<span class="contact-label">(${escapeHtml(email.label)})</span>` : ''}
    </div>`;
  }

  // Phones
  for (const phone of data.phones) {
    html += `<div class="contact-field">
      <svg class="contact-field-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      <a class="contact-link" data-href="tel:${escapeAttr(phone.value)}">${escapeHtml(phone.value)}</a>
      ${phone.label ? `<span class="contact-label">(${escapeHtml(phone.label)})</span>` : ''}
    </div>`;
  }

  // Birthday
  if (data.birthday) {
    const formatted = formatBirthday(data.birthday);
    html += `<div class="contact-field">
      <svg class="contact-field-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/></svg>
      <span>${escapeHtml(formatted)}</span>
    </div>`;
  }

  // Addresses
  for (const addr of data.addresses) {
    html += `<div class="contact-field">
      <svg class="contact-field-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      <span>${escapeHtml(addr.value)}</span>
      ${addr.label ? `<span class="contact-label">(${escapeHtml(addr.label)})</span>` : ''}
    </div>`;
  }

  // Social
  for (const social of data.social) {
    html += `<div class="contact-field">
      <svg class="contact-field-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      <a class="contact-link" data-href="${escapeAttr(social.value)}">${escapeHtml(social.value)}</a>
      ${social.label ? `<span class="contact-label">(${escapeHtml(social.label)})</span>` : ''}
    </div>`;
  }

  html += '</div></div>';
  card.innerHTML = html;

  // Attach click handlers for links (use Tauri shell.open)
  card.querySelectorAll('.contact-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const href = (link as HTMLElement).dataset.href;
      if (href) {
        const { open } = await import('@tauri-apps/plugin-shell');
        await open(href);
      }
    });
  });
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatBirthday(iso: string): string {
  const date = new Date(iso + 'T00:00:00');
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}
```

**Step 3: Call get_contact_data in loadNoteWithHeader (main.ts)**

In `loadNoteWithHeader`, after loading the raw content and before `updateHeaderData`, add:

```typescript
// Load contact card data if in rolodex section
const { renderContactCard } = await import('./editor');
try {
  const contactData = await invoke<ContactData | null>('get_contact_data', { notePath: note.path });
  renderContactCard(contactData);
} catch {
  renderContactCard(null);
}
```

Import `ContactData` type from editor.ts at the top of main.ts.

Also, when clearing notes (empty section, switching sections), call `renderContactCard(null)` to hide the card.

**Step 4: Add CSS for contact card**

In `src/styles/main.css`:

```css
/* Contact card */
#contact-card {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

#contact-card.hidden {
  display: none;
}

.contact-card-inner {
  max-width: 600px;
}

.contact-name {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.contact-company {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.contact-fields {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.contact-field {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.857rem;
  color: var(--text-primary);
}

.contact-field-icon {
  flex-shrink: 0;
  color: var(--text-secondary);
}

.contact-link {
  color: var(--accent-color);
  cursor: pointer;
  text-decoration: none;
}

.contact-link:hover {
  text-decoration: underline;
}

.contact-label {
  color: var(--text-secondary);
  font-size: 0.75rem;
}
```

**Step 5: Verify visually**

Run: `npm run tauri dev`

Expected: Opening a rolodex contact shows a structured card with name, company, clickable emails/phones, birthday, addresses, social links. Other notes show no card.

**Step 6: Commit**

```
Contact header card for rolodex notes
```

---

### Task 7: Cursor-at-top for rolodex notes

Position the cursor at line 1 when opening a rolodex contact, enabling the prepend-notes pattern.

**Files:**
- Modify: `src/editor.ts:126-140` (loadContent function)
- Modify: `src/main.ts:257-308` (loadNoteWithHeader)

**Step 1: Add cursorToStart option to loadContent**

Modify `loadContent` to accept an options parameter:

```typescript
export function loadContent(content: string, options?: { cursorToStart?: boolean }) {
  if (!editorView) return;

  const parsed = parseFrontMatter(content);
  currentFrontMatter = parsed.frontmatter;

  const doc = defaultMarkdownParser.parse(parsed.body) || schema.node('doc', null, [schema.node('paragraph')]);

  editorView.updateState(
    EditorState.create({
      doc,
      plugins: editorView.state.plugins,
    })
  );

  if (options?.cursorToStart) {
    // Position cursor at start of document
    const tr = editorView.state.tr.setSelection(
      TextSelection.create(editorView.state.doc, 1)
    );
    editorView.dispatch(tr);
  }
}
```

**Step 2: Pass cursorToStart from loadNoteWithHeader**

In `loadNoteWithHeader` in `main.ts`, when loading content, check if the note is in a rolodex section:

```typescript
// Determine if this is a rolodex note (check section type)
const sections: Section[] = await invoke('list_sections');
const noteDir = note.path.substring(0, note.path.lastIndexOf('/'));
const isRolodex = sections.some(s => s.path === noteDir && s.section_type === 'rolodex');

loadContent(fullContent, { cursorToStart: isRolodex });
```

Actually, simpler — we already have `currentSection` available. In `loadNoteWithHeader`, the section context is available from the sidebar module. We should check the contact data response instead since we already call `get_contact_data`:

```typescript
const contactData = await invoke<ContactData | null>('get_contact_data', { notePath: note.path });
renderContactCard(contactData);

// Load content with cursor-at-top for rolodex notes
loadContent(fullContent, { cursorToStart: !!contactData });
```

**Step 3: Verify**

Run: `npm run tauri dev`

Expected: Opening a rolodex contact places cursor at the very start of the body content. Opening a regular note behaves as before.

**Step 4: Commit**

```
Cursor-at-top for rolodex notes (prepend pattern)
```

---

## Summary

| Task | Description | Est. Size |
|------|-------------|-----------|
| 1 | Note struct contact metadata + sort modes (Rust) | Medium |
| 2 | Rolodex section icon | Small |
| 3 | Enhanced sidebar list items | Medium |
| 4 | Sort cycling for rolodex | Medium |
| 5 | get_contact_data Tauri command | Medium |
| 6 | Contact header card | Large |
| 7 | Cursor-at-top for rolodex | Small |

Dependencies: Task 1 must complete before Tasks 2-4 (sidebar needs the data). Task 5 must complete before Tasks 6-7 (card needs the command). Tasks 2, 3, 4 are independent of each other. Tasks 6 and 7 are independent of each other.
