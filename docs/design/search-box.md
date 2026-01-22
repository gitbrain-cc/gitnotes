# Search Box - Design Spec

Essential UI/UX elements to preserve as the app evolves.

---

## Terminology

- **Search Container** (`#search-container`) - Always visible in top bar. Contains input and dropdown. Fixed width, positioned to align with editor content.

- **Search Input** (`#search-input`) - Text input field with placeholder "Search files and content...". Visually anchored - does not move between open/closed states.

- **Search Dropdown** (`#search-results`) - Floating panel that appears below input when active. Contains recent files, recent searches, and search results.

### Anchored Input Architecture
The input field stays visually fixed in the same position whether the dropdown is open or closed. This is achieved by:
1. Input has consistent width/padding in both states
2. Only the border-radius changes (pill → connected)
3. Dropdown appears below, not around the input

---

## Visual Structure

**Closed state:**
```
                              ┌──────────────────────────────────┐
                              │ Search files and content...       │
                              └──────────────────────────────────┘
                              ↑
                              Left edge aligns with editor content
```

**Open state (empty query):**
```
                              ┌──────────────────────────────────┐
                              │ Search files and content...       │
                              ├──────────────────────────────────┤
                              │ RECENT FILES                      │
                              │   1-weeks    Today                │
                              │   1-weeks    2026-03              │
                              │   1-todo     BE (NEXT)            │
                              │   1-weeks    2026-02              │
                              │   gf-business CUTS                │
                              │   1-weeks    2025-50              │
                              │   gf-roadmap F&F Pass             │
                              ├──────────────────────────────────┤
                              │ RECENT SEARCHES                   │
                              │   🔍 Ivana                         │
                              │   🔍 faf                           │
                              └──────────────────────────────────┘
```

**Open state (with search query):**
```
                              ┌──────────────────────────────────┐
                              │ magento                           │
                              ├──────────────────────────────────┤
                              │ FILES                             │
                              │   gf-roadmap  Magento Migration   │
                              ├──────────────────────────────────┤
                              │ IN CONTENT                        │
                              │   1-weeks     2025-48             │
                              │   ...working on the <magento>...  │
                              │                                   │
                              │   gf-business Planning            │
                              │   ...migrate from <Magento> to... │
                              └──────────────────────────────────┘
```

**Open state (no results):**
```
                              ┌──────────────────────────────────┐
                              │ xyznotfound                       │
                              ├──────────────────────────────────┤
                              │                                   │
                              │   No results found                │
                              │                                   │
                              └──────────────────────────────────┘
```

---

## Positioning

### Horizontal Alignment
- Container left edge aligns with editor content left edge
- Achieved via: `margin-left: calc(var(--sidebar-width-pages) - 35px)`
- Input and dropdown share the same left edge (anchored)

### Vertical Position
- Input fixed in top bar area
- Dropdown appears immediately below input (top: 100%)
- Dropdown floats over content (does not push page down)

---

## Search Input

### Layout
- Width: 100%, max-width 500px
- Padding: 10px 16px
- Font size: 13px

### States

**Closed (default):**
- Border-radius: 20px (pill shape)
- Border: 1px solid --border-color
- Background: --bg-primary

**Open (active):**
- Border-radius: 12px 12px 0 0 (connected to dropdown)
- Border: 1px solid --accent-color
- Border-bottom: 1px solid --border-color (subtle separation)
- Background: --bg-primary

### Behavior
- Click → open dropdown, focus input
- Cmd+P → open dropdown, focus input
- Escape → close dropdown, blur input
- Click outside → close dropdown

---

## Search Dropdown

### Container
- Position: absolute, below input
- Background: --bg-primary
- Border: 1px solid --accent-color (no top border - connects to input)
- Border-radius: 0 0 12px 12px
- Shadow: 0 8px 24px rgba(0,0,0,0.3)
- Max height: 400px (scrollable)
- Min height: ~120px (enough for "No results" message + padding)

### Sections
Dropdown contains up to 3 sections, separated by subtle borders:

1. **Recent Files** - shown when query is empty
2. **Recent Searches** - shown when query is empty
3. **Search Results** - shown when typing

---

## Recent Files Section

### Header
- Text: "RECENT FILES"
- Font: 11px, weight 600, uppercase
- Color: --text-secondary
- Padding: 4px 12px 8px

### List
- Max items: **7** (not 8, to ensure Recent Searches isn't cut off)
- Each item is a row with:

```
┌──────────────────────────────────────────┐
│  section-name    page-name               │
│  [secondary]     [primary, bold]         │
└──────────────────────────────────────────┘
```

### Item Layout
- Section name: 11px, --text-secondary, truncate at 12 chars
- Page name: 14px, weight 500, --text-primary
- Gap between: 6px
- Padding: 8px 12px

### Item States
- Default: transparent background
- Hover/Selected: --bg-tertiary background
- Click: open that page

---

## Recent Searches Section

### Header
- Text: "RECENT SEARCHES"
- Same styling as Recent Files header

### List
- Max items: 5
- Each item shows: search icon + query text

```
┌──────────────────────────────────────────┐
│  🔍  search query text                    │
└──────────────────────────────────────────┘
```

### Item Layout
- Icon: 14x14px SVG magnifying glass, --text-secondary
- Text: 13px, --text-primary
- Gap: 8px

### Item States
- Hover: --bg-tertiary background
- Click: populate input with that search query

---

## Search Results Section

### Shown when query is not empty
Replaces Recent Files + Recent Searches when user types.

### Search Phases
| Query length | Behavior |
|--------------|----------|
| 1-2 chars | Fuzzy filename matching only (instant, client-side) |
| 3+ chars | Filename + full-text content search (150ms debounce) |

### Group Headers
Results grouped into two categories:
- **"Files"** - filename/section matches (appears first)
- **"In Content"** - content matches with snippets

Header styling same as Recent Files header (11px, uppercase, secondary).

### Result Item (filename match)
Same layout as Recent Files item:
```
┌──────────────────────────────────────────┐
│  section-name    page-name               │
└──────────────────────────────────────────┘
```

### Result Item (content match)
Two-line layout with snippet:
```
┌──────────────────────────────────────────┐
│  section-name    page-name               │
│  ...matching snippet with highlights...  │
└──────────────────────────────────────────┘
```

### Snippet Styling
- Font: 12px, --text-secondary
- Highlight (`<mark>`): --accent-color background, slight padding
- Max length: ~70 chars, truncated at word boundary with "..."
- Margin-top: 4px from header line
- Ellipsis prefix: "..." if snippet doesn't start at line beginning

### Deduplication
If a file matches both filename AND content, show only in "Files" group (not duplicated in "In Content").

### Result Limits
- Max 10 filename matches
- Max 20 content matches
- Total displayed: up to 30 results

---

## Keyboard Navigation

| Key | Action |
|-----|--------|
| Cmd+P | Open search bar, focus input |
| Escape | Close dropdown |
| Arrow Down | Move selection down |
| Arrow Up | Move selection up |
| Enter | Open selected result |

### Selection
- One item highlighted at a time (--bg-tertiary)
- Selection wraps: first ↔ last
- Selected item scrolls into view

---

## Click Behavior Summary

| Element | Click Action |
|---------|--------------|
| Search input | Open dropdown, focus |
| Recent file item | Open that page |
| Recent search item | Fill input with query |
| Search result | Open page (scroll to match if content) |
| Outside dropdown | Close dropdown |

---

## Data Persistence

- Recent files: localStorage `gitnotes_recent_files` (max 7)
- Recent searches: localStorage `gitnotes_recent_searches` (max 5)
- Updated on file open / search selection

---

## Constants

```typescript
const MAX_RECENT_FILES = 7;
const MAX_RECENT_SEARCHES = 5;
const MIN_CONTENT_SEARCH_LENGTH = 3;
```

---

## Z-Index & Stacking

### Stacking Order (low to high)
| z-index | Element |
|---------|---------|
| 1000 | Top bar, Context menus |
| 1001 | Git modal |
| 1002 | Search dropdown |

### Behavior
- Search dropdown appears above editor content
- Search dropdown appears above git modal (if both open)
- Clicking git box while search is open → close search first
- Only one overlay active at a time (search OR git modal)

---

## Transitions & Animation

### Opening
- Dropdown appears instantly (no fade/slide)
- Border-radius change on input is instant

### Closing
- Dropdown disappears instantly
- Input returns to pill shape instantly

### Selection highlight
- Background change is instant (no transition)

### Rationale
Instant transitions feel snappier for frequent actions like search. Animations add latency to keyboard-driven workflows.

---

## Empty & Error States

### No Results
- Shown when query returns zero matches
- Single centered message: "No results found"
- Font: 13px, --text-secondary
- Padding: 24px vertical
- Not selectable (no hover state)

### Loading
- No explicit loading state
- Filename matches appear instantly (client-side filter)
- Content matches appear after 150ms debounce (server-side search)
- Results update in place as they arrive
