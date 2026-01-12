use std::fs;
use std::path::PathBuf;
use std::process::Command;
use serde::{Deserialize, Serialize};
use chrono::{Datelike, Local, DateTime, Utc};

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
    "name-asc".to_string()
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
                Some(Page {
                    name: filename.trim_end_matches(".md").to_string(),
                    path: path.to_string_lossy().to_string(),
                    filename: filename,
                })
            } else {
                None
            }
        })
        .collect();

    // Sort by order config
    match order_config.sort.as_str() {
        "name-desc" => pages.sort_by(|a, b| b.name.cmp(&a.name)),
        "manual" if !order_config.pages.is_empty() => {
            pages.sort_by(|a, b| {
                let a_idx = order_config.pages.iter().position(|x| x == &a.filename);
                let b_idx = order_config.pages.iter().position(|x| x == &b.filename);
                match (a_idx, b_idx) {
                    (Some(ai), Some(bi)) => ai.cmp(&bi),
                    (Some(_), None) => std::cmp::Ordering::Less,
                    (None, Some(_)) => std::cmp::Ordering::Greater,
                    (None, None) => a.name.cmp(&b.name),
                }
            });
        }
        _ => pages.sort_by(|a, b| a.name.cmp(&b.name)), // name-asc default
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
    fs::write(&path, &content).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_page(section_path: String, name: String) -> Result<Page, String> {
    let filename = format!("{}.md", name);
    let path = PathBuf::from(&section_path).join(&filename);

    if path.exists() {
        return Err("Page already exists".to_string());
    }

    fs::write(&path, format!("# {}\n\n", name)).map_err(|e| e.to_string())?;

    Ok(Page {
        name,
        path: path.to_string_lossy().to_string(),
        filename,
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

    fs::write(&file_path, format!("# {}\n\n", name)).map_err(|e| e.to_string())?;

    Ok(Page {
        name,
        path: file_path.to_string_lossy().to_string(),
        filename,
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

    fs::rename(&old_file, &new_path).map_err(|e| e.to_string())?;

    Ok(Page {
        name: new_name,
        path: new_path.to_string_lossy().to_string(),
        filename: new_filename,
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

    fs::rename(&old_file, &new_path).map_err(|e| e.to_string())?;

    Ok(Page {
        name: filename.trim_end_matches(".md").to_string(),
        path: new_path.to_string_lossy().to_string(),
        filename,
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
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
            git_commit
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
