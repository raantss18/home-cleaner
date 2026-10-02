//! Journal local horodaté de toutes les actions de suppression/déplacement.
//!
//! Écrit en JSON Lines dans `$XDG_DATA_HOME/home-cleaner/journal.log`
//! (typiquement `~/.local/share/home-cleaner/journal.log`).

use std::io::Write;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct JournalEntry {
    /// Horodatage ISO-8601 local.
    pub timestamp: String,
    /// "trash" | "permanent".
    pub mode: String,
    pub path: String,
    pub size: u64,
    pub success: bool,
    pub error: Option<String>,
    pub dry_run: bool,
}

/// Emplacement du fichier de journal.
pub fn journal_path() -> Option<PathBuf> {
    let dir = dirs::data_local_dir()?.join("home-cleaner");
    Some(dir.join("journal.log"))
}

/// Ajoute une entrée au journal (crée le dossier si besoin).
pub fn append(entry: &JournalEntry) {
    let Some(path) = journal_path() else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let Ok(line) = serde_json::to_string(entry) else {
        return;
    };
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
    {
        let _ = writeln!(file, "{line}");
    }
}

/// Lit les `limit` dernières entrées du journal (plus récentes d'abord).
pub fn read_recent(limit: usize) -> Vec<JournalEntry> {
    let Some(path) = journal_path() else {
        return Vec::new();
    };
    let Ok(content) = std::fs::read_to_string(&path) else {
        return Vec::new();
    };
    let mut entries: Vec<JournalEntry> = content
        .lines()
        .filter(|l| !l.trim().is_empty())
        .filter_map(|l| serde_json::from_str(l).ok())
        .collect();
    entries.reverse();
    entries.truncate(limit);
    entries
}
