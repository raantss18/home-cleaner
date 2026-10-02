import type { FolderSize, ScanStats } from "../types";
import { formatBytes, formatDuration } from "../lib/format";
import { WarningBadges } from "./WarningBadges";
import { Empty } from "./DuplicatesTab";

export function OverviewTab({
  folders,
  stats,
}: {
  folders: FolderSize[];
  stats: ScanStats;
}) {
  if (folders.length === 0) {
    return <Empty label="Aucune donnée. Lancez un scan." />;
  }
  const max = Math.max(...folders.map((f) => f.size), 1);

  return (
    <div className="p-4 space-y-4 overflow-auto h-full">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Fichiers" value={stats.files_scanned.toLocaleString("fr-FR")} />
        <Stat label="Dossiers" value={stats.dirs_scanned.toLocaleString("fr-FR")} />
        <Stat label="Volume total" value={formatBytes(stats.bytes_scanned)} />
        <Stat label="Durée du scan" value={formatDuration(stats.duration_ms)} />
      </div>

      <div className="card">
        <div className="px-3 py-2 text-sm font-semibold border-b border-neutral-200 dark:border-neutral-800">
          Répartition par dossier de premier niveau
        </div>
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {folders.map((f) => (
            <div key={f.path} className="px-3 py-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span aria-hidden>{f.is_dir ? "📁" : "📄"}</span>
                  <span className="font-mono text-sm truncate" title={f.path}>
                    {f.name}
                  </span>
                  <WarningBadges warnings={f.warnings} />
                </div>
                <span className="text-sm font-semibold tabular-nums shrink-0">
                  {formatBytes(f.size)}
                </span>
              </div>
              <div className="h-2 w-full rounded bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                <div
                  className="h-full bg-breeze"
                  style={{ width: `${(f.size / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      {stats.errors > 0 && (
        <p className="text-xs text-neutral-400">
          {stats.errors} entrée(s) ignorée(s) (permissions, boucles de liens…).
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-3 py-2">
      <div className="text-xs text-neutral-400">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
