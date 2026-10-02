//! Détection des dossiers synchronisés par Syncthing et des dossiers de
//! configuration actifs, afin d'apposer des badges d'avertissement.
//!
//! Deux sources sont combinées :
//!  1. Le marqueur `.stfolder` déposé par Syncthing à la racine de chaque
//!     dossier partagé (détection fiable et 100 % locale).
//!  2. La liste des dossiers déclarés dans `config.xml` (emplacements XDG
//!     usuels), pour couvrir les cas où le marqueur serait absent.

use quick_xml::events::Event;
use quick_xml::Reader;
use std::path::{Path, PathBuf};

use crate::model::Warning;

/// Ensemble des racines à surveiller, calculé une fois avant le scan.
#[derive(Clone, Debug, Default)]
pub struct WarningRoots {
    /// Racines de dossiers Syncthing.
    syncthing: Vec<PathBuf>,
    /// Racines de dossiers de configuration actifs.
    config: Vec<PathBuf>,
}

impl WarningRoots {
    /// Construit l'ensemble des racines pour un `$HOME` donné.
    pub fn discover(home: &Path) -> Self {
        let mut syncthing = folders_from_config(home);

        // Marqueurs `.stfolder` : on parcourt jusqu'à une profondeur
        // raisonnable pour ne pas re-scanner tout le home ici (le scan
        // principal enrichira via `is_syncthing`, mais on veut aussi les
        // racines déclarées explicitement).
        for entry in walkdir::WalkDir::new(home)
            .max_depth(6)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            if entry.file_name() == ".stfolder" {
                if let Some(parent) = entry.path().parent() {
                    syncthing.push(parent.to_path_buf());
                }
            }
        }

        syncthing.sort();
        syncthing.dedup();

        let config = config_roots(home);

        Self { syncthing, config }
    }

    /// Calcule les avertissements applicables à un chemin.
    pub fn warnings_for(&self, path: &Path) -> Vec<Warning> {
        let mut out = Vec::new();
        if self.syncthing.iter().any(|root| path.starts_with(root)) {
            out.push(Warning::Syncthing);
        }
        if self.config.iter().any(|root| path.starts_with(root)) {
            out.push(Warning::Config);
        }
        out
    }
}

/// Dossiers de configuration actifs typiques sous $HOME.
fn config_roots(home: &Path) -> Vec<PathBuf> {
    [".config", ".local/share", ".local/state", ".gnupg", ".ssh", ".mozilla", ".thunderbird"]
        .iter()
        .map(|rel| home.join(rel))
        .filter(|p| p.exists())
        .collect()
}

/// Emplacements possibles du `config.xml` de Syncthing.
fn config_xml_candidates(home: &Path) -> Vec<PathBuf> {
    vec![
        home.join(".local/state/syncthing/config.xml"),
        home.join(".config/syncthing/config.xml"),
    ]
}

/// Extrait les chemins de dossiers déclarés dans le `config.xml` de Syncthing.
fn folders_from_config(home: &Path) -> Vec<PathBuf> {
    let mut roots = Vec::new();
    for candidate in config_xml_candidates(home) {
        let Ok(content) = std::fs::read_to_string(&candidate) else {
            continue;
        };
        roots.extend(parse_folder_paths(&content));
    }
    roots
}

/// Parse les attributs `path` des balises `<folder ...>` du config.xml.
fn parse_folder_paths(xml: &str) -> Vec<PathBuf> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    let mut roots = Vec::new();
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) | Ok(Event::Empty(e)) if e.name().as_ref() == b"folder" => {
                for attr in e.attributes().flatten() {
                    if attr.key.as_ref() == b"path" {
                        if let Ok(val) = attr.unescape_value() {
                            let expanded = expand_tilde(val.as_ref());
                            roots.push(expanded);
                        }
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    roots
}

/// Développe un éventuel `~` initial en chemin absolu.
fn expand_tilde(path: &str) -> PathBuf {
    if let Some(stripped) = path.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(stripped);
        }
    }
    PathBuf::from(path)
}
