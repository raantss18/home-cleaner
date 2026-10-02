//! Types partagés entre le backend Rust et le frontend (sérialisés en JSON).

use serde::{Deserialize, Serialize};

/// Avertissements attachés à un chemin (badges dans l'UI).
#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Warning {
    /// Dossier de configuration actif (.config, .local/share, etc.).
    Config,
    /// Situé dans un dossier synchronisé par Syncthing.
    Syncthing,
}

/// Description d'un fichier détecté.
#[derive(Serialize, Clone, Debug)]
pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub size: u64,
    /// Date de modification (timestamp Unix, secondes).
    pub modified: Option<i64>,
    /// Date de dernier accès (timestamp Unix, secondes).
    pub accessed: Option<i64>,
    pub is_symlink: bool,
    pub warnings: Vec<Warning>,
}

/// Groupe de fichiers ayant un contenu strictement identique.
#[derive(Serialize, Clone, Debug)]
pub struct DuplicateGroup {
    /// Hash Blake3 (hex) du contenu commun.
    pub hash: String,
    /// Taille d'un fichier du groupe (identique pour tous).
    pub size: u64,
    /// Espace récupérable si on ne garde qu'un exemplaire.
    pub reclaimable: u64,
    pub files: Vec<FileInfo>,
}

/// Raison pour laquelle une entrée est considérée obsolète.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub enum ObsoleteReason {
    /// Dossier vide.
    EmptyDir,
    /// Dossier de cache connu (~/.cache, node_modules, __pycache__, .venv...).
    CacheDir,
    /// Dossier de build (target/, dist/, build/).
    BuildDir,
    /// Fichier temporaire (*.tmp, *~, .DS_Store...).
    TempFile,
    /// Non modifié / accédé depuis longtemps (au-delà du seuil).
    Stale,
}

#[derive(Serialize, Clone, Debug)]
pub struct ObsoleteEntry {
    pub info: FileInfo,
    pub reason: ObsoleteReason,
    pub is_dir: bool,
    /// Détail lisible (ex. "node_modules", "312 jours").
    pub detail: String,
}

/// Lien symbolique dont la cible n'existe pas.
#[derive(Serialize, Clone, Debug)]
pub struct BrokenLink {
    pub path: String,
    pub name: String,
    /// Cible telle qu'écrite dans le lien.
    pub target: String,
    pub warnings: Vec<Warning>,
}

/// Taille agrégée d'un enfant direct de $HOME (vue d'ensemble).
#[derive(Serialize, Clone, Debug)]
pub struct FolderSize {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub file_count: u64,
    pub is_dir: bool,
    pub warnings: Vec<Warning>,
}

#[derive(Serialize, Clone, Debug, Default)]
pub struct ScanStats {
    pub files_scanned: u64,
    pub dirs_scanned: u64,
    pub bytes_scanned: u64,
    pub errors: u64,
    /// Durée du scan en millisecondes.
    pub duration_ms: u64,
    pub home: String,
}

#[derive(Serialize, Clone, Debug, Default)]
pub struct ScanResult {
    pub duplicates: Vec<DuplicateGroup>,
    pub obsolete: Vec<ObsoleteEntry>,
    pub large_files: Vec<FileInfo>,
    pub broken_links: Vec<BrokenLink>,
    pub folders: Vec<FolderSize>,
    pub stats: ScanStats,
}

/// Paramètres du scan fournis par l'UI.
#[derive(Deserialize, Clone, Debug)]
pub struct ScanConfig {
    /// Seuil "obsolète" en jours (ex. 180, 365).
    pub stale_days: u64,
    /// Nombre de gros fichiers à remonter.
    pub large_files_count: usize,
    /// Taille minimale (octets) pour qu'un fichier compte comme "gros".
    pub large_file_min_size: u64,
    /// Taille minimale (octets) pour rechercher des doublons.
    pub duplicate_min_size: u64,
}

impl Default for ScanConfig {
    fn default() -> Self {
        Self {
            stale_days: 365,
            large_files_count: 50,
            large_file_min_size: 100 * 1024 * 1024, // 100 Mo
            duplicate_min_size: 4 * 1024,           // 4 Ko
        }
    }
}

/// Progression émise vers l'UI pendant le scan.
#[derive(Serialize, Clone, Debug)]
pub struct ScanProgress {
    /// "walk", "hash", "analyze"...
    pub phase: String,
    pub message: String,
    pub files_scanned: u64,
    pub bytes_scanned: u64,
    /// Chemin en cours (tronqué côté UI si besoin).
    pub current: String,
    /// Progression indicative 0.0..=1.0, ou -1 si indéterminée.
    pub fraction: f64,
}

/// Mode de suppression demandé par l'utilisateur.
#[derive(Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeleteMode {
    /// Déplacer vers la corbeille XDG (réversible).
    Trash,
    /// Suppression définitive.
    Permanent,
}

#[derive(Deserialize, Clone, Debug)]
pub struct DeleteRequest {
    pub paths: Vec<String>,
    pub mode: DeleteMode,
    /// Si vrai : ne rien supprimer, seulement rapporter ce qui serait fait.
    pub dry_run: bool,
}

#[derive(Serialize, Clone, Debug)]
pub struct DeleteOutcome {
    pub path: String,
    pub ok: bool,
    pub error: Option<String>,
    /// Octets libérés (ou qui le seraient en dry-run).
    pub freed: u64,
    pub dry_run: bool,
}
