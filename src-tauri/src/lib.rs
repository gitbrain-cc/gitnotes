mod search;

use chrono::{DateTime, Datelike, Local, Utc};
use search::{SearchIndex, SearchResult as TantivySearchResult};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;

const PROTECTED_SECTIONS: &[&str] = &["1-todo", "1-weeks"];

#[derive(Debug, Serialize, Deserialize)]
pub struct Section {
    pub name: String,
    pub path: String,
    pub title: Option<String>,
    pub color: Option<String>,
    pub section_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct SectionMetadata {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default = "default_sort")]
    pub sort: String,
    #[serde(default)]
    pub pinned: Vec<String>,
    #[serde(default)]
    pub order: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_note: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent_instructions: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "type")]
    pub section_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Note {
    pub name: String,
    pub path: String,
    pub filename: String,
    pub created: u64,  // Unix timestamp
    pub modified: u64, // Unix timestamp
    pub subfolder: Option<String>,
    // Rolodex contact fields (populated only for type: rolodex sections)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_company: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_role: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub imported: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_call: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Whisper {
    pub character: String,
    pub path: String,
    pub generated: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LabeledValue {
    pub label: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContactData {
    pub title: Option<String>,
    pub company: Option<String>,
    pub role: Option<String>,
    pub emails: Vec<LabeledValue>,
    pub phones: Vec<LabeledValue>,
    pub birthday: Option<String>,
    pub addresses: Vec<LabeledValue>,
    pub social: Vec<LabeledValue>,
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
pub struct GitNotesConfig {
    #[serde(default, rename = "sectionOrder")]
    pub section_order: Vec<String>,
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

#[derive(Debug, Serialize, Clone)]
pub struct VaultStats {
    pub vault_id: String,
    pub section_count: u32,
    pub note_count: u32,
    pub last_modified: Option<String>,
    pub is_git_repo: bool,
    pub git_branch: Option<String>,
    pub git_provider: Option<String>,
    pub git_repo: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitSettings {
    #[serde(default = "default_auto_commit")]
    pub auto_commit: bool,
    // Keep old fields for migration, marked skip_serializing
    #[serde(default, skip_serializing)]
    pub commit_mode: Option<String>,
    #[serde(default, skip_serializing)]
    pub commit_interval: Option<u32>,
}

fn default_auto_commit() -> bool {
    true
}

impl Default for GitSettings {
    fn default() -> Self {
        GitSettings {
            auto_commit: default_auto_commit(),
            commit_mode: None,
            commit_interval: None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppearanceSettings {
    #[serde(default = "default_theme")]
    pub theme: String,
}

fn default_theme() -> String {
    "original".to_string()
}

impl Default for AppearanceSettings {
    fn default() -> Self {
        AppearanceSettings {
            theme: default_theme(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EditorSettings {
    #[serde(default = "default_font_size")]
    pub font_size: u8,
    #[serde(default = "default_font_family")]
    pub font_family: String,
    #[serde(default = "default_line_wrapping")]
    pub line_wrapping: bool,
    #[serde(default = "default_tab_size")]
    pub tab_size: u8,
    #[serde(default = "default_use_tabs")]
    pub use_tabs: bool,
    #[serde(default = "default_cursor_style")]
    pub cursor_style: String,
    #[serde(default = "default_cursor_blink")]
    pub cursor_blink: bool,
}

fn default_font_size() -> u8 { 16 }
fn default_font_family() -> String { "system".to_string() }
fn default_line_wrapping() -> bool { true }
fn default_tab_size() -> u8 { 2 }
fn default_use_tabs() -> bool { false }
fn default_cursor_style() -> String { "block".to_string() }
fn default_cursor_blink() -> bool { true }

impl Default for EditorSettings {
    fn default() -> Self {
        EditorSettings {
            font_size: default_font_size(),
            font_family: default_font_family(),
            line_wrapping: default_line_wrapping(),
            tab_size: default_tab_size(),
            use_tabs: default_use_tabs(),
            cursor_style: default_cursor_style(),
            cursor_blink: default_cursor_blink(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LastSession {
    pub section: String,
    pub note: String,
    pub cursor_pos: usize,
    pub scroll_top: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub vaults: Vec<Vault>,
    #[serde(default)]
    pub active_vault: Option<String>,
    #[serde(default)]
    pub git: GitSettings,
    #[serde(default)]
    pub appearance: AppearanceSettings,
    #[serde(default)]
    pub editor: EditorSettings,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_session: Option<LastSession>,
}

fn get_config_dir_name() -> &'static str {
    if cfg!(debug_assertions) { "gitnotes-dev" } else { "gitnotes" }
}

fn get_settings_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_default())
        .join(get_config_dir_name())
        .join("settings.json")
}

fn load_settings() -> Settings {
    let path = get_settings_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(mut settings) = serde_json::from_str::<Settings>(&content) {
                // Migrate old commit_mode to auto_commit
                if let Some(ref mode) = settings.git.commit_mode {
                    settings.git.auto_commit = mode != "manual";
                    settings.git.commit_mode = None;
                    settings.git.commit_interval = None;
                    // Save migrated settings
                    let _ = save_settings(&settings);
                }
                return settings;
            }
        }
    }
    // Return empty settings for onboarding flow
    Settings {
        vaults: vec![],
        active_vault: None,
        git: GitSettings::default(),
        appearance: AppearanceSettings::default(),
        editor: EditorSettings::default(),
        last_session: None,
    }
}

fn save_settings(settings: &Settings) -> Result<(), String> {
    let path = get_settings_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

fn generate_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!("{:x}", duration.as_millis())
}

/// Parse repository name from a git URL
/// Handles: git@github.com:user/repo.git, ssh://git@github.com/user/repo.git, https://...
fn parse_repo_name(url: &str) -> Option<String> {
    let url = url.trim();

    // Extract last path component
    let name = if url.contains(':') && !url.starts_with("ssh://") && !url.starts_with("http") {
        // git@github.com:user/repo.git format
        url.split(':').last()?.split('/').last()?
    } else {
        // ssh://git@github.com/user/repo.git or https:// URL format
        url.split('/').last()?
    };

    // Remove .git suffix
    let name = name.strip_suffix(".git").unwrap_or(name);

    if name.is_empty() {
        None
    } else {
        Some(name.to_string())
    }
}

/// Parse git remote URL and return (provider, repo)
/// Handles: git@github.com:user/repo.git, https://github.com/user/repo.git
fn parse_git_remote(url: &str) -> Option<(String, String)> {
    let url = url.trim();

    // SSH format: git@github.com:user/repo.git
    if let Some(rest) = url.strip_prefix("git@") {
        let parts: Vec<&str> = rest.splitn(2, ':').collect();
        if parts.len() == 2 {
            let provider = parts[0].to_string();
            let repo = parts[1].trim_end_matches(".git").to_string();
            return Some((provider, repo));
        }
    }

    // HTTPS format: https://github.com/user/repo.git
    if url.starts_with("https://") || url.starts_with("http://") {
        if let Some(rest) = url
            .strip_prefix("https://")
            .or_else(|| url.strip_prefix("http://"))
        {
            let parts: Vec<&str> = rest.splitn(2, '/').collect();
            if parts.len() == 2 {
                let provider = parts[0].to_string();
                let repo = parts[1].trim_end_matches(".git").to_string();
                return Some((provider, repo));
            }
        }
    }

    None
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

fn load_section_metadata(section_path: &PathBuf) -> SectionMetadata {
    let metadata_file = section_path.join(".section.md");
    let order_file = section_path.join(".order.json");

    // Try loading from .section.md first
    let mut metadata = if metadata_file.exists() {
        if let Ok(content) = fs::read_to_string(&metadata_file) {
            if content.starts_with("---\n") {
                if let Some(end) = content[4..].find("\n---") {
                    let yaml_str = &content[4..4 + end];
                    serde_yaml::from_str::<SectionMetadata>(yaml_str).unwrap_or_default()
                } else {
                    SectionMetadata::default()
                }
            } else {
                SectionMetadata::default()
            }
        } else {
            SectionMetadata::default()
        }
    } else {
        SectionMetadata::default()
    };

    // Migrate from legacy .order.json if it exists
    if order_file.exists() {
        if let Ok(content) = fs::read_to_string(&order_file) {
            if let Ok(legacy) = serde_json::from_str::<OrderConfig>(&content) {
                // Only migrate if .section.md doesn't have these values yet
                if metadata.sort == default_sort() && legacy.sort != default_sort() {
                    metadata.sort = legacy.sort;
                }
                if metadata.pinned.is_empty() && !legacy.pinned.is_empty() {
                    metadata.pinned = legacy.pinned;
                }
                if metadata.order.is_empty() && !legacy.pages.is_empty() {
                    metadata.order = legacy.pages;
                }
                // Save migrated data to .section.md and remove old file
                if save_section_metadata(section_path, &metadata).is_ok() {
                    let _ = fs::remove_file(&order_file);
                }
            }
        }
    }

    metadata
}

fn save_section_metadata(section_path: &PathBuf, metadata: &SectionMetadata) -> Result<(), String> {
    let metadata_file = section_path.join(".section.md");

    let mut lines = vec!["---".to_string()];

    // Write fields only if they have non-default values
    if let Some(ref title) = metadata.title {
        lines.push(format!("title: \"{}\"", title));
    }
    if let Some(ref color) = metadata.color {
        lines.push(format!("color: \"{}\"", color));
    }
    if !metadata.sort.is_empty() && metadata.sort != default_sort() {
        lines.push(format!("sort: {}", metadata.sort));
    }
    if !metadata.pinned.is_empty() {
        lines.push("pinned:".to_string());
        for item in &metadata.pinned {
            lines.push(format!("  - {}", item));
        }
    }
    if !metadata.order.is_empty() {
        lines.push("order:".to_string());
        for item in &metadata.order {
            lines.push(format!("  - {}", item));
        }
    }
    if let Some(ref last_note) = metadata.last_note {
        lines.push(format!("last_note: \"{}\"", last_note));
    }
    if let Some(ref instructions) = metadata.agent_instructions {
        lines.push("agent_instructions: |".to_string());
        for line in instructions.lines() {
            if line.is_empty() {
                lines.push(String::new());
            } else {
                lines.push(format!("  {}", line));
            }
        }
    }
    if let Some(ref section_type) = metadata.section_type {
        lines.push(format!("type: {}", section_type));
    }

    lines.push("---".to_string());

    let content = lines.join("\n");
    fs::write(&metadata_file, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_section_metadata(
    section_path: String,
    title: Option<String>,
    color: Option<String>,
) -> Result<(), String> {
    let path = PathBuf::from(&section_path);
    // Load existing metadata to preserve sort/pinned/order fields
    let mut metadata = load_section_metadata(&path);
    metadata.title = title;
    metadata.color = color;
    save_section_metadata(&path, &metadata)
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
}

fn get_notes_path() -> PathBuf {
    let settings = load_settings();

    // Find active vault, or use first vault, or fall back to default
    let vault_path = settings
        .active_vault
        .and_then(|id| settings.vaults.iter().find(|v| v.id == id))
        .or_else(|| settings.vaults.first())
        .map(|v| v.path.clone());

    match vault_path {
        Some(p) => PathBuf::from(p),
        None => dirs::home_dir().unwrap_or_default().join("Documents/Notes"),
    }
}

fn load_gitnotes_config(vault_path: &PathBuf) -> GitNotesConfig {
    let config_file = vault_path.join(".gitnotes");
    if config_file.exists() {
        if let Ok(content) = fs::read_to_string(&config_file) {
            if let Ok(config) = serde_json::from_str(&content) {
                return config;
            }
        }
    }
    GitNotesConfig::default()
}

#[tauri::command]
fn save_section_order(order: Vec<String>) -> Result<(), String> {
    let vault_path = get_notes_path();
    let config_file = vault_path.join(".gitnotes");

    // Load existing config to preserve other fields
    let mut config = load_gitnotes_config(&vault_path);
    config.section_order = order;

    let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&config_file, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_sort_preference(section_path: String) -> Result<String, String> {
    let path = PathBuf::from(&section_path);
    let metadata = load_section_metadata(&path);
    Ok(metadata.sort)
}

#[tauri::command]
fn set_sort_preference(section_path: String, sort: String) -> Result<(), String> {
    let path = PathBuf::from(&section_path);
    let mut metadata = load_section_metadata(&path);
    metadata.sort = sort;
    save_section_metadata(&path, &metadata)
}

#[tauri::command]
fn get_last_note(section_path: String) -> Result<Option<String>, String> {
    let path = PathBuf::from(&section_path);
    let metadata = load_section_metadata(&path);
    Ok(metadata.last_note)
}

#[tauri::command]
fn set_last_note(section_path: String, note_path: String) -> Result<(), String> {
    let path = PathBuf::from(&section_path);
    let mut metadata = load_section_metadata(&path);
    // Only save if changed to avoid unnecessary YAML reformatting
    if metadata.last_note.as_ref() != Some(&note_path) {
        metadata.last_note = Some(note_path);
        save_section_metadata(&path, &metadata)
    } else {
        Ok(())
    }
}

#[tauri::command]
fn list_sections() -> Result<Vec<Section>, String> {
    let notes_path = get_notes_path();

    if !notes_path.exists() {
        return Err(format!("Notes directory not found: {:?}", notes_path));
    }

    let gitnotes_config = load_gitnotes_config(&notes_path);

    let mut sections: Vec<Section> = fs::read_dir(&notes_path)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            if path.is_dir() && !entry.file_name().to_string_lossy().starts_with('.') {
                let metadata = load_section_metadata(&path);
                Some(Section {
                    name: entry.file_name().to_string_lossy().to_string(),
                    path: path.to_string_lossy().to_string(),
                    title: metadata.title,
                    color: metadata.color,
                    section_type: metadata.section_type.clone(),
                })
            } else {
                None
            }
        })
        .collect();

    // Sort by .gitnotes sectionOrder or alphabetically
    if !gitnotes_config.section_order.is_empty() {
        sections.sort_by(|a, b| {
            let a_idx = gitnotes_config
                .section_order
                .iter()
                .position(|x| x == &a.name);
            let b_idx = gitnotes_config
                .section_order
                .iter()
                .position(|x| x == &b.name);
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

fn collect_notes_from_dir(dir: &PathBuf, subfolder: Option<String>, section_type: Option<&str>) -> Vec<Note> {
    let is_rolodex = section_type == Some("rolodex");

    fs::read_dir(dir)
        .ok()
        .into_iter()
        .flatten()
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            let filename = entry.file_name().to_string_lossy().to_string();

            if path.is_file() && filename.ends_with(".md") && !filename.starts_with('.') {
                // Try frontmatter first, fall back to filesystem
                let (created, modified, contact_title, contact_company, contact_role, contact_email, imported, last_call) =
                    if let Ok(content) = fs::read_to_string(&path) {
                        let (fm, _) = parse_frontmatter(&content);
                        let fm_created = fm
                            .as_ref()
                            .and_then(|f| f.created.as_ref())
                            .map(|s| iso_to_timestamp(s));
                        let fm_modified = fm
                            .as_ref()
                            .and_then(|f| f.modified.as_ref())
                            .map(|s| iso_to_timestamp(s));

                        // Fall back to filesystem if frontmatter missing
                        let metadata = fs::metadata(&path).ok();
                        let fs_created = metadata
                            .as_ref()
                            .and_then(|m| m.created().ok())
                            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                            .map(|d| d.as_secs())
                            .unwrap_or(0);
                        let fs_modified = metadata
                            .as_ref()
                            .and_then(|m| m.modified().ok())
                            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                            .map(|d| d.as_secs())
                            .unwrap_or(0);

                        // Extract rolodex contact fields if applicable
                        let (ct, cc, cr, ce, imp, lc) = if is_rolodex {
                            if let Some(ref f) = fm {
                                let other = &f.other;
                                let title = other.get("title").and_then(|v| v.as_str()).map(|s| s.to_string());
                                let company = other.get("company").and_then(|v| v.as_str()).map(|s| s.to_string());
                                let role = other.get("role").and_then(|v| v.as_str()).map(|s| s.to_string());
                                let email = other.get("emails")
                                    .and_then(|v| v.as_sequence())
                                    .and_then(|seq| seq.first())
                                    .and_then(|item| item.as_mapping())
                                    .and_then(|map| map.get(serde_yaml::Value::String("value".to_string())))
                                    .and_then(|v| v.as_str())
                                    .map(|s| s.to_string());
                                let imported_val = other.get("imported").and_then(|v| v.as_str()).map(|s| s.to_string());
                                let last_call_val = other.get("last_call").and_then(|v| v.as_str()).map(|s| s.to_string());
                                (title, company, role, email, imported_val, last_call_val)
                            } else {
                                (None, None, None, None, None, None)
                            }
                        } else {
                            (None, None, None, None, None, None)
                        };

                        (
                            fm_created.unwrap_or(fs_created),
                            fm_modified.unwrap_or(fs_modified),
                            ct, cc, cr, ce, imp, lc,
                        )
                    } else {
                        (0, 0, None, None, None, None, None, None)
                    };

                Some(Note {
                    name: filename.trim_end_matches(".md").to_string(),
                    path: path.to_string_lossy().to_string(),
                    filename,
                    created,
                    modified,
                    subfolder: subfolder.clone(),
                    contact_title,
                    contact_company,
                    contact_role,
                    contact_email,
                    imported,
                    last_call,
                })
            } else {
                None
            }
        })
        .collect()
}

#[tauri::command]
fn list_notes(section_path: String) -> Result<Vec<Note>, String> {
    let path = PathBuf::from(&section_path);

    if !path.exists() {
        return Err(format!("Section not found: {}", section_path));
    }

    let section_meta = load_section_metadata(&path);
    // Fallback: detect rolodex by directory name if type not set in .section.md
    let section_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
    let section_type = section_meta.section_type.as_deref()
        .or_else(|| if section_name == "rolodex" { Some("rolodex") } else { None });

    // Collect notes from section root
    let mut notes = collect_notes_from_dir(&path, None, section_type);

    // Collect notes from one level of sub-directories
    if let Ok(entries) = fs::read_dir(&path) {
        for entry in entries.filter_map(|e| e.ok()) {
            let sub_path = entry.path();
            if sub_path.is_dir() {
                let dir_name = entry.file_name().to_string_lossy().to_string();
                if !dir_name.starts_with('.') {
                    notes.extend(collect_notes_from_dir(&sub_path, Some(dir_name), section_type));
                }
            }
        }
    }

    // Sort helper: use contact_title for rolodex, fall back to name
    let sort_name = |note: &Note| -> String {
        note.contact_title.as_deref().unwrap_or(&note.name).to_lowercase()
    };

    // Sort by preference
    match section_meta.sort.as_str() {
        "alpha-desc" | "name-desc" => {
            notes.sort_by(|a, b| sort_name(b).cmp(&sort_name(a)))
        }
        "created-asc" => notes.sort_by(|a, b| a.created.cmp(&b.created)),
        "created-desc" => notes.sort_by(|a, b| b.created.cmp(&a.created)),
        "modified-asc" => notes.sort_by(|a, b| a.modified.cmp(&b.modified)),
        "modified-desc" => notes.sort_by(|a, b| b.modified.cmp(&a.modified)),
        "imported-asc" => notes.sort_by(|a, b| {
            match (&a.imported, &b.imported) {
                (Some(a_val), Some(b_val)) => a_val.cmp(b_val),
                (Some(_), None) => std::cmp::Ordering::Less,
                (None, Some(_)) => std::cmp::Ordering::Greater,
                (None, None) => sort_name(a).cmp(&sort_name(b)),
            }
        }),
        "imported-desc" => notes.sort_by(|a, b| {
            match (&a.imported, &b.imported) {
                (Some(a_val), Some(b_val)) => b_val.cmp(a_val),
                (Some(_), None) => std::cmp::Ordering::Less,
                (None, Some(_)) => std::cmp::Ordering::Greater,
                (None, None) => sort_name(a).cmp(&sort_name(b)),
            }
        }),
        "lastcall-asc" => notes.sort_by(|a, b| {
            match (&a.last_call, &b.last_call) {
                (Some(a_val), Some(b_val)) => a_val.cmp(b_val),
                (Some(_), None) => std::cmp::Ordering::Less,
                (None, Some(_)) => std::cmp::Ordering::Greater,
                (None, None) => sort_name(a).cmp(&sort_name(b)),
            }
        }),
        "lastcall-desc" => notes.sort_by(|a, b| {
            match (&a.last_call, &b.last_call) {
                (Some(a_val), Some(b_val)) => b_val.cmp(a_val),
                (Some(_), None) => std::cmp::Ordering::Less,
                (None, Some(_)) => std::cmp::Ordering::Greater,
                (None, None) => sort_name(a).cmp(&sort_name(b)),
            }
        }),
        "manual" if !section_meta.order.is_empty() => {
            notes.sort_by(|a, b| {
                let a_idx = section_meta.order.iter().position(|x| x == &a.filename);
                let b_idx = section_meta.order.iter().position(|x| x == &b.filename);
                match (a_idx, b_idx) {
                    (Some(ai), Some(bi)) => ai.cmp(&bi),
                    (Some(_), None) => std::cmp::Ordering::Less,
                    (None, Some(_)) => std::cmp::Ordering::Greater,
                    (None, None) => sort_name(a).cmp(&sort_name(b)),
                }
            });
        }
        _ => notes.sort_by(|a, b| sort_name(a).cmp(&sort_name(b))), // alpha-asc default
    }

    // Move pinned to top
    if !section_meta.pinned.is_empty() {
        notes.sort_by(|a, b| {
            let a_pinned = section_meta.pinned.contains(&a.filename);
            let b_pinned = section_meta.pinned.contains(&b.filename);
            match (a_pinned, b_pinned) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => std::cmp::Ordering::Equal,
            }
        });
    }

    Ok(notes)
}

#[tauri::command]
fn read_note(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_note(path: String, content: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);
    let now = iso_now();

    // Parse frontmatter from incoming content
    let (existing_fm, body) = parse_frontmatter(&content);

    // Read existing file to check for changes and get old frontmatter
    let old_content = if file_path.exists() {
        fs::read_to_string(&file_path).ok()
    } else {
        None
    };

    let (old_fm, old_body) = old_content
        .as_ref()
        .map(|c| parse_frontmatter(c))
        .map(|(fm, b)| (fm, b.to_string()))
        .unwrap_or((None, String::new()));

    // Check if body content actually changed
    let content_changed = old_body.trim() != body.trim();

    // If body hasn't changed, don't rewrite (avoids frontmatter reordering causing git dirty)
    if !content_changed && old_content.is_some() {
        return Ok(());
    }

    // Merge frontmatter: prefer existing from content, fall back to file
    let mut fm = existing_fm.or(old_fm).unwrap_or_default();
    if fm.created.is_none() {
        fm.created = Some(now.clone());
    }
    // Update modified timestamp since content changed
    fm.modified = Some(now);

    // Write with updated frontmatter
    let final_content = format!("{}\n\n{}", format_frontmatter(&fm), body);
    fs::write(&path, final_content).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_note(section_path: String, name: String) -> Result<Note, String> {
    let filename = format!("{}.md", name);
    let path = PathBuf::from(&section_path).join(&filename);

    if path.exists() {
        return Err("Note already exists".to_string());
    }

    let now_iso = iso_now();
    let now_ts = iso_to_timestamp(&now_iso);

    let fm = Frontmatter {
        created: Some(now_iso.clone()),
        modified: Some(now_iso),
        other: std::collections::HashMap::new(),
    };

    let content = format!("{}\n\n", format_frontmatter(&fm));
    fs::write(&path, content).map_err(|e| e.to_string())?;

    Ok(Note {
        name,
        path: path.to_string_lossy().to_string(),
        filename,
        created: now_ts,
        modified: now_ts,
        subfolder: None,
        contact_title: None,
        contact_company: None,
        contact_role: None,
        contact_email: None,
        imported: None,
        last_call: None,
    })
}

fn get_week_name() -> String {
    let now = Local::now();
    format!("{}-{:02}", now.year(), now.iso_week().week())
}

#[tauri::command]
fn create_note_smart(section_path: String) -> Result<Note, String> {
    let path = PathBuf::from(&section_path);
    let section_name = path
        .file_name()
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

    let content = format!("{}\n\n", format_frontmatter(&fm));
    fs::write(&file_path, content).map_err(|e| e.to_string())?;

    // Position new note based on sort order (manual sort needs explicit ordering)
    let mut section_meta = load_section_metadata(&path);
    if section_meta.sort == "manual" {
        // Insert at top for manual sort (most visible position)
        section_meta.order.insert(0, filename.clone());
        let _ = save_section_metadata(&path, &section_meta);
    }

    Ok(Note {
        name,
        path: file_path.to_string_lossy().to_string(),
        filename,
        created: now_ts,
        modified: now_ts,
        subfolder: None,
        contact_title: None,
        contact_company: None,
        contact_role: None,
        contact_email: None,
        imported: None,
        last_call: None,
    })
}

#[tauri::command]
fn delete_note(path: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);

    if !file_path.exists() {
        return Err("Note not found".to_string());
    }

    trash::delete(&file_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_note(old_path: String, new_name: String) -> Result<Note, String> {
    let old_file = PathBuf::from(&old_path);

    if !old_file.exists() {
        return Err("Note not found".to_string());
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
        return Err("A note with that name already exists".to_string());
    }

    // Get timestamps before rename
    let metadata = fs::metadata(&old_file).ok();
    let created = metadata
        .as_ref()
        .and_then(|m| m.created().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    fs::rename(&old_file, &new_path).map_err(|e| e.to_string())?;

    let modified = fs::metadata(&new_path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    Ok(Note {
        name: new_name,
        path: new_path.to_string_lossy().to_string(),
        filename: new_filename,
        created,
        modified,
        subfolder: None,
        contact_title: None,
        contact_company: None,
        contact_role: None,
        contact_email: None,
        imported: None,
        last_call: None,
    })
}

#[tauri::command]
fn move_note(path: String, new_section_path: String) -> Result<Note, String> {
    let old_file = PathBuf::from(&path);

    if !old_file.exists() {
        return Err("Note not found".to_string());
    }

    let filename = old_file
        .file_name()
        .ok_or("Invalid filename")?
        .to_string_lossy()
        .to_string();

    let new_path = PathBuf::from(&new_section_path).join(&filename);

    if new_path.exists() {
        return Err("A note with that name already exists in the target section".to_string());
    }

    // Get timestamps before move
    let metadata = fs::metadata(&old_file).ok();
    let created = metadata
        .as_ref()
        .and_then(|m| m.created().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    fs::rename(&old_file, &new_path).map_err(|e| e.to_string())?;

    let modified = fs::metadata(&new_path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    Ok(Note {
        name: filename.trim_end_matches(".md").to_string(),
        path: new_path.to_string_lossy().to_string(),
        filename,
        created,
        modified,
        subfolder: None,
        contact_title: None,
        contact_company: None,
        contact_role: None,
        contact_email: None,
        imported: None,
        last_call: None,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub name: String,
    pub path: String,
    pub section: String,
}

#[tauri::command]
fn list_all_notes() -> Result<Vec<SearchResult>, String> {
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

        if let Ok(entries) = fs::read_dir(&section_path) {
            for entry in entries.filter_map(|e| e.ok()) {
                let entry_path = entry.path();
                let filename = entry.file_name().to_string_lossy().to_string();

                if entry_path.is_file() && filename.ends_with(".md") && !filename.starts_with('.') {
                    results.push(SearchResult {
                        name: filename.trim_end_matches(".md").to_string(),
                        path: entry_path.to_string_lossy().to_string(),
                        section: section_name.clone(),
                    });
                } else if entry_path.is_dir() && !filename.starts_with('.') {
                    // One level of sub-directory recursion
                    if let Ok(sub_entries) = fs::read_dir(&entry_path) {
                        for sub_entry in sub_entries.filter_map(|e| e.ok()) {
                            let sub_path = sub_entry.path();
                            let sub_filename = sub_entry.file_name().to_string_lossy().to_string();

                            if sub_path.is_file() && sub_filename.ends_with(".md") && !sub_filename.starts_with('.') {
                                results.push(SearchResult {
                                    name: sub_filename.trim_end_matches(".md").to_string(),
                                    path: sub_path.to_string_lossy().to_string(),
                                    section: section_name.clone(),
                                });
                            }
                        }
                    }
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
        title: None,
        color: None,
        section_type: None,
    })
}

#[tauri::command]
fn rename_section(path: String, new_name: String) -> Result<Section, String> {
    let section_path = PathBuf::from(&path);

    if !section_path.exists() {
        return Err("Section not found".to_string());
    }

    let folder_name = section_path
        .file_name()
        .ok_or("Invalid path")?
        .to_string_lossy()
        .to_string();

    let old_name_lower = folder_name.to_lowercase();
    if PROTECTED_SECTIONS.contains(&old_name_lower.as_str()) {
        return Err("This section cannot be renamed".to_string());
    }

    // Load existing metadata to preserve color
    let mut metadata = load_section_metadata(&section_path);
    metadata.title = Some(new_name.clone());

    // Save updated metadata
    save_section_metadata(&section_path, &metadata)?;

    Ok(Section {
        name: folder_name,
        path: path,
        title: metadata.title,
        color: metadata.color,
        section_type: metadata.section_type.clone(),
    })
}

#[tauri::command]
fn delete_section(path: String) -> Result<(), String> {
    let dir_path = PathBuf::from(&path);

    if !dir_path.exists() {
        return Err("Section not found".to_string());
    }

    let name = dir_path
        .file_name()
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

#[tauri::command]
fn list_whispers(note_path: String) -> Result<Vec<Whisper>, String> {
    let note = PathBuf::from(&note_path);
    let parent = note.parent().ok_or("Invalid note path")?;
    let stem = note
        .file_stem()
        .ok_or("Invalid note filename")?
        .to_string_lossy();

    let whispers_dir = parent.join(".whispers");
    if !whispers_dir.exists() || !whispers_dir.is_dir() {
        return Ok(vec![]);
    }

    let prefix = format!("{}.", stem);

    let mut whispers: Vec<Whisper> = fs::read_dir(&whispers_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let filename = entry.file_name().to_string_lossy().to_string();

            // Must match <stem>.<character>.md
            if !filename.starts_with(&prefix) || !filename.ends_with(".md") {
                return None;
            }

            // Extract character: strip prefix and .md suffix
            let rest = filename.strip_prefix(&prefix)?;
            let character = rest.strip_suffix(".md")?;

            // Skip bare <stem>.md (empty character name)
            if character.is_empty() {
                return None;
            }

            let whisper_path = entry.path();

            // Parse frontmatter to get generated timestamp
            let generated = fs::read_to_string(&whisper_path)
                .ok()
                .and_then(|content| {
                    if !content.starts_with("---\n") {
                        return None;
                    }
                    let end = content[4..].find("\n---")?;
                    let yaml_str = &content[4..4 + end];
                    let map: std::collections::HashMap<String, serde_yaml::Value> =
                        serde_yaml::from_str(yaml_str).ok()?;
                    map.get("generated")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                });

            Some(Whisper {
                character: character.to_string(),
                path: whisper_path.to_string_lossy().to_string(),
                generated,
            })
        })
        .collect();

    whispers.sort_by(|a, b| a.character.cmp(&b.character));

    Ok(whispers)
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
    pub insertions: u32,
    pub deletions: u32,
    pub last_commit_hash: Option<String>,
    pub last_commit_message: Option<String>,
    pub last_commit_date: Option<String>,
    pub last_commit_author: Option<String>,
    pub is_team: bool,
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
fn search_notes(
    query: String,
    state: tauri::State<AppState>,
) -> Result<Vec<TantivySearchResult>, String> {
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
fn git_commit_and_push(message: String) -> Result<(), String> {
    let notes_path = get_notes_path();

    // Stage all changes
    let add_result = Command::new("git")
        .args(["add", "-A"])
        .current_dir(&notes_path)
        .output()
        .map_err(|e| e.to_string())?;

    if !add_result.status.success() {
        return Err(String::from_utf8_lossy(&add_result.stderr).to_string());
    }

    // Commit
    let commit_result = Command::new("git")
        .args(["commit", "-m", &message])
        .current_dir(&notes_path)
        .output()
        .map_err(|e| e.to_string())?;

    if !commit_result.status.success() {
        let stderr = String::from_utf8_lossy(&commit_result.stderr);
        if !stderr.contains("nothing to commit") {
            return Err(stderr.to_string());
        }
        // Nothing to commit - still try to push in case there are unpushed commits
    }

    // Push
    let push_result = Command::new("git")
        .args(["push"])
        .current_dir(&notes_path)
        .output()
        .map_err(|e| e.to_string())?;

    if !push_result.status.success() {
        let stderr = String::from_utf8_lossy(&push_result.stderr);
        // "Everything up-to-date" goes to stderr but isn't an error
        if !stderr.contains("Everything up-to-date") && !stderr.is_empty() {
            return Err(stderr.to_string());
        }
    }

    Ok(())
}

#[tauri::command]
fn get_repo_status() -> Result<RepoStatus, String> {
    let notes_path = get_notes_path();

    // Get repo name from active vault config, falling back to folder name
    let settings = load_settings();
    let repo_name = settings
        .active_vault
        .and_then(|id| settings.vaults.iter().find(|v| v.id == id).cloned())
        .or_else(|| settings.vaults.first().cloned())
        .map(|v| v.name)
        .unwrap_or_else(|| {
            notes_path
                .file_name()
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

    // Get diff stats (insertions/deletions) for uncommitted changes
    let (insertions, deletions) = if is_dirty {
        // Get stats for both staged and unstaged changes
        let diff_output = Command::new("git")
            .args(["diff", "--numstat", "HEAD"])
            .current_dir(&notes_path)
            .output();

        match diff_output {
            Ok(output) if output.status.success() => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let mut ins: u32 = 0;
                let mut del: u32 = 0;
                for line in stdout.lines() {
                    let parts: Vec<&str> = line.split('\t').collect();
                    if parts.len() >= 2 {
                        // Binary files show "-" instead of numbers
                        if let Ok(i) = parts[0].parse::<u32>() {
                            ins += i;
                        }
                        if let Ok(d) = parts[1].parse::<u32>() {
                            del += d;
                        }
                    }
                }
                (ins, del)
            }
            _ => (0, 0),
        }
    } else {
        (0, 0)
    };

    // Get last commit info
    let log_output = Command::new("git")
        .args(["log", "-1", "--format=%H|%s|%aI|%an"])
        .current_dir(&notes_path)
        .output();

    let (last_commit_hash, last_commit_message, last_commit_date, last_commit_author) =
        match log_output {
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

    // Detect team brain: use cached value or count unique committer emails
    let mut settings = load_settings();
    let cached_is_team = settings
        .active_vault
        .as_ref()
        .and_then(|id| settings.vaults.iter().find(|v| &v.id == id))
        .and_then(|v| v.is_team);

    let is_team = if let Some(cached) = cached_is_team {
        cached
    } else {
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

        let detected = author_count >= 2;

        // Cache result on the active vault
        if let Some(active_id) = &settings.active_vault {
            if let Some(vault) = settings.vaults.iter_mut().find(|v| &v.id == active_id) {
                vault.is_team = Some(detected);
                let _ = save_settings(&settings);
            }
        }

        detected
    };

    // Resolve effective is_team (override takes precedence)
    let effective_is_team = settings
        .active_vault
        .as_ref()
        .and_then(|id| settings.vaults.iter().find(|v| &v.id == id))
        .map(|v| v.is_team_override.unwrap_or(is_team))
        .unwrap_or(is_team);

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
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirtyFile {
    pub path: String,
    pub filename: String,
    pub status: String, // M, A, D, R, etc.
    pub insertions: u32,
    pub deletions: u32,
}

#[tauri::command]
fn get_dirty_files() -> Result<Vec<DirtyFile>, String> {
    let notes_path = get_notes_path();

    // Get file statuses
    let status_output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&notes_path)
        .output()
        .map_err(|e| e.to_string())?;

    if !status_output.status.success() {
        return Ok(vec![]);
    }

    // Get diff stats for tracked files
    let numstat_output = Command::new("git")
        .args(["diff", "--numstat", "HEAD"])
        .current_dir(&notes_path)
        .output()
        .ok();

    // Build a map of path -> (insertions, deletions)
    let mut stats_map: std::collections::HashMap<String, (u32, u32)> =
        std::collections::HashMap::new();
    if let Some(output) = numstat_output {
        if output.status.success() {
            for line in String::from_utf8_lossy(&output.stdout).lines() {
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.len() >= 3 {
                    let ins = parts[0].parse().unwrap_or(0);
                    let del = parts[1].parse().unwrap_or(0);
                    stats_map.insert(parts[2].to_string(), (ins, del));
                }
            }
        }
    }

    let files: Vec<DirtyFile> = String::from_utf8_lossy(&status_output.stdout)
        .lines()
        .filter_map(|line| {
            if line.len() < 4 {
                return None;
            }
            let status = line[0..2].trim().to_string();
            let path = line[3..].to_string();
            // Handle paths ending with / (directories) - trim and get last non-empty segment
            let trimmed_path = path.trim_end_matches('/');
            let filename = trimmed_path
                .split('/')
                .last()
                .unwrap_or(trimmed_path)
                .to_string();
            let (insertions, deletions) = stats_map.get(trimmed_path).copied().unwrap_or((0, 0));
            Some(DirtyFile {
                path,
                filename,
                status,
                insertions,
                deletions,
            })
        })
        .collect();

    Ok(files)
}

#[tauri::command]
fn get_vault_path() -> String {
    get_notes_path().to_string_lossy().to_string()
}

#[tauri::command]
fn get_file_diff(path: String, vault_path: Option<String>) -> Result<String, String> {
    let notes_path = vault_path.map(PathBuf::from).unwrap_or_else(get_notes_path);

    // Try diff against HEAD (modified files)
    let output = Command::new("git")
        .args(["diff", "HEAD", "--", &path])
        .current_dir(&notes_path)
        .output()
        .map_err(|e| e.to_string())?;

    let diff = String::from_utf8_lossy(&output.stdout).to_string();
    if !diff.is_empty() {
        return Ok(diff);
    }

    // Try staged diff (new staged files)
    let output = Command::new("git")
        .args(["diff", "--cached", "--", &path])
        .current_dir(&notes_path)
        .output()
        .map_err(|e| e.to_string())?;

    let diff = String::from_utf8_lossy(&output.stdout).to_string();
    if !diff.is_empty() {
        return Ok(diff);
    }

    // For untracked files, show content as addition
    let file_path = notes_path.join(&path);
    if file_path.exists() {
        if file_path.is_file() {
            if let Ok(content) = std::fs::read_to_string(&file_path) {
                let lines: Vec<String> = content.lines().map(|l| format!("+{}", l)).collect();
                return Ok(format!(
                    "diff --git a/{path} b/{path}\nnew file\n--- /dev/null\n+++ b/{path}\n@@\n{}",
                    lines.join("\n")
                ));
            }
        } else if file_path.is_dir() {
            // For new directories, list contents
            let mut files: Vec<String> = Vec::new();
            if let Ok(entries) = std::fs::read_dir(&file_path) {
                for entry in entries.flatten() {
                    if let Some(name) = entry.file_name().to_str() {
                        let file_type = if entry.path().is_dir() {
                            "folder"
                        } else {
                            "file"
                        };
                        files.push(format!("+  {} ({})", name, file_type));
                    }
                }
            }
            files.sort();
            let dir_name = path.trim_end_matches('/');
            return Ok(format!(
                "New folder: {}\n\nContents:\n{}",
                dir_name,
                if files.is_empty() {
                    "+  (empty)".to_string()
                } else {
                    files.join("\n")
                }
            ));
        }
    }

    Ok(String::new())
}

#[tauri::command]
fn get_commit_diff(hash: String) -> Result<String, String> {
    let notes_path = get_notes_path();

    let output = Command::new("git")
        .args(["show", "--format=", &hash])
        .current_dir(&notes_path)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err("Failed to get commit diff".to_string())
    }
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

/// Check if a path is a git repository (has a .git directory)
fn is_git_repository(path: &str) -> bool {
    let git_dir = std::path::Path::new(path).join(".git");
    git_dir.exists() && git_dir.is_dir()
}

// Settings commands
#[tauri::command]
fn get_settings() -> Settings {
    load_settings()
}

#[derive(Debug, Serialize)]
pub struct VaultValidation {
    pub has_vaults: bool,
    pub active_vault_valid: bool,
    pub invalid_vault_id: Option<String>,
    pub invalid_vault_path: Option<String>,
    pub invalid_vault_name: Option<String>,
}

#[tauri::command]
fn validate_active_vault() -> VaultValidation {
    let settings = load_settings();

    if settings.vaults.is_empty() {
        return VaultValidation {
            has_vaults: false,
            active_vault_valid: false,
            invalid_vault_id: None,
            invalid_vault_path: None,
            invalid_vault_name: None,
        };
    }

    // Find active vault or use first
    let active_vault = settings
        .active_vault
        .and_then(|id| settings.vaults.iter().find(|v| v.id == id))
        .or_else(|| settings.vaults.first());

    match active_vault {
        Some(vault) => {
            let path_exists = Path::new(&vault.path).exists();
            VaultValidation {
                has_vaults: true,
                active_vault_valid: path_exists,
                invalid_vault_id: if path_exists {
                    None
                } else {
                    Some(vault.id.clone())
                },
                invalid_vault_path: if path_exists {
                    None
                } else {
                    Some(vault.path.clone())
                },
                invalid_vault_name: if path_exists {
                    None
                } else {
                    Some(vault.name.clone())
                },
            }
        }
        None => VaultValidation {
            has_vaults: true,
            active_vault_valid: false,
            invalid_vault_id: None,
            invalid_vault_path: None,
            invalid_vault_name: None,
        },
    }
}

#[tauri::command]
fn update_settings(settings: Settings) -> Result<(), String> {
    save_settings(&settings)
}

#[tauri::command]
fn save_session_state(section: String, note: String, cursor_pos: usize, scroll_top: f64) -> Result<(), String> {
    let mut settings = load_settings();
    settings.last_session = Some(LastSession {
        section,
        note,
        cursor_pos,
        scroll_top,
    });
    save_settings(&settings)
}

#[tauri::command]
fn get_vault_stats(vault_id: String) -> Result<VaultStats, String> {
    let settings = load_settings();
    let vault = settings
        .vaults
        .iter()
        .find(|v| v.id == vault_id)
        .ok_or_else(|| "Vault not found".to_string())?;

    let vault_path = Path::new(&vault.path);

    // Count sections (directories) and notes (.md files)
    let mut section_count = 0u32;
    let mut note_count = 0u32;
    let mut latest_modified: Option<std::time::SystemTime> = None;

    if vault_path.exists() {
        for entry in walkdir::WalkDir::new(vault_path)
            .min_depth(1)
            .into_iter()
            .filter_entry(|e| !e.file_name().to_string_lossy().starts_with('.'))
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.is_dir() {
                section_count += 1;
            } else if path.extension().map_or(false, |ext| ext == "md") {
                note_count += 1;
                if let Ok(metadata) = path.metadata() {
                    if let Ok(modified) = metadata.modified() {
                        if latest_modified.map_or(true, |latest| modified > latest) {
                            latest_modified = Some(modified);
                        }
                    }
                }
            }
        }
    }

    // Format last modified as relative time
    let last_modified = latest_modified.map(|time| {
        let now = std::time::SystemTime::now();
        let duration = now.duration_since(time).unwrap_or_default();
        let secs = duration.as_secs();

        if secs < 60 {
            "just now".to_string()
        } else if secs < 3600 {
            let mins = secs / 60;
            format!("{} min{} ago", mins, if mins == 1 { "" } else { "s" })
        } else if secs < 86400 {
            let hours = secs / 3600;
            format!("{} hour{} ago", hours, if hours == 1 { "" } else { "s" })
        } else if secs < 604800 {
            let days = secs / 86400;
            format!("{} day{} ago", days, if days == 1 { "" } else { "s" })
        } else {
            let weeks = secs / 604800;
            format!("{} week{} ago", weeks, if weeks == 1 { "" } else { "s" })
        }
    });

    // Check git status - walk up to find .git directory
    let git_path = {
        let mut current: Option<&Path> = Some(&vault_path);
        loop {
            match current {
                Some(dir) => {
                    let candidate = dir.join(".git");
                    if candidate.exists() {
                        break Some(candidate);
                    }
                    current = dir.parent();
                }
                None => break None,
            }
        }
    };
    let is_git_repo = git_path.is_some();

    let (git_branch, git_provider, git_repo) = if let Some(git_path) = git_path {
        // Get branch
        let head_path = git_path.join("HEAD");
        let branch = fs::read_to_string(&head_path).ok().and_then(|content| {
            content
                .strip_prefix("ref: refs/heads/")
                .map(|s| s.trim().to_string())
        });

        // Get remote URL from config
        let config_path = git_path.join("config");
        let (provider, repo) = fs::read_to_string(&config_path)
            .ok()
            .and_then(|content| {
                // Find [remote "origin"] section and extract url
                let mut in_origin = false;
                for line in content.lines() {
                    if line.trim() == "[remote \"origin\"]" {
                        in_origin = true;
                    } else if line.trim().starts_with('[') {
                        in_origin = false;
                    } else if in_origin && line.trim().starts_with("url = ") {
                        let url = line.trim().strip_prefix("url = ")?;
                        return parse_git_remote(url);
                    }
                }
                None
            })
            .map(|(p, r)| (Some(p), Some(r)))
            .unwrap_or((None, None));

        (branch, provider, repo)
    } else {
        (None, None, None)
    };

    Ok(VaultStats {
        vault_id,
        section_count,
        note_count,
        last_modified,
        is_git_repo,
        git_branch,
        git_provider,
        git_repo,
    })
}

#[tauri::command]
async fn add_vault(app: tauri::AppHandle) -> Result<Option<Vault>, String> {
    use tauri_plugin_dialog::DialogExt;

    let folder = app.dialog().file().blocking_pick_folder();

    match folder {
        Some(path) => {
            let path_str = path.to_string();

            // Validate it's a git repository
            if !is_git_repository(&path_str) {
                return Err(
                    "Not a git repository. Please select a folder with git initialized."
                        .to_string(),
                );
            }

            let name = std::path::Path::new(&path_str)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("notes")
                .to_string();

            let vault = Vault {
                id: generate_id(),
                name,
                path: path_str,
                is_team: None,
                is_team_override: None,
            };

            let mut settings = load_settings();
            settings.vaults.push(vault.clone());
            save_settings(&settings)?;

            Ok(Some(vault))
        }
        None => Ok(None),
    }
}

#[tauri::command]
fn remove_vault(vault_id: String) -> Result<(), String> {
    let mut settings = load_settings();
    settings.vaults.retain(|v| v.id != vault_id);

    // If we removed the active vault, clear active_vault
    if settings.active_vault.as_ref() == Some(&vault_id) {
        settings.active_vault = settings.vaults.first().map(|v| v.id.clone());
    }

    save_settings(&settings)
}

#[tauri::command]
fn set_active_vault(vault_id: String) -> Result<(), String> {
    let mut settings = load_settings();
    if settings.vaults.iter().any(|v| v.id == vault_id) {
        settings.active_vault = Some(vault_id);
        save_settings(&settings)
    } else {
        Err("Vault not found".to_string())
    }
}

#[tauri::command]
fn add_existing_vault(path: String) -> Result<Vault, String> {
    if !is_git_repository(&path) {
        return Err("Not a git repository".to_string());
    }

    let name = std::path::Path::new(&path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("notes")
        .to_string();

    let vault = Vault {
        id: generate_id(),
        name,
        path,
        is_team: None,
        is_team_override: None,
    };

    let mut settings = load_settings();
    settings.vaults.push(vault.clone());
    save_settings(&settings)?;

    Ok(vault)
}

#[tauri::command]
fn get_auto_commit() -> bool {
    let settings = load_settings();
    settings.git.auto_commit
}

#[tauri::command]
fn set_auto_commit(enabled: bool) -> Result<(), String> {
    let mut settings = load_settings();
    settings.git.auto_commit = enabled;
    save_settings(&settings)
}

#[tauri::command]
fn get_theme() -> String {
    let settings = load_settings();
    settings.appearance.theme
}

#[tauri::command]
fn set_theme(theme: String) -> Result<(), String> {
    let mut settings = load_settings();
    settings.appearance.theme = theme;
    save_settings(&settings)
}

#[tauri::command]
fn get_editor_settings() -> EditorSettings {
    load_settings().editor
}

#[tauri::command]
fn set_editor_settings(settings: EditorSettings) -> Result<(), String> {
    let mut current = load_settings();
    current.editor = settings;
    save_settings(&current)
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
        .map(|o| {
            String::from_utf8_lossy(&o.stdout)
                .lines()
                .next()
                .unwrap_or("")
                .to_string()
        })
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

// Clone repository commands
#[derive(serde::Serialize)]
enum ClonePathStatus {
    Empty,
    SameRemote,
    DifferentRemote,
    NotGit,
    NotEmpty,
}

#[tauri::command]
fn check_clone_path(url: String, path: String) -> Result<ClonePathStatus, String> {
    let path = std::path::Path::new(&path);

    if !path.exists() {
        return Ok(ClonePathStatus::Empty);
    }

    // Check if it's a git repo
    let git_dir = path.join(".git");
    if !git_dir.exists() {
        // Folder exists but not a git repo - check if empty
        if std::fs::read_dir(path)
            .map(|mut d| d.next().is_none())
            .unwrap_or(false)
        {
            return Ok(ClonePathStatus::Empty);
        }
        return Ok(ClonePathStatus::NotEmpty);
    }

    // It's a git repo - check if same remote
    let output = std::process::Command::new("git")
        .args(["remote", "get-url", "origin"])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Ok(ClonePathStatus::NotGit);
    }

    let existing_remote = String::from_utf8_lossy(&output.stdout).trim().to_string();

    // Normalize URLs for comparison (remove .git suffix, trailing slashes)
    let normalize = |u: &str| {
        u.trim()
            .trim_end_matches('/')
            .trim_end_matches(".git")
            .to_string()
    };

    if normalize(&existing_remote) == normalize(&url) {
        Ok(ClonePathStatus::SameRemote)
    } else {
        Ok(ClonePathStatus::DifferentRemote)
    }
}

#[tauri::command]
async fn clone_vault(_app: tauri::AppHandle, url: String, path: String) -> Result<Vault, String> {
    // Create parent directory if needed
    let parent = std::path::Path::new(&path).parent();
    if let Some(parent) = parent {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    // Run git clone
    let output = std::process::Command::new("git")
        .args(["clone", &url, &path])
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Clone failed: {}", stderr.trim()));
    }

    // Create vault
    let name = parse_repo_name(&url).unwrap_or_else(|| "notes".to_string());
    let vault = Vault {
        id: generate_id(),
        name,
        path: path.clone(),
        is_team: None,
        is_team_override: None,
    };

    // Save to settings
    let mut settings = load_settings();
    settings.vaults.push(vault.clone());
    save_settings(&settings)?;

    Ok(vault)
}

#[tauri::command]
fn get_default_clone_path(url: String) -> Result<String, String> {
    let name = parse_repo_name(&url).ok_or("Invalid repository URL")?;
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let path = home.join("GitNotes").join(&name);
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
async fn create_vault(path: String, name: String) -> Result<Vault, String> {
    let vault_path = PathBuf::from(&path);

    // Create directory if not exists
    if !vault_path.exists() {
        fs::create_dir_all(&vault_path)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Check if already a git repo
    let git_dir = vault_path.join(".git");
    if !git_dir.exists() {
        // git init
        let init_result = Command::new("git")
            .args(["init"])
            .current_dir(&vault_path)
            .output()
            .map_err(|e| format!("Failed to run git: {}", e))?;

        if !init_result.status.success() {
            let stderr = String::from_utf8_lossy(&init_result.stderr);
            return Err(format!("git init failed: {}", stderr.trim()));
        }

        // Create initial .gitignore
        let gitignore_path = vault_path.join(".gitignore");
        let gitignore_content = ".DS_Store\n*.swp\n*.swo\n*~\n";
        fs::write(&gitignore_path, gitignore_content)
            .map_err(|e| format!("Failed to create .gitignore: {}", e))?;
    }

    // Create vault object
    let vault = Vault {
        id: generate_id(),
        name,
        path,
        is_team: None,
        is_team_override: None,
    };

    // Add to settings
    let mut settings = load_settings();
    settings.vaults.push(vault.clone());
    settings.active_vault = Some(vault.id.clone());
    save_settings(&settings)?;

    Ok(vault)
}

#[tauri::command]
fn get_default_vault_path(name: String) -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let path = home.join("GitNotes").join(&name);
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn get_contact_data(note_path: String) -> Result<Option<ContactData>, String> {
    let path = PathBuf::from(&note_path);

    // Check if note is in a rolodex section by checking parent dir's .section.md
    let parent = path.parent().ok_or("No parent directory")?;
    let section_meta = load_section_metadata(&PathBuf::from(parent));
    let parent_name = parent.file_name().and_then(|n| n.to_str()).unwrap_or("");
    let is_rolodex = section_meta.section_type.as_deref() == Some("rolodex") || parent_name == "rolodex";
    if !is_rolodex {
        return Ok(None);
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let (fm, _) = parse_frontmatter(&content);
    let fm = match fm {
        Some(f) => f,
        None => return Ok(None),
    };

    let other = &fm.other;

    // Helper to extract Vec<LabeledValue> from a YAML sequence of mappings
    fn extract_labeled_values(other: &std::collections::HashMap<String, serde_yaml::Value>, key: &str) -> Vec<LabeledValue> {
        other.get(key)
            .and_then(|v| v.as_sequence())
            .map(|seq| {
                seq.iter().filter_map(|item| {
                    let mapping = item.as_mapping()?;
                    let label = mapping.get(serde_yaml::Value::String("label".into()))?.as_str()?;
                    let value = mapping.get(serde_yaml::Value::String("value".into()))?.as_str()?;
                    Some(LabeledValue { label: label.to_string(), value: value.to_string() })
                }).collect()
            })
            .unwrap_or_default()
    }

    let contact = ContactData {
        title: other.get("title").and_then(|v| v.as_str()).map(String::from),
        company: other.get("company").and_then(|v| v.as_str()).map(String::from),
        role: other.get("role").and_then(|v| v.as_str()).map(String::from),
        emails: extract_labeled_values(other, "emails"),
        phones: extract_labeled_values(other, "phones"),
        birthday: other.get("birthday").map(|v| {
            v.as_str().map(String::from)
                .unwrap_or_else(|| serde_yaml::to_string(v).unwrap_or_default().trim().to_string())
        }).and_then(|s| if s.is_empty() { None } else { Some(s) }),
        addresses: extract_labeled_values(other, "addresses"),
        social: extract_labeled_values(other, "social"),
    };

    Ok(Some(contact))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let notes_path = get_notes_path();

    // Initialize search index
    let index_path = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(get_config_dir_name())
        .join("search-index");

    let search_index = Arc::new(
        SearchIndex::new(&index_path, &notes_path).expect("Failed to create search index"),
    );

    SearchIndex::start_watcher(Arc::clone(&search_index), notes_path.clone())
        .expect("Failed to start file watcher");

    let app_state = AppState { search_index };

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
            use tauri::Emitter;

            let settings_item = MenuItemBuilder::new("Settings...")
                .id("settings")
                .accelerator("CmdOrCtrl+,")
                .build(app)?;

            let quit_item = MenuItemBuilder::new("Quit GitNotes")
                .id("quit")
                .accelerator("CmdOrCtrl+Q")
                .build(app)?;

            let app_submenu = SubmenuBuilder::new(app, "GitNotes")
                .item(&settings_item)
                .separator()
                .item(&quit_item)
                .build()?;

            let edit_submenu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_submenu)
                .item(&edit_submenu)
                .build()?;

            app.set_menu(menu)?;

            // Handle menu events
            app.on_menu_event(move |app, event| {
                if event.id() == "settings" {
                    let _ = app.emit("open-settings", ());
                }
                if event.id() == "quit" {
                    let _ = app.emit("quit-requested", ());
                }
            });

            Ok(())
        })
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            list_sections,
            list_notes,
            read_note,
            write_note,
            create_note,
            create_note_smart,
            delete_note,
            rename_note,
            move_note,
            list_all_notes,
            create_section,
            rename_section,
            delete_section,
            get_file_metadata,
            list_whispers,
            get_git_info,
            git_commit,
            git_commit_and_push,
            search_notes,
            get_repo_status,
            get_dirty_files,
            get_vault_path,
            get_file_diff,
            get_commit_diff,
            get_git_log,
            get_repo_stats,
            get_sort_preference,
            set_sort_preference,
            get_last_note,
            set_last_note,
            set_section_metadata,
            save_section_order,
            get_settings,
            update_settings,
            save_session_state,
            validate_active_vault,
            get_vault_stats,
            add_vault,
            remove_vault,
            set_active_vault,
            add_existing_vault,
            get_auto_commit,
            set_auto_commit,
            get_theme,
            set_theme,
            get_editor_settings,
            set_editor_settings,
            check_clone_path,
            clone_vault,
            get_default_clone_path,
            create_vault,
            get_default_vault_path,
            get_contact_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
