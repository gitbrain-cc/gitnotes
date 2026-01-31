import { invoke } from '@tauri-apps/api/core';
import { initSidebar, navigateToPath } from './sidebar';
import {
  initEditor, getContent, focusEditor, getWordCount, updateHeaderData, loadContent,
  getCursorPosition, getScrollTop, getViewportHeight, getContentUpToCursor
} from './editor';
import { recordEdit, recordSave, recordCommit, startEvalLoop, triggerImmediateCommit } from './commit-engine';
import { initSearchBar, openSearchBar, loadAllNotes, closeSearchBar, isSearchBarOpen, addRecentFile } from './search-bar';
import { parseFrontMatter, serializeFrontMatter, FrontMatter } from './frontmatter';
import { initGitStatus, refreshGitStatus, isTeamRepo } from './git-status';
import { initSettings, isSettingsOpen, closeSettings, getTheme, applyTheme, getEditorSettings, applyEditorSettings, getAutoCommit } from './settings';
import { initGitView, isGitModeOpen, enterGitMode, exitGitMode } from './git-view';
import { checkOnboarding, initOnboarding, showOnboarding } from './onboarding';
import { checkForUpdates } from './updater';
import { initCommitModal, openCommitModal, isCommitModalOpen, closeCommitModal } from './commit-modal';

interface Section {
  name: string;
  path: string;
}

interface Note {
  name: string;
  path: string;
  filename: string;
}

interface FileMetadata {
  created: string | null;
}

interface GitInfo {
  last_commit_date: string | null;
  last_commit_author: string | null;
  is_dirty: boolean;
  is_tracked: boolean;
  is_git_repo: boolean;
}

let currentNote: Note | null = null;
let currentFrontMatter: FrontMatter = {};
let currentBody: string = '';
let saveTimeout: number | null = null;

export function clearPendingSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
}

export async function loadSections(): Promise<Section[]> {
  return await invoke('list_sections');
}

export async function loadNotes(sectionPath: string): Promise<Note[]> {
  return await invoke('list_notes', { sectionPath });
}

export async function readNote(path: string): Promise<string> {
  return await invoke('read_note', { path });
}

export async function writeNote(path: string, content: string): Promise<void> {
  return await invoke('write_note', { path, content });
}

export async function getFileMetadata(path: string): Promise<FileMetadata> {
  return await invoke('get_file_metadata', { path });
}

export async function getGitInfo(path: string): Promise<GitInfo> {
  return await invoke('get_git_info', { path });
}

export async function gitCommit(path: string, message: string): Promise<void> {
  return await invoke('git_commit', { path, message });
}

export async function createNoteSmart(sectionPath: string): Promise<Note> {
  return await invoke('create_note_smart', { sectionPath });
}

export async function deleteNote(path: string): Promise<void> {
  return await invoke('delete_note', { path });
}

export async function renameNote(oldPath: string, newName: string): Promise<Note> {
  return await invoke('rename_note', { oldPath, newName });
}

export async function moveNote(path: string, newSectionPath: string): Promise<Note> {
  return await invoke('move_note', { path, newSectionPath });
}

export async function createSection(name: string): Promise<Section> {
  return await invoke('create_section', { name });
}

export async function renameSection(path: string, newName: string): Promise<Section> {
  return await invoke('rename_section', { path, newName });
}

export async function deleteSection(path: string): Promise<void> {
  return await invoke('delete_section', { path });
}

export async function setSectionMetadata(sectionPath: string, title: string | null, color: string | null) {
  await invoke('set_section_metadata', {
    sectionPath,
    title: title || null,
    color: color || null,
  });
}

export async function saveSectionOrder(order: string[]): Promise<void> {
  await invoke('save_section_order', { order });
}

export function setCurrentNote(note: Note | null) {
  currentNote = note;
}

export function getCurrentNote(): Note | null {
  return currentNote;
}

export function setStatus(_text: string) {
  // Status text removed - dirty/commit info shown in note header
  // Keeping function signature for compatibility
}

export function setConfidence(score: number): void {
  const container = document.getElementById('commit-confidence');
  const bar = document.getElementById('confidence-bar');

  if (!container || !bar) return;

  if (score <= 0) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  bar.style.setProperty('--confidence', `${score}%`);
}

export function flashCommitted(): void {
  const statusEl = document.getElementById('status-text');
  if (!statusEl) return;

  statusEl.textContent = 'Committed ✓';
  statusEl.classList.add('committed-flash');

  setTimeout(() => {
    statusEl.classList.remove('committed-flash');
    statusEl.textContent = '';
    setConfidence(0);
  }, 2000);
}

export function updateWordCount() {
  const countEl = document.getElementById('word-count');
  if (countEl) {
    const count = getWordCount();
    countEl.textContent = `${count} word${count !== 1 ? 's' : ''}`;
  }
}

// Format a date as relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null as unknown as string;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffWeek < 4) return `${diffWeek}w ago`;
  if (diffMonth < 12) return `${diffMonth}mo ago`;

  const diffYear = Math.floor(diffDay / 365);
  return `${diffYear}y ago`;
}

// Build the modified info string based on git status
function buildModifiedInfo(gitInfo: GitInfo, createdDate: string | null): string | null {
  if (!gitInfo.is_git_repo) {
    return null;
  }

  if (!gitInfo.is_tracked) {
    return 'New note';
  }

  if (gitInfo.is_dirty) {
    return 'Modified · not committed';
  }

  if (gitInfo.last_commit_date) {
    // If created and last commit are the same day, don't show "Edited"
    if (createdDate && isSameDay(createdDate, gitInfo.last_commit_date)) {
      return null;
    }

    const relativeTime = formatRelativeTime(gitInfo.last_commit_date);
    if (isTeamRepo() && gitInfo.last_commit_author) {
      return `Edited ${relativeTime} by ${gitInfo.last_commit_author}`;
    }
    return `Edited ${relativeTime}`;
  }

  return null;
}

function formatAbsoluteDate(dateStr: string): string | null {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isSameDay(dateA: string, dateB: string): boolean {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

// Load note and update header
export async function loadNoteWithHeader(note: Note) {
  currentNote = note;

  // Read raw content
  const rawContent = await readNote(note.path);

  // Parse front matter
  const parsed = parseFrontMatter(rawContent);
  currentFrontMatter = parsed.frontmatter;
  currentBody = parsed.body;

  // Check if we need to migrate (no created date in front matter)
  if (!currentFrontMatter.created) {
    const metadata = await getFileMetadata(note.path);
    if (metadata.created) {
      currentFrontMatter.created = metadata.created;
    } else {
      // Fallback to now
      currentFrontMatter.created = new Date().toISOString().slice(0, 19);
    }
  }

  // Get git info
  const gitInfo = await getGitInfo(note.path);

  // Build header data
  const title = note.name; // filename without .md
  const createdDate = currentFrontMatter.created
    ? formatAbsoluteDate(currentFrontMatter.created)
    : null;
  const modifiedInfo = buildModifiedInfo(gitInfo, currentFrontMatter.created ?? null);

  // Load content into editor (full content with front matter - editor will hide it)
  const fullContent = serializeFrontMatter(currentFrontMatter, currentBody);
  loadContent(fullContent);

  // Update header display
  updateHeaderData({ title, createdDate, modifiedInfo });

  updateWordCount();

  // Track as recent file
  addRecentFile(note.path);
}

// Refresh just the header (after save/commit)
async function refreshHeader() {
  if (!currentNote) return;

  const gitInfo = await getGitInfo(currentNote.path);
  const createdDate = currentFrontMatter.created
    ? formatAbsoluteDate(currentFrontMatter.created)
    : null;
  const modifiedInfo = buildModifiedInfo(gitInfo, currentFrontMatter.created ?? null);

  updateHeaderData({
    title: currentNote.name,
    createdDate,
    modifiedInfo,
  });
}

export function scheduleSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  setStatus('Modified...');
  recordEdit(getCursorPosition(), getScrollTop());

  saveTimeout = window.setTimeout(async () => {
    if (currentNote) {
      try {
        const fullContent = getContent();

        // Parse to update our stored body (front matter stays the same)
        const parsed = parseFrontMatter(fullContent);
        currentBody = parsed.body;

        // Rebuild with current front matter
        const contentToSave = serializeFrontMatter(currentFrontMatter, currentBody);

        await writeNote(currentNote.path, contentToSave);
        setStatus('Saved');

        // Count lines changed (approximate)
        const linesChanged = fullContent.split('\n').length;
        recordSave(currentNote.path, linesChanged);

        // Commit engine handles timing via evaluation loop
        // Just record the save, it will evaluate and commit when ready

        await refreshHeader();
      } catch (err) {
        setStatus('Error saving');
        console.error('Save error:', err);
      }
    }
  }, 500);
}

function handleSearchSelect(result: { path: string; section?: string }, matchLine?: number, searchTerm?: string) {
  const section = result.section || result.path.split('/').slice(-2, -1)[0] || '';
  navigateToPath(result.path, section, matchLine, searchTerm);
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Cmd+S: Open commit modal
    if (e.metaKey && e.key === 's') {
      e.preventDefault();
      openCommitModal();
    }

    // Cmd+P or Cmd+Shift+F: Search bar
    if (e.metaKey && (e.key === 'p' || (e.shiftKey && e.key === 'f'))) {
      e.preventDefault();
      if (!isSearchBarOpen()) {
        openSearchBar(handleSearchSelect);
      }
    }

    // Cmd+1: Focus editor
    if (e.metaKey && e.key === '1') {
      e.preventDefault();
      focusEditor();
    }

    // Cmd+2: Focus sidebar (sections)
    if (e.metaKey && e.key === '2') {
      e.preventDefault();
      const sectionsList = document.getElementById('sections-list');
      const firstItem = sectionsList?.querySelector('li') as HTMLElement;
      firstItem?.focus();
    }

    // Esc: Close modals in order
    if (e.key === 'Escape') {
      if (isCommitModalOpen()) {
        closeCommitModal();
      } else if (isSettingsOpen()) {
        closeSettings();
      } else if (isGitModeOpen()) {
        exitGitMode();
      } else if (isSearchBarOpen()) {
        closeSearchBar();
      }
    }
  });
}

async function init() {
  try {
    // Apply theme and editor settings immediately to prevent flash
    const theme = await getTheme();
    applyTheme(theme);
    const editorSettings = await getEditorSettings();
    applyEditorSettings(editorSettings);

    // Check if onboarding is needed (no vaults configured)
    if (await checkOnboarding()) {
      initOnboarding();
      showOnboarding();
      return; // Don't init other UI until vault is set up
    }

    initEditor();
    initSearchBar(handleSearchSelect);
    initGitStatus();
    initGitView();
    initSettings();
    initCommitModal();
    setupKeyboardShortcuts();
    await initSidebar();
    await loadAllNotes();
    setStatus('Ready');

    // Start commit evaluation loop
    startEvalLoop(
      async (score, shouldCommit, message) => {
        setConfidence(score);

        if (shouldCommit && currentNote) {
          const autoCommit = await getAutoCommit();
          if (autoCommit) {
            try {
              await gitCommit(currentNote.path, message);
              recordCommit();
              flashCommitted();
              await refreshGitStatus();
              if (isGitModeOpen()) await enterGitMode();
            } catch {
              // Commit failed silently
            }
          }
        }
      },
      () => ({
        cursor: getCursorPosition(),
        scroll: getScrollTop(),
        viewport: getViewportHeight(),
        content: getContentUpToCursor(),
      })
    );

    // Immediate commit on blur (app loses focus)
    window.addEventListener('blur', async () => {
      const autoCommit = await getAutoCommit();
      if (autoCommit && currentNote) {
        await triggerImmediateCommit(async (msg) => {
          await gitCommit(currentNote!.path, msg);
          flashCommitted();
          await refreshGitStatus();
          if (isGitModeOpen()) await enterGitMode();
        });
      }
    });

    // Immediate commit on close (window closes)
    window.addEventListener('beforeunload', async () => {
      const autoCommit = await getAutoCommit();
      if (autoCommit && currentNote) {
        await triggerImmediateCommit(async (msg) => {
          await gitCommit(currentNote!.path, msg);
        });
      }
    });

    // Check for updates in background
    checkForUpdates();
  } catch (err) {
    console.error('Init error:', err);
    setStatus('Error loading');
  }
}

document.addEventListener('DOMContentLoaded', init);
