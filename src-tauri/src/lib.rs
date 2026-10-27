mod rules;
use rules::classify_path;
use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;
use trash;
use walkdir::WalkDir;

#[derive(Serialize)]
pub struct ScanEntry {
    path: String,
    size: u64,
    is_dir: bool,
}

#[derive(Serialize, Clone)]
pub struct JunkFinding {
    path: String,
    size: u64,
    tier: rules::SafetyTier,
    reason: String,
}

#[derive(Serialize)]
pub struct ScanResult {
    root: String,
    total_bytes: u64,
    file_count: u64,
    entries: Vec<ScanEntry>,
    junk_findings: Vec<JunkFinding>,
    skipped_errors: Vec<String>,
}

#[tauri::command]
fn scan_disk(path: String) -> Result<ScanResult, String> {
    let root = Path::new(&path);
    if !root.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let mut total_bytes = 0u64;
    let mut file_count = 0u64;
    let mut entries = Vec::new();
    let mut skipped_errors = Vec::new();
    let mut junk_map: HashMap<String, JunkFinding> = HashMap::new();

    for entry in WalkDir::new(root).follow_links(true).into_iter() {
        let entry = match entry {
            Ok(e) => e,
            Err(e) => { 
                skipped_errors.push(e.to_string()); 
                continue; 
            }
        };

        if entry.path() == root { continue; }

        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(e) => { 
                skipped_errors.push(format!("Metadata error on {}: {}", entry.path().display(), e)); 
                continue; 
            }
        };

        let size = meta.len();
        let is_dir = meta.is_dir();
        let path_str = entry.path().to_string_lossy().to_string();

        if !is_dir {
            total_bytes += size;
            file_count += 1;
        }

        entries.push(ScanEntry {
            path: path_str.clone(),
            size,
            is_dir,
        });

        if let Some((tier, reason)) = classify_path(&path_str) {
            let group_path = if is_dir {
                path_str.clone()
            } else {
                entry.path().parent().unwrap_or(entry.path()).to_string_lossy().to_string()
            };

            junk_map.entry(group_path.clone())
                .and_modify(|f| f.size += size)
                .or_insert(JunkFinding {
                    path: group_path,
                    size: if is_dir { 0 } else { size },
                    tier,
                    reason,
                });
        }
    }

    let mut junk_findings: Vec<JunkFinding> = junk_map.into_values().collect();
    junk_findings.sort_by(|a, b| b.size.cmp(&a.size));

    Ok(ScanResult {
        root: path,
        total_bytes,
        file_count,
        entries,
        junk_findings,
        skipped_errors,
    })
}

#[derive(Serialize)]
pub struct DeleteResult {
    success_count: usize,
    failed: Vec<String>,
}

#[tauri::command]
fn delete_items(paths: Vec<String>) -> Result<DeleteResult, String> {
    let mut success_count = 0;
    let mut failed = Vec::new();

    for path in paths {
        let p = std::path::Path::new(&path);
        if !p.exists() {
            failed.push(format!("Path does not exist: {}", path));
            continue;
        }
        match trash::delete(&path) {
            Ok(_) => success_count += 1,
            Err(e) => failed.push(format!("Failed to delete {}: {}", path, e)),
        }
    }

    Ok(DeleteResult {
        success_count,
        failed,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            scan_disk,
            delete_items
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}