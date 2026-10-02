import { useEffect, useState } from "react";
import type { JournalEntry } from "../types";
import { getJournal } from "../lib/api";
import { formatBytes } from "../lib/format";

export function JournalDialog({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);

  useEffect(() => {
    getJournal(500).then(setEntries);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Journal des actions</h2>
          <button className="btn-ghost !py-1" onClick={onClose}>
            Fermer
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {entries.length === 0 ? (
            <p className="p-6 text-center text-sm text-neutral-400">
              Aucune action enregistrée pour l'instant.
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-neutral-100 dark:bg-neutral-800 text-left">
                <tr>
                  <th className="px-3 py-2">Horodatage</th>
                  <th className="px-3 py-2">Mode</th>
                  <th className="px-3 py-2">Chemin</th>
                  <th className="px-3 py-2 text-right">Taille</th>
                  <th className="px-3 py-2">État</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr
                    key={i}
                    className="border-b border-neutral-100 dark:border-neutral-800"
                  >
                    <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">
                      {e.timestamp}
                    </td>
                    <td className="px-3 py-1.5">
                      {e.dry_run ? "dry-run" : e.mode}
                    </td>
                    <td
                      className="px-3 py-1.5 font-mono truncate max-w-xs"
                      title={e.path}
                    >
                      {e.path}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {formatBytes(e.size)}
                    </td>
                    <td className="px-3 py-1.5">
                      {e.success ? (
                        <span className="text-emerald-600">✅</span>
                      ) : (
                        <span className="text-red-500" title={e.error ?? ""}>
                          ❌
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-4 py-2 border-t border-neutral-200 dark:border-neutral-800 text-xs text-neutral-400">
          Fichier : ~/.local/share/home-cleaner/journal.log
        </div>
      </div>
    </div>
  );
}
