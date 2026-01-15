const PRESET_COLORS = [
  '#e8a849', // orange/gold (accent)
  '#e85d5d', // coral red
  '#d65db1', // magenta
  '#845ec2', // purple
  '#4a9f4a', // green
  '#00b4d8', // cyan
  '#5b8def', // blue
  '#8b7355', // brown/earth
];

let activePicker: HTMLElement | null = null;

export function showColorPicker(x: number, y: number, currentColor: string | null, onSelect: (color: string | null) => void) {
  hideColorPicker();

  const picker = document.createElement('div');
  picker.className = 'color-picker';
  picker.style.left = `${x}px`;
  picker.style.top = `${y}px`;

  // Preset swatches
  const swatches = document.createElement('div');
  swatches.className = 'color-swatches';

  for (const color of PRESET_COLORS) {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.backgroundColor = color;
    if (color === currentColor) {
      swatch.classList.add('selected');
    }
    swatch.addEventListener('click', () => {
      hideColorPicker();
      onSelect(color);
    });
    swatches.appendChild(swatch);
  }

  picker.appendChild(swatches);

  // Clear button
  const clearBtn = document.createElement('button');
  clearBtn.className = 'color-clear-btn';
  clearBtn.textContent = 'Clear color';
  clearBtn.addEventListener('click', () => {
    hideColorPicker();
    onSelect(null);
  });
  picker.appendChild(clearBtn);

  document.body.appendChild(picker);
  activePicker = picker;

  // Close on click outside
  setTimeout(() => {
    document.addEventListener('click', handleOutsideClick);
  }, 0);
}

function handleOutsideClick(e: MouseEvent) {
  if (activePicker && !activePicker.contains(e.target as Node)) {
    hideColorPicker();
  }
}

export function hideColorPicker() {
  if (activePicker) {
    activePicker.remove();
    activePicker = null;
  }
  document.removeEventListener('click', handleOutsideClick);
}
