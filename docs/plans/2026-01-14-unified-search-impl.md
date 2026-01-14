# Unified Search Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Quick Switcher modal with a unified top search bar combining filename navigation and full-text content search.

**Architecture:** Tantivy index in Rust backend for full-text search, file watcher for live updates. Frontend dropdown with recent files, recent searches, and search results. Queries under 3 chars use in-memory filename matching; 3+ chars query Tantivy.

**Tech Stack:** Tantivy 0.22 (full-text search), notify 6 (file watcher), Tauri IPC

---

### Task 1: Add Rust Dependencies

**Files:**
- Modify: `src-tauri/Cargo.toml`

**Step 1: Add tantivy and notify**

Add to `[dependencies]` section:

```toml
tantivy = "0.22"
notify = "6"
notify-debouncer-mini = "0.4"
```

**Step 2: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: Compiles successfully (may take a while to download deps)

**Step 3: Commit**

```bash
git add src-tauri/Cargo.toml
git commit -m "$(cat <<'EOF'
chore: add tantivy and notify dependencies

For full-text search indexing and file watching
EOF
)"
```

---

### Task 2: Create Search Module Skeleton

**Files:**
- Create: `src-tauri/src/search.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: Create search.rs with types and placeholder functions**

```rust
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tantivy::collector::TopDocs;
use tantivy::query::QueryParser;
use tantivy::schema::*;
use tantivy::{Index, IndexReader, IndexWriter, TantivyDocument, ReloadPolicy};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub path: String,
    pub filename: String,
    pub section: String,
    pub snippet: Option<String>,
    pub match_line: Option<usize>,
}

pub struct SearchIndex {
    index: Index,
    reader: IndexReader,
    writer: Mutex<IndexWriter>,
    schema: Schema,
    // Field handles
    path_field: Field,
    filename_field: Field,
    section_field: Field,
    content_field: Field,
}

impl SearchIndex {
    pub fn new(index_path: &PathBuf, notes_path: &PathBuf) -> Result<Self, String> {
        // TODO: Implement in Task 3
        todo!()
    }

    pub fn search(&self, query: &str, limit: usize) -> Result<Vec<SearchResult>, String> {
        // TODO: Implement in Task 4
        todo!()
    }

    pub fn index_file(&self, path: &PathBuf) -> Result<(), String> {
        // TODO: Implement in Task 3
        todo!()
    }

    pub fn remove_file(&self, path: &PathBuf) -> Result<(), String> {
        // TODO: Implement in Task 3
        todo!()
    }
}
```

**Step 2: Add module to lib.rs**

At the top of `src-tauri/src/lib.rs`, add:

```rust
mod search;
```

**Step 3: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: Compiles (with warnings about unused imports and todo)

**Step 4: Commit**

```bash
git add src-tauri/src/search.rs src-tauri/src/lib.rs
git commit -m "$(cat <<'EOF'
feat: add search module skeleton

Types and placeholder functions for Tantivy integration
EOF
)"
```

---

### Task 3: Implement Tantivy Indexing

**Files:**
- Modify: `src-tauri/src/search.rs`

**Step 1: Implement SearchIndex::new**

Replace the `new` function:

```rust
impl SearchIndex {
    pub fn new(index_path: &PathBuf, notes_path: &PathBuf) -> Result<Self, String> {
        // Build schema
        let mut schema_builder = Schema::builder();
        let path_field = schema_builder.add_text_field("path", STRING | STORED);
        let filename_field = schema_builder.add_text_field("filename", TEXT | STORED);
        let section_field = schema_builder.add_text_field("section", TEXT | STORED);
        let content_field = schema_builder.add_text_field("content", TEXT | STORED);
        let schema = schema_builder.build();

        // Create or open index
        std::fs::create_dir_all(index_path).map_err(|e| e.to_string())?;

        let index = Index::create_in_dir(index_path, schema.clone())
            .or_else(|_| Index::open_in_dir(index_path))
            .map_err(|e| e.to_string())?;

        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()
            .map_err(|e: tantivy::TantivyError| e.to_string())?;

        let writer = index.writer(50_000_000).map_err(|e| e.to_string())?;

        let search_index = Self {
            index,
            reader,
            writer: Mutex::new(writer),
            schema,
            path_field,
            filename_field,
            section_field,
            content_field,
        };

        // Initial indexing of all files
        search_index.index_all_files(notes_path)?;

        Ok(search_index)
    }

    fn index_all_files(&self, notes_path: &PathBuf) -> Result<(), String> {
        let mut writer = self.writer.lock().map_err(|e| e.to_string())?;

        // Clear existing index
        writer.delete_all_documents().map_err(|e| e.to_string())?;

        // Walk directory and index all .md files
        if notes_path.exists() {
            self.index_directory_recursive(&mut writer, notes_path, notes_path)?;
        }

        writer.commit().map_err(|e| e.to_string())?;
        Ok(())
    }

    fn index_directory_recursive(
        &self,
        writer: &mut IndexWriter,
        dir: &PathBuf,
        notes_root: &PathBuf,
    ) -> Result<(), String> {
        let entries = std::fs::read_dir(dir).map_err(|e| e.to_string())?;

        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();

            if path.is_dir() {
                // Skip hidden directories
                if !path.file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.starts_with('.'))
                    .unwrap_or(false)
                {
                    self.index_directory_recursive(writer, &path, notes_root)?;
                }
            } else if path.extension().map(|e| e == "md").unwrap_or(false) {
                self.add_file_to_index(writer, &path, notes_root)?;
            }
        }
        Ok(())
    }

    fn add_file_to_index(
        &self,
        writer: &mut IndexWriter,
        path: &PathBuf,
        notes_root: &PathBuf,
    ) -> Result<(), String> {
        let content = std::fs::read_to_string(path).map_err(|e| e.to_string())?;

        let filename = path
            .file_stem()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        let section = path
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        let path_str = path.to_string_lossy().to_string();

        let mut doc = TantivyDocument::new();
        doc.add_text(self.path_field, &path_str);
        doc.add_text(self.filename_field, &filename);
        doc.add_text(self.section_field, &section);
        doc.add_text(self.content_field, &content);

        writer.add_document(doc).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn index_file(&self, path: &PathBuf, notes_root: &PathBuf) -> Result<(), String> {
        let mut writer = self.writer.lock().map_err(|e| e.to_string())?;

        // Remove old version first
        let path_str = path.to_string_lossy().to_string();
        let term = tantivy::Term::from_field_text(self.path_field, &path_str);
        writer.delete_term(term);

        // Add new version
        self.add_file_to_index(&mut writer, path, notes_root)?;
        writer.commit().map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn remove_file(&self, path: &PathBuf) -> Result<(), String> {
        let mut writer = self.writer.lock().map_err(|e| e.to_string())?;
        let path_str = path.to_string_lossy().to_string();
        let term = tantivy::Term::from_field_text(self.path_field, &path_str);
        writer.delete_term(term);
        writer.commit().map_err(|e| e.to_string())?;
        Ok(())
    }
}
```

**Step 2: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: Compiles (warning about unused `search` function)

**Step 3: Commit**

```bash
git add src-tauri/src/search.rs
git commit -m "$(cat <<'EOF'
feat: implement Tantivy index creation and file indexing

Full-text indexing of markdown files with path, filename, section, content
EOF
)"
```

---

### Task 4: Implement Search Query

**Files:**
- Modify: `src-tauri/src/search.rs`

**Step 1: Implement search function**

Replace the `search` placeholder:

```rust
pub fn search(&self, query: &str, limit: usize) -> Result<Vec<SearchResult>, String> {
    let searcher = self.reader.searcher();

    let query_parser = QueryParser::for_index(&self.index, vec![self.filename_field, self.content_field]);

    let parsed_query = query_parser
        .parse_query(query)
        .map_err(|e| e.to_string())?;

    let top_docs = searcher
        .search(&parsed_query, &TopDocs::with_limit(limit))
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();

    for (_score, doc_address) in top_docs {
        let doc: TantivyDocument = searcher.doc(doc_address).map_err(|e| e.to_string())?;

        let path = doc
            .get_first(self.path_field)
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let filename = doc
            .get_first(self.filename_field)
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let section = doc
            .get_first(self.section_field)
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let content = doc
            .get_first(self.content_field)
            .and_then(|v| v.as_str())
            .unwrap_or("");

        // Generate snippet around first match
        let (snippet, match_line) = self.generate_snippet(content, query);

        results.push(SearchResult {
            path,
            filename,
            section,
            snippet,
            match_line,
        });
    }

    Ok(results)
}

fn generate_snippet(&self, content: &str, query: &str) -> (Option<String>, Option<usize>) {
    let query_lower = query.to_lowercase();
    let content_lower = content.to_lowercase();

    if let Some(pos) = content_lower.find(&query_lower) {
        // Find line number
        let line_num = content[..pos].matches('\n').count();

        // Extract snippet: ~40 chars before, match, ~40 chars after
        let start = content[..pos]
            .char_indices()
            .rev()
            .nth(40)
            .map(|(i, _)| i)
            .unwrap_or(0);

        let end_offset = pos + query.len();
        let end = content[end_offset..]
            .char_indices()
            .nth(40)
            .map(|(i, _)| end_offset + i)
            .unwrap_or(content.len());

        let mut snippet = String::new();
        if start > 0 {
            snippet.push_str("...");
        }
        snippet.push_str(content[start..end].trim());
        if end < content.len() {
            snippet.push_str("...");
        }

        // Clean up newlines
        let snippet = snippet.replace('\n', " ").replace("  ", " ");

        (Some(snippet), Some(line_num))
    } else {
        (None, None)
    }
}
```

**Step 2: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: Compiles successfully

**Step 3: Commit**

```bash
git add src-tauri/src/search.rs
git commit -m "$(cat <<'EOF'
feat: implement search query with snippet generation

Queries both filename and content fields, returns snippets with match line
EOF
)"
```

---

### Task 5: Implement File Watcher

**Files:**
- Modify: `src-tauri/src/search.rs`

**Step 1: Add file watcher function**

Add these imports at the top of search.rs:

```rust
use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use std::sync::Arc;
use std::time::Duration;
```

Add this function to the impl block:

```rust
pub fn start_watcher(
    search_index: Arc<SearchIndex>,
    notes_path: PathBuf,
) -> Result<(), String> {
    let notes_path_clone = notes_path.clone();

    std::thread::spawn(move || {
        let (tx, rx) = std::sync::mpsc::channel();

        let mut debouncer = new_debouncer(Duration::from_millis(500), tx)
            .expect("Failed to create debouncer");

        debouncer
            .watcher()
            .watch(&notes_path, notify::RecursiveMode::Recursive)
            .expect("Failed to watch directory");

        for result in rx {
            match result {
                Ok(events) => {
                    for event in events {
                        let path = event.path;

                        // Only handle .md files
                        if !path.extension().map(|e| e == "md").unwrap_or(false) {
                            continue;
                        }

                        match event.kind {
                            DebouncedEventKind::Any => {
                                if path.exists() {
                                    let _ = search_index.index_file(&path, &notes_path_clone);
                                } else {
                                    let _ = search_index.remove_file(&path);
                                }
                            }
                            _ => {}
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Watch error: {:?}", e);
                }
            }
        }
    });

    Ok(())
}
```

**Step 2: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: Compiles successfully

**Step 3: Commit**

```bash
git add src-tauri/src/search.rs
git commit -m "$(cat <<'EOF'
feat: add file watcher for live index updates

Debounced watcher updates index on file changes
EOF
)"
```

---

### Task 6: Wire Up Tauri Commands

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add search state and commands**

Add these imports near the top of lib.rs:

```rust
use std::sync::Arc;
use search::{SearchIndex, SearchResult};
```

Add this struct and commands (before the `run()` function):

```rust
struct AppState {
    search_index: Arc<SearchIndex>,
    notes_path: PathBuf,
}

#[tauri::command]
fn search_notes(query: String, state: tauri::State<AppState>) -> Result<Vec<SearchResult>, String> {
    if query.len() < 3 {
        // For short queries, return empty - frontend handles filename matching
        return Ok(vec![]);
    }
    state.search_index.search(&query, 20)
}

#[tauri::command]
fn rebuild_search_index(state: tauri::State<AppState>) -> Result<(), String> {
    // Force rebuild by creating a new index
    // For now, this is a no-op since we rebuild on startup
    Ok(())
}
```

**Step 2: Update the run function to initialize search**

Find the `pub fn run()` function and update it:

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let notes_path = get_notes_path();

    // Initialize search index
    let index_path = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("noteone")
        .join("search-index");

    let search_index = Arc::new(
        SearchIndex::new(&index_path, &notes_path)
            .expect("Failed to create search index")
    );

    // Start file watcher
    search::SearchIndex::start_watcher(Arc::clone(&search_index), notes_path.clone())
        .expect("Failed to start file watcher");

    let app_state = AppState {
        search_index,
        notes_path,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            list_sections,
            list_pages,
            read_page,
            write_page,
            create_page,
            rename_page,
            delete_page,
            move_page,
            create_section,
            rename_section,
            delete_section,
            list_all_pages,
            get_file_metadata,
            get_git_info,
            git_commit,
            search_notes,
            rebuild_search_index,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 3: Verify compilation**

Run: `cd src-tauri && cargo build`
Expected: Compiles successfully

**Step 4: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "$(cat <<'EOF'
feat: wire up search Tauri commands

Initialize search index on startup, expose search_notes command
EOF
)"
```

---

### Task 7: Update HTML Layout

**Files:**
- Modify: `index.html`

**Step 1: Replace quick-switcher with search bar**

Replace the entire content of `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NoteOne</title>
  <link rel="stylesheet" href="/src/styles/main.css">
</head>
<body>
  <div id="search-container">
    <input type="text" id="search-input" placeholder="Search files and content...">
    <div id="search-dropdown">
      <section id="recent-files-section" class="search-section">
        <div class="search-section-header">Recent Files</div>
        <ul id="recent-files-list"></ul>
      </section>
      <section id="recent-searches-section" class="search-section">
        <div class="search-section-header">Recent Searches</div>
        <ul id="recent-searches-list"></ul>
      </section>
      <section id="search-results-section" class="search-section">
        <ul id="search-results-list"></ul>
      </section>
    </div>
  </div>

  <div id="app">
    <aside id="sections" class="sidebar">
      <div class="sidebar-header">Sections</div>
      <ul id="sections-list"></ul>
      <div class="sidebar-footer">
        <button id="add-section-btn" class="sidebar-add-btn">+ Add section</button>
      </div>
    </aside>
    <aside id="pages" class="sidebar">
      <div class="sidebar-header">Pages</div>
      <ul id="pages-list"></ul>
      <div class="sidebar-footer">
        <button id="add-page-btn" class="sidebar-add-btn">+ Add page</button>
      </div>
    </aside>
    <main id="editor-container">
      <div id="note-header"></div>
      <div id="editor"></div>
    </main>
  </div>
  <footer id="status-bar">
    <span id="status-text">Ready</span>
    <span id="word-count"></span>
  </footer>

  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

**Step 2: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: replace quick-switcher modal with search bar

Top search bar with dropdown for recent files, searches, and results
EOF
)"
```

---

### Task 8: Create Search Bar Frontend

**Files:**
- Create: `src/search-bar.ts`

**Step 1: Create the search bar module**

```typescript
import { invoke } from '@tauri-apps/api/core';

interface SearchResult {
  path: string;
  filename: string;
  section: string;
  snippet: string | null;
  match_line: number | null;
}

interface PageInfo {
  name: string;
  path: string;
  section: string;
}

// State
let isOpen = false;
let selectedIndex = 0;
let currentResults: (SearchResult | PageInfo)[] = [];
let allPages: PageInfo[] = [];
let recentFiles: string[] = [];
let recentSearches: string[] = [];
let onSelectCallback: ((result: SearchResult | PageInfo, matchLine?: number) => void) | null = null;

const MAX_RECENT_FILES = 8;
const MAX_RECENT_SEARCHES = 5;
const MIN_CONTENT_SEARCH_LENGTH = 3;

// LocalStorage keys
const RECENT_FILES_KEY = 'noteone_recent_files';
const RECENT_SEARCHES_KEY = 'noteone_recent_searches';

export async function loadAllPages(): Promise<void> {
  allPages = await invoke('list_all_pages');
}

export function addRecentFile(path: string): void {
  recentFiles = recentFiles.filter(p => p !== path);
  recentFiles.unshift(path);
  recentFiles = recentFiles.slice(0, MAX_RECENT_FILES);
  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(recentFiles));
}

function addRecentSearch(query: string): void {
  if (query.length < MIN_CONTENT_SEARCH_LENGTH) return;
  recentSearches = recentSearches.filter(q => q !== query);
  recentSearches.unshift(query);
  recentSearches = recentSearches.slice(0, MAX_RECENT_SEARCHES);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recentSearches));
}

function loadRecentData(): void {
  try {
    const files = localStorage.getItem(RECENT_FILES_KEY);
    const searches = localStorage.getItem(RECENT_SEARCHES_KEY);
    recentFiles = files ? JSON.parse(files) : [];
    recentSearches = searches ? JSON.parse(searches) : [];
  } catch {
    recentFiles = [];
    recentSearches = [];
  }
}

function fuzzyMatch(query: string, text: string): boolean {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();
  if (lowerQuery.length === 0) return true;
  let queryIndex = 0;
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      queryIndex++;
    }
  }
  return queryIndex === lowerQuery.length;
}

function filterByFilename(query: string): PageInfo[] {
  if (!query) return [];
  return allPages
    .filter(page => fuzzyMatch(query, page.name) || fuzzyMatch(query, page.section))
    .slice(0, 10);
}

async function searchContent(query: string): Promise<SearchResult[]> {
  if (query.length < MIN_CONTENT_SEARCH_LENGTH) return [];
  try {
    return await invoke('search_notes', { query });
  } catch (e) {
    console.error('Search error:', e);
    return [];
  }
}

function getRecentFilesAsPages(): PageInfo[] {
  return recentFiles
    .map(path => allPages.find(p => p.path === path))
    .filter((p): p is PageInfo => p !== undefined);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function highlightMatch(text: string, query: string): string {
  if (!query || query.length < MIN_CONTENT_SEARCH_LENGTH) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const regex = new RegExp(`(${escapeHtml(query)})`, 'gi');
  return escaped.replace(regex, '<mark>$1</mark>');
}

function renderDropdown(query: string): void {
  const recentFilesSection = document.getElementById('recent-files-section');
  const recentSearchesSection = document.getElementById('recent-searches-section');
  const resultsSection = document.getElementById('search-results-section');
  const recentFilesList = document.getElementById('recent-files-list');
  const recentSearchesList = document.getElementById('recent-searches-list');
  const resultsList = document.getElementById('search-results-list');

  if (!recentFilesSection || !recentSearchesSection || !resultsSection) return;
  if (!recentFilesList || !recentSearchesList || !resultsList) return;

  // Clear all
  recentFilesList.innerHTML = '';
  recentSearchesList.innerHTML = '';
  resultsList.innerHTML = '';

  if (!query) {
    // Show recent files and searches
    recentFilesSection.style.display = recentFiles.length ? 'block' : 'none';
    recentSearchesSection.style.display = recentSearches.length ? 'block' : 'none';
    resultsSection.style.display = 'none';

    const recentPages = getRecentFilesAsPages();
    currentResults = recentPages;

    recentPages.forEach((page, i) => {
      const li = document.createElement('li');
      li.className = i === selectedIndex ? 'selected' : '';
      li.innerHTML = `
        <span class="result-filename">${escapeHtml(page.name)}</span>
        <span class="result-section">${escapeHtml(page.section)}</span>
      `;
      li.addEventListener('click', () => selectResult(i));
      recentFilesList.appendChild(li);
    });

    recentSearches.forEach((search, i) => {
      const li = document.createElement('li');
      li.className = 'recent-search-item';
      li.innerHTML = `<span class="search-icon">🔍</span> ${escapeHtml(search)}`;
      li.addEventListener('click', () => {
        const input = document.getElementById('search-input') as HTMLInputElement;
        if (input) {
          input.value = search;
          input.dispatchEvent(new Event('input'));
        }
      });
      recentSearchesList.appendChild(li);
    });
  } else {
    // Show search results
    recentFilesSection.style.display = 'none';
    recentSearchesSection.style.display = 'none';
    resultsSection.style.display = 'block';

    currentResults.forEach((result, i) => {
      const li = document.createElement('li');
      li.className = i === selectedIndex ? 'selected' : '';

      if ('snippet' in result && result.snippet) {
        // Content match
        li.innerHTML = `
          <div class="result-header">
            <span class="result-section">${escapeHtml(result.section)}</span>
            <span class="result-separator">/</span>
            <span class="result-filename">${escapeHtml(result.filename)}</span>
          </div>
          <div class="result-snippet">${highlightMatch(result.snippet, query)}</div>
        `;
      } else {
        // Filename match
        const page = result as PageInfo;
        li.innerHTML = `
          <div class="result-header">
            <span class="result-section">${escapeHtml(page.section)}</span>
            <span class="result-separator">/</span>
            <span class="result-filename">${escapeHtml(page.name)}</span>
          </div>
        `;
      }

      li.addEventListener('click', () => selectResult(i));
      resultsList.appendChild(li);
    });

    if (currentResults.length === 0) {
      resultsList.innerHTML = '<li class="no-results">No results found</li>';
    }
  }
}

function selectResult(index: number): void {
  if (index < 0 || index >= currentResults.length) return;

  const result = currentResults[index];
  const input = document.getElementById('search-input') as HTMLInputElement;
  const query = input?.value || '';

  // Add to recent searches if content search
  if (query.length >= MIN_CONTENT_SEARCH_LENGTH) {
    addRecentSearch(query);
  }

  closeSearchBar();

  if (onSelectCallback) {
    if ('match_line' in result) {
      onSelectCallback(result, result.match_line ?? undefined);
    } else {
      onSelectCallback(result);
    }
  }
}

function scrollToSelected(): void {
  const selected = document.querySelector('#search-dropdown .selected') as HTMLElement;
  selected?.scrollIntoView({ block: 'nearest' });
}

export function openSearchBar(onSelect: (result: SearchResult | PageInfo, matchLine?: number) => void): void {
  onSelectCallback = onSelect;
  isOpen = true;
  selectedIndex = 0;
  currentResults = getRecentFilesAsPages();

  const container = document.getElementById('search-container');
  const dropdown = document.getElementById('search-dropdown');
  const input = document.getElementById('search-input') as HTMLInputElement;

  if (container && dropdown && input) {
    container.classList.add('focused');
    dropdown.classList.add('visible');
    input.value = '';
    input.focus();
    renderDropdown('');
  }
}

export function closeSearchBar(): void {
  isOpen = false;
  onSelectCallback = null;

  const container = document.getElementById('search-container');
  const dropdown = document.getElementById('search-dropdown');

  if (container && dropdown) {
    container.classList.remove('focused');
    dropdown.classList.remove('visible');
  }
}

export function isSearchBarOpen(): boolean {
  return isOpen;
}

export function initSearchBar(): void {
  loadRecentData();

  const input = document.getElementById('search-input') as HTMLInputElement;
  const container = document.getElementById('search-container');
  if (!input || !container) return;

  let searchTimeout: number | null = null;

  input.addEventListener('input', async () => {
    const query = input.value.trim();
    selectedIndex = 0;

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (query.length < MIN_CONTENT_SEARCH_LENGTH) {
      // Immediate filename filtering
      currentResults = filterByFilename(query);
      renderDropdown(query);
    } else {
      // Debounced content search
      searchTimeout = window.setTimeout(async () => {
        const filenameMatches = filterByFilename(query);
        const contentMatches = await searchContent(query);

        // Combine: filename matches first, then content matches (deduplicated)
        const seenPaths = new Set(filenameMatches.map(p => p.path));
        const uniqueContentMatches = contentMatches.filter(r => !seenPaths.has(r.path));

        currentResults = [...filenameMatches, ...uniqueContentMatches];
        renderDropdown(query);
      }, 150);
    }
  });

  input.addEventListener('focus', () => {
    if (!isOpen) {
      // Don't auto-open, wait for explicit open
    }
  });

  input.addEventListener('keydown', (e) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
        renderDropdown(input.value.trim());
        scrollToSelected();
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        renderDropdown(input.value.trim());
        scrollToSelected();
        break;
      case 'Enter':
        e.preventDefault();
        selectResult(selectedIndex);
        break;
      case 'Escape':
        e.preventDefault();
        closeSearchBar();
        break;
    }
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (isOpen && !container.contains(e.target as Node)) {
      closeSearchBar();
    }
  });
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run build`
Expected: Compiles (may have errors from main.ts imports - we'll fix next)

**Step 3: Commit**

```bash
git add src/search-bar.ts
git commit -m "$(cat <<'EOF'
feat: add search-bar.ts frontend module

Dropdown with recent files, recent searches, combined filename/content search
EOF
)"
```

---

### Task 9: Update main.ts

**Files:**
- Modify: `src/main.ts`

**Step 1: Replace quick switcher imports with search bar**

At the top of the file, replace:
```typescript
import { initQuickSwitcher, openQuickSwitcher, loadAllPages, closeQuickSwitcher, isQuickSwitcherOpen } from './search';
```

With:
```typescript
import { initSearchBar, openSearchBar, loadAllPages, closeSearchBar, isSearchBarOpen, addRecentFile } from './search-bar';
```

**Step 2: Update handleQuickSwitcherSelect function**

Replace:
```typescript
function handleQuickSwitcherSelect(result: { name: string; path: string; section: string }) {
  navigateToPath(result.path, result.section);
}
```

With:
```typescript
function handleSearchSelect(result: { path: string; section?: string }, matchLine?: number) {
  const section = result.section || result.path.split('/').slice(-2, -1)[0] || '';
  navigateToPath(result.path, section, matchLine);
}
```

**Step 3: Update setupKeyboardShortcuts**

Replace the Cmd+P handler:
```typescript
// Cmd+P: Quick switcher
if (e.metaKey && e.key === 'p') {
  e.preventDefault();
  if (!isQuickSwitcherOpen()) {
    openQuickSwitcher(handleQuickSwitcherSelect);
  }
}
```

With:
```typescript
// Cmd+P or Cmd+Shift+F: Search bar
if (e.metaKey && (e.key === 'p' || (e.shiftKey && e.key === 'f'))) {
  e.preventDefault();
  if (!isSearchBarOpen()) {
    openSearchBar(handleSearchSelect);
  }
}
```

Replace the Escape handler:
```typescript
// Esc: Close modals
if (e.key === 'Escape') {
  if (isQuickSwitcherOpen()) {
    closeQuickSwitcher();
  }
}
```

With:
```typescript
// Esc: Close search
if (e.key === 'Escape') {
  if (isSearchBarOpen()) {
    closeSearchBar();
  }
}
```

**Step 4: Update init function**

Replace:
```typescript
initEditor();
initQuickSwitcher();
```

With:
```typescript
initEditor();
initSearchBar();
```

**Step 5: Add recent file tracking to loadPageWithHeader**

At the end of `loadPageWithHeader`, add:
```typescript
// Track as recent file
addRecentFile(page.path);
```

**Step 6: Update navigateToPath in sidebar.ts to accept matchLine**

In `src/sidebar.ts`, find the `navigateToPath` export and update its signature. This may require reading the file first.

**Step 7: Verify compilation**

Run: `npm run build`
Expected: Compiles successfully

**Step 8: Commit**

```bash
git add src/main.ts
git commit -m "$(cat <<'EOF'
feat: switch from quick-switcher to search bar

Update imports, keyboard shortcuts, and add recent file tracking
EOF
)"
```

---

### Task 10: Add Search Bar Styles

**Files:**
- Modify: `src/styles/main.css`

**Step 1: Add search bar CSS**

Add these styles to `main.css` (replace the existing `#quick-switcher-*` styles if any):

```css
/* Search Bar */
#search-container {
  position: relative;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  padding: 8px 12px;
}

#search-input {
  width: 100%;
  padding: 8px 12px;
  font-size: 14px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  outline: none;
}

#search-input:focus {
  border-color: var(--accent-color);
}

#search-input::placeholder {
  color: var(--text-secondary);
}

#search-dropdown {
  display: none;
  position: absolute;
  top: 100%;
  left: 12px;
  right: 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-height: 400px;
  overflow-y: auto;
  z-index: 1000;
}

#search-dropdown.visible {
  display: block;
}

.search-section {
  padding: 8px 0;
}

.search-section:not(:last-child) {
  border-bottom: 1px solid var(--border-color);
}

.search-section-header {
  padding: 4px 12px 8px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
}

#search-dropdown ul {
  list-style: none;
}

#search-dropdown li {
  padding: 8px 12px;
  cursor: pointer;
}

#search-dropdown li:hover,
#search-dropdown li.selected {
  background: var(--bg-tertiary);
}

#search-dropdown li.no-results {
  color: var(--text-secondary);
  cursor: default;
}

#search-dropdown li.no-results:hover {
  background: transparent;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 4px;
}

.result-filename {
  font-weight: 500;
  color: var(--text-primary);
}

.result-section {
  font-size: 12px;
  color: var(--text-secondary);
}

.result-separator {
  color: var(--text-secondary);
  font-size: 12px;
}

.result-snippet {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-snippet mark {
  background: var(--accent-color);
  color: var(--bg-primary);
  padding: 0 2px;
  border-radius: 2px;
}

.recent-search-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.search-icon {
  font-size: 12px;
  opacity: 0.6;
}
```

**Step 2: Update #app layout**

Find the `#app` rule and update it to account for the search bar:

```css
#app {
  display: flex;
  height: calc(100% - 24px - 49px); /* status bar + search bar */
}
```

**Step 3: Remove old quick-switcher styles**

Delete any existing `#quick-switcher-*` CSS rules.

**Step 4: Commit**

```bash
git add src/styles/main.css
git commit -m "$(cat <<'EOF'
feat: add search bar styles

Dropdown styling with sections, results, snippets, and highlights
EOF
)"
```

---

### Task 11: Delete Old Quick Switcher

**Files:**
- Delete: `src/search.ts`

**Step 1: Remove the file**

```bash
rm src/search.ts
```

**Step 2: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: remove old quick-switcher module

Replaced by unified search-bar.ts
EOF
)"
```

---

### Task 12: Update sidebar.ts for Match Line Navigation

**Files:**
- Modify: `src/sidebar.ts`

**Step 1: Update navigateToPath to accept matchLine parameter**

Find the `navigateToPath` function and update its signature:

```typescript
export async function navigateToPath(pagePath: string, sectionName: string, matchLine?: number): Promise<void>
```

The function should pass `matchLine` to `loadPageWithHeader` or scroll to the line after loading.

**Step 2: Update loadPageWithHeader in main.ts to scroll to match**

After loading content, if `matchLine` is provided, scroll the editor to that line.

**Step 3: Test manually**

Run: `npm run tauri dev`
- Press Cmd+P to open search bar
- Type a 3+ character query
- Verify content results appear
- Click a result and verify it navigates to the match

**Step 4: Commit**

```bash
git add src/sidebar.ts src/main.ts
git commit -m "$(cat <<'EOF'
feat: scroll to match line when selecting search result
EOF
)"
```

---

### Task 13: Final Polish and Test

**Step 1: Full manual test**

- Start app: `npm run tauri dev`
- Test filename search (< 3 chars)
- Test content search (≥ 3 chars)
- Test keyboard navigation (up/down/enter/escape)
- Test recent files (open a few files, reopen search)
- Test recent searches (search something, reopen search)
- Test clicking outside to close
- Test Cmd+P and Cmd+Shift+F both work

**Step 2: Fix any issues found**

**Step 3: Final commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: unified search bar complete

Full-text search with Tantivy, file watching, recent files/searches
EOF
)"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Add Rust dependencies (tantivy, notify) |
| 2 | Create search module skeleton |
| 3 | Implement Tantivy indexing |
| 4 | Implement search query |
| 5 | Implement file watcher |
| 6 | Wire up Tauri commands |
| 7 | Update HTML layout |
| 8 | Create search-bar.ts frontend |
| 9 | Update main.ts |
| 10 | Add search bar styles |
| 11 | Delete old quick-switcher |
| 12 | Add match line navigation |
| 13 | Final polish and test |
