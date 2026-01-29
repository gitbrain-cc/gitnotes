# Whispers UI

> GitNotes UI for browsing and requesting AI character whispers on notes.

## Context

GitBrain is introducing **characters and whispers** — AI-generated companion notes that offer different perspectives on your notes. See the full architecture:

→ `gitbrain/docs/plans/2026-01-29-characters-and-whispers-design.md`

**Prerequisite:** gitbrain must rename `.shd/` to `.whispers/` first.

→ `gitbrain/docs/plans/2026-01-29-rename-shd-to-whispers.md`

## What Are Whispers

Each note in a brain can have companion files in a `.whispers/` directory:

```
1-weeks/
  2026-05.md                         ← human note
  .whispers/
    2026-05.summary.md               ← daily summary character
    2026-05.stoic.md                  ← stoic philosopher character
    2026-05.strategist.md            ← business strategist character
```

Characters are persona definitions stored in `~/.gitbrain/characters/`. Each character is a markdown file with a prompt that shapes how an LLM reads and responds to notes. Characters are activated per-brain in `~/.gitbrain/config.yml`.

Whispers are git-committed — they are valuable AI-generated knowledge, not cache.

## GitNotes Features

### 1. Whisper Panel

When viewing a note, show available whispers in a side panel or collapsible section.

- Discover whispers by reading `.whispers/<note-name>.*.md`
- Show character name and whisper content
- Indicate which characters have whispered vs. which are available but haven't
- Whispers are read-only in the UI (produced by AI, not edited by user)

### 2. Request Whisper

Button or menu to request a new whisper from any installed character.

- Show a character picker (installed characters from `~/.gitbrain/characters/`)
- Calls `gitbrain whisper --character <id> --note <path>`
- Whisper appears in panel when complete
- Loading state while LLM produces the whisper

### 3. Character Management (in Settings)

- List installed characters with name, author, version
- Toggle active/inactive per brain
- Preview character prompt
- Future: install from community repository

### 4. Whisper Indicators

In the note list / sidebar:

- Small indicator showing a note has whispers (count or icon)
- Optional: filter notes that have whispers from a specific character

## UI Considerations

- Whispers are secondary to the human note — they should not compete for attention
- A collapsed/expandable panel works well — visible when wanted, out of the way otherwise
- Character icons or color coding could help distinguish whispers at a glance
- The request flow should feel lightweight — pick character, wait, done

## Dependencies

- `gitbrain whisper` CLI command (not yet implemented)
- `.whispers/` directory convention (rename from `.shd/` pending)
- Character files in `~/.gitbrain/characters/`
- Per-brain character activation in config
