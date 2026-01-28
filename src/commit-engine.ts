// src/commit-engine.ts
// Intelligent auto-commit engine with confidence scoring

interface ChangeInfo {
  linesChanged: number;
  savedAt: number;
}

interface CommitState {
  lastSaveTime: number;
  lastCommitTime: number;
  lastEditTime: number;
  previousVelocity: number;
  pendingChanges: Map<string, ChangeInfo>;
  lastEditCursorPos: number;
  lastEditScrollTop: number;
}

// Constants
export const MIN_COMMIT_DELAY = 30_000; // 30 seconds safety
export const VELOCITY_WINDOW = 30_000; // 30 seconds
export const EVAL_INTERVAL = 10_000; // 10 seconds

// State
const state: CommitState = {
  lastSaveTime: 0,
  lastCommitTime: Date.now(),
  lastEditTime: Date.now(),
  previousVelocity: 0,
  pendingChanges: new Map(),
  lastEditCursorPos: 0,
  lastEditScrollTop: 0,
};

let editTimestamps: number[] = [];
let evalIntervalId: number | null = null;

export function getState(): CommitState {
  return state;
}

export function getEditTimestamps(): number[] {
  return editTimestamps;
}

export function getEvalIntervalId(): number | null {
  return evalIntervalId;
}

export function setEvalIntervalId(id: number | null): void {
  evalIntervalId = id;
}

export function addEditTimestamp(timestamp: number): void {
  editTimestamps.push(timestamp);
}

export function clearEditTimestamps(): void {
  editTimestamps = [];
}

// Edit tracking functions
export function recordEdit(cursorPos: number, scrollTop: number): void {
  const now = Date.now();

  // Update velocity tracking
  state.previousVelocity = getEditVelocity();
  editTimestamps.push(now);
  editTimestamps = editTimestamps.filter((t) => now - t < VELOCITY_WINDOW);

  // Update state
  state.lastEditTime = now;
  state.lastEditCursorPos = cursorPos;
  state.lastEditScrollTop = scrollTop;
}

export function getEditVelocity(): number {
  const now = Date.now();
  const recentEdits = editTimestamps.filter((t) => now - t < VELOCITY_WINDOW);
  return recentEdits.length / (VELOCITY_WINDOW / 1000);
}

export function recordSave(notePath: string, linesChanged: number): void {
  state.lastSaveTime = Date.now();
  state.pendingChanges.set(notePath, {
    linesChanged,
    savedAt: Date.now(),
  });
}

export function recordCommit(): void {
  state.lastCommitTime = Date.now();
  state.pendingChanges.clear();
}

export function hasUncommittedChanges(): boolean {
  return state.pendingChanges.size > 0;
}

// Confidence calculation
export interface ConfidenceResult {
  score: number;
  signals: string[];
}

export function calculateConfidence(
  currentCursorPos: number,
  currentScrollTop: number,
  viewportHeight: number,
  contentAtCursor: string
): ConfidenceResult {
  const signals: string[] = [];
  let score = 0;

  const timeSinceSave = Date.now() - state.lastSaveTime;
  const timeSinceEdit = Date.now() - state.lastEditTime;

  // Safety gate: no commit within MIN_COMMIT_DELAY of save
  if (timeSinceSave < MIN_COMMIT_DELAY) {
    return { score: 0, signals: [] };
  }

  // Time-based signals (max 40)
  if (timeSinceEdit > 120_000) {
    score += 40;
    signals.push('idle_2min');
  } else if (timeSinceEdit > 60_000) {
    score += 25;
    signals.push('idle_1min');
  } else if (timeSinceEdit > 30_000) {
    score += 10;
    signals.push('idle_30s');
  }

  // Velocity drop (max 20)
  const currentVelocity = getEditVelocity();
  if (currentVelocity < 0.1 && state.previousVelocity > 0.5) {
    score += 20;
    signals.push('velocity_drop');
  }

  // Change magnitude (max 15)
  const totalLines = Array.from(state.pendingChanges.values()).reduce(
    (sum, c) => sum + c.linesChanged,
    0
  );
  if (totalLines > 50) {
    score += 15;
    signals.push('large_change');
  } else if (totalLines > 10) {
    score += 10;
    signals.push('medium_change');
  }

  // Structural signals (max 20)
  if (contentAtCursor.endsWith('\n\n')) {
    score += 15;
    signals.push('paragraph_end');
  }
  const lines = contentAtCursor.split('\n');
  const prevLine = lines[lines.length - 2] || '';
  const currLine = lines[lines.length - 1] || '';
  if (/^#{1,6}\s+.+/.test(prevLine) && currLine.trim() === '') {
    score += 20;
    signals.push('heading_end');
  }

  // Behavioral signals (max 25)
  const cursorDistance = Math.abs(currentCursorPos - state.lastEditCursorPos);
  if (cursorDistance > 500) {
    score += 10;
    signals.push('cursor_moved');
  }

  const scrollDistance = Math.abs(currentScrollTop - state.lastEditScrollTop);
  if (scrollDistance > viewportHeight) {
    score += 15;
    signals.push('scrolled_away');
  }

  return { score: Math.min(score, 100), signals };
}

// Evaluation loop
type EvalCallback = (score: number, shouldCommit: boolean, message: string) => void;

let evalCallback: EvalCallback | null = null;
let getEditorState: (() => { cursor: number; scroll: number; viewport: number; content: string }) | null = null;

export function startEvalLoop(
  callback: EvalCallback,
  editorStateGetter: () => { cursor: number; scroll: number; viewport: number; content: string }
): void {
  evalCallback = callback;
  getEditorState = editorStateGetter;

  if (evalIntervalId) {
    clearInterval(evalIntervalId);
  }

  evalIntervalId = window.setInterval(() => {
    if (!hasUncommittedChanges() || !getEditorState || !evalCallback) return;

    const { cursor, scroll, viewport, content } = getEditorState();
    const { score } = calculateConfidence(cursor, scroll, viewport, content);
    const shouldCommit = score >= 100;
    const message = generateCommitMessage();

    evalCallback(score, shouldCommit, message);
  }, EVAL_INTERVAL);
}

export function stopEvalLoop(): void {
  if (evalIntervalId) {
    clearInterval(evalIntervalId);
    evalIntervalId = null;
  }
}

// Immediate commit for high-confidence scenarios (note switch, blur, close)
export async function triggerImmediateCommit(
  commitFn: (message: string) => Promise<void>
): Promise<void> {
  if (!hasUncommittedChanges()) return;

  const timeSinceSave = Date.now() - state.lastSaveTime;
  if (timeSinceSave < MIN_COMMIT_DELAY) return;

  const message = generateCommitMessage();
  await commitFn(message);
  recordCommit();
}

// Commit message generation
export function generateCommitMessage(): string {
  const changes = Array.from(state.pendingChanges.entries())
    .map(([path, info]) => ({
      name: path.split('/').pop()?.replace('.md', '') || 'note',
      lines: info.linesChanged,
    }))
    .sort((a, b) => b.lines - a.lines);

  if (changes.length === 0) {
    return 'Update notes';
  }

  if (changes.length === 1) {
    return `Update ${changes[0].name}`;
  }

  // Top 2-3 most changed notes
  const topNotes = changes.slice(0, 3).map((c) => c.name);
  return `Update ${topNotes.join(', ')}`;
}
