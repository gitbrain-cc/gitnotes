import { Plugin } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import {
  addRowBefore, addRowAfter,
  addColumnBefore, addColumnAfter,
  deleteRow, deleteColumn, deleteTable,
  CellSelection,
} from 'prosemirror-tables';

interface MenuItem {
  label: string;
  command: (state: any, dispatch: any) => boolean;
  separator?: boolean;
}

const menuItems: MenuItem[] = [
  { label: 'Insert Row Above', command: addRowBefore },
  { label: 'Insert Row Below', command: addRowAfter },
  { label: 'Insert Column Left', command: addColumnBefore },
  { label: 'Insert Column Right', command: addColumnAfter },
  { label: 'Delete Row', command: deleteRow, separator: true },
  { label: 'Delete Column', command: deleteColumn },
  { label: 'Delete Table', command: deleteTable, separator: true },
];

function isInTable(view: EditorView): boolean {
  const { $from } = view.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === 'table') return true;
  }
  return view.state.selection instanceof CellSelection;
}

function removeMenu() {
  const existing = document.querySelector('.pm-table-menu');
  if (existing) existing.remove();
}

function showMenu(view: EditorView, x: number, y: number) {
  removeMenu();

  const menu = document.createElement('div');
  menu.className = 'pm-table-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  for (const item of menuItems) {
    if (item.separator) {
      const sep = document.createElement('div');
      sep.className = 'pm-table-menu-separator';
      menu.appendChild(sep);
    }

    const btn = document.createElement('button');
    btn.className = 'pm-table-menu-item';
    btn.textContent = item.label;

    // Disable if command can't execute
    if (!item.command(view.state, undefined)) {
      btn.disabled = true;
    }

    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      item.command(view.state, view.dispatch);
      removeMenu();
      view.focus();
    });

    menu.appendChild(btn);
  }

  document.body.appendChild(menu);

  // Clamp to viewport
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = `${window.innerWidth - rect.width - 4}px`;
  if (rect.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - rect.height - 4}px`;

  // Remove on click outside or Escape
  const cleanup = (e: Event) => {
    if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
    removeMenu();
    document.removeEventListener('mousedown', cleanup);
    document.removeEventListener('keydown', cleanup);
  };
  // Delay to avoid catching the contextmenu event itself
  setTimeout(() => {
    document.addEventListener('mousedown', cleanup);
    document.addEventListener('keydown', cleanup);
  }, 0);
}

export function buildTableMenuPlugin(): Plugin {
  return new Plugin({
    props: {
      handleDOMEvents: {
        contextmenu(view: EditorView, event: MouseEvent) {
          if (!isInTable(view)) return false;
          event.preventDefault();
          showMenu(view, event.clientX, event.clientY);
          return true;
        },
      },
    },
  });
}
