//! Backend Tauri de Home Cleaner.

mod actions;
mod fs_util;
mod hashing;
mod heuristics;
mod journal;
mod model;
mod scan;
mod syncthing;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use tauri::{AppHandle, Emitter, Manager, State};

use model::*;

/// État global partagé entre commandes.
#[derive(Default)]
pub struct AppState {
    cancel: Arc<AtomicBool>,
    scanning: Arc<AtomicBool>,
}

/// Lance un scan en tâche de fond. Les résultats arrivent via l'événement
/// `scan-complete` (ou `scan-error`) ; la progression via `scan-progress`.
#[tauri::command]
fn start_scan(app: AppHandle, state: State<'_, AppState>, config: ScanConfig) -> Result<(), String> {
    if state.scanning.swap(true, Ordering::SeqCst) {
        return Err("Un scan est déjà en cours".into());
    }
    state.cancel.store(false, Ordering::SeqCst);

    let cancel = state.cancel.clone();
    let scanning = state.scanning.clone();
    let app_for_thread = app.clone();

    // rayon est synchrone : on isole le scan dans un thread dédié pour ne pas
    // bloquer la boucle d'événements Tauri.
    std::thread::spawn(move || {
        let emit = |p: ScanProgress| {
            let _ = app_for_thread.emit("scan-progress", p);
        };

        let result = scan::run_scan(&config, &cancel, &emit);
        scanning.store(false, Ordering::SeqCst);

        match result {
            Ok(res) => {
                let _ = app_for_thread.emit("scan-complete", res);
            }
            Err(err) => {
                let _ = app_for_thread.emit("scan-error", err);
            }
        }
    });

    Ok(())
}

/// Demande l'annulation coopérative du scan en cours.
#[tauri::command]
fn cancel_scan(state: State<'_, AppState>) {
    state.cancel.store(true, Ordering::SeqCst);
}

/// Supprime (corbeille/définitif) ou simule (dry-run) une liste de chemins.
#[tauri::command]
fn delete_items(req: DeleteRequest) -> Vec<DeleteOutcome> {
    actions::run_delete(&req)
}

/// Renvoie les dernières entrées du journal.
#[tauri::command]
fn get_journal(limit: Option<usize>) -> Vec<journal::JournalEntry> {
    journal::read_recent(limit.unwrap_or(500))
}

/// Renvoie le `$HOME` canonique (affiché dans l'UI).
#[tauri::command]
fn get_home() -> Result<String, String> {
    fs_util::home_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .ok_or_else(|| "Impossible de déterminer $HOME".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            start_scan,
            cancel_scan,
            delete_items,
            get_journal,
            get_home,
        ])
        .setup(|app| {
            // Force la création de la fenêtre principale au démarrage.
            let _ = app.get_webview_window("main");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erreur au lancement de l'application Tauri");
}
