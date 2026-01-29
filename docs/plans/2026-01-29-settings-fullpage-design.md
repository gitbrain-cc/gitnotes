# Settings Full-Page Redesign

## Problem

The 600x480px settings modal is too cramped. With 4 tabs of content, the modal format limits our ability to build quality settings UI.

## Solution

Convert settings from a modal overlay to a full-page app mode, joining Notes and Git as a third mode.

## Layout

```
┌──────────────┬─────────────────────────────────────────┐
│ < Settings   │                                         │
│              │  [Section title]                        │
│  Repositories│                                         │
│  Git         │  [Settings controls]                    │
│  Editor      │                                         │
│  Appearance  │                                         │
│              │                                         │
│              │                                         │
└──────────────┴─────────────────────────────────────────┘
```

### Sidebar

- Exact same width and position as the Sections sidebar in notes mode. Same CSS dimensions, padding, border-right style. Pixel-perfect alignment so the transition feels seamless.
- Header: "< Settings" with back arrow, replacing "Sections" header.
- Nav items: Repositories, Git, Editor, Appearance. Styled like section items in the sidebar.

### Content Panel

- Spans from sidebar edge to right window edge (where Notes list + Editor normally live).
- Section title at the top as a heading.
- Max-width ~600-700px, left-aligned (not centered). Prevents controls from stretching on wide windows.
- Scrollable if content overflows. Sidebar stays fixed.

### Full Window

- Takes over the entire window. No top bar, no modal overlay, no backdrop.
- The `#settings-overlay` modal pattern is replaced entirely.

## Transitions & Behavior

- **Entering**: Gear button or Cmd+, hides current mode (notes/git) and shows settings. Instant swap, no animation (same as notes/git toggle).
- **Leaving**: Back arrow click or Escape hides settings, restores previous mode. Editor state preserved.
- **Saving**: All settings apply immediately in real-time. No save button.

## Controls

All existing settings controls (repo list, toggles, theme picker, font options, sliders) remain as-is. This is a structural change only - the controls just get more room.

## Sections

1. **Repositories** - Vault list, add/remove repos
2. **Git** - Auto-commit toggle, team repository setting
3. **Editor** - Text size, line wrapping, indent settings
4. **Appearance** - Theme selection, font family
