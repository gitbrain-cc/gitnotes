# Settings: Unified "Add Repository" Dropdown

**Date:** 2025-01-20
**Status:** Design

## Problem

Settings has two separate buttons ("+ Add Local Folder" and "+ Clone Repository") while onboarding has three options including "Create Repository". Users cannot create a new empty repository from Settings.

## Solution

Replace the two buttons with a single "+ Add Repository" dropdown that offers all three options. Consolidate shared modal code between settings and onboarding.

## UI Design

### Current State
```
[+ Add Local Folder]  [+ Clone Repository]
```

### New State
```
[+ Add Repository ▾]
```

Clicking shows dropdown menu:
```
┌─────────────────────┐
│ Add Local Folder    │
│ Clone Repository    │
│ Create Repository   │
└─────────────────────┘
```

### Dropdown Behavior
- Position below button, right-aligned
- Close on click outside or Escape key
- Standard hover states
- No external library needed

## Implementation

### New File: `src/modals.ts`

Extract shared modal logic currently duplicated between `settings.ts` and `onboarding.ts`:

```typescript
// Clone modal
export function openCloneModal(): void
export function closeCloneModal(): void
export function showCloneError(message: string): void
export function hideCloneError(): void
export function showCloneProgress(): void
export function hideCloneProgress(): void
export function isValidSshUrl(url: string): boolean
export function updateCloneButton(): void

// Create modal
export function openCreateModal(): void
export function closeCreateModal(): void
export function showCreateError(message: string): void
export function hideCreateError(): void
export function updateCreateButton(): void

// Shared init (wire up event listeners)
export function initCloneModal(onSuccess: () => Promise<void>): void
export function initCreateModal(onSuccess: () => Promise<void>): void
```

### Changes to `index.html`

1. Replace two buttons with dropdown:
```html
<div class="add-repo-dropdown">
  <button id="add-repo-btn" class="add-repo-button">
    + Add Repository
    <svg><!-- chevron down --></svg>
  </button>
  <div id="add-repo-menu" class="dropdown-menu hidden">
    <button data-action="local">Add Local Folder</button>
    <button data-action="clone">Clone Repository</button>
    <button data-action="create">Create Repository</button>
  </div>
</div>
```

2. Add create modal (move from onboarding-only to shared):
```html
<div id="create-overlay" class="modal-overlay hidden">
  <!-- Name input, path input, browse button, create button -->
</div>
```

### Changes to `src/settings.ts`

- Remove clone modal helper functions (now in modals.ts)
- Import from modals.ts
- Add dropdown toggle logic
- Wire up all three menu options

### Changes to `src/onboarding.ts`

- Remove duplicated clone/create modal helpers
- Import from modals.ts
- Keep onboarding-specific flow (step navigation, completeOnboarding callback)

## File Changes Summary

| File | Action |
|------|--------|
| `src/modals.ts` | Create - shared modal logic |
| `src/settings.ts` | Modify - use shared modals, add dropdown |
| `src/onboarding.ts` | Modify - use shared modals |
| `index.html` | Modify - dropdown UI, create modal HTML |
| `src/styles/main.css` | Modify - dropdown styles |

## Testing

1. Settings dropdown opens/closes correctly
2. All three options work from Settings
3. Onboarding still works (clone and create flows)
4. Escape key closes modals in correct order (create/clone modal first, then settings)
5. Click outside closes dropdown and modals appropriately
