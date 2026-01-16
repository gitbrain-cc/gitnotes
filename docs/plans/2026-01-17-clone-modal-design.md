# Clone Modal Design

## Overview

Move clone form from inline in settings to a dedicated small modal. Reduces UI clutter in settings panel.

## Rationale

- Settings modal was overloaded with vault list + clone form
- "Add Local Folder" opens system modal, "Clone Repository" should open its own modal too
- Symmetrical UX: both buttons trigger modals

## Structure

**Trigger:** "Clone Repository" button in settings opens clone modal.

**Modal specs:**
- ~400px wide (smaller than settings)
- Centered with dimmed backdrop
- Settings stays visible but dimmed behind
- Title: "Clone Repository"
- Close X button

```
┌──────────────────────────────────────┐
│ Clone Repository                   ✕ │
├──────────────────────────────────────┤
│ Repository URL                       │
│ ┌──────────────────────────────────┐ │
│ │ git@github.com:user/repo.git     │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Clone to                             │
│ ┌────────────────────────┐ [Browse]  │
│ │ ~/GitNotes/repo        │           │
│ └────────────────────────┘           │
│                                      │
│              [Cancel]  [Clone]       │
└──────────────────────────────────────┘
```

## Behavior

**Opening:**
- Click "Clone Repository" → clone modal appears
- Settings visible but dimmed behind
- Focus goes to URL input

**Escape key:**
- First Escape closes clone modal (returns to settings)
- Second Escape closes settings

**Error states (inline):**
- "Folder contains a different repository"
- "Folder exists but isn't empty"
- "Clone failed: [git error]"

**Progress:**
- "Cloning repository..." with indeterminate progress bar
- Buttons disabled during clone

**Already cloned (SameRemote):**
- Skip clone, brief "Repository already cloned" message
- Add vault, close modal, refresh list

**On success:**
- Close clone modal
- Settings stays open
- Vault list refreshes showing new repo

## Implementation

**HTML:**
- Move clone form out of `#panel-repositories`
- Create new `#clone-modal` with own `#clone-overlay`
- Settings panel: vault list + two buttons only

**CSS:**
- `#clone-overlay` - dimmed backdrop, z-index above settings
- `#clone-modal` - ~400px width, centered, modal styling
- Reuse existing `.clone-field`, `.clone-error`, `.clone-progress` styles

**TypeScript:**
- New `openCloneModal()` / `closeCloneModal()` functions
- "Clone Repository" button calls `openCloneModal()`
- Escape key: check clone modal open first, then settings
- On success: close clone modal, call `renderVaultList()`

**Rust:**
- No changes needed

---

## Implementation Status

**Executed:** 2026-01-17

Refactored clone form to separate modal. Build passes.
