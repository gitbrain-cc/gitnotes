import { invoke } from '@tauri-apps/api/core';
import { initSidebar, navigateToPath } from './sidebar';
import { initEditor, getContent, focusEditor, getWordCount, updateHeaderData, loadContent } from './editor';
import { initSearchBar, openSearchBar, loadAllNotes, closeSearchBar, isSearchBarOpen, addRecentFile } from './search-bar';
import { parseFrontMatter, serializeFrontMatter, FrontMatter } from './frontmatter';
import { initGitStatus, refreshGitStatus, closeHistoryPanel, isHistoryPanelOpen } from './git-status';
import { initSettings, getGitMode, isSettingsOpen, closeSettings } from './settings';

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

export function setCurrentNote(note: Note | null) {
  currentNote = note;
}

export function getCurrentNote(): Note | null {
  return currentNote;
}

export function setStatus(text: string) {
  const statusEl = document.getElementById('status-text');
  if (statusEl) {
    statusEl.textContent = text;
  }
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

  return date.toLocaleDateString();
}

// Build the modified info string based on git status
function buildModifiedInfo(gitInfo: GitInfo): string | null {
  if (!gitInfo.is_git_repo) {
    return null;
  }

  if (!gitInfo.is_tracked) {
    return 'New · not in git';
  }

  if (gitInfo.is_dirty) {
    return 'Modified · not committed';
  }

  if (gitInfo.last_commit_date && gitInfo.last_commit_author) {
    const relativeTime = formatRelativeTime(gitInfo.last_commit_date);
    return `${gitInfo.last_commit_author}, ${relativeTime}`;
  }

  return null;
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
    ? formatRelativeTime(currentFrontMatter.created)
    : null;
  const modifiedInfo = buildModifiedInfo(gitInfo);

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
    ? formatRelativeTime(currentFrontMatter.created)
    : null;
  const modifiedInfo = buildModifiedInfo(gitInfo);

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
  updateWordCount();

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

        // Auto-commit only if git mode is 'simple'
        const gitMode = await getGitMode();
        if (gitMode === 'simple') {
          try {
            const filename = currentNote.filename.replace('.md', '');
            await gitCommit(currentNote.path, `Update ${filename}`);
            setStatus('Committed');
          } catch {
            // Git commit failed - that's ok, file is still saved
            setStatus('Saved (not committed)');
          }
        } else {
          // Manual mode - just mark as saved
          setStatus('Saved');
        }

        // Refresh header to show new git status
        await refreshHeader();
        await refreshGitStatus();
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

    // Esc: Close settings, search, or history panel
    if (e.key === 'Escape') {
      if (isSettingsOpen()) {
        closeSettings();
      } else if (isSearchBarOpen()) {
        closeSearchBar();
      } else if (isHistoryPanelOpen()) {
        closeHistoryPanel();
      }
    }
  });
}

async function init() {
  try {
    initEditor();
    initSearchBar(handleSearchSelect);
    initGitStatus();
    initSettings();
    setupKeyboardShortcuts();
    await initSidebar();
    await loadAllNotes();
    setStatus('Ready');
  } catch (err) {
    console.error('Init error:', err);
    setStatus('Error loading');
  }
}

document.addEventListener('DOMContentLoaded', init);
