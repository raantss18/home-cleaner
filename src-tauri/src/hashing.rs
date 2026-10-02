//! Détection de doublons par hash de contenu Blake3.
//!
//! Stratégie : pré-filtre par taille (deux fichiers de tailles différentes ne
//! peuvent pas être identiques), puis hash Blake3 en parallèle (rayon)
//! uniquement des fichiers dont la taille est partagée par au moins un autre.

use std::collections::HashMap;
use std::io::Read;
use std::path::PathBuf;

use rayon::prelude::*;

use crate::model::{DuplicateGroup, FileInfo};

/// Entrée candidate au dédoublonnage.
pub struct Candidate {
    pub info: FileInfo,
    pub path: PathBuf,
}

/// Calcule le hash Blake3 (hex) d'un fichier en le lisant par blocs.
fn hash_file(path: &PathBuf) -> std::io::Result<String> {
    let mut file = std::fs::File::open(path)?;
    let mut hasher = blake3::Hasher::new();
    let mut buf = vec![0u8; 1024 * 1024]; // 1 Mo
    loop {
        let n = file.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hasher.finalize().to_hex().to_string())
}

/// Regroupe les candidats en groupes de doublons.
///
/// `min_size` filtre les fichiers trop petits (bruit peu utile à dédoublonner).
/// `progress` est appelé après chaque fichier hashé (pour la barre de
/// progression) : `(hashed_so_far, to_hash_total)`.
pub fn find_duplicates<F>(
    candidates: Vec<Candidate>,
    min_size: u64,
    progress: F,
) -> Vec<DuplicateGroup>
where
    F: Fn(u64, u64) + Sync + Send,
{
    // 1. Pré-filtre par taille.
    let mut by_size: HashMap<u64, Vec<Candidate>> = HashMap::new();
    for c in candidates {
        if c.info.size < min_size || c.info.size == 0 {
            continue;
        }
        by_size.entry(c.info.size).or_default().push(c);
    }

    // On ne hash que les tailles partagées par >= 2 fichiers.
    let to_hash: Vec<Candidate> = by_size
        .into_iter()
        .filter(|(_, v)| v.len() >= 2)
        .flat_map(|(_, v)| v)
        .collect();

    let total = to_hash.len() as u64;
    let done = std::sync::atomic::AtomicU64::new(0);

    // 2. Hash en parallèle.
    let hashed: Vec<(String, Candidate)> = to_hash
        .into_par_iter()
        .filter_map(|c| {
            let result = hash_file(&c.path).ok().map(|h| (h, c));
            let n = done.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
            progress(n, total);
            result
        })
        .collect();

    // 3. Regroupe par (hash) — la taille est déjà garantie identique.
    let mut by_hash: HashMap<String, Vec<Candidate>> = HashMap::new();
    for (h, c) in hashed {
        by_hash.entry(h).or_default().push(c);
    }

    let mut groups: Vec<DuplicateGroup> = by_hash
        .into_iter()
        .filter(|(_, v)| v.len() >= 2)
        .map(|(hash, mut v)| {
            // Tri stable : chemin le plus court d'abord (candidat naturel à garder).
            v.sort_by(|a, b| a.info.path.len().cmp(&b.info.path.len()));
            let size = v[0].info.size;
            let reclaimable = size * (v.len() as u64 - 1);
            DuplicateGroup {
                hash,
                size,
                reclaimable,
                files: v.into_iter().map(|c| c.info).collect(),
            }
        })
        .collect();

    // Groupes les plus "coûteux" en premier.
    groups.sort_by(|a, b| b.reclaimable.cmp(&a.reclaimable));
    groups
}
