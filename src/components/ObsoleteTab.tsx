import { useMemo, useState } from "react";
import type { ObsoleteEntry, ObsoleteReason } from "../types";
import type { Selection } from "../hooks/useSelection";
import { formatBytes } from "../lib/format";
import { Row } from "./Row";
import { Empty } from "./DuplicatesTab";

const REASON_META: Record<
  ObsoleteReason,
  { label: string; cls: string }
> = {
  cache_dir: {
    label: "Cache",
    cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  },
  build_dir: {
    label: "Build",
    cls: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  },
  empty_dir: {
    label: "Vide",
    cls: "bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300",
  },
  temp_file: {
    label: "Temporaire",
    cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  },
  stale: {
    label: "Inactif",
    cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  },
};

const ALL_REASONS: ObsoleteReason[] = [
  "cache_dir",
  "build_dir",
  "empty_dir",
  "temp_file",
  "stale",
];

export function ObsoleteTab({
  entries,
  sel,
}: {
  entries: ObsoleteEntry[];
  sel: Selection;
}) {
  const [active, setActive] = useState<Set<ObsoleteReason>>(
    new Set(ALL_REASONS)
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of entries) c[e.reason] = (c[e.reason] ?? 0) + 1;
    return c;
  }, [entries]);

  const filtered = useMemo(
    () => entries.filter((e) => active.has(e.reason)),
    [entries, active]
  );

  if (entries.length === 0) {
    return <Empty label="Aucun élément obsolète détecté." />;
  }

  const toggleReason = (r: ObsoleteReason) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        {ALL_REASONS.map((r) => {
          const m = REASON_META[r];
          const on = active.has(r);
          return (
            <button
              key={r}
              onClick={() => toggleReason(r)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                on ? m.cls : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800"
              }`}
            >
              {m.label} ({counts[r] ?? 0})
            </button>
          );
        })}
        <div className="ml-auto flex gap-2">
          <button
            className="btn-ghost !py-1 !px-2 text-xs"
            onClick={() =>
              sel.setMany(
                filtered.map((e) => ({ path: e.info.path, size: e.info.size })),
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
                filtered.map((e) => ({ path: e.info.path, size: e.info.size })),
                false
              )
            }
          >
            Aucun
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {filtered.map((e) => {
          const m = REASON_META[e.reason];
          return (
            <Row
              key={e.info.path}
              path={e.info.path}
              size={e.info.size}
              modified={e.info.modified}
              warnings={e.info.warnings}
              isDir={e.is_dir}
              checked={sel.has(e.info.path)}
              onToggle={() => sel.toggle(e.info.path, e.info.size)}
              tag={
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${m.cls}`}
                  title={e.detail}
                >
                  {m.label}
                </span>
              }
            />
          );
        })}
        {filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-neutral-400">
            Aucun élément pour ces filtres.
          </div>
        )}
        <div className="p-3 text-center text-xs text-neutral-400">
          Total affiché :{" "}
          {formatBytes(filtered.reduce((a, e) => a + e.info.size, 0))}
        </div>
      </div>
    </div>
  );
}
