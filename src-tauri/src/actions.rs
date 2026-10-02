//! Exécution des suppressions (corbeille ou définitive) avec garde-fous.

use std::path::Path;

use crate::fs_util;
use crate::journal::{self, JournalEntry};
use crate::model::{DeleteMode, DeleteOutcome, DeleteRequest};

/// Taille d'un chemin : fichier => sa taille ; dossier => somme récursive.
fn path_size(path: &Path) -> u64 {
    let Ok(meta) = std::fs::symlink_metadata(path) else {
        return 0;
    };
    if meta.file_type().is_symlink() {
        return 0; // un lien ne "pèse" rien de récupérable
    }
    if meta.is_file() {
        return meta.len();
    }
    if meta.is_dir() {
        return walkdir::WalkDir::new(path)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter_map(|e| e.metadata().ok())
            .filter(|m| m.is_file())
            .map(|m| m.len())
            .sum();
    }
    0
}

/// Horodatage local ISO-8601 (ex. "2026-07-24 15:42:07").
fn timestamp() -> String {
    chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

/// Exécute une requête de suppression, chemin par chemin.
///
/// Garde-fous appliqués à CHAQUE chemin :
///  - refus si hors de `$HOME` ;
///  - en `dry_run`, aucune modification, seulement le rapport ;
///  - journalisation systématique (succès comme échec).
pub fn run_delete(req: &DeleteRequest) -> Vec<DeleteOutcome> {
    let home = match fs_util::home_dir() {
        Some(h) => h,
        None => {
            return req
                .paths
                .iter()
                .map(|p| DeleteOutcome {
                    path: p.clone(),
                    ok: false,
                    error: Some("Impossible de déterminer $HOME".into()),
                    freed: 0,
                    dry_run: req.dry_run,
                })
                .collect();
        }
    };

    let mode_str = match req.mode {
        DeleteMode::Trash => "trash",
        DeleteMode::Permanent => "permanent",
    };

    let mut outcomes = Vec::with_capacity(req.paths.len());

    for raw in &req.paths {
        let path = Path::new(raw);

        // Garde-fou $HOME.
        if !fs_util::is_within_home(path, &home) {
            let outcome = DeleteOutcome {
                path: raw.clone(),
                ok: false,
                error: Some("Refusé : chemin hors de $HOME".into()),
                freed: 0,
                dry_run: req.dry_run,
            };
            journal::append(&JournalEntry {
                timestamp: timestamp(),
                mode: mode_str.into(),
                path: raw.clone(),
                size: 0,
                success: false,
                error: outcome.error.clone(),
                dry_run: req.dry_run,
            });
            outcomes.push(outcome);
            continue;
        }

        let size = path_size(path);

        if req.dry_run {
            outcomes.push(DeleteOutcome {
                path: raw.clone(),
                ok: true,
                error: None,
                freed: size,
                dry_run: true,
            });
            continue;
        }

        // Existence.
        if std::fs::symlink_metadata(path).is_err() {
            let err = "Le chemin n'existe plus".to_string();
            journal::append(&JournalEntry {
                timestamp: timestamp(),
                mode: mode_str.into(),
                path: raw.clone(),
                size,
                success: false,
                error: Some(err.clone()),
                dry_run: false,
            });
            outcomes.push(DeleteOutcome {
                path: raw.clone(),
                ok: false,
                error: Some(err),
                freed: 0,
                dry_run: false,
            });
            continue;
        }

        let result: Result<(), String> = match req.mode {
            DeleteMode::Trash => trash::delete(path).map_err(|e| e.to_string()),
            DeleteMode::Permanent => {
                let meta = std::fs::symlink_metadata(path);
                match meta {
                    Ok(m) if m.is_dir() && !m.file_type().is_symlink() => {
                        std::fs::remove_dir_all(path).map_err(|e| e.to_string())
                    }
                    _ => std::fs::remove_file(path).map_err(|e| e.to_string()),
                }
            }
        };

        let (ok, error, freed) = match result {
            Ok(()) => (true, None, size),
            Err(e) => (false, Some(e), 0),
        };

        journal::append(&JournalEntry {
            timestamp: timestamp(),
            mode: mode_str.into(),
            path: raw.clone(),
            size,
            success: ok,
            error: error.clone(),
            dry_run: false,
        });

        outcomes.push(DeleteOutcome {
            path: raw.clone(),
            ok,
            error,
            freed,
            dry_run: false,
        });
    }

    outcomes
}
