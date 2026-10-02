import type { ReactNode } from "react";
import type { Warning } from "../types";
import { formatBytes, formatDate, shortenPath } from "../lib/format";
import { WarningBadges } from "./WarningBadges";

interface RowProps {
  path: string;
  size: number;
  modified?: number | null;
  warnings?: Warning[];
  checked: boolean;
  onToggle: () => void;
  /** Badge de gauche (raison, "lien", etc.). */
  tag?: ReactNode;
  isSymlink?: boolean;
  isDir?: boolean;
}

export function Row({
  path,
  size,
  modified,
  warnings = [],
  checked,
  onToggle,
  tag,
  isSymlink,
  isDir,
}: RowProps) {
  return (
    <label
      className={`flex items-center gap-3 px-3 py-2 border-b border-neutral-100 dark:border-neutral-800 cursor-pointer
        hover:bg-neutral-50 dark:hover:bg-neutral-800/50 ${
          checked ? "bg-breeze/10 dark:bg-breeze/10" : ""
        }`}
    >
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0 accent-breeze"
        checked={checked}
        onChange={onToggle}
      />
      <span className="shrink-0 w-6 text-center text-neutral-400" aria-hidden>
        {isDir ? "📁" : isSymlink ? "🔗" : "📄"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {tag}
          <span
            className="font-mono text-sm truncate"
            title={path}
          >
            {shortenPath(path)}
          </span>
          <WarningBadges warnings={warnings} />
        </div>
      </div>
      <span className="shrink-0 w-24 text-right text-sm tabular-nums text-neutral-500">
        {modified !== undefined ? formatDate(modified ?? null) : ""}
      </span>
      <span className="shrink-0 w-20 text-right text-sm font-semibold tabular-nums">
        {formatBytes(size)}
      </span>
    </label>
  );
}
