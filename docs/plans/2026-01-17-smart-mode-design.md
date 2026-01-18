# Smart Mode Design

> Git commit mode that batches commits based on time intervals instead of committing on every save.

## Overview

Smart mode replaces Simple mode as the default. It commits only when:
1. There are uncommitted changes, AND
2. Enough time has passed since the last commit

This reduces commit noise while ensuring work is regularly saved to git.

## Commit Triggers

All triggers use the same logic:

```
if hasUncommittedChanges AND (now - lastCommitTime >= interval):
    commit all staged changes
```

Triggers:
- **Inactivity timeout** - fires after `interval` minutes of no edits
- **File switch** - when navigating to a different note
- **Section switch** - when changing sections
- **App blur** - when window loses focus
- **App close** - on quit/beforeunload

The inactivity timer resets on every keystroke.

## Settings

### Git Modes

| Mode | Behavior |
|------|----------|
| Smart (default) | Commit after interval on triggers |
| Simple | Commit on every save |
| Manual | No auto-commit, user commits manually |

### Commit Interval

- Only shown when Smart mode selected
- Default: 30 minutes
- User configurable (number input in minutes)
- Controls both inactivity timeout and minimum time between commits

## State Tracking

Module-level state in main.ts:

```typescript
let lastCommitTime: number = Date.now();
let hasUncommittedChanges: boolean = false;
let inactivityTimer: number | null = null;
```

## Implementation Summary

### Rust (lib.rs)
- Add `commit_interval: u32` to `GitSettings` (default: 30)
- Add `get_commit_interval` / `set_commit_interval` commands
- Change `default_commit_mode()` from `"simple"` to `"smart"`

### TypeScript (settings.ts)
- Add interval input (visible only in smart mode)
- Wire up interval get/set commands

### TypeScript (main.ts)
- Track `lastCommitTime`, `hasUncommittedChanges`
- Add `inactivityTimer` that resets on keystrokes
- Add `trySmartCommit()` function with the commit check logic
- Call `trySmartCommit()` on: inactivity timeout, file switch, section switch, blur, beforeunload
- Keep simple/manual modes working (check mode first)

### HTML (index.html)
- Add interval input field to git settings panel
- Show/hide based on selected mode
