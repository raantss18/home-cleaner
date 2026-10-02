import type { DuplicateGroup } from "../types";
import type { Selection } from "../hooks/useSelection";
import { formatBytes } from "../lib/format";
import { Row } from "./Row";

export function DuplicatesTab({
  groups,
  sel,
}: {
  groups: DuplicateGroup[];
  sel: Selection;
}) {
  if (groups.length === 0) {
    return <Empty label="Aucun doublon détecté." />;
  }

  const totalReclaimable = groups.reduce((a, g) => a + g.reclaimable, 0);

  return (
    <div className="p-4 space-y-4">
      <p className="text-sm text-neutral-500">
        {groups.length} groupe(s) de doublons · jusqu'à{" "}
        <span className="font-semibold text-breeze">
          {formatBytes(totalReclaimable)}
        </span>{" "}
        récupérable en ne gardant qu'un exemplaire par groupe.
      </p>

      {groups.map((g) => (
        <div key={g.hash} className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-3 py-2 bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-700">
            <div className="text-sm">
              <span className="font-semibold">{g.files.length} copies</span>
              <span className="text-neutral-500">
                {" "}
                · {formatBytes(g.size)} l'unité · récupérable{" "}
                <span className="text-breeze font-semibold">
                  {formatBytes(g.reclaimable)}
                </span>
              </span>
              <span
                className="ml-2 font-mono text-[11px] text-neutral-400"
                title={g.hash}
              >
                {g.hash.slice(0, 12)}
              </span>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                className="btn-ghost !py-1 !px-2 text-xs"
                onClick={() =>
                  sel.setMany(
                    g.files.slice(1).map((f) => ({ path: f.path, size: f.size })),
                    true
                  )
                }
                title="Garder le premier fichier, sélectionner les autres pour suppression"
              >
                Garder le 1er
              </button>
              <button
                className="btn-ghost !py-1 !px-2 text-xs"
                onClick={() =>
                  sel.setMany(
                    g.files.map((f) => ({ path: f.path, size: f.size })),
                    false
                  )
                }
              >
                Aucun
              </button>
            </div>
          </div>
          <div>
            {g.files.map((f, i) => (
              <Row
                key={f.path}
                path={f.path}
                size={f.size}
                modified={f.modified}
                warnings={f.warnings}
                isSymlink={f.is_symlink}
                checked={sel.has(f.path)}
                onToggle={() => sel.toggle(f.path, f.size)}
                tag={
                  i === 0 ? (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      suggéré à garder
                    </span>
                  ) : undefined
                }
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Empty({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-neutral-400">
      {label}
    </div>
  );
}
