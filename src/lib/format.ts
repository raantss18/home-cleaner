// Formatage lisible (tailles, dates).

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 o";
  const units = ["o", "Ko", "Mo", "Go", "To"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  );
  const value = bytes / Math.pow(1024, i);
  const digits = value >= 100 || i === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[i]}`;
}

export function formatDate(unixSecs: number | null): string {
  if (unixSecs === null || unixSecs === undefined) return "—";
  const d = new Date(unixSecs * 1000);
  return d.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${Math.round(s % 60)} s`;
}

/** Tronque un chemin au milieu pour l'affichage. */
export function shortenPath(path: string, max = 70): string {
  if (path.length <= max) return path;
  const head = Math.ceil(max * 0.4);
  const tail = Math.floor(max * 0.5);
  return `${path.slice(0, head)}…${path.slice(path.length - tail)}`;
}
