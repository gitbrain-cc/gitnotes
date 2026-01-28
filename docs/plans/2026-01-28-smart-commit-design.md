# Smart Commit Design

## Overview

Redesign GitNotes commit behavior from three modes (simple/smart/manual) to two:
- **Auto-commit ON** - Intelligent commit timing based on confidence scoring
- **Auto-commit OFF** - Manual commits only via Cmd+S

## Core Principles

1. **Save and commit are decoupled** - Save is aggressive (data safety), commit is intelligent (clean history)
2. **Confidence-based triggering** - Multiple signals contribute to commit decision
3. **Safety delays** - Never commit mid-thought; minimum delay after save
4. **Transparency** - Status bar shows commit confidence building

## The Commit Pipeline

```
Edit → Save (500ms debounce) → Commit Evaluation → Maybe Commit
```

## Commit State

```typescript
interface CommitState {
  lastSaveTime: number;
  lastCommitTime: number;
  lastEditTime: number;
  editSessionStart: number;
  recentEditCount: number;
  previousVelocity: number;
  pendingChanges: Map<string, ChangeInfo>;
}

interface ChangeInfo {
  linesAdded: number;
  linesRemoved: number;
  savedAt: number;
}
```

## Confidence Algorithm

Accumulate score from multiple weighted signals. Commit when score ≥ threshold.

### Signals and Weights

| Signal | Weight | Detection |
|--------|--------|-----------|
| Idle > 2 min | +40 | `Date.now() - lastEditTime > 120_000` |
| Idle > 1 min | +25 | `Date.now() - lastEditTime > 60_000` |
| Idle > 30s | +10 | `Date.now() - lastEditTime > 30_000` |
| Velocity drop | +20 | Was editing fast, now stopped |
| Large change (50+ lines) | +15 | `pendingChanges.totalLines > 50` |
| Medium change (10+ lines) | +10 | `pendingChanges.totalLines > 10` |
| Paragraph completed | +15 | Last edit ended with double newline |
| Heading completed | +20 | Last edit ended a markdown heading |
| Cursor moved away | +10 | Cursor position far from last edit |
| Scrolled away | +15 | Viewport no longer shows edit location |

### Safety Gate

```typescript
if (timeSinceSave < MIN_COMMIT_DELAY) return { score: 0 };
```

`MIN_COMMIT_DELAY` = 30 seconds. No commit can fire within 30s of last save, preventing mid-thought commits.

### Threshold

Commit fires at 100%. The weights are calibrated so that:
- Idle 2min alone = 40%
- Idle 2min + velocity drop = 60%
- Idle 2min + velocity drop + paragraph end = 75%
- Idle 2min + velocity drop + paragraph end + scrolled away = 90%
- etc.

Multiple signals combining naturally reaches 100%.

### High-Confidence Bypasses

These events trigger immediate commit (after safety delay):
- Note switch
- Section switch
- Window blur (app loses focus)
- App close (beforeunload)

### Evaluation Loop

Run confidence calculation every 10 seconds when pending changes exist.

```typescript
setInterval(() => {
  if (!hasUncommittedChanges()) return;

  const { score, signals } = calculateConfidence();
  updateStatusBar(score);

  if (score >= 100) {
    commit();
  }
}, 10_000);
```

## Status Bar Indicator

### States

| State | Display | Duration |
|-------|---------|----------|
| Idle | `Ready` | Persistent |
| Typing | `Modified...` | While editing |
| Saved, no confidence | `Saved` | Until confidence > 0 |
| Saved, building | `Saved · ████░░░░ 52%` | While accumulating |
| Just committed | `Committed ✓` | 2 seconds, then Ready |

### Confidence Bar

Visual progress bar showing how close to auto-commit:
- Empty at 0%
- Fills as confidence builds
- Pulses briefly when commit fires

## Commit Messages

Auto-generated from changed note names, ordered by change magnitude:

```
Update Today           // single note
Update Today, Ideas    // multiple notes, most-changed first
```

## Manual Commit (Cmd+S)

Supplements auto-commit. When user presses Cmd+S:

1. Open commit box modal
2. Pre-fill message with auto-generated text
3. Focus the message input
4. Enter confirms, Escape cancels

This allows users to write meaningful commit messages when desired, while auto-commits continue silently for routine saves.

## Settings

### Auto-commit Toggle

```
[x] Auto-commit
    Automatically commit after periods of inactivity
```

When OFF: saves happen normally, commits only via Cmd+S.

### Remove Old Settings

Delete:
- Simple/Smart/Manual mode selector
- Commit interval slider (no longer needed)

## Migration

- `commit_mode: "simple"` → `auto_commit: true`
- `commit_mode: "smart"` → `auto_commit: true`
- `commit_mode: "manual"` → `auto_commit: false`
- `commit_interval` → deleted (algorithm handles timing)

## Implementation Notes

### Detecting Structural Completion

```typescript
function lastEditEndedParagraph(): boolean {
  // Check if last edit resulted in double newline
  const content = getContent();
  const cursorPos = getCursorPosition();
  return content.slice(cursorPos - 2, cursorPos) === '\n\n';
}

function lastEditEndedHeading(): boolean {
  // Check if previous line is a heading and current line is empty
  const lines = getContent().split('\n');
  const cursorLine = getCurrentLineNumber();
  if (cursorLine < 1) return false;
  const prevLine = lines[cursorLine - 1];
  const currLine = lines[cursorLine] || '';
  return /^#{1,6}\s+.+/.test(prevLine) && currLine.trim() === '';
}
```

### Edit Velocity Tracking

```typescript
const VELOCITY_WINDOW = 30_000; // 30 seconds
let editTimestamps: number[] = [];

function recordEdit() {
  const now = Date.now();
  editTimestamps.push(now);
  // Prune old entries
  editTimestamps = editTimestamps.filter(t => now - t < VELOCITY_WINDOW);
}

function getEditVelocity(): number {
  // Edits per second over window
  return editTimestamps.length / (VELOCITY_WINDOW / 1000);
}
```

### Scroll/Cursor Position Tracking

```typescript
let lastEditScrollTop: number;
let lastEditCursorPos: number;

function userScrolledAway(): boolean {
  const currentScroll = editor.scrollTop;
  const viewportHeight = editor.clientHeight;
  return Math.abs(currentScroll - lastEditScrollTop) > viewportHeight;
}

function cursorMovedAwayFromEdit(): boolean {
  const currentPos = getCursorPosition();
  return Math.abs(currentPos - lastEditCursorPos) > 500; // characters
}
```

## Files to Modify

- `src/main.ts` - Core commit logic, state management
- `src/status-bar.ts` - Confidence indicator UI
- `src/settings.ts` - Simplified toggle
- `src-tauri/src/lib.rs` - Settings schema migration
- `index.html` - Updated settings panel
- `src/styles.css` - Confidence bar styling
