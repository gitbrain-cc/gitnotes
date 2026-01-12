import { loadSections, loadPages, readPage, setCurrentPage, setStatus } from './main';
import { loadContent } from './editor';

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

export async function initSidebar() {
  sections = await loadSections();
  renderSections();

  if (sections.length > 0) {
    await selectSection(sections[0]);
  }
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
    list.appendChild(li);
  }
}

async function selectPage(page: Page) {
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
    setStatus('Ready');
  } catch (err) {
    console.error('Error loading page:', err);
    setStatus('Error loading page');
  }
}

export function getCurrentSection(): Section | null {
  return currentSection;
}
