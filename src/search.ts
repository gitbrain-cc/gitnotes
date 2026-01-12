import { invoke } from '@tauri-apps/api/core';

interface SearchResult {
  name: string;
  path: string;
  section: string;
}

let allPages: SearchResult[] = [];
let filteredPages: SearchResult[] = [];
let selectedIndex = 0;
let isOpen = false;
let onSelectCallback: ((result: SearchResult) => void) | null = null;

export async function loadAllPages(): Promise<void> {
  allPages = await invoke('list_all_pages');
}

function fuzzyMatch(query: string, text: string): boolean {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  if (lowerQuery.length === 0) return true;

  let queryIndex = 0;
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      queryIndex++;
    }
  }
  return queryIndex === lowerQuery.length;
}

function filterPages(query: string): SearchResult[] {
  if (!query) return allPages.slice(0, 20);

  return allPages
    .filter(page => fuzzyMatch(query, page.name) || fuzzyMatch(query, page.section))
    .slice(0, 20);
}

function renderResults() {
  const list = document.getElementById('quick-switcher-list');
  if (!list) return;

  list.innerHTML = '';

  for (let i = 0; i < filteredPages.length; i++) {
    const page = filteredPages[i];
    const li = document.createElement('li');
    li.className = i === selectedIndex ? 'selected' : '';
    li.innerHTML = `
      <span class="page-name">${escapeHtml(page.name)}</span>
      <span class="page-section">${escapeHtml(page.section)}</span>
    `;
    li.addEventListener('click', () => selectResult(i));
    list.appendChild(li);
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function selectResult(index: number) {
  if (index >= 0 && index < filteredPages.length) {
    const result = filteredPages[index];
    closeQuickSwitcher();
    if (onSelectCallback) {
      onSelectCallback(result);
    }
  }
}

export function openQuickSwitcher(onSelect: (result: SearchResult) => void) {
  if (isOpen) return;

  onSelectCallback = onSelect;
  isOpen = true;
  selectedIndex = 0;
  filteredPages = allPages.slice(0, 20);

  const overlay = document.getElementById('quick-switcher-overlay');
  const input = document.getElementById('quick-switcher-input') as HTMLInputElement;

  if (overlay && input) {
    overlay.classList.add('visible');
    input.value = '';
    input.focus();
    renderResults();
  }
}

export function closeQuickSwitcher() {
  isOpen = false;
  onSelectCallback = null;

  const overlay = document.getElementById('quick-switcher-overlay');
  if (overlay) {
    overlay.classList.remove('visible');
  }
}

export function isQuickSwitcherOpen(): boolean {
  return isOpen;
}

export function initQuickSwitcher() {
  const input = document.getElementById('quick-switcher-input') as HTMLInputElement;
  if (!input) return;

  input.addEventListener('input', () => {
    filteredPages = filterPages(input.value);
    selectedIndex = 0;
    renderResults();
  });

  input.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, filteredPages.length - 1);
        renderResults();
        scrollToSelected();
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        renderResults();
        scrollToSelected();
        break;
      case 'Enter':
        e.preventDefault();
        selectResult(selectedIndex);
        break;
      case 'Escape':
        e.preventDefault();
        closeQuickSwitcher();
        break;
    }
  });

  const overlay = document.getElementById('quick-switcher-overlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeQuickSwitcher();
      }
    });
  }
}

function scrollToSelected() {
  const list = document.getElementById('quick-switcher-list');
  const selected = list?.querySelector('.selected') as HTMLElement;
  if (selected && list) {
    selected.scrollIntoView({ block: 'nearest' });
  }
}
