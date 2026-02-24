# Rolodex View

> Contact browsing and editing experience for GitNotes. Structured frontmatter rendered as a read-only card, body as a prepend-first editor.

## Context

The rolodex section is fully implemented in gitbrain — 185+ contacts imported from Apple Contacts, call history sidecars, whisper support. GitNotes currently renders it as a generic section. This spec adds a dedicated view.

**Source of truth:** gitbrain owns the rolodex data model. See `gitbrain/docs/plans/2026-02-16-rolodex-design.md` for the contact schema, import pipeline, and conventions. GitNotes is the UI layer — it reads and displays, never writes frontmatter.

## Scope

**In:**
- Rolodex section icon (people/users) in sidebar
- Enhanced sidebar list items: contact name + smart subtitle
- Sort cycling: name, added, last call
- Contact header card above editor (read-only, all available fields)
- Body editing with cursor-at-top prepend pattern

**Out (future iterations):**
- Inline frontmatter editing (managed by `gitbrain rolodex import`)
- Search/filter within rolodex
- Call history display
- Whisper integration in contact view
- Contact photos/avatars

## Sidebar

### Section Icon

People/users icon for `type: rolodex` sections. Lucide `users` style — 16px, stroke `currentColor`, stroke-width 2. Same rendering pattern as the journal quill icon.

### List Items

Rolodex sections render enhanced list items instead of plain filenames:

```
[users icon] Rolodex
  Maria Garcia
  Acme Corp · VP Engineering

  John Smith
  john.smith@gmail.com

  Adrien
```

**Primary line:** `title` from frontmatter (the contact's full name).

**Subtitle:** For now, a simple fallback cascade from frontmatter fields:
1. `company` + `role` (e.g. "Acme Corp · VP Engineering")
2. `company` alone
3. `role` alone
4. Primary email address
5. Empty (no subtitle)

This subtitle is a placeholder. The plan is to replace it with something smarter — either a user-chosen tagline per contact, or an AI-suggested summary line (e.g. "College friend, lives in Paris" or "Guidefitter partner"). The data model and UI slot are designed to accommodate that evolution.

### Sort Cycling

Clicking the section icon cycles through sort modes:

1. **Name A→Z** (default)
2. **Name Z→A**
3. **Added newest→oldest** (from `imported` frontmatter field)
4. **Added oldest→newest**
5. **Last call newest→oldest** (from `last_call` frontmatter field)
6. **Last call oldest→newest**

**Sort indicator:** Small text label next to the section title showing the active mode (e.g. "A-Z", "Added ↓", "Calls ↓"). Updates on each click.

**Missing data:** Contacts without `last_call` sort to bottom in call modes. Contacts without `imported` sort to bottom in added modes.

**Persistence:** Sort mode is per-section and persists across app restarts (stored in `.gitnotes` config alongside section order).

## Contact Header Card

When a rolodex note is opened, a read-only card renders between the note header and the ProseMirror editor. It displays all available frontmatter fields — empty fields are omitted.

### Layout

```
┌─────────────────────────────────────┐
│ Maria Garcia                        │
│ Acme Corp · VP Engineering          │
│                                     │
│ [mail icon] maria@acme.com (work)   │
│ [mail icon] m.garcia@gmail.com      │
│ [phone icon] +1 555-0123 (work)     │
│ [phone icon] +1 555-0456 (mobile)   │
│ [cake icon] March 15, 1985          │
│ [map icon] 123 Main St, SF (work)   │
│ [link icon] linkedin.com/in/maria   │
│ [link icon] @mariagarcia            │
└─────────────────────────────────────┘
```

All icons are small inline SVGs (14-16px, stroke style). No emoji.

### Field rendering

| Field | Icon | Behavior |
|-------|------|----------|
| `title` | none | Rendered as card heading |
| `company` + `role` | none | Subheading, dimmed |
| `emails[]` | mail | Clickable via `shell.open(mailto:...)` |
| `phones[]` | phone | Clickable via `shell.open(tel:...)` |
| `birthday` | cake | Formatted as readable date (e.g. "March 15, 1985") |
| `addresses[]` | map-pin | Plain text display |
| `social[]` | link | Clickable via `shell.open(url)` |
| `imported` | none | Not shown in card (used for sorting only) |
| `last_call` | none | Not shown in card (used for sorting only) |

Labels (work, mobile, personal) shown in parentheses, dimmed, after the value.

**Link handling:** All clickable values use Tauri's `shell.open()` API to open in the system default handler (mail client, phone app, browser). Raw HTML links don't work in Tauri's webview.

### Card height

Most contacts are sparse (3-5 fields). Dense contacts with multiple emails, phones, and addresses will produce a taller card. This is acceptable — the card scrolls with the editor content. No collapse/expand needed for v1.

## Editor Behavior

### Prepend pattern

When a rolodex contact is opened:
1. Contact header card renders (read-only, from frontmatter)
2. ProseMirror editor loads the body content (below frontmatter)
3. Cursor is positioned at line 1

The user types new notes at the top, presses Enter to push older content down. This creates a natural reverse-chronological flow — most recent notes always visible first. No automatic date stamps — the user owns the format.

**Cursor-at-top:** ProseMirror typically restores last cursor position. For rolodex notes specifically, override this to always set selection to the start of the document on load.

### Empty body

If the contact has no body content, the editor shows a placeholder: "Add notes..." (dimmed, disappears on focus).

### Auto-save

Same 500ms debounce as regular notes. Saves body only — frontmatter is never written by GitNotes.

## Rust Backend Changes

### Contact metadata in list_notes

Extend note metadata returned by `list_notes` with fields needed for sidebar rendering and sorting:

- `contact_title: Option<String>` — for display name
- `contact_company: Option<String>` — for subtitle
- `contact_role: Option<String>` — for subtitle
- `contact_email: Option<String>` — primary email, subtitle fallback
- `imported: Option<String>` — for sort
- `last_call: Option<String>` — for sort

Only populated when the note is in a `type: rolodex` section. Parsed from YAML frontmatter during listing. Avoids the frontend needing to load every note individually for sidebar data.

### ContactData in load_note

When `load_note` is called for a note inside a `type: rolodex` section, parse the full frontmatter and return it as structured data:

```rust
pub struct ContactData {
    pub title: Option<String>,
    pub company: Option<String>,
    pub role: Option<String>,
    pub emails: Vec<LabeledValue>,
    pub phones: Vec<LabeledValue>,
    pub birthday: Option<String>,
    pub addresses: Vec<LabeledValue>,
    pub social: Vec<LabeledValue>,
    pub imported: Option<String>,
    pub last_call: Option<String>,
}

pub struct LabeledValue {
    pub label: String,
    pub value: String,
}
```

Returned alongside the existing note content. Frontend renders the card from this struct — no frontmatter parsing in TypeScript.

**No new Tauri commands.** Extend existing `load_note` and `list_notes` responses.

## Files Changed

| File | Change |
|------|--------|
| `src-tauri/src/lib.rs` | `ContactData`, `LabeledValue` structs. Extend `load_note` response with contact data. Extend `list_notes` note metadata with contact fields. |
| `src/sidebar.ts` | Rolodex icon. Enhanced list items (title + subtitle). Sort cycling on icon click. Sort indicator. |
| `src/editor.ts` | Contact header card rendering. Cursor-at-top for rolodex notes. |
| `src/styles/main.css` | Card styles, subtitle styles, sort indicator, field icons. |

No new files.

## Implementation Order

Each step is independently shippable:

1. **Rust: contact metadata in list_notes** — extend note metadata for sidebar
2. **Sidebar: rolodex icon** — small, visible payoff
3. **Sidebar: enhanced list items** — title + subtitle for rolodex sections
4. **Sidebar: sort cycling** — icon click cycles name/added/last call with persistence
5. **Rust: ContactData in load_note** — full frontmatter parsing for rolodex notes
6. **Editor: contact header card** — render structured card with SVG icons and shell.open links
7. **Editor: cursor-at-top** — override cursor position for rolodex notes

## Future

- **Smart subtitle** — user-chosen tagline or AI-suggested summary per contact
- **Search/filter** — type-to-filter in the rolodex sidebar list
- **Call history** — display recent calls in the card or a dedicated section
- **Whisper panel** — surface character whispers alongside contact notes
- **Contact photos** — avatar from Apple Contacts (requires gitbrain photo import)
