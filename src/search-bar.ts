import { invoke } from '@tauri-apps/api/core';
import { exitGitMode } from './git-view';
import { scanDocForMatches, setFindState, FindMatch } from './editor';

interface SearchResult {
  path: string;
  filename: string;
  section: string;
  snippet: string | null;
  match_line: number | null;
}

interface NoteInfo {
  name: string;
  path: string;
  section: string;
}

// State
let isOpen = false;
let selectedIndex = 0;
let currentResults: (SearchResult | NoteInfo)[] = [];
let allNotes: NoteInfo[] = [];
let recentFiles: string[] = [];
let recentSearches: string[] = [];
let currentNotePath: string | null = null;
let inNoteMatches: FindMatch[] = [];
let onSelectCallback: ((result: SearchResult | NoteInfo, matchLine?: number, searchTerm?: string) => void) | null = null;
let defaultSelectCallback: ((result: SearchResult | NoteInfo, matchLine?: number, searchTerm?: string) => void) | null = null;

const MAX_RECENT_FILES = 7;
const MAX_RECENT_SEARCHES = 5;
const MIN_CONTENT_SEARCH_LENGTH = 3;

// LocalStorage keys
const RECENT_FILES_KEY = 'gitnotes_recent_files';
const RECENT_SEARCHES_KEY = 'gitnotes_recent_searches';

export async function loadAllNotes(): Promise<void> {
  allNotes = await invoke('list_all_notes');
}

export function addRecentFile(path: string): void {
  recentFiles = recentFiles.filter(p => p !== path);
  recentFiles.unshift(path);
  recentFiles = recentFiles.slice(0, MAX_RECENT_FILES);
  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(recentFiles));
}

function addRecentSearch(query: string): void {
  if (query.length < MIN_CONTENT_SEARCH_LENGTH) return;
  recentSearches = recentSearches.filter(q => q !== query);
  recentSearches.unshift(query);
  recentSearches = recentSearches.slice(0, MAX_RECENT_SEARCHES);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recentSearches));
}

export function setCurrentNotePath(path: string | null): void {
  currentNotePath = path;
}

function loadRecentData(): void {
  try {
    const files = localStorage.getItem(RECENT_FILES_KEY);
    const searches = localStorage.getItem(RECENT_SEARCHES_KEY);
    recentFiles = files ? JSON.parse(files) : [];
    recentSearches = searches ? JSON.parse(searches) : [];
  } catch {
    recentFiles = [];
    recentSearches = [];
  }
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

function filterByFilename(query: string): NoteInfo[] {
  if (!query) return [];
  return allNotes
    .filter(note => fuzzyMatch(query, note.name) || fuzzyMatch(query, note.section))
    .slice(0, 10);
}

async function searchContent(query: string): Promise<SearchResult[]> {
  if (query.length < MIN_CONTENT_SEARCH_LENGTH) return [];
  try {
    return await invoke('search_notes', { query });
  } catch (e) {
    console.error('Search error:', e);
    return [];
  }
}

function getRecentFilesAsNotes(): NoteInfo[] {
  return recentFiles
    .map(path => allNotes.find(p => p.path === path))
    .filter((p): p is NoteInfo => p !== undefined);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function truncateSection(section: string, maxLen: number = 12): string {
  if (section.length <= maxLen) return section;
  return section.slice(0, maxLen - 1) + '…';
}

function highlightMatch(text: string, query: string): string {
  if (!query || query.length < MIN_CONTENT_SEARCH_LENGTH) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const regex = new RegExp(`(${escapeHtml(query)})`, 'gi');
  return escaped.replace(regex, '<mark>$1</mark>');
}

function renderDropdown(query: string): void {
  const recentFilesSection = document.getElementById('recent-files-section');
  const recentSearchesSection = document.getElementById('recent-searches-section');
  const resultsSection = document.getElementById('search-results-section');
  const recentFilesList = document.getElementById('recent-files-list');
  const recentSearchesList = document.getElementById('recent-searches-list');
  const resultsList = document.getElementById('search-results-list');

  if (!recentFilesSection || !recentSearchesSection || !resultsSection) return;
  if (!recentFilesList || !recentSearchesList || !resultsList) return;

  // Clear all
  recentFilesList.innerHTML = '';
  recentSearchesList.innerHTML = '';
  resultsList.innerHTML = '';

  if (!query) {
    // Show recent files and searches
    recentFilesSection.style.display = recentFiles.length ? 'block' : 'none';
    recentSearchesSection.style.display = recentSearches.length ? 'block' : 'none';
    resultsSection.style.display = 'none';

    const recentNotes = getRecentFilesAsNotes();
    currentResults = recentNotes;

    recentNotes.forEach((note, i) => {
      const li = document.createElement('li');
      li.className = i === selectedIndex ? 'selected' : '';
      li.innerHTML = `
        <div class="result-header">
          <span class="result-section">${escapeHtml(truncateSection(note.section))}</span>
          <span class="result-filename">${escapeHtml(note.name)}</span>
        </div>
      `;
      li.addEventListener('click', () => selectResult(i));
      recentFilesList.appendChild(li);
    });

    recentSearches.forEach((search) => {
      const li = document.createElement('li');
      li.className = 'recent-search-item';
      li.innerHTML = `<svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>${escapeHtml(search)}`;
      li.addEventListener('click', () => {
        const input = document.getElementById('search-input') as HTMLInputElement;
        if (input) {
          input.value = search;
          input.dispatchEvent(new Event('input'));
        }
      });
      recentSearchesList.appendChild(li);
    });
  } else {
    // Show search results
    recentFilesSection.style.display = 'none';
    recentSearchesSection.style.display = 'none';
    resultsSection.style.display = 'block';

    // Scan current note for matches (client-side)
    inNoteMatches = [];
    if (currentNotePath && query.length >= MIN_CONTENT_SEARCH_LENGTH) {
      inNoteMatches = scanDocForMatches(query);
    }

    // Render "In This Note" group
    if (inNoteMatches.length > 0) {
      const header = document.createElement('li');
      header.className = 'results-group-header';
      header.textContent = 'In This Note';
      resultsList.appendChild(header);

      inNoteMatches.forEach((match, matchIdx) => {
        const li = document.createElement('li');
        li.className = 'in-note-match';
        li.innerHTML = `
          <div class="result-header">
            <span class="result-line-number">line ${match.lineNumber}</span>
            <span class="result-snippet">${highlightMatch(match.snippet, query)}</span>
          </div>
        `;
        li.addEventListener('click', () => {
          addRecentSearch(query);
          closeSearchDropdown();
          setFindState(query, inNoteMatches, matchIdx);
        });
        resultsList.appendChild(li);
      });
    }

    // Separate filename matches from content matches
    const filenameMatches: { result: SearchResult | NoteInfo; index: number }[] = [];
    const contentMatches: { result: SearchResult | NoteInfo; index: number }[] = [];

    currentResults.forEach((result, i) => {
      if ('snippet' in result && result.snippet) {
        contentMatches.push({ result, index: i });
      } else {
        filenameMatches.push({ result, index: i });
      }
    });

    // Render filename matches
    if (filenameMatches.length > 0) {
      const header = document.createElement('li');
      header.className = 'results-group-header';
      header.textContent = 'Files';
      resultsList.appendChild(header);

      filenameMatches.forEach(({ result, index }) => {
        const note = result as NoteInfo;
        const li = document.createElement('li');
        li.className = index === selectedIndex ? 'selected' : '';
        li.innerHTML = `
          <div class="result-header">
            <span class="result-section">${escapeHtml(truncateSection(note.section))}</span>
            <span class="result-filename">${escapeHtml(note.name)}</span>
          </div>
        `;
        li.addEventListener('click', () => selectResult(index));
        resultsList.appendChild(li);
      });
    }

    // Render content matches
    if (contentMatches.length > 0) {
      const header = document.createElement('li');
      header.className = 'results-group-header';
      header.textContent = 'In Content';
      resultsList.appendChild(header);

      contentMatches.forEach(({ result, index }) => {
        const sr = result as SearchResult;
        const li = document.createElement('li');
        li.className = index === selectedIndex ? 'selected' : '';
        li.innerHTML = `
          <div class="result-header">
            <span class="result-section">${escapeHtml(truncateSection(sr.section))}</span>
            <span class="result-filename">${escapeHtml(sr.filename)}</span>
          </div>
          <div class="result-snippet">${highlightMatch(sr.snippet || '', query)}</div>
        `;
        li.addEventListener('click', () => selectResult(index));
        resultsList.appendChild(li);
      });
    }

    if (currentResults.length === 0 && inNoteMatches.length === 0) {
      resultsList.innerHTML = '<li class="no-results">No results found</li>';
    }
  }
}

function selectResult(index: number): void {
  if (index < 0 || index >= currentResults.length) return;

  const result = currentResults[index];
  const input = document.getElementById('search-input') as HTMLInputElement;
  const query = input?.value || '';

  // Add to recent searches if content search
  if (query.length >= MIN_CONTENT_SEARCH_LENGTH) {
    addRecentSearch(query);
  }

  closeSearchBar();

  const callback = onSelectCallback || defaultSelectCallback;
  if (callback) {
    if ('match_line' in result) {
      callback(result, result.match_line ?? undefined, query || undefined);
    } else {
      callback(result, undefined, undefined);
    }
  }
}

function scrollToSelected(): void {
  const selected = document.querySelector('#search-results .selected') as HTMLElement;
  selected?.scrollIntoView({ block: 'nearest' });
}

export function openSearchBar(onSelect?: (result: SearchResult | NoteInfo, matchLine?: number, searchTerm?: string) => void): void {
  // Close git view if open (mutual exclusivity)
  exitGitMode();

  if (onSelect) {
    onSelectCallback = onSelect;
  }
  isOpen = true;
  selectedIndex = 0;
  currentResults = getRecentFilesAsNotes();

  const container = document.getElementById('search-container');
  const input = document.getElementById('search-input') as HTMLInputElement;

  if (container && input) {
    container.classList.add('active');
    input.focus();
    renderDropdown(input.value.trim());
  }
}

export function closeSearchBar(): void {
  isOpen = false;
  onSelectCallback = null;

  const container = document.getElementById('search-container');
  const input = document.getElementById('search-input') as HTMLInputElement;
  if (container) {
    container.classList.remove('active');
  }
  if (input) {
    input.value = '';
    input.blur();
  }
}

// Close dropdown only — keep search term visible in input
export function closeSearchDropdown(): void {
  isOpen = false;
  onSelectCallback = null;

  const container = document.getElementById('search-container');
  const input = document.getElementById('search-input') as HTMLInputElement;
  if (container) {
    container.classList.remove('active');
  }
  if (input) {
    input.blur();
  }
}

export function isSearchBarOpen(): boolean {
  return isOpen;
}

export function initSearchBar(onSelect?: (result: SearchResult | NoteInfo, matchLine?: number, searchTerm?: string) => void): void {
  if (onSelect) {
    defaultSelectCallback = onSelect;
  }
  loadRecentData();

  const input = document.getElementById('search-input') as HTMLInputElement;
  const container = document.getElementById('search-container');
  if (!input || !container) return;

  let searchTimeout: number | null = null;

  input.addEventListener('input', async () => {
    const query = input.value.trim();
    selectedIndex = 0;

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (query.length < MIN_CONTENT_SEARCH_LENGTH) {
      // Immediate filename filtering
      currentResults = filterByFilename(query);
      renderDropdown(query);
    } else {
      // Debounced content search
      searchTimeout = window.setTimeout(async () => {
        const filenameMatches = filterByFilename(query);
        const contentMatches = await searchContent(query);

        // Combine: filename matches first, then content matches (deduplicated)
        const seenPaths = new Set(filenameMatches.map(p => p.path));
        const uniqueContentMatches = contentMatches.filter(r => !seenPaths.has(r.path) && r.path !== currentNotePath);

        currentResults = [...filenameMatches, ...uniqueContentMatches];
        renderDropdown(query);
      }, 150);
    }
  });


  input.addEventListener('focus', () => {
    if (!isOpen) {
      openSearchBar();
    }
  });

  input.addEventListener('click', () => {
    if (!isOpen) {
      openSearchBar();
    }
  });

  input.addEventListener('keydown', (e) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
        renderDropdown(input.value.trim());
        scrollToSelected();
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        renderDropdown(input.value.trim());
        scrollToSelected();
        break;
      case 'Enter':
        e.preventDefault();
        selectResult(selectedIndex);
        break;
      case 'Escape':
        e.preventDefault();
        closeSearchBar();
        break;
    }
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (isOpen && !container.contains(e.target as Node)) {
      closeSearchBar();
    }
  });
}
