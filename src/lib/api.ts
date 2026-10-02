// Couche d'accès au backend Tauri (commandes + événements).

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  DeleteMode,
  DeleteOutcome,
  JournalEntry,
  ScanConfig,
  ScanProgress,
  ScanResult,
} from "../types";

export function startScan(config: ScanConfig): Promise<void> {
  return invoke("start_scan", { config });
}

export function cancelScan(): Promise<void> {
  return invoke("cancel_scan");
}

export function deleteItems(
  paths: string[],
  mode: DeleteMode,
  dryRun: boolean
): Promise<DeleteOutcome[]> {
  return invoke("delete_items", { req: { paths, mode, dry_run: dryRun } });
}

export function getJournal(limit = 500): Promise<JournalEntry[]> {
  return invoke("get_journal", { limit });
}

export function getHome(): Promise<string> {
  return invoke("get_home");
}

export function onProgress(cb: (p: ScanProgress) => void): Promise<UnlistenFn> {
  return listen<ScanProgress>("scan-progress", (e) => cb(e.payload));
}

export function onComplete(cb: (r: ScanResult) => void): Promise<UnlistenFn> {
  return listen<ScanResult>("scan-complete", (e) => cb(e.payload));
}

export function onError(cb: (msg: string) => void): Promise<UnlistenFn> {
  return listen<string>("scan-error", (e) => cb(e.payload));
}
