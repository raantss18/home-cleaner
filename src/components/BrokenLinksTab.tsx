import type { BrokenLink } from "../types";
import type { Selection } from "../hooks/useSelection";
import { shortenPath } from "../lib/format";
import { WarningBadges } from "./WarningBadges";
import { Empty } from "./DuplicatesTab";

export function BrokenLinksTab({
  links,
  sel,
}: {
  links: BrokenLink[];
  sel: Selection;
}) {
  if (links.length === 0) {
    return <Empty label="Aucun lien symbolique cassé." />;
  }
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <p className="text-sm text-neutral-500">
          {links.length} lien(s) symbolique(s) pointant vers une cible inexistante.
        </p>
        <div className="ml-auto flex gap-2">
          <button
            className="btn-ghost !py-1 !px-2 text-xs"
            onClick={() =>
              sel.setMany(
                links.map((l) => ({ path: l.path, size: 0 })),
                true
              )
            }
          >
            Tout sélectionner
          </button>
          <button
            className="btn-ghost !py-1 !px-2 text-xs"
            onClick={() =>
              sel.setMany(
                links.map((l) => ({ path: l.path, size: 0 })),
                false
              )
            }
          >
            Aucun
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {links.map((l) => (
          <label
            key={l.path}
            className={`flex items-center gap-3 px-3 py-2 border-b border-neutral-100 dark:border-neutral-800 cursor-pointer
              hover:bg-neutral-50 dark:hover:bg-neutral-800/50 ${
                sel.has(l.path) ? "bg-breeze/10" : ""
              }`}
          >
            <input
              type="checkbox"
              className="h-4 w-4 shrink-0 accent-breeze"
              checked={sel.has(l.path)}
              onChange={() => sel.toggle(l.path, 0)}
            />
            <span className="shrink-0 w-6 text-center text-neutral-400">🔗</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm truncate" title={l.path}>
                  {shortenPath(l.path)}
                </span>
                <WarningBadges warnings={l.warnings} />
              </div>
              <div className="text-xs text-red-500 font-mono truncate" title={l.target}>
                ↳ cible manquante : {shortenPath(l.target, 60)}
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
