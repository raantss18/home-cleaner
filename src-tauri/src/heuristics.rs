//! Règles de classification "obsolète" par nom de fichier/dossier.

use crate::model::ObsoleteReason;
use std::path::Path;

/// Noms de dossiers de cache connus.
const CACHE_DIR_NAMES: &[&str] = &[
    ".cache",
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".gradle",
    ".ipynb_checkpoints",
    ".sass-cache",
    ".next",
    ".nuxt",
    ".parcel-cache",
];

/// Noms de dossiers de build.
const BUILD_DIR_NAMES: &[&str] = &["target", "dist", "build", "out", ".turbo", "cmake-build-debug"];

/// Extensions/suffixes de fichiers temporaires.
const TEMP_SUFFIXES: &[&str] = &[".tmp", ".temp", ".swp", ".swo", ".part", ".crdownload", ".bak"];

/// Noms exacts de fichiers temporaires / de bruit.
const TEMP_EXACT: &[&str] = &[".DS_Store", "Thumbs.db", "desktop.ini", ".directory"];

/// Classe un dossier par son nom. Renvoie la raison si obsolète.
pub fn classify_dir(name: &str) -> Option<ObsoleteReason> {
    if CACHE_DIR_NAMES.contains(&name) {
        Some(ObsoleteReason::CacheDir)
    } else if BUILD_DIR_NAMES.contains(&name) {
        Some(ObsoleteReason::BuildDir)
    } else {
        None
    }
}

/// Vrai si le fichier est temporaire d'après son nom.
pub fn is_temp_file(name: &str) -> bool {
    if TEMP_EXACT.contains(&name) {
        return true;
    }
    // Fichiers de sauvegarde d'éditeur type `fichier~`.
    if name.ends_with('~') {
        return true;
    }
    let lower = name.to_ascii_lowercase();
    TEMP_SUFFIXES.iter().any(|s| lower.ends_with(s))
}

/// Nom d'un chemin, en `&str` (chaîne vide si non-UTF8).
pub fn file_name_str(path: &Path) -> &str {
    path.file_name().and_then(|n| n.to_str()).unwrap_or("")
}
