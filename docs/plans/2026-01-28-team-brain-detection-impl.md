# Team Brain Detection — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Auto-detect solo vs team brains, cache the result per vault, and conditionally show the committer name in the git status bar.

**Architecture:** Extend the Rust `Vault` struct with `is_team` and `is_team_override` fields. Detect unique committer count inside `get_repo_status()` by running `git log --format='%ae'` piped through `sort -u | head -3`. Cache result in settings. Frontend reads `is_team` from `RepoStatus` and conditionally renders the author name.

**Tech Stack:** Rust (Tauri backend), TypeScript (frontend), HTML/CSS

---

### Task 1: Extend Vault struct in Rust

**Files:**
- Modify: `src-tauri/src/lib.rs:89-94` (Vault struct)

**Step 1: Add fields to Vault struct**

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Vault {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_team: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_team_override: Option<bool>,
}
```

**Step 2: Verify it compiles**

Run: `cd /Users/simon/tetronomis/gitnotes && cargo check --manifest-path src-tauri/Cargo.toml`
Expected: compiles with no errors (serde defaults handle missing fields in existing settings.json)

**Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: add is_team fields to Vault struct"
```

---

### Task 2: Add team detection to get_repo_status()

**Files:**
- Modify: `src-tauri/src/lib.rs:1109-1119` (RepoStatus struct)
- Modify: `src-tauri/src/lib.rs:1292-1405` (get_repo_status function)

**Step 1: Add `is_team` field to RepoStatus struct**

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct RepoStatus {
    pub repo_name: String,
    pub is_dirty: bool,
    pub dirty_count: u32,
    pub insertions: u32,
    pub deletions: u32,
    pub last_commit_hash: Option<String>,
    pub last_commit_message: Option<String>,
    pub last_commit_date: Option<String>,
    pub last_commit_author: Option<String>,
    pub is_team: bool,
}
```

**Step 2: Add detection logic inside get_repo_status()**

After the existing `log_output` block (around line 1392), before the `Ok(RepoStatus {` return, add:

```rust
    // Detect team brain: count unique committer emails
    let unique_authors = Command::new("sh")
        .args(["-c", "git log --format='%ae' | sort -u | head -3"])
        .current_dir(&notes_path)
        .output();

    let author_count = unique_authors
        .ok()
        .filter(|o| o.status.success())
        .map(|o| {
            String::from_utf8_lossy(&o.stdout)
                .lines()
                .filter(|l| !l.trim().is_empty())
                .count()
        })
        .unwrap_or(0);

    let is_team = author_count >= 2;

    // Cache is_team on the active vault in settings
    let mut settings = load_settings();
    if let Some(active_id) = &settings.active_vault {
        if let Some(vault) = settings.vaults.iter_mut().find(|v| &v.id == active_id) {
            if vault.is_team != Some(is_team) {
                vault.is_team = Some(is_team);
                let _ = save_settings(&settings);
            }
        }
    }

    // Resolve effective is_team (override takes precedence)
    let effective_is_team = settings
        .active_vault
        .as_ref()
        .and_then(|id| settings.vaults.iter().find(|v| &v.id == id))
        .map(|v| v.is_team_override.unwrap_or(is_team))
        .unwrap_or(is_team);
```

**Step 3: Add `is_team: effective_is_team` to the RepoStatus return value**

In the `Ok(RepoStatus { ... })` block, add the field:

```rust
    Ok(RepoStatus {
        repo_name,
        is_dirty,
        dirty_count,
        insertions,
        deletions,
        last_commit_hash,
        last_commit_message,
        last_commit_date,
        last_commit_author,
        is_team: effective_is_team,
    })
```

**Step 4: Verify it compiles**

Run: `cd /Users/simon/tetronomis/gitnotes && cargo check --manifest-path src-tauri/Cargo.toml`
Expected: compiles with no errors

**Step 5: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: detect team brain via unique committer emails"
```

---

### Task 3: Update frontend types and conditionally show author

**Files:**
- Modify: `src/git-status.ts:4-14` (RepoStatus interface)
- Modify: `src/git-status.ts:39-76` (renderStatus function)

**Step 1: Add `is_team` to RepoStatus interface**

```typescript
interface RepoStatus {
  repo_name: string;
  is_dirty: boolean;
  dirty_count: number;
  insertions: number;
  deletions: number;
  last_commit_hash: string | null;
  last_commit_message: string | null;
  last_commit_date: string | null;
  last_commit_author: string | null;
  is_team: boolean;
}
```

**Step 2: Show author conditionally in renderStatus()**

In the status text block (lines 58-75), update the clean-state branch to include author when `is_team`:

Replace the existing clean-state text (lines 64-70):
```typescript
    } else if (status.last_commit_date && status.last_commit_message) {
      // Show last commit info when clean
      const timeText = formatRelativeTime(status.last_commit_date);
      const msgText = status.last_commit_message.length > 20
        ? status.last_commit_message.slice(0, 20) + '...'
        : status.last_commit_message;
      statusText = status.is_team && status.last_commit_author
        ? `${timeText} · ${status.last_commit_author} · ${msgText}`
        : `${timeText} · ${msgText}`;
```

**Step 3: Verify with dev mode**

Run: `cd /Users/simon/tetronomis/gitnotes && npm run tauri dev`
Expected: App launches. Git status bar shows repo name + status. No author name visible (solo brain). If tested against a multi-author repo, author name appears.

**Step 4: Commit**

```bash
git add src/git-status.ts
git commit -m "feat: show commit author only in team brains"
```

---

### Task 4: Update frontend Vault type

**Files:**
- Modify: `src/settings.ts:14-18` (Vault interface)

**Step 1: Add fields to TypeScript Vault interface**

```typescript
interface Vault {
  id: string;
  name: string;
  path: string;
  is_team?: boolean | null;
  is_team_override?: boolean | null;
}
```

**Step 2: Commit**

```bash
git add src/settings.ts
git commit -m "feat: add is_team fields to frontend Vault type"
```

---

### Task 5: Add team override toggle in settings UI

**Files:**
- Modify: `index.html` (settings panel, add toggle)
- Modify: `src/settings.ts` (wire up toggle)
- Modify: `src/styles/main.css` (style for three-state toggle if needed)

**Step 1: Add toggle HTML to settings panel**

In `index.html`, find the git settings section (near auto-commit toggle). Add after the auto-commit row:

```html
<div class="setting-row">
  <div class="setting-label">
    <div class="setting-title">Team repository</div>
    <div class="setting-description">Show author names in commits and notes</div>
  </div>
  <select id="team-override-select" class="setting-select">
    <option value="auto">Auto</option>
    <option value="on">On</option>
    <option value="off">Off</option>
  </select>
</div>
```

**Step 2: Wire up the select in settings.ts**

In `loadSettingsData()`, after the auto-commit toggle update, add:

```typescript
    // Update team override select
    const teamSelect = document.getElementById('team-override-select') as HTMLSelectElement;
    if (teamSelect && currentSettings) {
      const activeVault = currentSettings.vaults.find(v => v.id === currentSettings!.active_vault)
        || currentSettings.vaults[0];
      if (activeVault) {
        if (activeVault.is_team_override === true) {
          teamSelect.value = 'on';
        } else if (activeVault.is_team_override === false) {
          teamSelect.value = 'off';
        } else {
          teamSelect.value = 'auto';
        }
      }
    }
```

In `initSettings()`, after the auto-commit toggle listener, add:

```typescript
  // Team override select
  const teamSelect = document.getElementById('team-override-select') as HTMLSelectElement;
  teamSelect?.addEventListener('change', async () => {
    if (!currentSettings) return;
    const value = teamSelect.value;
    const activeVault = currentSettings.vaults.find(v => v.id === currentSettings!.active_vault)
      || currentSettings.vaults[0];
    if (!activeVault) return;

    if (value === 'on') {
      activeVault.is_team_override = true;
    } else if (value === 'off') {
      activeVault.is_team_override = false;
    } else {
      activeVault.is_team_override = null;
    }

    await invoke('update_settings', { settings: currentSettings });
  });
```

**Step 3: Add minimal CSS for the select (if not already styled)**

In `src/styles/main.css`, add:

```css
.setting-select {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
}
```

**Step 4: Verify with dev mode**

Run: `cd /Users/simon/tetronomis/gitnotes && npm run tauri dev`
Expected: Settings modal shows "Team repository" select with Auto/On/Off. Changing it persists to settings.json. When set to "On", git status bar shows author name. When "Off" or "Auto" (solo), author is hidden.

**Step 5: Commit**

```bash
git add index.html src/settings.ts src/styles/main.css
git commit -m "feat: add team repository override in settings"
```

---

### Task 6: Squash into single feature commit

**Step 1: Squash commits**

```bash
git rebase -i HEAD~5
```

Squash all into one commit with message:

```
feat: detect team brains and conditionally show commit author
```

**Step 2: Verify final build**

Run: `cd /Users/simon/tetronomis/gitnotes && npm run tauri dev`
Expected: Full feature works end-to-end.
