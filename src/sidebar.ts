import {
  loadSections, loadNotes, setCurrentNote, setStatus,
  createNoteSmart, deleteNote, renameNote, createSection, deleteSection, moveNote,
  loadNoteWithHeader, setSectionMetadata
} from './main';
import { loadContent, updateHeaderData } from './editor';
import { showContextMenu } from './contextmenu';
import { initSortMenu, updateSortForSection } from './sortmenu';
import { showColorPicker } from './colorpicker';

interface Section {
  name: string;
  path: string;
  title?: string;
  color?: string;
}

interface Note {
  name: string;
  path: string;
  filename: string;
}

let sections: Section[] = [];
let currentSection: Section | null = null;

async function handleDeleteNote(note: Note) {
  try {
    await deleteNote(note.path);
    if (currentSection) {
      const notes = await loadNotes(currentSection.path);
      renderNotes(notes);
      if (notes.length > 0) {
        await selectNote(notes[0]);
      } else {
        setCurrentNote(null);
        loadContent('');
        updateHeaderData({ title: '', createdDate: null, modifiedInfo: null });
      }
    }
  } catch (err) {
    console.error('Delete error:', err);
  }
}

function startRename(note: Note, li: HTMLElement) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = note.name;
  input.className = 'inline-rename';

  li.textContent = '';
  li.appendChild(input);
  input.focus();
  input.select();

  const finishRename = async () => {
    const newName = input.value.trim();
    if (newName && newName !== note.name) {
      try {
        await renameNote(note.path, newName);
      } catch (err) {
        console.error('Rename error:', err);
      }
    }
    if (currentSection) {
      const notes = await loadNotes(currentSection.path);
      renderNotes(notes);
    }
  };

  input.addEventListener('blur', finishRename);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      input.blur();
    } else if (e.key === 'Escape') {
      input.value = note.name;
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
  input.value = section.title || section.name;
  input.className = 'inline-rename';

  li.textContent = '';
  li.appendChild(input);
  input.focus();
  input.select();

  const finishRename = async () => {
    const newName = input.value.trim();
    if (newName && newName !== (section.title || section.name)) {
      try {
        await setSectionMetadata(section.path, newName, section.color || null);
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
      input.value = section.title || section.name;
      input.blur();
    }
  });
}

async function refreshCurrentNotes() {
  if (!currentSection) return;
  const notes = await loadNotes(currentSection.path);
  renderNotes(notes);
}

export async function initSidebar() {
  // Initialize sort menu with refresh callback
  initSortMenu(refreshCurrentNotes);

  sections = await loadSections();
  renderSections();

  if (sections.length > 0) {
    await selectSection(sections[0]);
  }

  document.getElementById('add-page-btn')?.addEventListener('click', async () => {
    if (!currentSection) return;
    try {
      const note = await createNoteSmart(currentSection.path);
      const notes = await loadNotes(currentSection.path);
      renderNotes(notes);
      await selectNote(note);

      // Auto-trigger rename if Untitled
      if (note.name === 'Untitled' || note.name.startsWith('Untitled ')) {
        const li = document.querySelector(`[data-path="${note.path}"]`) as HTMLElement;
        if (li) startRename(note, li);
      }
    } catch (err) {
      console.error('Create note error:', err);
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
    li.textContent = section.title || section.name;
    li.dataset.path = section.path;

    if (section.color) {
      li.dataset.color = section.color;
      li.style.setProperty('--section-color', section.color);
    }

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
      const notePath = e.dataTransfer?.getData('text/plain');
      if (notePath && section.path !== currentSection?.path) {
        try {
          await moveNote(notePath, section.path);
          if (currentSection) {
            const notes = await loadNotes(currentSection.path);
            renderNotes(notes);
            if (notes.length > 0) {
              await selectNote(notes[0]);
            } else {
              setCurrentNote(null);
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
        {
          label: 'Set Color',
          action: () => {
            showColorPicker(e.clientX, e.clientY, section.color || null, async (color) => {
              try {
                await setSectionMetadata(section.path, section.title || null, color);
                sections = await loadSections();
                renderSections();
              } catch (err) {
                console.error('Set color error:', err);
              }
            });
          }
        },
        { label: 'Delete', action: () => handleDeleteSection(section), disabled: isProtected }
      ]);
    });
    list.appendChild(li);
  }
}

async function selectSection(section: Section) {
  currentSection = section;
  renderSections();

  // Update sort menu for this section
  await updateSortForSection(section.path);

  const notes = await loadNotes(section.path);
  renderNotes(notes);

  // Select first note if any
  if (notes.length > 0) {
    await selectNote(notes[0]);
  } else {
    setCurrentNote(null);
    loadContent('');
    updateHeaderData({ title: '', createdDate: null, modifiedInfo: null });
    setStatus('No notes in section');
  }
}

function renderNotes(notes: Note[]) {
  const list = document.getElementById('pages-list');
  if (!list) return;

  list.innerHTML = '';

  for (const note of notes) {
    const li = document.createElement('li');
    li.textContent = note.name;
    li.dataset.path = note.path;
    li.draggable = true;
    li.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData('text/plain', note.path);
      li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
    });
    li.addEventListener('click', () => selectNote(note));
    li.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, [
        { label: 'Rename', action: () => startRename(note, li) },
        { label: 'Delete', action: () => handleDeleteNote(note) }
      ]);
    });
    list.appendChild(li);
  }
}

export async function selectNote(note: Note, matchLine?: number, searchTerm?: string) {
  // Update UI
  const notesList = document.getElementById('pages-list');
  if (notesList) {
    notesList.querySelectorAll('li').forEach(li => {
      li.classList.toggle('active', li.dataset.path === note.path);
    });
  }

  setStatus('Loading...');

  try {
    await loadNoteWithHeader(note);

    // Scroll to match line if provided
    if (matchLine !== undefined) {
      const { scrollToLine } = await import('./editor');
      scrollToLine(matchLine, searchTerm);
    }

    setStatus('Ready');

    // Auto-trigger rename for Untitled notes
    if (note.name === 'Untitled' || note.name.startsWith('Untitled ')) {
      const li = document.querySelector(`[data-path="${note.path}"]`) as HTMLElement;
      if (li && !li.querySelector('input')) {
        startRename(note, li);
      }
    }
  } catch (err) {
    console.error('Error loading note:', err);
    setStatus('Error loading note');
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
    const notes = await loadNotes(section.path);
    renderNotes(notes);
  }

  // Create a Note object and select it
  const filename = path.split('/').pop() || '';
  const note: Note = {
    name: filename.replace('.md', ''),
    path: path,
    filename: filename
  };

  await selectNote(note, matchLine, searchTerm);
}
