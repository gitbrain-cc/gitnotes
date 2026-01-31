# Brains 2nd-Column Hierarchy + Rename Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a second column to the Settings "Brains" tab (a list of brains, like the notes list in the main screen), and rename "Repository" to "Brain" everywhere in the UI.

**Architecture:** The settings view currently has 2 zones: sidebar (tabs) + content panel. When the "Brains" tab is active, we insert a middle column (`#settings-brains-list`) between the sidebar and the content panel, identical in structure to `#pages`. The content panel then shows detail/settings for the selected brain. For other tabs (Git, Editor, Appearance), no middle column — same as today.

**Tech Stack:** TypeScript, HTML, CSS (vanilla, no framework). Tauri IPC for backend data.

---

### Task 1: Rename "Repository" → "Brain" in all UI strings

**Files:**
- Modify: `index.html` — all user-facing strings
- Modify: `src/onboarding.ts:59-62` — error banner text
- Modify: `src/modals.ts:171` — error message string
- Modify: `src/settings.ts:195` — remove button title
- Modify: `.claude/CLAUDE.md` — terminology table

**Step 1: Update `index.html` strings**

Replace all user-facing "Repository" / "repository" with "Brain" / "brain":

| Line | Old | New |
|------|-----|-----|
| 130 | `Repositories` (tab label) | `Brains` |
| 137 | `id="panel-repositories"` | `id="panel-brains"` |
| 138 | `Repositories` (panel title) | `Brains` |
| 143 | `+ Add Repository` | `+ Add Brain` |
| 150 | `Clone Repository` | `Clone Brain` |
| 151 | `Create Repository` | `Create Brain` |
| 168 | `Team repository` | `Team brain` |
| 311 | `Clone Repository` (modal h3) | `Clone Brain` |
| 316 | `Repository URL` | `Repository URL` (keep — this is a git concept) |
| 328 | `Cloning repository...` | `Cloning...` |
| 342 | `Create Repository` (modal h3) | `Create Brain` |
| 347 | `Repository name` | `Brain name` |
| 387 | `Set up your repository` | `Set up your brain` |
| 397 | `Use an existing git repository` | `Use an existing git repository` (keep — describes the git folder) |

Also update the `data-tab` attribute:
- Line 130: `data-tab="repositories"` → `data-tab="brains"`

**Step 2: Update `src/settings.ts` string references**

- Line 195: `title="Remove repository"` → `title="Remove brain"`
- Update tab switching: all references to `data-tab="repositories"` → `data-tab="brains"` (rendered via `panel-${tabName}`)

**Step 3: Update `src/onboarding.ts` strings**

- Line 60: `Repository not found` → `Brain not found`
- Line 62: `Please select or create a new repository.` → `Please select or create a new brain.`

**Step 4: Update `src/modals.ts` string**

- Line 171: `Folder contains a different repository` → `Folder contains a different repository` (keep — this is about the git repo on disk, not the brain concept)

**Step 5: Update `.claude/CLAUDE.md` terminology table**

Update the terminology row:
```
| Top-level container | **Brain** | `Vault` | "Brain" in UI aligns with GitBrain ecosystem |
```

**Step 6: Commit**

```bash
git add index.html src/settings.ts src/onboarding.ts .claude/CLAUDE.md
git commit -m "Rename Repository to Brain in all UI strings"
```

---

### Task 2: Add HTML structure for brains list column

**Files:**
- Modify: `index.html` — add `#settings-brains-list` sidebar between settings sidebar and content

**Step 1: Add the brains list column**

Inside `#settings-view`, between `#settings-sidebar` and `#settings-content`, add:

```html
<aside id="settings-brains-list" class="sidebar hidden">
  <div class="sidebar-header">Brains</div>
  <ul id="brains-list"></ul>
  <div class="sidebar-footer">
    <div id="add-brain-dropdown" class="add-repo-dropdown">
      <button id="add-brain-btn" class="sidebar-add-btn">+ Add Brain</button>
      <div id="add-brain-menu" class="dropdown-menu hidden">
        <button class="dropdown-item" data-action="local">Add Local Folder</button>
        <button class="dropdown-item" data-action="clone">Clone Brain</button>
        <button class="dropdown-item" data-action="create">Create Brain</button>
      </div>
    </div>
  </div>
</aside>
```

Remove the old `#vault-actions` / `#add-repo-dropdown` section from `#panel-brains` since the add button moves to the column footer.

**Step 2: Commit**

```bash
git add index.html
git commit -m "Add brains list column HTML structure in settings"
```

---

### Task 3: Add CSS for the brains list column

**Files:**
- Modify: `src/styles/main.css`

**Step 1: Add styles for brains list sidebar**

```css
/* Brains list column in settings */
#settings-brains-list {
  width: var(--sidebar-width-pages);
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--border-color);
}

#settings-brains-list.hidden {
  display: none;
}

#settings-brains-list ul {
  list-style: none;
  overflow-y: auto;
  flex: 1;
}

#settings-brains-list li {
  padding: 10px 16px;
  cursor: pointer;
  font-size: 0.929rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-left: 3px solid transparent;
  transition: border-width 150ms ease, background 150ms ease, border-color 150ms ease;
}

#settings-brains-list li:hover {
  background: var(--bg-tertiary);
}

#settings-brains-list li.active {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-left-width: 5px;
  padding-left: 11px;
  border-left-color: var(--accent-color);
}

#settings-brains-list .brain-subtitle {
  font-size: 0.786rem;
  color: var(--text-secondary);
  margin-top: 2px;
}
```

**Step 2: Commit**

```bash
git add src/styles/main.css
git commit -m "Add CSS for brains list column"
```

---

### Task 4: Implement brains list rendering and selection logic

**Files:**
- Modify: `src/settings.ts` — add `renderBrainsList()`, selection state, wire up tab switching to show/hide column

**Step 1: Add state and rendering**

Add a `selectedBrainId` state variable alongside `currentSettings`.

Add `renderBrainsList()` that:
1. Reads `currentSettings.vaults`
2. Renders each as an `<li>` in `#brains-list` with vault name + subtitle (git provider or truncated path)
3. Highlights the selected brain with `.active` class
4. On click, sets `selectedBrainId` and calls `renderBrainDetail()`
5. Auto-selects the active vault on first load

**Step 2: Show/hide column on tab switch**

Modify the tab switching logic in `initSettings()`:
- When `data-tab="brains"` is selected: remove `.hidden` from `#settings-brains-list`, call `renderBrainsList()`
- When any other tab is selected: add `.hidden` to `#settings-brains-list`

**Step 3: Wire the add brain button**

Move the add-brain dropdown logic from the old `#add-repo-btn` / `#add-repo-dropdown` to the new `#add-brain-btn` / `#add-brain-dropdown` in the column footer. Same 3 actions: local, clone, create.

**Step 4: Commit**

```bash
git add src/settings.ts
git commit -m "Implement brains list rendering and tab-based show/hide"
```

---

### Task 5: Implement brain detail panel

**Files:**
- Modify: `index.html` — update `#panel-brains` content to be a detail view
- Modify: `src/settings.ts` — add `renderBrainDetail()`

**Step 1: Update panel HTML**

Replace the current `#panel-brains` content (vault-list + vault-actions) with a detail container:

```html
<div id="panel-brains" class="settings-panel active">
  <div id="brain-detail"></div>
</div>
```

**Step 2: Implement `renderBrainDetail(vaultId)`**

Renders into `#brain-detail`:

1. **Header**: Brain name (h2, `.settings-panel-title`)
2. **Info section** — location (git provider + repo or path), git branch badge, stats line (sections, notes, last modified)
3. **Settings section** — "Team brain" toggle (move from Git panel to here). Uses the existing `team-override-select` pattern but scoped to the selected brain.
4. **Danger zone** — Remove brain button at the bottom. Only enabled if more than 1 brain exists.

Fetch stats via `getVaultStats(vaultId)` for the selected brain.

**Step 3: Move team override from Git panel to brain detail**

Remove the `team-override-select` / `.setting-row` from `#panel-git` in HTML. Render it dynamically in `renderBrainDetail()` instead.

**Step 4: Commit**

```bash
git add index.html src/settings.ts
git commit -m "Implement brain detail panel with per-brain settings"
```

---

### Task 6: Clean up old vault list rendering

**Files:**
- Modify: `src/settings.ts` — remove `renderVaultList()` and its call sites, replace with `renderBrainsList()` + `renderBrainDetail()`

**Step 1: Remove old code**

- Delete `renderVaultList()` function
- Remove its call from `loadSettingsData()`
- Replace with: `await renderBrainsList()` (which auto-selects and renders detail)

**Step 2: Update `loadSettingsData()`**

After loading settings:
1. Call `renderBrainsList()`
2. The brains list auto-selects the active vault → triggers `renderBrainDetail()`
3. Remove the old auto-commit toggle and team override logic from `loadSettingsData()` since team override is now per-brain in the detail panel

**Step 3: Verify auto-commit toggle still works**

The auto-commit toggle stays in the Git panel — it's a global setting, not per-brain. Make sure `loadSettingsData()` still initializes it.

**Step 4: Commit**

```bash
git add src/settings.ts
git commit -m "Remove old vault list, wire brains list and detail panel"
```

---

### Task 7: Handle brain switching from detail panel

**Files:**
- Modify: `src/settings.ts`

**Step 1: Add "Set as active" behavior**

When clicking a brain in the list that is NOT the currently active vault:
- Call `setActiveVault(vaultId)`
- Update `currentSettings.active_vault`
- Reload the app (`window.location.reload()`) — same behavior as today

When clicking the already-active brain:
- Just show its detail panel (no reload)

**Step 2: Add remove brain handler in detail panel**

Wire the remove button in the detail panel:
- Same logic as current `vault-remove` handler
- After removal, re-render the brains list
- If removed brain was active, reload app

**Step 3: Commit**

```bash
git add src/settings.ts
git commit -m "Wire brain switching and removal from detail panel"
```

---

### Task 8: Show brains column by default on settings open

**Files:**
- Modify: `src/settings.ts`

**Step 1: Default to brains tab**

The "Brains" tab is already the default active tab (first in the list). Ensure that when settings opens:
1. The brains list column is shown (not hidden)
2. `renderBrainsList()` is called
3. First brain is auto-selected

This means in `openSettings()` or `loadSettingsData()`, after loading data, show the brains column if the active tab is "brains".

**Step 2: Commit**

```bash
git add src/settings.ts
git commit -m "Show brains column by default when settings opens"
```

---

### Summary

| Task | Description |
|------|-------------|
| 1 | Rename Repository → Brain in all UI strings |
| 2 | Add HTML structure for brains list column |
| 3 | Add CSS for brains list column |
| 4 | Implement brains list rendering + tab show/hide |
| 5 | Implement brain detail panel |
| 6 | Clean up old vault list rendering |
| 7 | Wire brain switching and removal |
| 8 | Show brains column by default on open |
