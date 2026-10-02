import { useEffect, useMemo, useState } from "react";
import type {
  DeleteMode,
  ScanConfig,
  ScanProgress,
  ScanResult,
  TabKey,
} from "./types";
import {
  cancelScan,
  getHome,
  onComplete,
  onError,
  onProgress,
  startScan,
} from "./lib/api";
import { useSelection } from "./hooks/useSelection";
import { formatBytes } from "./lib/format";
import { OverviewTab } from "./components/OverviewTab";
import { DuplicatesTab } from "./components/DuplicatesTab";
import { ObsoleteTab } from "./components/ObsoleteTab";
import { LargeFilesTab } from "./components/LargeFilesTab";
import { BrokenLinksTab } from "./components/BrokenLinksTab";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { JournalDialog } from "./components/JournalDialog";

const DEFAULT_CONFIG: ScanConfig = {
  stale_days: 365,
  large_files_count: 50,
  large_file_min_size: 100 * 1024 * 1024,
  duplicate_min_size: 4 * 1024,
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Vue d'ensemble" },
  { key: "duplicates", label: "Doublons" },
  { key: "obsolete", label: "Obsolètes" },
  { key: "large", label: "Gros fichiers" },
  { key: "broken", label: "Liens cassés" },
];

export default function App() {
  const [home, setHome] = useState("");
  const [config, setConfig] = useState<ScanConfig>(DEFAULT_CONFIG);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [mode, setMode] = useState<DeleteMode>("trash");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);

  const sel = useSelection();

  useEffect(() => {
    getHome().then(setHome).catch(() => setHome("$HOME inconnu"));
    const unlisteners: Promise<() => void>[] = [
      onProgress(setProgress),
      onComplete((r) => {
        setResult(r);
        setScanning(false);
        setProgress(null);
      }),
      onError((msg) => {
        setError(msg);
        setScanning(false);
        setProgress(null);
      }),
    ];
    return () => {
      unlisteners.forEach((p) => p.then((fn) => fn()));
    };
  }, []);

  // Chemins portant un avertissement (Syncthing / config), pour l'aperçu.
  const warnedPaths = useMemo(() => {
    const s = new Set<string>();
    if (!result) return s;
    const add = (p: string, w: unknown[]) => w.length > 0 && s.add(p);
    result.duplicates.forEach((g) =>
      g.files.forEach((f) => add(f.path, f.warnings))
    );
    result.obsolete.forEach((e) => add(e.info.path, e.info.warnings));
    result.large_files.forEach((f) => add(f.path, f.warnings));
    result.broken_links.forEach((l) => add(l.path, l.warnings));
    return s;
  }, [result]);

  const hasWarnedSelection = sel.paths.some((p) => warnedPaths.has(p));

  const launchScan = () => {
    setError(null);
    setResult(null);
    sel.clear();
    setScanning(true);
    setProgress(null);
    startScan(config).catch((e) => {
      setError(String(e));
      setScanning(false);
    });
  };

  const handleDeleted = (deleted: string[]) => {
    const gone = new Set(deleted);
    setResult((prev) => prev && pruneResult(prev, gone));
    sel.setMany(
      deleted.map((p) => ({ path: p, size: 0 })),
      false
    );
    setConfirmOpen(false);
  };

  return (
    <div className="flex h-full flex-col">
      {/* En-tête */}
      <header className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧹</span>
          <h1 className="text-lg font-bold">Home Cleaner</h1>
        </div>
        <span
          className="font-mono text-xs text-neutral-400 truncate max-w-[240px]"
          title={home}
        >
          {home}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <ConfigControls
            config={config}
            setConfig={setConfig}
            disabled={scanning}
          />
          <button
            className="btn-ghost"
            onClick={() => setJournalOpen(true)}
            title="Voir le journal des suppressions"
          >
            Journal
          </button>
          {scanning ? (
            <button className="btn-danger" onClick={() => cancelScan()}>
              Annuler
            </button>
          ) : (
            <button className="btn-primary" onClick={launchScan}>
              Scanner $HOME
            </button>
          )}
        </div>
      </header>

      {/* Progression */}
      {scanning && (
        <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-breeze/5">
          <ProgressView progress={progress} />
        </div>
      )}

      {error && (
        <div className="px-4 py-2 bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Onglets */}
      <nav className="flex gap-1 px-3 pt-2 border-b border-neutral-200 dark:border-neutral-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-t-md px-4 py-2 text-sm font-medium ${
              tab === t.key
                ? "bg-neutral-100 dark:bg-neutral-800 text-breeze border-b-2 border-breeze"
                : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            }`}
          >
            {t.label}
            {result && <TabCount tab={t.key} result={result} />}
          </button>
        ))}
      </nav>

      {/* Contenu */}
      <main className="flex-1 overflow-auto bg-neutral-100 dark:bg-neutral-950">
        {!result && !scanning ? (
          <WelcomeScreen />
        ) : result ? (
          <>
            {tab === "overview" && (
              <OverviewTab folders={result.folders} stats={result.stats} />
            )}
            {tab === "duplicates" && (
              <DuplicatesTab groups={result.duplicates} sel={sel} />
            )}
            {tab === "obsolete" && (
              <ObsoleteTab entries={result.obsolete} sel={sel} />
            )}
            {tab === "large" && (
              <LargeFilesTab files={result.large_files} sel={sel} />
            )}
            {tab === "broken" && (
              <BrokenLinksTab links={result.broken_links} sel={sel} />
            )}
          </>
        ) : null}
      </main>

      {/* Barre d'action */}
      <footer className="flex flex-wrap items-center gap-3 px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="text-sm">
          <span className="font-semibold">{sel.count}</span> sélectionné(s) ·{" "}
          <span className="font-semibold text-breeze">
            {formatBytes(sel.totalBytes)}
          </span>{" "}
          récupérable
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex rounded-md border border-neutral-300 dark:border-neutral-700 overflow-hidden text-sm">
            <button
              onClick={() => setMode("trash")}
              className={`px-3 py-1.5 ${
                mode === "trash"
                  ? "bg-breeze text-white"
                  : "bg-transparent text-neutral-500"
              }`}
            >
              Corbeille
            </button>
            <button
              onClick={() => setMode("permanent")}
              className={`px-3 py-1.5 ${
                mode === "permanent"
                  ? "bg-red-600 text-white"
                  : "bg-transparent text-neutral-500"
              }`}
            >
              Définitif
            </button>
          </div>

          <button
            className="btn-ghost"
            onClick={sel.clear}
            disabled={sel.count === 0}
          >
            Désélectionner
          </button>
          <button
            className={mode === "permanent" ? "btn-danger" : "btn-primary"}
            disabled={sel.count === 0}
            onClick={() => setConfirmOpen(true)}
          >
            {mode === "permanent"
              ? "Supprimer définitivement…"
              : "Mettre à la corbeille…"}
          </button>
        </div>
      </footer>

      {confirmOpen && (
        <ConfirmDialog
          paths={sel.paths}
          mode={mode}
          hasWarnings={hasWarnedSelection}
          onCancel={() => setConfirmOpen(false)}
          onDone={handleDeleted}
        />
      )}
      {journalOpen && <JournalDialog onClose={() => setJournalOpen(false)} />}
    </div>
  );
}

/* --- Sous-composants d'en-tête / d'état --- */

function ConfigControls({
  config,
  setConfig,
  disabled,
}: {
  config: ScanConfig;
  setConfig: (c: ScanConfig) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-1 text-xs text-neutral-500">
      <label className="flex items-center gap-1" title="Seuil d'inactivité">
        Inactif &gt;
        <select
          disabled={disabled}
          value={config.stale_days}
          onChange={(e) =>
            setConfig({ ...config, stale_days: Number(e.target.value) })
          }
          className="rounded border border-neutral-300 dark:border-neutral-700 bg-transparent px-1 py-0.5"
        >
          <option value={90}>3 mois</option>
          <option value={180}>6 mois</option>
          <option value={365}>1 an</option>
          <option value={730}>2 ans</option>
        </select>
      </label>
      <label
        className="flex items-center gap-1"
        title="Taille minimale d'un « gros fichier »"
      >
        Gros &gt;
        <select
          disabled={disabled}
          value={config.large_file_min_size}
          onChange={(e) =>
            setConfig({
              ...config,
              large_file_min_size: Number(e.target.value),
            })
          }
          className="rounded border border-neutral-300 dark:border-neutral-700 bg-transparent px-1 py-0.5"
        >
          <option value={10 * 1024 * 1024}>10 Mo</option>
          <option value={100 * 1024 * 1024}>100 Mo</option>
          <option value={500 * 1024 * 1024}>500 Mo</option>
          <option value={1024 * 1024 * 1024}>1 Go</option>
        </select>
      </label>
    </div>
  );
}

function ProgressView({ progress }: { progress: ScanProgress | null }) {
  const frac = progress?.fraction ?? -1;
  const determinate = frac >= 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span>{progress?.message ?? "Initialisation…"}</span>
        <span className="tabular-nums text-neutral-400">
          {progress
            ? `${progress.files_scanned.toLocaleString(
                "fr-FR"
              )} fichiers · ${formatBytes(progress.bytes_scanned)}`
            : ""}
        </span>
      </div>
      <div className="h-2 w-full rounded bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
        <div
          className={`h-full bg-breeze ${
            determinate ? "" : "animate-pulse w-1/3"
          }`}
          style={determinate ? { width: `${frac * 100}%` } : undefined}
        />
      </div>
      {progress?.current && (
        <div className="mt-1 font-mono text-[10px] text-neutral-400 truncate">
          {progress.current}
        </div>
      )}
    </div>
  );
}

function TabCount({ tab, result }: { tab: TabKey; result: ScanResult }) {
  const n =
    tab === "duplicates"
      ? result.duplicates.length
      : tab === "obsolete"
      ? result.obsolete.length
      : tab === "large"
      ? result.large_files.length
      : tab === "broken"
      ? result.broken_links.length
      : 0;
  if (n === 0) return null;
  return (
    <span className="ml-2 rounded-full bg-neutral-300 dark:bg-neutral-700 px-1.5 text-[10px] tabular-nums">
      {n}
    </span>
  );
}

function WelcomeScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-8">
      <div className="text-5xl">🧹</div>
      <h2 className="text-xl font-semibold">Nettoyage de votre dossier home</h2>
      <p className="max-w-md text-sm text-neutral-500">
        Lancez un scan pour détecter doublons, dossiers obsolètes, gros fichiers
        et liens cassés. <strong>Rien n'est supprimé automatiquement</strong> :
        vous validez chaque suppression, avec la corbeille comme option par
        défaut.
      </p>
    </div>
  );
}

/** Retire les chemins supprimés d'un résultat de scan. */
function pruneResult(result: ScanResult, gone: Set<string>): ScanResult {
  const duplicates = result.duplicates
    .map((g) => {
      const files = g.files.filter((f) => !gone.has(f.path));
      return { ...g, files, reclaimable: files[0]?.size * (files.length - 1) || 0 };
    })
    .filter((g) => g.files.length >= 2);

  return {
    ...result,
    duplicates,
    obsolete: result.obsolete.filter((e) => !gone.has(e.info.path)),
    large_files: result.large_files.filter((f) => !gone.has(f.path)),
    broken_links: result.broken_links.filter((l) => !gone.has(l.path)),
  };
}
