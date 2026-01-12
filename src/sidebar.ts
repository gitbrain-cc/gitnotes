import {
  loadSections, loadPages, readPage, setCurrentPage, setStatus, updateWordCount,
  createPageSmart, deletePage, renamePage, createSection
} from './main';
import { loadContent } from './editor';
import { showContextMenu } from './contextmenu';

interface Section {
  name: string;
  path: string;
}

interface Page {
  name: string;
  path: string;
  filename: string;
}

let sections: Section[] = [];
let currentSection: Section | null = null;

async function handleDeletePage(page: Page) {
  try {
    await deletePage(page.path);
    if (currentSection) {
      const pages = await loadPages(currentSection.path);
      renderPages(pages);
      if (pages.length > 0) {
        await selectPage(pages[0]);
      } else {
        setCurrentPage(null);
        loadContent('');
      }
    }
  } catch (err) {
    console.error('Delete error:', err);
  }
}

function startRename(page: Page, li: HTMLElement) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = page.name;
  input.className = 'inline-rename';

  li.textContent = '';
  li.appendChild(input);
  input.focus();
  input.select();

  const finishRename = async () => {
    const newName = input.value.trim();
    if (newName && newName !== page.name) {
      try {
        await renamePage(page.path, newName);
      } catch (err) {
        console.error('Rename error:', err);
      }
    }
    if (currentSection) {
      const pages = await loadPages(currentSection.path);
      renderPages(pages);
    }
  };

  input.addEventListener('blur', finishRename);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      input.blur();
    } else if (e.key === 'Escape') {
      input.value = page.name;
      input.blur();
    }
  });
}

export async function initSidebar() {
  sections = await loadSections();
  renderSections();

  if (sections.length > 0) {
    await selectSection(sections[0]);
  }

  document.getElementById('add-page-btn')?.addEventListener('click', async () => {
    if (!currentSection) return;
    try {
      const page = await createPageSmart(currentSection.path);
      const pages = await loadPages(currentSection.path);
      renderPages(pages);
      await selectPage(page);

      // Auto-trigger rename if Untitled
      if (page.name === 'Untitled' || page.name.startsWith('Untitled ')) {
        const li = document.querySelector(`[data-path="${page.path}"]`) as HTMLElement;
        if (li) startRename(page, li);
      }
    } catch (err) {
      console.error('Create page error:', err);
    }
  });

  document.getElementById('add-section-btn')?.addEventListener('click', async () => {
    try {
      await createSection('Untitled');
      sections = await loadSections();
      renderSections();
    } catch (err) {
      console.error('Create section error:', err);
    }
  });
}

function renderSections() {
  const list = document.getElementById('sections-list');
  if (!list) return;

  list.innerHTML = '';

  for (const section of sections) {
    const li = document.createElement('li');
    li.textContent = section.name;
    li.dataset.path = section.path;

    if (currentSection && currentSection.path === section.path) {
      li.classList.add('active');
    }

    li.addEventListener('click', () => selectSection(section));
    list.appendChild(li);
  }
}

async function selectSection(section: Section) {
  currentSection = section;
  renderSections();

  const pages = await loadPages(section.path);
  renderPages(pages);

  // Select first page if any
  if (pages.length > 0) {
    await selectPage(pages[0]);
  } else {
    setCurrentPage(null);
    loadContent('');
    setStatus('No pages in section');
  }
}

function renderPages(pages: Page[]) {
  const list = document.getElementById('pages-list');
  if (!list) return;

  list.innerHTML = '';

  for (const page of pages) {
    const li = document.createElement('li');
    li.textContent = page.name;
    li.dataset.path = page.path;
    li.addEventListener('click', () => selectPage(page));
    li.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, [
        { label: 'Rename', action: () => startRename(page, li) },
        { label: 'Delete', action: () => handleDeletePage(page) }
      ]);
    });
    list.appendChild(li);
  }
}

export async function selectPage(page: Page) {
  // Update UI
  const pagesList = document.getElementById('pages-list');
  if (pagesList) {
    pagesList.querySelectorAll('li').forEach(li => {
      li.classList.toggle('active', li.dataset.path === page.path);
    });
  }

  setCurrentPage(page);
  setStatus('Loading...');

  try {
    const content = await readPage(page.path);
    loadContent(content);
    updateWordCount();
    setStatus('Ready');
  } catch (err) {
    console.error('Error loading page:', err);
    setStatus('Error loading page');
  }
}

export function getCurrentSection(): Section | null {
  return currentSection;
}

export async function navigateToPath(path: string, sectionName: string) {
  // Find the matching section
  const section = sections.find(s => s.name === sectionName);
  if (section && (!currentSection || currentSection.path !== section.path)) {
    currentSection = section;
    renderSections();
    const pages = await loadPages(section.path);
    renderPages(pages);
  }

  // Create a Page object and select it
  const filename = path.split('/').pop() || '';
  const page: Page = {
    name: filename.replace('.md', ''),
    path: path,
    filename: filename
  };

  await selectPage(page);
}
