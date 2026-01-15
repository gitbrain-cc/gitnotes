# Settings Design

## Overview

Minimal settings for NoteOne. 4 sections, ~8 settings total.

## Sections

### Repositories

Manage multiple note vaults.

| Setting | Type | Description |
|---------|------|-------------|
| Vault list | List | Name + path for each vault |
| Active vault | Selection | Currently open vault |
| Add/Remove | Actions | Manage vault list |

### Git

Global git behavior (applies to all vaults).

| Setting | Type | Options |
|---------|------|---------|
| Mode | Select | Simple / Manual / Smart |

**Mode behavior:**

| Mode | Commit | When |
|------|--------|------|
| Simple | Auto | Every save |
| Manual | Explicit | User triggers only |
| Smart | Auto-batched | Idle timeout, app close, edit elsewhere |

**Smart mode logic:**
- Commit when idle 2+ minutes (thought complete)
- Commit on app close (session end)
- Commit previous page when starting to edit a new page (moved on)
- Does NOT commit on page switch alone (might be referencing)

Requires tracking: dirty pages, last edit time, edit intent.

Push is always manual (no setting).

### Appearance

| Setting | Type | Options |
|---------|------|---------|
| Theme | Select | Original, Yellow-pad, Classic-light, Classic-dark, True-dark, System |

- **Original**: Current dark theme
- **Yellow-pad**: Warm, legal pad aesthetic
- **Classic-light**: Clean light theme
- **Classic-dark**: Standard dark theme
- **True-dark**: OLED black
- **System**: Follows OS (maps to Classic-light/dark)

Accent colors baked into each theme (no separate picker).

### Editor

| Setting | Type | Default |
|---------|------|---------|
| Font size | Number | 13px |
| Font family | Select | System default |
| Wrapping | Toggle | On |

Future: spellcheck toggle.

## Out of Scope

Removed from original wishlist (YAGNI):
- Line numbers
- Tab size / spaces vs tabs
- Auto-push options
- Commit message templates
- GPG signing
- Cloud sync
- Backup settings
- Export

Can revisit if actually needed.
