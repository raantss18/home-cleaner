//! Utilitaires filesystem partagés, dont le garde-fou central : ne jamais
//! agir hors de `$HOME`.

use std::path::{Path, PathBuf};
use std::time::SystemTime;

/// Renvoie le `$HOME` canonique de l'utilisateur.
pub fn home_dir() -> Option<PathBuf> {
    let home = dirs::home_dir()?;
    // canonicalize résout les symlinks (ex. /home -> /var/home sur certains setups).
    std::fs::canonicalize(&home).ok().or(Some(home))
}

/// Vrai si `path` est situé à l'intérieur de `home`.
///
/// Le dernier composant n'est volontairement PAS résolu (on ne suit pas un
/// symlink final) : on canonicalise le parent puis on rejoint le nom de
/// fichier. Ainsi un lien symbolique pointant hors de $HOME reste supprimable
/// (c'est le lien, pas sa cible, qui est dans $HOME) mais on rejette tout
/// chemin dont le parent réel sort de $HOME.
pub fn is_within_home(path: &Path, home: &Path) -> bool {
    let Some(file_name) = path.file_name() else {
        // Chemin racine ("/", ".."): jamais dans $HOME de façon sûre.
        return false;
    };
    let parent = path.parent().unwrap_or_else(|| Path::new("/"));
    let real_parent = match std::fs::canonicalize(parent) {
        Ok(p) => p,
        Err(_) => return false,
    };
    let candidate = real_parent.join(file_name);
    candidate.starts_with(home) && candidate != home
}

/// Convertit un `SystemTime` en timestamp Unix (secondes).
pub fn to_unix_secs(time: SystemTime) -> Option<i64> {
    time.duration_since(SystemTime::UNIX_EPOCH)
        .ok()
        .map(|d| d.as_secs() as i64)
        .or_else(|| {
            // Date antérieure à l'epoch (rare) : valeur négative.
            SystemTime::UNIX_EPOCH
                .duration_since(time)
                .ok()
                .map(|d| -(d.as_secs() as i64))
        })
}

/// Taille "logique" d'une entrée : pour un fichier, sa taille ; pour un
/// dossier ou autre, 0 (la taille des dossiers est agrégée ailleurs).
pub fn entry_size(meta: &std::fs::Metadata) -> u64 {
    if meta.is_file() {
        meta.len()
    } else {
        0
    }
}
