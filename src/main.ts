import { invoke } from '@tauri-apps/api/core';
import { initSidebar, navigateToPath } from './sidebar';
import { initEditor, getContent, focusEditor, getWordCount } from './editor';
import { initQuickSwitcher, openQuickSwitcher, loadAllPages, closeQuickSwitcher, isQuickSwitcherOpen } from './search';

interface Section {
  name: string;
  path: string;
}

interface Page {
  name: string;
  path: string;
  filename: string;
}

let currentPage: Page | null = null;
let saveTimeout: number | null = null;

export async function loadSections(): Promise<Section[]> {
  return await invoke('list_sections');
}

export async function loadPages(sectionPath: string): Promise<Page[]> {
  return await invoke('list_pages', { sectionPath });
}

export async function readPage(path: string): Promise<string> {
  return await invoke('read_page', { path });
}

export async function writePage(path: string, content: string): Promise<void> {
  return await invoke('write_page', { path, content });
}

export function setCurrentPage(page: Page | null) {
  currentPage = page;
}

export function getCurrentPage(): Page | null {
  return currentPage;
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

export function scheduleSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  setStatus('Modified...');
  updateWordCount();

  saveTimeout = window.setTimeout(async () => {
    if (currentPage) {
      try {
        const content = getContent();
        await writePage(currentPage.path, content);
        setStatus('Saved');
      } catch (err) {
        setStatus('Error saving');
        console.error('Save error:', err);
      }
    }
  }, 500);
}

function handleQuickSwitcherSelect(result: { name: string; path: string; section: string }) {
  navigateToPath(result.path, result.section);
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Cmd+P: Quick switcher
    if (e.metaKey && e.key === 'p') {
      e.preventDefault();
      if (!isQuickSwitcherOpen()) {
        openQuickSwitcher(handleQuickSwitcherSelect);
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

    // Esc: Close modals
    if (e.key === 'Escape') {
      if (isQuickSwitcherOpen()) {
        closeQuickSwitcher();
      }
    }
  });
}

async function init() {
  try {
    initEditor();
    initQuickSwitcher();
    setupKeyboardShortcuts();
    await initSidebar();
    await loadAllPages();
    setStatus('Ready');
  } catch (err) {
    console.error('Init error:', err);
    setStatus('Error loading');
  }
}

document.addEventListener('DOMContentLoaded', init);
