interface MenuItem {
  label: string;
  action: () => void;
  disabled?: boolean;
}

let activeMenu: HTMLElement | null = null;

export function showContextMenu(x: number, y: number, items: MenuItem[]) {
  hideContextMenu();

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  for (const item of items) {
    const menuItem = document.createElement('div');
    menuItem.className = 'context-menu-item';
    if (item.disabled) {
      menuItem.classList.add('disabled');
    }
    menuItem.textContent = item.label;

    if (!item.disabled) {
      menuItem.addEventListener('click', () => {
        hideContextMenu();
        item.action();
      });
    }

    menu.appendChild(menuItem);
  }

  document.body.appendChild(menu);
  activeMenu = menu;

  // Close on click outside
  setTimeout(() => {
    document.addEventListener('click', hideContextMenu, { once: true });
  }, 0);
}

export function hideContextMenu() {
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
  }
}
