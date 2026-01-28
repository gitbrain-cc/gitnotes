import { invoke } from '@tauri-apps/api/core';

type SortType = 'alpha' | 'created' | 'modified';
type SortDirection = 'asc' | 'desc';

interface SortState {
  type: SortType;
  direction: SortDirection;
}

let currentSort: SortState = { type: 'alpha', direction: 'asc' };
let currentSectionPath: string | null = null;
let onSortChange: (() => void) | null = null;

async function getSortPreference(sectionPath: string): Promise<string> {
  return await invoke('get_sort_preference', { sectionPath });
}

async function setSortPreference(sectionPath: string, sort: string): Promise<void> {
  return await invoke('set_sort_preference', { sectionPath, sort });
}

function parseSortString(sortStr: string): SortState {
  const [type, direction] = sortStr.split('-') as [string, string];

  const typeMap: Record<string, SortType> = {
    'alpha': 'alpha',
    'name': 'alpha',
    'created': 'created',
    'modified': 'modified',
  };

  return {
    type: typeMap[type] || 'alpha',
    direction: (direction === 'desc' ? 'desc' : 'asc') as SortDirection,
  };
}

function toSortString(state: SortState): string {
  return `${state.type}-${state.direction}`;
}

function updateMenuUI() {
  const options = document.querySelectorAll('.sort-option');

  options.forEach(option => {
    const el = option as HTMLElement;
    const sortType = el.dataset.sort as SortType;
    const arrow = el.querySelector('.sort-arrow') as HTMLElement;

    if (sortType === currentSort.type) {
      el.classList.add('active');
      arrow.textContent = currentSort.direction === 'asc' ? '↑' : '↓';
    } else {
      el.classList.remove('active');
      arrow.textContent = '';
    }
  });
}

function closeMenu() {
  document.getElementById('sort-container')?.classList.remove('active');
}

function toggleMenu() {
  const container = document.getElementById('sort-container');
  console.log('toggleMenu called, container:', container, 'classList before:', container?.classList.toString());
  container?.classList.toggle('active');
  console.log('classList after:', container?.classList.toString());
}

async function handleOptionClick(sortType: SortType) {
  if (!currentSectionPath) return;

  if (sortType === currentSort.type) {
    // Toggle direction
    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    // New sort type with default direction
    currentSort.type = sortType;
    currentSort.direction = sortType === 'alpha' ? 'asc' : 'desc';
  }

  // Save preference
  await setSortPreference(currentSectionPath, toSortString(currentSort));

  // Update UI
  updateMenuUI();
  closeMenu();

  // Trigger refresh
  if (onSortChange) {
    onSortChange();
  }
}

export async function updateSortForSection(sectionPath: string) {
  currentSectionPath = sectionPath;

  try {
    const sortStr = await getSortPreference(sectionPath);
    currentSort = parseSortString(sortStr);
    updateMenuUI();
  } catch (err) {
    console.error('Error loading sort preference:', err);
    currentSort = { type: 'alpha', direction: 'asc' };
    updateMenuUI();
  }
}

export function getCurrentSort(): SortState {
  return currentSort;
}

export function initSortMenu(refreshCallback: () => void) {
  onSortChange = refreshCallback;

  const sortBtn = document.getElementById('sort-btn');
  console.log('initSortMenu called, sort-btn element:', sortBtn);

  // Toggle button
  sortBtn?.addEventListener('click', (e) => {
    console.log('sort-btn clicked');
    e.stopPropagation();
    toggleMenu();
  });

  // Sort options
  document.querySelectorAll('.sort-option').forEach(option => {
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      const sortType = (option as HTMLElement).dataset.sort as SortType;
      handleOptionClick(sortType);
    });
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    const container = document.getElementById('sort-container');
    if (container && !container.contains(e.target as Node)) {
      closeMenu();
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMenu();
    }
  });
}
