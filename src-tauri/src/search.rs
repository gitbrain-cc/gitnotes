use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
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
}
