# Onboarding ✅ Done

## Overview

First-run experience to set up GitNotes with a notes repository.

## Flow

1. **Welcome screen** ✅ Done
   - [x] App intro / branding
   - [x] "Get Started" CTA

2. **Connect repository** ✅ Done
   - [x] Clone existing git repo (SSH URL)
   - [x] Open local folder
   - [x] Create new vault (init git repo)

3. **Import existing notes** (future)
   - [ ] OneNote import wizard
   - [ ] Obsidian vault migration
   - [ ] Plain markdown folder

4. **Configuration** ✅ Done (via Settings)
   - [ ] Git identity (name/email) if not set
   - [x] Saving mechanism preference (simple/manual/smart modes)
   - [x] Theme preference (6 themes)
   - [ ] Default section setup

## Technical

- [x] Config file support (`~/Library/Application Support/gitnotes/settings.json`)
- [x] Store vaults for quick switching
- [x] Onboarding trigger: `settings.vaults.length === 0`

## Multi-vault support ✅ Done

- [x] Vault switcher in Settings UI
- [x] Add/remove vaults
- [x] Each vault = independent git repo
- [ ] Vault switcher in main UI (top-left dropdown?)
