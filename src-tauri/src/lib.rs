use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

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

#[tauri::command]
fn delete_page(path: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);

    if !file_path.exists() {
        return Err("Page not found".to_string());
    }

    trash::delete(&file_path).map_err(|e| e.to_string())
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
            delete_page,
            list_all_pages
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
