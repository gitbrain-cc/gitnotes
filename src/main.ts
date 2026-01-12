import { invoke } from '@tauri-apps/api/core';
import { initSidebar } from './sidebar';
import { initEditor, loadContent, getContent } from './editor';

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

export function scheduleSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  setStatus('Modified...');

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

async function init() {
  try {
    initEditor();
    await initSidebar();
    setStatus('Ready');
  } catch (err) {
    console.error('Init error:', err);
    setStatus('Error loading');
  }
}

document.addEventListener('DOMContentLoaded', init);
