import { useEffect, useState } from "react";
import type { DeleteMode, DeleteOutcome } from "../types";
import { deleteItems } from "../lib/api";
import { formatBytes, shortenPath } from "../lib/format";

interface Props {
  paths: string[];
  mode: DeleteMode;
  /** Vrai si au moins un chemin porte un avertissement (Syncthing/config). */
  hasWarnings: boolean;
  onCancel: () => void;
  /** Appelé après suppression réelle réussie, avec les chemins effacés. */
  onDone: (deleted: string[]) => void;
}

/**
 * Confirmation en deux temps :
 *  1. Aperçu dry-run (aucune modification) avec espace récupérable exact.
 *  2. Exécution réelle. En mode définitif, l'utilisateur doit cocher une case
 *     ET saisir "SUPPRIMER".
 */
export function ConfirmDialog({
  paths,
  mode,
  hasWarnings,
  onCancel,
  onDone,
}: Props) {
  const [preview, setPreview] = useState<DeleteOutcome[] | null>(null);
  const [typed, setTyped] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<DeleteOutcome[] | null>(null);

  // Étape 1 : dry-run pour l'aperçu et le calcul exact des tailles.
  useEffect(() => {
    let alive = true;
    deleteItems(paths, mode, true).then((r) => {
      if (alive) setPreview(r);
    });
    return () => {
      alive = false;
    };
  }, [paths, mode]);

  const totalFreed = (preview ?? []).reduce((a, o) => a + o.freed, 0);
  const isPermanent = mode === "permanent";
  const canConfirm =
    !busy &&
    preview !== null &&
    (!isPermanent || (acknowledged && typed.trim() === "SUPPRIMER"));

  const doDelete = async () => {
    setBusy(true);
    const r = await deleteItems(paths, mode, false);
    setResults(r);
    setBusy(false);
    const deleted = r.filter((o) => o.ok).map((o) => o.path);
    if (deleted.length > 0) onDone(deleted);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-lg font-semibold">
            {results
              ? "Résultat"
              : isPermanent
              ? "Suppression définitive"
              : "Envoi à la corbeille"}
          </h2>
        </div>

        <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
          {!results && (
            <>
              <p className="text-sm">
                {paths.length} élément(s) ·{" "}
                <span className="font-semibold text-breeze">
                  {preview ? formatBytes(totalFreed) : "calcul…"}
                </span>{" "}
                à libérer.
              </p>

              {isPermanent && (
                <div className="rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-300">
                  ⚠ Cette action est <strong>irréversible</strong>. Les fichiers
                  ne passeront pas par la corbeille.
                </div>
              )}

              {hasWarnings && (
                <div className="rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 p-3 text-sm text-amber-800 dark:text-amber-300">
                  ⚠ Certains éléments sont dans un dossier synchronisé (Syncthing)
                  ou de configuration active. Vérifiez avant de valider.
                </div>
              )}

              <ul className="text-xs font-mono space-y-1 max-h-56 overflow-auto rounded bg-neutral-50 dark:bg-neutral-800/50 p-2">
                {(preview ?? paths.map((p) => ({ path: p, freed: 0 }))).map(
                  (o) => (
                    <li
                      key={o.path}
                      className="flex justify-between gap-2"
                      title={o.path}
                    >
                      <span className="truncate">{shortenPath(o.path, 60)}</span>
                      <span className="text-neutral-400 shrink-0">
                        {"freed" in o ? formatBytes(o.freed) : ""}
                      </span>
                    </li>
                  )
                )}
              </ul>

              {isPermanent && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-red-600"
                      checked={acknowledged}
                      onChange={(e) => setAcknowledged(e.target.checked)}
                    />
                    Je comprends que cette suppression est définitive.
                  </label>
                  <input
                    type="text"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder="Tapez SUPPRIMER pour confirmer"
                    className="w-full rounded border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-1.5 text-sm font-mono"
                  />
                </div>
              )}
            </>
          )}

          {results && (
            <ul className="text-xs font-mono space-y-1">
              {results.map((o) => (
                <li key={o.path} className="flex justify-between gap-2">
                  <span className="truncate" title={o.path}>
                    {o.ok ? "✅" : "❌"} {shortenPath(o.path, 55)}
                  </span>
                  <span
                    className={
                      o.ok ? "text-neutral-400" : "text-red-500 shrink-0"
                    }
                  >
                    {o.ok ? formatBytes(o.freed) : o.error}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2">
          {results ? (
            <button className="btn-primary" onClick={onCancel}>
              Fermer
            </button>
          ) : (
            <>
              <button className="btn-ghost" onClick={onCancel} disabled={busy}>
                Annuler
              </button>
              <button
                className={isPermanent ? "btn-danger" : "btn-primary"}
                onClick={doDelete}
                disabled={!canConfirm}
              >
                {busy
                  ? "Suppression…"
                  : isPermanent
                  ? "Supprimer définitivement"
                  : "Mettre à la corbeille"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
