# Onboarding TODO

## Overview

First-run experience to set up NoteOne with a notes repository.

## Flow

1. **Welcome screen**
   - App intro / branding
   - "Get Started" CTA

2. **Connect repository**
   - Clone existing git repo (URL input)
   - Open local folder
   - Create new vault (init git repo)

3. **Import existing notes** (optional)
   - OneNote import wizard
   - Obsidian vault migration
   - Plain markdown folder

4. **Configuration**
   - Git identity (name/email) if not set
   - Saving mechanism preference:
     - Auto-commit on save (default)
     - Manual commits only (expert mode)
     - Sync frequency for remote push
   - Theme preference
   - Default section setup

## Technical

- Currently hardcoded: `src-tauri/src/lib.rs:237`
- Need: config file (`~/.config/noteone/config.json` or similar)
- Store recent vaults for quick switching

## Multi-vault support

- Vault switcher in UI (top-left dropdown?)
- Recent vaults list
- Each vault = independent git repo
