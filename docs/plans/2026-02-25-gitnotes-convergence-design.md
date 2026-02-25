# GitNotes — Server Convergence Plan

**Date:** 2026-02-25
**Status:** Draft
**Ref:** `docs/gitbrain-ecosystem.md`

## Context

GitNotes is a local app — reads brain repos from disk, commits via git. As the gitbrain ecosystem grows with server infrastructure (gitbrain-web), capture surfaces (iOS, tray), and sync, GitNotes' role doesn't change. If a brain is synced to disk by any means, GitNotes already shows it.

## Principle

**GitNotes is a local editor, not a server client.** Server-facing UI belongs to the web dashboard. Capture and sync belong to the CLI and tray app. GitNotes gains git-aware features (sync status, push/pull, conflict resolution) — not server-aware features.

---

## What GitNotes Actually Needs

Three features, all pure git — no HTTP client, no server auth, no API calls.

### 1. Sync Status Indicator

Show whether the local brain is in sync with its remote.

- Sidebar shows sync icon next to brains that have a git remote configured.
- States: synced (checkmark), ahead (arrow up), behind (arrow down), diverged (warning).
- Detection: `git remote -v` to check if remote exists, `git rev-list` for ahead/behind counts.
- Refresh on app focus and after push/pull.

### 2. Push / Pull from UI

Convenience buttons so users don't switch to terminal.

- Toolbar button or context menu: "Sync" (pull then push).
- Shells out to `git pull --rebase` / `git push` via Tauri shell plugin (already enabled).
- Alternative: shell out to `gitbrain push` / `gitbrain pull` if CLI is installed.
- GitNotes doesn't implement git transport — delegates to git or the CLI.
- Shows success/failure feedback in status bar.

### 3. Conflict Resolution UI

When a pull creates merge conflicts, help the user resolve them.

- Detect conflicts via `git status --porcelain` (lines starting with `UU`, `AA`, etc.).
- Show affected files with side-by-side diff view (local vs incoming).
- User picks resolution per conflict, GitNotes stages and commits the merge.
- This is the most complex feature — defer until team brains are actually in use.

---

## What Doesn't Belong in GitNotes

These were in the original draft but belong elsewhere in the ecosystem:

| Feature | Belongs to | Why |
|---------|-----------|-----|
| Activity feed (server captures) | **Web dashboard** | Server UI for server features |
| Remote brain browsing | **Web dashboard** | No local files = not gitnotes' job |
| File browser / upload | **Web dashboard** or **tray** | Server storage concern |
| New note notifications | **Tray app** (OS-level) | GitNotes may not be open |
| Aggregated rolodex | **Web dashboard** or **CLI** | Cross-brain aggregation is a server query |
| Team member avatars | Nice-to-have, not essential | Can revisit if teams ship |

**Note:** If a server-triaged note lands in a local brain via sync, GitNotes already picks it up through its file watcher — no special integration needed.

---

## Technical Notes

- **No new Tauri plugins needed.** All three features use git commands via the existing `tauri-plugin-shell`.
- **No server auth in GitNotes.** Auth is the CLI's concern (`gitbrain login`).
- **No config file bridging.** GitNotes detects remotes via `git remote -v` on the vault path, not by reading `~/.gitbrain/config.yml`.
- **Offline by definition.** These are git features — they work (or gracefully degrade) whether a server exists or not.

---

## Timeline

| Feature | When | Complexity |
|---------|------|-----------|
| Sync status indicator | Next after current v0.4 work | Low — git commands + sidebar icon |
| Push/pull button | Same batch | Low — shell out + UI feedback |
| Conflict resolution | When team brains are in use | Medium — diff view component |
