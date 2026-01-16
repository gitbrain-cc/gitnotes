# Add Repository Design

## Overview

Two distinct paths to add a repository: local folder or clone from remote.

## Entry Points

Two buttons in Repository settings, below the vault list:

```
[+ Add Local Folder]  [+ Clone Repository]
```

## Add Local Folder

1. Click button → native folder picker opens
2. Validate selection is a git repository
3. If valid → add to list
4. If not git → inline error: "Not a git repository. Please select a folder with git initialized."

## Clone Repository

### UI

Inline form expands below buttons (not a new modal):

```
┌─────────────────────────────────────────────────────┐
│ Repository URL                                      │
│ ┌─────────────────────────────────────────────────┐ │
│ │ git@github.com:user/repo.git                    │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Clone to                                            │
│ ┌─────────────────────────────────────┐ [Browse]    │
│ │ ~/GitNotes/repo                     │             │
│ └─────────────────────────────────────┘             │
│                                                     │
│                        [Cancel]  [Clone]            │
└─────────────────────────────────────────────────────┘
```

### Behavior

- **URL field** - Auto-detects repo name, updates "Clone to" path as you type
- **Clone to** - Pre-filled with `~/GitNotes/<repo-name>`, editable, Browse button for picker
- **Clone button** - Disabled until valid SSH URL entered

### Validation & Edge Cases

| Scenario | Behavior |
|----------|----------|
| Folder doesn't exist | Clone, show progress, add to list |
| Folder exists + same remote | Skip clone, message "Already cloned", add to list |
| Folder exists + different remote | Error: "Folder contains a different repository" |
| Folder exists + not git | Error: "Folder exists but isn't empty" |
| Clone fails | Error with git message: "Clone failed: Permission denied" |

### Progress

```
Cloning repository...  [━━━━━━━━━━━━━━━━━━━━]
```

## Implementation

### Backend (Rust)

New commands:
- `clone_vault(url: String, path: String)` - runs `git clone`, returns Vault
- `check_clone_path(url: String, path: String)` - returns status enum
- `parse_repo_name(url: String)` - extracts name from SSH URL

### Frontend

- Inline form component in settings.ts
- URL validates SSH format (`git@...` or `ssh://...`)
- Debounced path suggestion on URL input
- Spinner on Clone button during operation

## Out of Scope

- HTTPS clone (SSH only)
- Branch selection (default branch only)
- Shallow clone
- Multiple remotes

---

## Implementation Status

**Executed:** 2026-01-17

All tasks completed. Build passes.

## Follow-up

**UI feedback:** The inline clone form inside the repositories panel feels cramped. Consider:
- Separate smaller modal for clone flow
- Or another approach TBD

To revisit in next iteration.
