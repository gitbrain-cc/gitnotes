import { invoke } from '@tauri-apps/api/core';
import {
  loadSections, loadNotes, setCurrentNote, setStatus, clearPendingSave,
  createNoteSmart, deleteNote, renameNote, createSection, deleteSection, moveNote,
  loadNoteWithHeader, setSectionMetadata, saveSectionOrder,
  gitCommit, flashCommitted, getCurrentNote
} from './main';
import { loadContent, updateHeaderData, focusEditor } from './editor';
import { showContextMenu } from './contextmenu';
import { initSortMenu, updateSortForSection, getCurrentSort } from './sortmenu';
import { showColorPicker } from './colorpicker';
import { triggerImmediateCommit } from './commit-engine';
import { getAutoCommit } from './settings';
import { refreshGitStatus } from './git-status';

interface Section {
  name: string;
  path: string;
  title?: string;
  color?: string;
  section_type?: string;
}

interface Note {
  name: string;
  path: string;
  filename: string;
  subfolder?: string;
}

let sections: Section[] = [];
let currentSection: Section | null = null;

// Section drag state
let dragState: {
  active: boolean;
  sectionIndex: number;
  startY: number;
  holdTimer: number | null;
} | null = null;
let skipNextSectionClick = false;
let renameAttempted = false;

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
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.title = '';

  li.textContent = '';
  li.appendChild(input);
  input.focus();
  input.select();
  renameAttempted = true;

  const finishRename = async () => {
    const newName = input.value.trim();
    let renamedNote: Note | null = null;
    if (newName && newName !== note.name) {
      try {
        renamedNote = await renameNote(note.path, newName);
      } catch (err) {
        console.error('Rename error:', err);
      }
    }
    if (currentSection) {
      const notes = await loadNotes(currentSection.path);
      renderNotes(notes);
      await selectNote(renamedNote || note);
      focusEditor();
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

let listenersInitialized = false;

export async function initSidebar(restoreSection?: string) {
  // Initialize sort menu with refresh callback
  initSortMenu(refreshCurrentNotes);

  sections = await loadSections();
  renderSections();

  if (sections.length > 0) {
    const target = restoreSection
      ? sections.find(s => s.name === restoreSection) || sections[0]
      : sections[0];
    await selectSection(target);
  }

  // Only add event listeners once (initSidebar can be called multiple times on vault switch)
  if (listenersInitialized) return;
  listenersInitialized = true;

  document.getElementById('add-page-btn')?.addEventListener('click', async () => {
    if (!currentSection) return;
    try {
      const note = await createNoteSmart(currentSection.path);
      const notes = await loadNotes(currentSection.path);
      renderNotes(notes);

      // Position new note at a predictable edge for alpha sort
      // (timestamp sorts already place new notes correctly)
      const sort = getCurrentSort();
      if (sort.type === 'alpha') {
        const li = document.querySelector(`[data-path="${note.path}"]`) as HTMLElement;
        const list = document.getElementById('pages-list');
        if (li && list) {
          if (sort.direction === 'desc') {
            list.prepend(li);
          } else {
            list.append(li);
          }
        }
      }

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

function getDropIndex(clientY: number): number {
  const list = document.getElementById('sections-list');
  if (!list) return 0;

  const items = Array.from(list.querySelectorAll('li:not(.drop-indicator)'));

  for (let i = 0; i < items.length; i++) {
    const rect = items[i].getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    if (clientY < midpoint) {
      return i;
    }
  }
  return items.length;
}

function showDropIndicator(index: number) {
  removeDropIndicator();
  const list = document.getElementById('sections-list');
  if (!list) return;

  const indicator = document.createElement('div');
  indicator.className = 'drop-indicator';

  const items = list.querySelectorAll('li:not(.drop-indicator)');
  if (index >= items.length) {
    list.appendChild(indicator);
  } else {
    list.insertBefore(indicator, items[index]);
  }
}

function removeDropIndicator() {
  document.querySelector('#sections-list .drop-indicator')?.remove();
}

function handleSectionDragMove(e: MouseEvent) {
  if (!dragState?.active) return;

  const list = document.getElementById('sections-list');
  if (!list) return;

  const rect = list.getBoundingClientRect();

  // Hide indicator if outside sidebar horizontally
  if (e.clientX < rect.left || e.clientX > rect.right) {
    removeDropIndicator();
    return;
  }

  const dropIndex = getDropIndex(e.clientY);
  showDropIndicator(dropIndex);
}

async function handleSectionDragEnd(e: MouseEvent) {
  document.removeEventListener('mousemove', handleSectionDragMove);
  document.removeEventListener('mouseup', handleSectionDragEnd);

  const list = document.getElementById('sections-list');
  if (!list || !dragState?.active) {
    removeDropIndicator();
    dragState = null;
    return;
  }

  const fromIndex = dragState.sectionIndex;
  const toIndex = getDropIndex(e.clientY);

  removeDropIndicator();

  // Remove dragging class from all items
  list.querySelectorAll('li.dragging').forEach(el => el.classList.remove('dragging'));

  dragState = null;
  skipNextSectionClick = true;

  // Skip if dropped in same position
  if (toIndex === fromIndex || toIndex === fromIndex + 1) {
    return;
  }

  // Reorder sections array
  const [moved] = sections.splice(fromIndex, 1);
  const insertAt = toIndex > fromIndex ? toIndex - 1 : toIndex;
  sections.splice(insertAt, 0, moved);

  // Save new order
  const order = sections.map(s => s.name);
  try {
    await saveSectionOrder(order);
  } catch (err) {
    console.error('Save section order error:', err);
  }

  // Re-render
  renderSections();
}

function renderSections() {
  const list = document.getElementById('sections-list');
  if (!list) return;

  list.innerHTML = '';

  for (const section of sections) {
    const li = document.createElement('li');
    li.dataset.path = section.path;

    li.appendChild(document.createTextNode(section.title || section.name));

    const isJournal = section.section_type === 'journal' || section.name === '1-weeks' || (section.title || '').toLowerCase() === 'journal';
    if (isJournal) {
      const icon = document.createElement('span');
      icon.className = 'section-icon';
      icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 1-4 4v14a3 3 0 0 0 3-3h7z"/></svg>';
      li.appendChild(icon);
    }

    if (section.color) {
      li.dataset.color = section.color;
      li.style.setProperty('--section-color', section.color);
    }

    if (currentSection && currentSection.path === section.path) {
      li.classList.add('active');
    }

    const isProtected = ['1-todo', '1-weeks'].includes(section.name.toLowerCase());

    const sectionIndex = sections.indexOf(section);

    // Hold-to-drag for section reordering (only if multiple sections)
    if (sections.length > 1) {
      li.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Left click only
        e.preventDefault(); // Prevent text selection

        const startY = e.clientY;
        const currentLi = li;

        const holdTimer = window.setTimeout(() => {
          // Enter drag mode
          currentLi.classList.add('dragging');
          dragState = { active: true, sectionIndex, startY, holdTimer: null };
          document.addEventListener('mousemove', handleSectionDragMove);
          document.addEventListener('mouseup', handleSectionDragEnd);
        }, 200);

        dragState = { active: false, sectionIndex, startY, holdTimer };
        currentLi.classList.add('drag-pending');

        const cancelHold = () => {
          if (dragState?.holdTimer) {
            clearTimeout(dragState.holdTimer);
          }
          currentLi.classList.remove('drag-pending');
          if (!dragState?.active) {
            dragState = null;
          }
          document.removeEventListener('mouseup', cancelHold);
          document.removeEventListener('mousemove', checkMovement);
        };

        const checkMovement = (moveEvent: MouseEvent) => {
          // Cancel if moved > 5px before hold timer fires
          if (Math.abs(moveEvent.clientY - startY) > 5 && !dragState?.active) {
            cancelHold();
          }
        };

        document.addEventListener('mouseup', cancelHold);
        document.addEventListener('mousemove', checkMovement);
      });
    }

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
    li.addEventListener('click', () => {
      if (skipNextSectionClick) {
        skipNextSectionClick = false;
        return;
      }
      selectSection(section);
    });
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
  // Commit current note before switching (if auto-commit enabled)
  const autoCommit = await getAutoCommit();
  const noteBeforeSwitch = getCurrentNote();
  if (autoCommit && noteBeforeSwitch) {
    await triggerImmediateCommit(async (msg) => {
      await gitCommit(noteBeforeSwitch.path, msg);
      flashCommitted();
      await refreshGitStatus();
    });
  }

  currentSection = section;
  renderSections();

  // Update sort menu for this section
  await updateSortForSection(section.path);

  const notes = await loadNotes(section.path);
  renderNotes(notes);

  // Select last opened note, or first if none stored
  if (notes.length > 0) {
    const lastNotePath = await invoke<string | null>('get_last_note', { sectionPath: section.path });
    const lastNote = lastNotePath ? notes.find(n => n.path === lastNotePath) : null;
    await selectNote(lastNote || notes[0]);
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
    const nameSpan = document.createElement('span');
    nameSpan.className = 'note-name';
    nameSpan.textContent = note.name;
    li.appendChild(nameSpan);
    if (note.subfolder) {
      const badge = document.createElement('span');
      badge.className = 'subfolder-badge';
      badge.textContent = note.subfolder.slice(0, 3);
      badge.title = note.subfolder;
      li.appendChild(badge);
    }
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
  // Cancel any pending save from previous note to prevent status flash
  clearPendingSave();

  // Commit current note before switching (if auto-commit enabled)
  const autoCommit = await getAutoCommit();
  const noteBeforeSwitch = getCurrentNote();
  if (autoCommit && noteBeforeSwitch && noteBeforeSwitch.path !== note.path) {
    await triggerImmediateCommit(async (msg) => {
      await gitCommit(noteBeforeSwitch.path, msg);
      flashCommitted();
      await refreshGitStatus();
    });
  }

  // Reset rename guard when switching to a different note
  const currentNote = getCurrentNote();
  if (currentNote && currentNote.path !== note.path) {
    renameAttempted = false;
  }

  // Save as last opened note for current section (fire-and-forget)
  if (currentSection) {
    invoke('set_last_note', { sectionPath: currentSection.path, notePath: note.path });
  }

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

    // Auto-trigger rename for Untitled notes (only on first select, not after rename dismissal)
    if (!renameAttempted && (note.name === 'Untitled' || note.name.startsWith('Untitled '))) {
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
