# Journal Support & Whisper Toggle

> Section type awareness, journal icon, and inline whisper viewing for GitNotes.

## Context

GitBrain is adding typed sections — starting with `type: journal` in `.section.md` frontmatter.
GitNotes needs to read this type and surface journal-specific UI, plus display whispers
for any note across all sections.

**Source of truth:** GitBrain defines section types, whisper conventions, and character systems.
GitNotes consumes these as a UI layer. See:
- `gitbrain/docs/plans/2026-02-15-section-types-design.md`
- `gitbrain/docs/plans/2026-01-29-characters-and-whispers-design.md`

**GitBrain status:** Section types are fully implemented (`gitbrain@dce1420`). The
`SectionMetadata.type` field supports `'journal' | 'rolodex'`. `gitbrain journal init`
creates typed sections. Skills read section type at runtime.

**Prior art:** `docs/plans/2026-01-29-whispers-ui-design.md` — broader whispers vision
(panels, requesting whispers, character management). This plan implements the first slice:
read-only whisper viewing via toggle.

## Feature 1: Section Type Awareness

### Rust backend

Add `section_type` field to `SectionMetadata` and `Section` structs:

```rust
pub struct SectionMetadata {
    // ... existing fields ...
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "type")]
    pub section_type: Option<String>,
}

pub struct Section {
    // ... existing fields ...
    pub section_type: Option<String>,
}
```

When loading sections, propagate `type` from the `.section.md` YAML to the `Section` response.

### TypeScript frontend

```typescript
interface Section {
  name: string;
  path: string;
  title?: string;
  color?: string;
  type?: string;  // "journal", "rolodex", or undefined
}
```

Backwards compatible — sections without `type` work unchanged.

**Graceful degradation:** For the journal quill icon, also check `section.name === '1-weeks'`
as fallback when `type` is not set. Many existing brains won't have `type: journal` yet
until the user runs `gitbrain journal init` or gitbrain's doctor adds it.

## Feature 2: Journal Quill Icon

When `section.type === 'journal'`, render a quill/inkwell SVG icon before the section
title in the sidebar.

Only typed sections get icons. Generic sections stay text-only to keep the sidebar clean.

### Rendering

In `renderSections()`, prepend the icon to the `<li>`:

```
[quill] Journal        ← type: journal
Ideas                  ← no type, no icon
Patterns               ← no type, no icon
```

Icon: small quill SVG, 14-16px, stroke style matching existing UI icons (currentColor,
stroke-width 2).

## Feature 3: Whisper Toggle

Generic feature — works for any note in any section that has whispers.

### Whisper Discovery (Rust)

New Tauri command: `list_whispers`

**Input:** note path (e.g., `/brain/1-weeks/2026-07.md`)
**Output:** list of whispers found in `.whispers/` for that note

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct Whisper {
    pub character: String,   // "summary", "stoic", etc.
    pub path: String,        // absolute path to whisper file
    pub generated: Option<String>, // from frontmatter, ISO timestamp
}
```

Discovery logic:
1. Get the note's parent directory
2. Look in `.whispers/` subdirectory
3. Match files: `<note-stem>.<character>.md` (e.g., `2026-07.summary.md`)
4. Extract character name from filename (segment between note stem and `.md`)
5. Parse each whisper's frontmatter for `generated` timestamp

Bare `<stem>.md` files in `.whispers/` are stale pre-character artifacts — ignored.

### Toggle UI (note header)

Toggle pills appear in `#note-header` when whispers exist for the current note:

```
2026-07
Created Feb 10, 2026 · Edited 2 hours ago
[Note] [Summary]                    ← single whisper: two pills
[Note] [Summary] [Stoic] [Critic]   ← multiple: one per character
```

When no whispers exist, no pills shown — header unchanged.

### Whisper View (read-only editor)

When a character pill is clicked:
1. Flush any pending auto-save on the current note
2. Load whisper markdown into ProseMirror with `editable: false`
3. Add `whisper-mode` class to `#editor-container`
4. Update header meta to: `Generated <date> · by <character>`

Visual cues for read-only:
- Subtle background tint (slightly muted via CSS)
- Default cursor (no text I-beam)
- No save triggers

Clicking "Note" pill restores the original note content in editable mode.

### State Management

```typescript
// in main.ts
let currentWhisper: { character: string; path: string } | null = null;
```

Resets:
- Switching notes → reset to Note view
- Switching sections → reset to Note view
- Closing note → reset

## Files Changed

| File | Change |
|------|--------|
| `src-tauri/src/lib.rs` | `section_type` on structs, `list_whispers` command |
| `src/sidebar.ts` | Quill icon for journal-type sections |
| `src/editor.ts` | Whisper toggle pills, read-only mode switching |
| `src/main.ts` | Whisper state tracking, orchestration |
| `src/styles/main.css` | Toggle pill styles, `.whisper-mode` visual treatment |

## Implementation Order

1. Section type awareness (Rust + TS) — foundational, small
2. Journal quill icon — visible payoff, depends on #1
3. Whisper discovery command (Rust) — backend for #4
4. Whisper toggle UI + read-only view — the main feature

## Future Extensions

- **Whisper annotations:** flip `editable: true`, add save path for user notes on whispers
- **Request whisper:** button to invoke `gitbrain whisper` from the UI
- **Whisper indicators:** badge on notes in sidebar showing whisper count
- **Rolodex icon:** when `type: rolodex` lands, add its own section icon
- **Character management:** settings panel for installed characters (see prior design)
