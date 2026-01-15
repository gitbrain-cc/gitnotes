import {
  loadSections, loadPages, setCurrentPage, setStatus,
  createPageSmart, deletePage, renamePage, createSection, renameSection, deleteSection, movePage,
  loadPageWithHeader
} from './main';
import { loadContent, updateHeaderData } from './editor';
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
        updateHeaderData({ title: '', createdDate: null, modifiedInfo: null });
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

async function handleDeleteSection(section: Section) {
  try {
    await deleteSection(section.path);
    sections = await loadSections();
    renderSections();
    if (sections.length > 0) {
      await selectSection(sections[0]);
    }
  } catch (err) {
    console.error('Delete section error:', err);
  }
}

function startSectionRename(section: Section, li: HTMLElement) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = section.name;
  input.className = 'inline-rename';

  li.textContent = '';
  li.appendChild(input);
  input.focus();
  input.select();

  const finishRename = async () => {
    const newName = input.value.trim();
    if (newName && newName !== section.name) {
      try {
        await renameSection(section.path, newName);
      } catch (err) {
        console.error('Rename error:', err);
      }
    }
    sections = await loadSections();
    renderSections();
  };

  input.addEventListener('blur', finishRename);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      input.blur();
    } else if (e.key === 'Escape') {
      input.value = section.name;
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

    const isProtected = ['1-todo', '1-weeks'].includes(section.name.toLowerCase());

    li.addEventListener('dragover', (e) => {
      e.preventDefault();
      li.classList.add('drop-target');
    });
    li.addEventListener('dragleave', () => {
      li.classList.remove('drop-target');
    });
    li.addEventListener('drop', async (e) => {
      e.preventDefault();
      li.classList.remove('drop-target');
      const pagePath = e.dataTransfer?.getData('text/plain');
      if (pagePath && section.path !== currentSection?.path) {
        try {
          await movePage(pagePath, section.path);
          if (currentSection) {
            const pages = await loadPages(currentSection.path);
            renderPages(pages);
            if (pages.length > 0) {
              await selectPage(pages[0]);
            } else {
              setCurrentPage(null);
              loadContent('');
              updateHeaderData({ title: '', createdDate: null, modifiedInfo: null });
            }
          }
        } catch (err) {
          console.error('Move error:', err);
        }
      }
    });
    li.addEventListener('click', () => selectSection(section));
    li.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, [
        { label: 'Rename', action: () => startSectionRename(section, li), disabled: isProtected },
        { label: 'Delete', action: () => handleDeleteSection(section), disabled: isProtected }
      ]);
    });
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
    updateHeaderData({ title: '', createdDate: null, modifiedInfo: null });
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
    li.draggable = true;
    li.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData('text/plain', page.path);
      li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
    });
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

export async function selectPage(page: Page, matchLine?: number, searchTerm?: string) {
  // Update UI
  const pagesList = document.getElementById('pages-list');
  if (pagesList) {
    pagesList.querySelectorAll('li').forEach(li => {
      li.classList.toggle('active', li.dataset.path === page.path);
    });
  }

  setStatus('Loading...');

  try {
    await loadPageWithHeader(page);

    // Scroll to match line if provided
    if (matchLine !== undefined) {
      const { scrollToLine } = await import('./editor');
      scrollToLine(matchLine, searchTerm);
    }

    setStatus('Ready');

    // Auto-trigger rename for Untitled pages
    if (page.name === 'Untitled' || page.name.startsWith('Untitled ')) {
      const li = document.querySelector(`[data-path="${page.path}"]`) as HTMLElement;
      if (li && !li.querySelector('input')) {
        startRename(page, li);
      }
    }
  } catch (err) {
    console.error('Error loading page:', err);
    setStatus('Error loading page');
  }
}

export function getCurrentSection(): Section | null {
  return currentSection;
}

export async function navigateToPath(path: string, sectionName: string, matchLine?: number, searchTerm?: string) {
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

  await selectPage(page, matchLine, searchTerm);
}
