// Types miroir des structures Rust sérialisées (voir src-tauri/src/model.rs).

export type Warning = "config" | "syncthing";

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  modified: number | null;
  accessed: number | null;
  is_symlink: boolean;
  warnings: Warning[];
}

export interface DuplicateGroup {
  hash: string;
  size: number;
  reclaimable: number;
  files: FileInfo[];
}

export type ObsoleteReason =
  | "empty_dir"
  | "cache_dir"
  | "build_dir"
  | "temp_file"
  | "stale";

export interface ObsoleteEntry {
  info: FileInfo;
  reason: ObsoleteReason;
  is_dir: boolean;
  detail: string;
}

export interface BrokenLink {
  path: string;
  name: string;
  target: string;
  warnings: Warning[];
}

export interface FolderSize {
  path: string;
  name: string;
  size: number;
  file_count: number;
  is_dir: boolean;
  warnings: Warning[];
}

export interface ScanStats {
  files_scanned: number;
  dirs_scanned: number;
  bytes_scanned: number;
  errors: number;
  duration_ms: number;
  home: string;
}

export interface ScanResult {
  duplicates: DuplicateGroup[];
  obsolete: ObsoleteEntry[];
  large_files: FileInfo[];
  broken_links: BrokenLink[];
  folders: FolderSize[];
  stats: ScanStats;
}

export interface ScanConfig {
  stale_days: number;
  large_files_count: number;
  large_file_min_size: number;
  duplicate_min_size: number;
}

export interface ScanProgress {
  phase: string;
  message: string;
  files_scanned: number;
  bytes_scanned: number;
  current: string;
  fraction: number;
}

export type DeleteMode = "trash" | "permanent";

export interface DeleteRequest {
  paths: string[];
  mode: DeleteMode;
  dry_run: boolean;
}

export interface DeleteOutcome {
  path: string;
  ok: boolean;
  error: string | null;
  freed: number;
  dry_run: boolean;
}

export interface JournalEntry {
  timestamp: string;
  mode: string;
  path: string;
  size: number;
  success: boolean;
  error: string | null;
  dry_run: boolean;
}

export type TabKey =
  | "overview"
  | "duplicates"
  | "obsolete"
  | "large"
  | "broken";
