//! Orchestration du scan de `$HOME`.
//!
//! Un unique parcours (walkdir) collecte tout ce dont on a besoin :
//! candidats au dédoublonnage, tailles par dossier, liens cassés, dossiers
//! vides / cache / build, fichiers temporaires et fichiers obsolètes. Le hash
//! des doublons se fait ensuite en parallèle.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;

use walkdir::WalkDir;

use crate::fs_util;
use crate::hashing::{self, Candidate};
use crate::heuristics;
use crate::model::*;
use crate::syncthing::WarningRoots;

/// Cap sur le nombre d'entrées "obsolètes" de type fichier isolé renvoyées à
/// l'UI (les dossiers cache/build/vides ne sont pas concernés). Évite de noyer
/// l'interface ; les entrées sont triées par taille avant troncature.
const MAX_STALE_ENTRIES: usize = 2000;

/// Vrai si un dossier (résolu) est dans `$HOME`.
fn dir_within_home(path: &Path, home: &Path) -> bool {
    match std::fs::canonicalize(path) {
        Ok(real) => real.starts_with(home),
        Err(_) => false,
    }
}

/// Construit un `FileInfo` à partir d'un chemin et de ses métadonnées.
fn make_info(
    path: &Path,
    meta: &std::fs::Metadata,
    is_symlink: bool,
    roots: &WarningRoots,
) -> FileInfo {
    FileInfo {
        path: path.to_string_lossy().into_owned(),
        name: heuristics::file_name_str(path).to_string(),
        size: fs_util::entry_size(meta),
        modified: meta.modified().ok().and_then(fs_util::to_unix_secs),
        accessed: meta.accessed().ok().and_then(fs_util::to_unix_secs),
        is_symlink,
        warnings: roots.warnings_for(path),
    }
}

/// Point d'entrée du scan. `emit` reçoit la progression ; `cancel` permet
/// l'annulation coopérative.
pub fn run_scan<E>(
    config: &ScanConfig,
    cancel: &AtomicBool,
    emit: &E,
) -> Result<ScanResult, String>
where
    E: Fn(ScanProgress) + Sync,
{
    let started = Instant::now();
    let home = fs_util::home_dir().ok_or("Impossible de déterminer $HOME")?;

    emit(ScanProgress {
        phase: "prepare".into(),
        message: "Détection des dossiers Syncthing et de configuration…".into(),
        files_scanned: 0,
        bytes_scanned: 0,
        current: home.to_string_lossy().into_owned(),
        fraction: -1.0,
    });

    let roots = WarningRoots::discover(&home);

    // Accumulateurs.
    let mut stats = ScanStats {
        home: home.to_string_lossy().into_owned(),
        ..Default::default()
    };
    let mut seen: HashSet<PathBuf> = HashSet::new();
    let mut candidates: Vec<Candidate> = Vec::new();
    let mut all_files: Vec<FileInfo> = Vec::new();
    let mut broken_links: Vec<BrokenLink> = Vec::new();

    // Tailles par enfant direct de $HOME (vue d'ensemble).
    let mut top_level: HashMap<String, (u64, u64)> = HashMap::new();
    // Nombre d'enfants par dossier (pour détecter les dossiers vides).
    let mut dir_children: HashMap<PathBuf, u64> = HashMap::new();
    // Racines cache/build enregistrées (outermost), avec taille agrégée.
    let mut block_roots: Vec<(PathBuf, ObsoleteReason, u64)> = Vec::new();

    let mut obsolete: Vec<ObsoleteEntry> = Vec::new();
    let mut stale_files: Vec<ObsoleteEntry> = Vec::new();

    let now = fs_util::to_unix_secs(std::time::SystemTime::now()).unwrap_or(0);
    let stale_cutoff = now - (config.stale_days as i64) * 86_400;

    let walker = WalkDir::new(&home)
        .follow_links(true)
        .into_iter()
        .filter_entry(|e| {
            // Bornage : on ne descend jamais dans un dossier dont la cible
            // réelle sort de $HOME. Les non-dossiers sont toujours conservés.
            if e.file_type().is_dir() && e.depth() > 0 {
                dir_within_home(e.path(), &home)
            } else {
                true
            }
        });

    for result in walker {
        if cancel.load(Ordering::Relaxed) {
            return Err("Scan annulé".into());
        }

        let entry = match result {
            Ok(e) => e,
            Err(err) => {
                // Lien symbolique cassé : la cible n'existe pas.
                if let Some(p) = err.path() {
                    if let Ok(meta) = std::fs::symlink_metadata(p) {
                        if meta.file_type().is_symlink() {
                            let target = std::fs::read_link(p)
                                .map(|t| t.to_string_lossy().into_owned())
                                .unwrap_or_default();
                            broken_links.push(BrokenLink {
                                path: p.to_string_lossy().into_owned(),
                                name: heuristics::file_name_str(p).to_string(),
                                target,
                                warnings: roots.warnings_for(p),
                            });
                            continue;
                        }
                    }
                }
                stats.errors += 1;
                continue;
            }
        };

        let path = entry.path();
        let depth = entry.depth();
        if depth == 0 {
            continue; // $HOME lui-même
        }

        let is_symlink = entry.path_is_symlink();
        let file_type = entry.file_type();

        // Comptage enfant pour la détection de dossiers vides.
        if let Some(parent) = path.parent() {
            *dir_children.entry(parent.to_path_buf()).or_insert(0) += 1;
        }

        if file_type.is_dir() {
            stats.dirs_scanned += 1;
            dir_children.entry(path.to_path_buf()).or_insert(0);

            let name = heuristics::file_name_str(path);
            if let Some(reason) = heuristics::classify_dir(name) {
                // N'enregistrer que si pas déjà sous une racine bloc connue.
                let already = block_roots
                    .iter()
                    .any(|(root, _, _)| path.starts_with(root));
                if !already {
                    block_roots.push((path.to_path_buf(), reason, 0));
                }
            }

            if stats.dirs_scanned % 200 == 0 {
                emit(ScanProgress {
                    phase: "walk".into(),
                    message: "Parcours de $HOME…".into(),
                    files_scanned: stats.files_scanned,
                    bytes_scanned: stats.bytes_scanned,
                    current: path.to_string_lossy().into_owned(),
                    fraction: -1.0,
                });
            }
            continue;
        }

        if !file_type.is_file() {
            continue; // sockets, fifo, etc.
        }

        // Déduplication du parcours (symlinks pointant dans $HOME).
        let canonical = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
        if !seen.insert(canonical.clone()) {
            continue;
        }

        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => {
                stats.errors += 1;
                continue;
            }
        };

        let size = meta.len();
        stats.files_scanned += 1;
        stats.bytes_scanned += size;

        let info = make_info(path, &meta, is_symlink, &roots);

        // Vue d'ensemble : attribuer au premier composant sous $HOME.
        if let Ok(rel) = path.strip_prefix(&home) {
            if let Some(first) = rel.components().next() {
                let key = first.as_os_str().to_string_lossy().into_owned();
                let e = top_level.entry(key).or_insert((0, 0));
                e.0 += size;
                e.1 += 1;
            }
        }

        // Attribuer la taille à une éventuelle racine cache/build.
        if let Some((_, _, acc)) = block_roots
            .iter_mut()
            .find(|(root, _, _)| path.starts_with(root.as_path()))
        {
            *acc += size;
        }

        // Classification obsolète (fichiers hors blocs cache/build).
        let under_block = block_roots
            .iter()
            .any(|(root, _, _)| path.starts_with(root.as_path()));
        if !under_block {
            let name = heuristics::file_name_str(path);
            if heuristics::is_temp_file(name) {
                obsolete.push(ObsoleteEntry {
                    info: info.clone(),
                    reason: ObsoleteReason::TempFile,
                    is_dir: false,
                    detail: "fichier temporaire".into(),
                });
            } else {
                // Obsolète si la plus récente des dates (mtime/atime) est ancienne.
                let recent = info.modified.max(info.accessed);
                if let Some(ts) = recent {
                    if ts < stale_cutoff {
                        let days = (now - ts) / 86_400;
                        stale_files.push(ObsoleteEntry {
                            info: info.clone(),
                            reason: ObsoleteReason::Stale,
                            is_dir: false,
                            detail: format!("inactif depuis {days} jours"),
                        });
                    }
                }
            }
        }

        // Candidat doublon + liste des gros fichiers.
        candidates.push(Candidate {
            info: info.clone(),
            path: canonical,
        });
        all_files.push(info);

        if stats.files_scanned % 500 == 0 {
            emit(ScanProgress {
                phase: "walk".into(),
                message: "Parcours de $HOME…".into(),
                files_scanned: stats.files_scanned,
                bytes_scanned: stats.bytes_scanned,
                current: path.to_string_lossy().into_owned(),
                fraction: -1.0,
            });
        }
    }

    if cancel.load(Ordering::Relaxed) {
        return Err("Scan annulé".into());
    }

    // --- Doublons (phase de hash) ---
    emit(ScanProgress {
        phase: "hash".into(),
        message: "Calcul des empreintes Blake3…".into(),
        files_scanned: stats.files_scanned,
        bytes_scanned: stats.bytes_scanned,
        current: String::new(),
        fraction: 0.0,
    });

    let last_pct = std::sync::atomic::AtomicU64::new(0);
    let duplicates = hashing::find_duplicates(candidates, config.duplicate_min_size, |done, total| {
        if total == 0 {
            return;
        }
        let pct = done * 100 / total;
        // Throttle : n'émettre qu'aux changements de pourcentage.
        if pct != last_pct.swap(pct, Ordering::Relaxed) {
            emit(ScanProgress {
                phase: "hash".into(),
                message: format!("Hash des doublons potentiels ({done}/{total})…"),
                files_scanned: stats.files_scanned,
                bytes_scanned: stats.bytes_scanned,
                current: String::new(),
                fraction: done as f64 / total as f64,
            });
        }
    });

    // --- Finalisation obsolètes ---
    // Dossiers cache/build agrégés.
    for (root, reason, acc) in &block_roots {
        let detail = match reason {
            ObsoleteReason::CacheDir => format!("cache · {}", heuristics::file_name_str(root)),
            ObsoleteReason::BuildDir => format!("build · {}", heuristics::file_name_str(root)),
            _ => String::new(),
        };
        let meta = std::fs::symlink_metadata(root).ok();
        let info = FileInfo {
            path: root.to_string_lossy().into_owned(),
            name: heuristics::file_name_str(root).to_string(),
            size: *acc,
            modified: meta
                .as_ref()
                .and_then(|m| m.modified().ok())
                .and_then(fs_util::to_unix_secs),
            accessed: meta
                .as_ref()
                .and_then(|m| m.accessed().ok())
                .and_then(fs_util::to_unix_secs),
            is_symlink: false,
            warnings: roots.warnings_for(root),
        };
        obsolete.push(ObsoleteEntry {
            info,
            reason: reason.clone(),
            is_dir: true,
            detail,
        });
    }

    // Dossiers vides.
    for (dir, count) in &dir_children {
        if *count == 0 {
            let meta = std::fs::symlink_metadata(dir).ok();
            let info = FileInfo {
                path: dir.to_string_lossy().into_owned(),
                name: heuristics::file_name_str(dir).to_string(),
                size: 0,
                modified: meta
                    .as_ref()
                    .and_then(|m| m.modified().ok())
                    .and_then(fs_util::to_unix_secs),
                accessed: meta
                    .as_ref()
                    .and_then(|m| m.accessed().ok())
                    .and_then(fs_util::to_unix_secs),
                is_symlink: false,
                warnings: roots.warnings_for(dir),
            };
            obsolete.push(ObsoleteEntry {
                info,
                reason: ObsoleteReason::EmptyDir,
                is_dir: true,
                detail: "dossier vide".into(),
            });
        }
    }

    // Fichiers obsolètes : tri par taille et troncature.
    stale_files.sort_by(|a, b| b.info.size.cmp(&a.info.size));
    stale_files.truncate(MAX_STALE_ENTRIES);
    obsolete.extend(stale_files);

    // --- Gros fichiers ---
    all_files.sort_by(|a, b| b.size.cmp(&a.size));
    let large_files: Vec<FileInfo> = all_files
        .into_iter()
        .filter(|f| f.size >= config.large_file_min_size)
        .take(config.large_files_count)
        .collect();

    // --- Vue d'ensemble ---
    let mut folders: Vec<FolderSize> = top_level
        .into_iter()
        .map(|(name, (size, count))| {
            let path = home.join(&name);
            let is_dir = path.is_dir();
            FolderSize {
                warnings: roots.warnings_for(&path),
                path: path.to_string_lossy().into_owned(),
                name,
                size,
                file_count: count,
                is_dir,
            }
        })
        .collect();
    folders.sort_by(|a, b| b.size.cmp(&a.size));

    stats.duration_ms = started.elapsed().as_millis() as u64;

    Ok(ScanResult {
        duplicates,
        obsolete,
        large_files,
        broken_links,
        folders,
        stats,
    })
}
