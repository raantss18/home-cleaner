import type { Warning } from "../types";

const LABELS: Record<Warning, { text: string; title: string; cls: string }> = {
  syncthing: {
    text: "Syncthing",
    title:
      "Ce chemin est dans un dossier synchronisé par Syncthing. Supprimer ici propagera la suppression sur vos autres appareils.",
    cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  config: {
    text: "Config active",
    title:
      "Ce chemin fait partie d'un dossier de configuration actif (.config, .local/share…). À supprimer avec prudence.",
    cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  },
};

export function WarningBadges({ warnings }: { warnings: Warning[] }) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <span className="inline-flex gap-1">
      {warnings.map((w) => {
        const l = LABELS[w];
        return (
          <span
            key={w}
            title={l.title}
            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${l.cls}`}
          >
            ⚠ {l.text}
          </span>
        );
      })}
    </span>
  );
}
