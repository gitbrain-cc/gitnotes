mod search;

use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Arc;
use serde::{Deserialize, Serialize};
use chrono::{Datelike, Local, DateTime, Utc};
use search::{SearchIndex, SearchResult as TantivySearchResult};

const PROTECTED_SECTIONS: &[&str] = &["1-todo", "1-weeks"];

#[derive(Debug, Serialize, Deserialize)]
pub struct Section {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Page {
    pub name: String,
    pub path: String,
    pub filename: String,
    pub created: u64,   // Unix timestamp
    pub modified: u64,  // Unix timestamp
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OrderConfig {
    #[serde(default)]
    pub sections: Vec<String>,
    #[serde(default)]
    pub pages: Vec<String>,
    #[serde(default = "default_sort")]
    pub sort: String,
    #[serde(default)]
    pub pinned: Vec<String>,
}

fn default_sort() -> String {
    "alpha-asc".to_string()
}

impl Default for OrderConfig {
    fn default() -> Self {
        OrderConfig {
            sections: vec![],
            pages: vec![],
            sort: default_sort(),
            pinned: vec![],
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct Frontmatter {
    #[serde(default)]
    created: Option<String>,
    #[serde(default)]
    modified: Option<String>,
    #[serde(flatten)]
    other: std::collections::HashMap<String, serde_yaml::Value>,
}

fn parse_frontmatter(content: &str) -> (Option<Frontmatter>, &str) {
    if !content.starts_with("---\n") {
        return (None, content);
    }

    if let Some(end) = content[4..].find("\n---") {
        let yaml_str = &content[4..4 + end];
        let body = &content[4 + end + 4..].trim_start_matches('\n');

        if let Ok(fm) = serde_yaml::from_str::<Frontmatter>(yaml_str) {
            return (Some(fm), body);
        }
    }

    (None, content)
}

fn format_frontmatter(fm: &Frontmatter) -> String {
    let mut lines = vec!["---".to_string()];

    if let Some(ref created) = fm.created {
        lines.push(format!("created: {}", created));
    }
    if let Some(ref modified) = fm.modified {
        lines.push(format!("modified: {}", modified));
    }

    // Add other fields
    for (key, value) in &fm.other {
        if let Ok(yaml) = serde_yaml::to_string(value) {
            let yaml = yaml.trim();
            if yaml.contains('\n') {
                lines.push(format!("{}: {}", key, yaml));
            } else {
                lines.push(format!("{}: {}", key, yaml));
            }
        }
    }

    lines.push("---".to_string());
    lines.join("\n")
}

fn iso_now() -> String {
    Utc::now().format("%Y-%m-%dT%H:%M:%S").to_string()
}

fn iso_to_timestamp(iso: &str) -> u64 {
    DateTime::parse_from_str(&format!("{}+00:00", iso), "%Y-%m-%dT%H:%M:%S%z")
        .or_else(|_| DateTime::parse_from_rfc3339(iso))
        .map(|dt| dt.timestamp() as u64)
        .unwrap_or(0)
}

struct AppState {
    search_index: Arc<SearchIndex>,
    notes_path: PathBuf,
}

fn get_notes_path() -> PathBuf {
    // TODO: Read from config file
    dirs::home_dir()
        .unwrap_or_default()
        .join("tetronomis/dotfiles/notes")
}

fn load_order_config(dir: &PathBuf) -> OrderConfig {
    let order_file = dir.join(".order.json");
    if order_file.exists() {
        if let Ok(content) = fs::read_to_string(&order_file) {
            if let Ok(config) = serde_json::from_str(&content) {
                return config;
            }
        }
    }
    OrderConfig::default()
}

fn save_order_config(dir: &PathBuf, config: &OrderConfig) -> Result<(), String> {
    let order_file = dir.join(".order.json");
    let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(&order_file, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_sort_preference(section_path: String) -> Result<String, String> {
    let path = PathBuf::from(&section_path);
    let config = load_order_config(&path);
    Ok(config.sort)
}

#[tauri::command]
fn set_sort_preference(section_path: String, sort: String) -> Result<(), String> {
    let path = PathBuf::from(&section_path);
    let mut config = load_order_config(&path);
    config.sort = sort;
    save_order_config(&path, &config)
}

#[tauri::command]
fn list_sections() -> Result<Vec<Section>, String> {
    let notes_path = get_notes_path();

    if !notes_path.exists() {
        return Err(format!("Notes directory not found: {:?}", notes_path));
    }

    let order_config = load_order_config(&notes_path);

    let mut sections: Vec<Section> = fs::read_dir(&notes_path)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            if path.is_dir() && !entry.file_name().to_string_lossy().starts_with('.') {
                Some(Section {
                    name: entry.file_name().to_string_lossy().to_string(),
                    path: path.to_string_lossy().to_string(),
                })
            } else {
                None
            }
        })
        .collect();

    // Sort by order config or alphabetically
    if !order_config.sections.is_empty() {
        sections.sort_by(|a, b| {
            let a_idx = order_config.sections.iter().position(|x| x == &a.name);
            let b_idx = order_config.sections.iter().position(|x| x == &b.name);
            match (a_idx, b_idx) {
                (Some(ai), Some(bi)) => ai.cmp(&bi),
                (Some(_), None) => std::cmp::Ordering::Less,
                (None, Some(_)) => std::cmp::Ordering::Greater,
                (None, None) => a.name.cmp(&b.name),
            }
        });
    } else {
        sections.sort_by(|a, b| a.name.cmp(&b.name));
    }

    Ok(sections)
}

#[tauri::command]
fn list_pages(section_path: String) -> Result<Vec<Page>, String> {
    let path = PathBuf::from(&section_path);

    if !path.exists() {
        return Err(format!("Section not found: {}", section_path));
    }

    let order_config = load_order_config(&path);

    let mut pages: Vec<Page> = fs::read_dir(&path)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            let filename = entry.file_name().to_string_lossy().to_string();

            if path.is_file() && filename.ends_with(".md") && !filename.starts_with('.') {
                // Try frontmatter first, fall back to filesystem
                let (created, modified) = if let Ok(content) = fs::read_to_string(&path) {
                    let (fm, _) = parse_frontmatter(&content);
                    let fm_created = fm.as_ref().and_then(|f| f.created.as_ref()).map(|s| iso_to_timestamp(s));
                    let fm_modified = fm.as_ref().and_then(|f| f.modified.as_ref()).map(|s| iso_to_timestamp(s));

                    // Fall back to filesystem if frontmatter missing
                    let metadata = fs::metadata(&path).ok();
                    let fs_created = metadata.as_ref()
                        .and_then(|m| m.created().ok())
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs())
                        .unwrap_or(0);
                    let fs_modified = metadata.as_ref()
                        .and_then(|m| m.modified().ok())
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs())
                        .unwrap_or(0);

                    (fm_created.unwrap_or(fs_created), fm_modified.unwrap_or(fs_modified))
                } else {
                    (0, 0)
                };

                Some(Page {
                    name: filename.trim_end_matches(".md").to_string(),
                    path: path.to_string_lossy().to_string(),
                    filename,
                    created,
                    modified,
                })
            } else {
                None
            }
        })
        .collect();

    // Sort by preference
    match order_config.sort.as_str() {
        "alpha-desc" | "name-desc" => pages.sort_by(|a, b| b.name.to_lowercase().cmp(&a.name.to_lowercase())),
        "created-asc" => pages.sort_by(|a, b| a.created.cmp(&b.created)),
        "created-desc" => pages.sort_by(|a, b| b.created.cmp(&a.created)),
        "modified-asc" => pages.sort_by(|a, b| a.modified.cmp(&b.modified)),
        "modified-desc" => pages.sort_by(|a, b| b.modified.cmp(&a.modified)),
        "manual" if !order_config.pages.is_empty() => {
            pages.sort_by(|a, b| {
                let a_idx = order_config.pages.iter().position(|x| x == &a.filename);
                let b_idx = order_config.pages.iter().position(|x| x == &b.filename);
                match (a_idx, b_idx) {
                    (Some(ai), Some(bi)) => ai.cmp(&bi),
                    (Some(_), None) => std::cmp::Ordering::Less,
                    (None, Some(_)) => std::cmp::Ordering::Greater,
                    (None, None) => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
                }
            });
        }
        _ => pages.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase())), // alpha-asc default
    }

    // Move pinned to top
    if !order_config.pinned.is_empty() {
        pages.sort_by(|a, b| {
            let a_pinned = order_config.pinned.contains(&a.filename);
            let b_pinned = order_config.pinned.contains(&b.filename);
            match (a_pinned, b_pinned) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => std::cmp::Ordering::Equal,
            }
        });
    }

    Ok(pages)
}

#[tauri::command]
fn read_page(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_page(path: String, content: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);
    let now = iso_now();

    // Parse frontmatter from incoming content
    let (existing_fm, body) = parse_frontmatter(&content);

    // Get existing frontmatter from file if incoming doesn't have one
    let old_fm = if existing_fm.is_none() && file_path.exists() {
        fs::read_to_string(&file_path)
            .ok()
            .and_then(|old_content| parse_frontmatter(&old_content).0)
    } else {
        None
    };

    // Merge frontmatter: prefer existing, update modified
    let mut fm = existing_fm.or(old_fm).unwrap_or_default();
    if fm.created.is_none() {
        fm.created = Some(now.clone());
    }
    fm.modified = Some(now);

    // Write with updated frontmatter
    let final_content = format!("{}\n\n{}", format_frontmatter(&fm), body);
    fs::write(&path, final_content).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_page(section_path: String, name: String) -> Result<Page, String> {
    let filename = format!("{}.md", name);
    let path = PathBuf::from(&section_path).join(&filename);

    if path.exists() {
        return Err("Page already exists".to_string());
    }

    let now_iso = iso_now();
    let now_ts = iso_to_timestamp(&now_iso);

    let fm = Frontmatter {
        created: Some(now_iso.clone()),
        modified: Some(now_iso),
        other: std::collections::HashMap::new(),
    };

    let content = format!("{}\n\n# {}\n\n", format_frontmatter(&fm), name);
    fs::write(&path, content).map_err(|e| e.to_string())?;

    Ok(Page {
        name,
        path: path.to_string_lossy().to_string(),
        filename,
        created: now_ts,
        modified: now_ts,
    })
}

fn get_week_name() -> String {
    let now = Local::now();
    format!("{}-{:02}", now.year(), now.iso_week().week())
}

#[tauri::command]
fn create_page_smart(section_path: String) -> Result<Page, String> {
    let path = PathBuf::from(&section_path);
    let section_name = path.file_name()
        .ok_or("Invalid path")?
        .to_string_lossy()
        .to_lowercase();

    let base_name = if section_name == "1-weeks" {
        get_week_name()
    } else {
        "Untitled".to_string()
    };

    // Find unique name if exists
    let mut name = base_name.clone();
    let mut counter = 1;
    loop {
        let filename = format!("{}.md", name);
        let file_path = path.join(&filename);
        if !file_path.exists() {
            break;
        }
        counter += 1;
        name = format!("{} {}", base_name, counter);
    }

    let filename = format!("{}.md", name);
    let file_path = path.join(&filename);

    let now_iso = iso_now();
    let now_ts = iso_to_timestamp(&now_iso);

    let fm = Frontmatter {
        created: Some(now_iso.clone()),
        modified: Some(now_iso),
        other: std::collections::HashMap::new(),
    };

    let content = format!("{}\n\n# {}\n\n", format_frontmatter(&fm), name);
    fs::write(&file_path, content).map_err(|e| e.to_string())?;

    Ok(Page {
        name,
        path: file_path.to_string_lossy().to_string(),
        filename,
        created: now_ts,
        modified: now_ts,
    })
}

#[tauri::command]
fn delete_page(path: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);

    if !file_path.exists() {
        return Err("Page not found".to_string());
    }

    trash::delete(&file_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_page(old_path: String, new_name: String) -> Result<Page, String> {
    let old_file = PathBuf::from(&old_path);

    if !old_file.exists() {
        return Err("Page not found".to_string());
    }

    // Validate name - no filesystem-invalid chars
    let invalid_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
    if new_name.chars().any(|c| invalid_chars.contains(&c)) {
        return Err("Invalid characters in name".to_string());
    }

    let parent = old_file.parent().ok_or("Invalid path")?;
    let new_filename = format!("{}.md", new_name);
    let new_path = parent.join(&new_filename);

    if new_path.exists() {
        return Err("A page with that name already exists".to_string());
    }

    // Get timestamps before rename
    let metadata = fs::metadata(&old_file).ok();
    let created = metadata.as_ref()
        .and_then(|m| m.created().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    fs::rename(&old_file, &new_path).map_err(|e| e.to_string())?;

    let modified = fs::metadata(&new_path).ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    Ok(Page {
        name: new_name,
        path: new_path.to_string_lossy().to_string(),
        filename: new_filename,
        created,
        modified,
    })
}

#[tauri::command]
fn move_page(path: String, new_section_path: String) -> Result<Page, String> {
    let old_file = PathBuf::from(&path);

    if !old_file.exists() {
        return Err("Page not found".to_string());
    }

    let filename = old_file.file_name()
        .ok_or("Invalid filename")?
        .to_string_lossy()
        .to_string();

    let new_path = PathBuf::from(&new_section_path).join(&filename);

    if new_path.exists() {
        return Err("A page with that name already exists in the target section".to_string());
    }

    // Get timestamps before move
    let metadata = fs::metadata(&old_file).ok();
    let created = metadata.as_ref()
        .and_then(|m| m.created().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    fs::rename(&old_file, &new_path).map_err(|e| e.to_string())?;

    let modified = fs::metadata(&new_path).ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    Ok(Page {
        name: filename.trim_end_matches(".md").to_string(),
        path: new_path.to_string_lossy().to_string(),
        filename,
        created,
        modified,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub name: String,
    pub path: String,
    pub section: String,
}

#[tauri::command]
fn list_all_pages() -> Result<Vec<SearchResult>, String> {
    let notes_path = get_notes_path();

    if !notes_path.exists() {
        return Err(format!("Notes directory not found: {:?}", notes_path));
    }

    let mut results: Vec<SearchResult> = Vec::new();

    let sections = fs::read_dir(&notes_path).map_err(|e| e.to_string())?;

    for section_entry in sections.filter_map(|e| e.ok()) {
        let section_path = section_entry.path();
        if !section_path.is_dir() {
            continue;
        }

        let section_name = section_entry.file_name().to_string_lossy().to_string();
        if section_name.starts_with('.') {
            continue;
        }

        if let Ok(pages) = fs::read_dir(&section_path) {
            for page_entry in pages.filter_map(|e| e.ok()) {
                let page_path = page_entry.path();
                let filename = page_entry.file_name().to_string_lossy().to_string();

                if page_path.is_file() && filename.ends_with(".md") && !filename.starts_with('.') {
                    results.push(SearchResult {
                        name: filename.trim_end_matches(".md").to_string(),
                        path: page_path.to_string_lossy().to_string(),
                        section: section_name.clone(),
                    });
                }
            }
        }
    }

    results.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(results)
}

#[tauri::command]
fn create_section(name: String) -> Result<Section, String> {
    let invalid_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
    if name.chars().any(|c| invalid_chars.contains(&c)) {
        return Err("Invalid characters in name".to_string());
    }

    let notes_path = get_notes_path();
    let section_path = notes_path.join(&name);

    if section_path.exists() {
        return Err("Section already exists".to_string());
    }

    fs::create_dir(&section_path).map_err(|e| e.to_string())?;

    Ok(Section {
        name,
        path: section_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn rename_section(path: String, new_name: String) -> Result<Section, String> {
    let old_dir = PathBuf::from(&path);

    if !old_dir.exists() {
        return Err("Section not found".to_string());
    }

    let old_name = old_dir.file_name()
        .ok_or("Invalid path")?
        .to_string_lossy()
        .to_lowercase();

    if PROTECTED_SECTIONS.contains(&old_name.as_str()) {
        return Err("This section cannot be renamed".to_string());
    }

    let invalid_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
    if new_name.chars().any(|c| invalid_chars.contains(&c)) {
        return Err("Invalid characters in name".to_string());
    }

    let parent = old_dir.parent().ok_or("Invalid path")?;
    let new_path = parent.join(&new_name);

    if new_path.exists() {
        return Err("A section with that name already exists".to_string());
    }

    fs::rename(&old_dir, &new_path).map_err(|e| e.to_string())?;

    Ok(Section {
        name: new_name,
        path: new_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn delete_section(path: String) -> Result<(), String> {
    let dir_path = PathBuf::from(&path);

    if !dir_path.exists() {
        return Err("Section not found".to_string());
    }

    let name = dir_path.file_name()
        .ok_or("Invalid path")?
        .to_string_lossy()
        .to_lowercase();

    if PROTECTED_SECTIONS.contains(&name.as_str()) {
        return Err("This section cannot be deleted".to_string());
    }

    trash::delete(&dir_path).map_err(|e| e.to_string())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileMetadata {
    pub created: Option<String>,
}

#[tauri::command]
fn get_file_metadata(path: String) -> Result<FileMetadata, String> {
    let file_path = PathBuf::from(&path);

    if !file_path.exists() {
        return Ok(FileMetadata { created: None });
    }

    let metadata = fs::metadata(&file_path).map_err(|e| e.to_string())?;

    let created = metadata.created().ok().map(|time| {
        let datetime: DateTime<Utc> = time.into();
        datetime.format("%Y-%m-%dT%H:%M:%S").to_string()
    });

    Ok(FileMetadata { created })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitInfo {
    pub last_commit_date: Option<String>,
    pub last_commit_author: Option<String>,
    pub is_dirty: bool,
    pub is_tracked: bool,
    pub is_git_repo: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RepoStatus {
    pub repo_name: String,
    pub is_dirty: bool,
    pub dirty_count: u32,
    pub last_commit_hash: Option<String>,
    pub last_commit_message: Option<String>,
    pub last_commit_date: Option<String>,
    pub last_commit_author: Option<String>,
}

#[tauri::command]
fn get_git_info(path: String) -> Result<GitInfo, String> {
    let file_path = PathBuf::from(&path);
    let parent = file_path.parent().unwrap_or(&file_path);

    // Check if in a git repo
    let repo_check = Command::new("git")
        .args(["rev-parse", "--git-dir"])
        .current_dir(parent)
        .output();

    let is_git_repo = repo_check.map(|o| o.status.success()).unwrap_or(false);

    if !is_git_repo {
        return Ok(GitInfo {
            last_commit_date: None,
            last_commit_author: None,
            is_dirty: false,
            is_tracked: false,
            is_git_repo: false,
        });
    }

    // Check if file is tracked
    let tracked_check = Command::new("git")
        .args(["ls-files", &path])
        .current_dir(parent)
        .output();

    let is_tracked = tracked_check
        .map(|o| o.status.success() && !o.stdout.is_empty())
        .unwrap_or(false);

    // Check if file has uncommitted changes
    let dirty_check = Command::new("git")
        .args(["diff", "--name-only", &path])
        .current_dir(parent)
        .output();

    let staged_check = Command::new("git")
        .args(["diff", "--cached", "--name-only", &path])
        .current_dir(parent)
        .output();

    let is_dirty = dirty_check.map(|o| !o.stdout.is_empty()).unwrap_or(false)
        || staged_check.map(|o| !o.stdout.is_empty()).unwrap_or(false)
        || !is_tracked;

    // Get last commit info
    let log_output = Command::new("git")
        .args(["log", "-1", "--format=%aI|%an", "--", &path])
        .current_dir(parent)
        .output();

    let (last_commit_date, last_commit_author) = match log_output {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let parts: Vec<&str> = stdout.trim().split('|').collect();
            if parts.len() == 2 {
                (Some(parts[0].to_string()), Some(parts[1].to_string()))
            } else {
                (None, None)
            }
        }
        _ => (None, None),
    };

    Ok(GitInfo {
        last_commit_date,
        last_commit_author,
        is_dirty,
        is_tracked,
        is_git_repo,
    })
}

#[tauri::command]
fn search_notes(query: String, state: tauri::State<AppState>) -> Result<Vec<TantivySearchResult>, String> {
    if query.len() < 3 {
        // For short queries, return empty - frontend handles filename matching
        return Ok(vec![]);
    }
    state.search_index.search(&query, 20)
}

#[tauri::command]
fn git_commit(path: String, message: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);
    let parent = file_path.parent().unwrap_or(&file_path);

    // Add the file
    let add_result = Command::new("git")
        .args(["add", &path])
        .current_dir(parent)
        .output()
        .map_err(|e| e.to_string())?;

    if !add_result.status.success() {
        return Err(String::from_utf8_lossy(&add_result.stderr).to_string());
    }

    // Commit
    let commit_result = Command::new("git")
        .args(["commit", "-m", &message, "--", &path])
        .current_dir(parent)
        .output()
        .map_err(|e| e.to_string())?;

    if !commit_result.status.success() {
        let stderr = String::from_utf8_lossy(&commit_result.stderr);
        // "nothing to commit" is not an error for us
        if !stderr.contains("nothing to commit") {
            return Err(stderr.to_string());
        }
    }

    Ok(())
}

#[tauri::command]
fn get_repo_status() -> Result<RepoStatus, String> {
    let notes_path = get_notes_path();

    // Get repo name from remote or folder name
    let repo_name = Command::new("git")
        .args(["remote", "get-url", "origin"])
        .current_dir(&notes_path)
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                let url = String::from_utf8_lossy(&o.stdout).trim().to_string();
                // Extract repo name from URL (e.g., "repo.git" -> "repo")
                url.split('/').last()
                    .map(|s| s.trim_end_matches(".git").to_string())
            } else {
                None
            }
        })
        .unwrap_or_else(|| {
            notes_path.file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| "notes".to_string())
        });

    // Check dirty status (count of uncommitted files)
    let status_output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&notes_path)
        .output()
        .map_err(|e| e.to_string())?;

    let dirty_count = if status_output.status.success() {
        String::from_utf8_lossy(&status_output.stdout)
            .lines()
            .count() as u32
    } else {
        0
    };

    let is_dirty = dirty_count > 0;

    // Get last commit info
    let log_output = Command::new("git")
        .args(["log", "-1", "--format=%H|%s|%aI|%an"])
        .current_dir(&notes_path)
        .output();

    let (last_commit_hash, last_commit_message, last_commit_date, last_commit_author) = match log_output {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let parts: Vec<&str> = stdout.trim().split('|').collect();
            if parts.len() == 4 {
                (
                    Some(parts[0].chars().take(7).collect()), // Short hash (safe)
                    Some(parts[1].to_string()),
                    Some(parts[2].to_string()),
                    Some(parts[3].to_string()),
                )
            } else {
                (None, None, None, None)
            }
        }
        _ => (None, None, None, None),
    };

    Ok(RepoStatus {
        repo_name,
        is_dirty,
        dirty_count,
        last_commit_hash,
        last_commit_message,
        last_commit_date,
        last_commit_author,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitLogEntry {
    pub hash: String,
    pub message: String,
    pub date: String,
    pub author: String,
    pub is_head: bool,
    pub insertions: u32,
    pub deletions: u32,
}

#[tauri::command]
fn get_git_log(limit: Option<u32>) -> Result<Vec<GitLogEntry>, String> {
    let notes_path = get_notes_path();
    let limit = limit.unwrap_or(50);

    // Get current HEAD hash
    let head_output = Command::new("git")
        .args(["rev-parse", "HEAD"])
        .current_dir(&notes_path)
        .output();

    let head_hash = head_output
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());

    // Get log entries with shortstat
    let log_output = Command::new("git")
        .args([
            "log",
            &format!("-{}", limit),
            "--format=COMMIT|%H|%s|%aI|%an",
            "--shortstat",
        ])
        .current_dir(&notes_path)
        .output()
        .map_err(|e| e.to_string())?;

    if !log_output.status.success() {
        return Err("Failed to get git log".to_string());
    }

    let output = String::from_utf8_lossy(&log_output.stdout);
    let mut entries: Vec<GitLogEntry> = Vec::new();
    let mut current_entry: Option<(String, String, String, String, String)> = None;

    for line in output.lines() {
        if line.starts_with("COMMIT|") {
            // Save previous entry if exists
            if let Some((hash, message, date, author, full_hash)) = current_entry.take() {
                let is_head = head_hash.as_ref().map(|h| h == &full_hash).unwrap_or(false);
                entries.push(GitLogEntry {
                    hash,
                    message,
                    date,
                    author,
                    is_head,
                    insertions: 0,
                    deletions: 0,
                });
            }
            // Parse new entry
            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() == 5 {
                let full_hash = parts[1].to_string();
                current_entry = Some((
                    full_hash.chars().take(7).collect(),
                    parts[2].to_string(),
                    parts[3].to_string(),
                    parts[4].to_string(),
                    full_hash,
                ));
            }
        } else if !line.trim().is_empty() {
            // Parse shortstat line: " 3 files changed, 10 insertions(+), 5 deletions(-)"
            if current_entry.is_some() {
                let mut insertions = 0u32;
                let mut deletions = 0u32;
                for part in line.split(',') {
                    let part = part.trim();
                    if part.contains("insertion") {
                        if let Some(num) = part.split_whitespace().next() {
                            insertions = num.parse::<u32>().unwrap_or(0);
                        }
                    } else if part.contains("deletion") {
                        if let Some(num) = part.split_whitespace().next() {
                            deletions = num.parse::<u32>().unwrap_or(0);
                        }
                    }
                }
                if let Some((hash, message, date, author, full_hash)) = current_entry.take() {
                    let is_head = head_hash.as_ref().map(|h| h == &full_hash).unwrap_or(false);
                    entries.push(GitLogEntry {
                        hash,
                        message,
                        date,
                        author,
                        is_head,
                        insertions,
                        deletions,
                    });
                }
            }
        }
    }

    // Don't forget the last entry if it had no stat line
    if let Some((hash, message, date, author, full_hash)) = current_entry {
        let is_head = head_hash.as_ref().map(|h| h == &full_hash).unwrap_or(false);
        entries.push(GitLogEntry {
            hash,
            message,
            date,
            author,
            is_head,
            insertions: 0,
            deletions: 0,
        });
    }

    Ok(entries)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RepoStats {
    pub total_commits: u32,
    pub first_commit_date: Option<String>,
    pub current_branch: Option<String>,
    pub branch_count: u32,
}

#[tauri::command]
fn get_repo_stats() -> Result<RepoStats, String> {
    let notes_path = get_notes_path();

    // Get total commit count
    let count_output = Command::new("git")
        .args(["rev-list", "--count", "HEAD"])
        .current_dir(&notes_path)
        .output();

    let total_commits = count_output
        .ok()
        .filter(|o| o.status.success())
        .map(|o| {
            String::from_utf8_lossy(&o.stdout)
                .trim()
                .parse::<u32>()
                .unwrap_or(0)
        })
        .unwrap_or(0);

    // Get first commit date (repo age) - find root commit first
    let root_commit = Command::new("git")
        .args(["rev-list", "--max-parents=0", "HEAD"])
        .current_dir(&notes_path)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).lines().next().unwrap_or("").to_string())
        .filter(|s| !s.is_empty());

    let first_commit_date = root_commit.and_then(|hash| {
        Command::new("git")
            .args(["log", "-1", "--format=%aI", &hash])
            .current_dir(&notes_path)
            .output()
            .ok()
            .filter(|o| o.status.success())
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .filter(|s| !s.is_empty())
    });

    // Get current branch
    let branch_output = Command::new("git")
        .args(["branch", "--show-current"])
        .current_dir(&notes_path)
        .output();

    let current_branch = branch_output
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty());

    // Get branch count
    let branches_output = Command::new("git")
        .args(["branch", "--list"])
        .current_dir(&notes_path)
        .output();

    let branch_count = branches_output
        .ok()
        .filter(|o| o.status.success())
        .map(|o| {
            String::from_utf8_lossy(&o.stdout)
                .lines()
                .filter(|l| !l.trim().is_empty())
                .count() as u32
        })
        .unwrap_or(0);

    Ok(RepoStats {
        total_commits,
        first_commit_date,
        current_branch,
        branch_count,
    })
}

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
    SearchIndex::start_watcher(Arc::clone(&search_index), notes_path.clone())
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
            create_page_smart,
            delete_page,
            rename_page,
            move_page,
            list_all_pages,
            create_section,
            rename_section,
            delete_section,
            get_file_metadata,
            get_git_info,
            git_commit,
            search_notes,
            get_repo_status,
            get_git_log,
            get_repo_stats,
            get_sort_preference,
            set_sort_preference,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
