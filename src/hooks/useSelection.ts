import { useCallback, useMemo, useState } from "react";

/**
 * Sélection globale de chemins à supprimer, indépendante de l'onglet actif.
 * On stocke la taille associée à chaque chemin pour estimer en temps réel
 * l'espace récupérable sans avoir à re-parcourir les résultats.
 */
export interface Selection {
  has: (path: string) => boolean;
  toggle: (path: string, size: number) => void;
  set: (path: string, size: number, on: boolean) => void;
  setMany: (items: { path: string; size: number }[], on: boolean) => void;
  clear: () => void;
  paths: string[];
  count: number;
  totalBytes: number;
}

export function useSelection(): Selection {
  const [map, setMap] = useState<Map<string, number>>(new Map());

  const has = useCallback((path: string) => map.has(path), [map]);

  const set = useCallback((path: string, size: number, on: boolean) => {
    setMap((prev) => {
      const next = new Map(prev);
      if (on) next.set(path, size);
      else next.delete(path);
      return next;
    });
  }, []);

  const toggle = useCallback((path: string, size: number) => {
    setMap((prev) => {
      const next = new Map(prev);
      if (next.has(path)) next.delete(path);
      else next.set(path, size);
      return next;
    });
  }, []);

  const setMany = useCallback(
    (items: { path: string; size: number }[], on: boolean) => {
      setMap((prev) => {
        const next = new Map(prev);
        for (const it of items) {
          if (on) next.set(it.path, it.size);
          else next.delete(it.path);
        }
        return next;
      });
    },
    []
  );

  const clear = useCallback(() => setMap(new Map()), []);

  const { paths, totalBytes } = useMemo(() => {
    let total = 0;
    const p: string[] = [];
    for (const [path, size] of map) {
      p.push(path);
      total += size;
    }
    return { paths: p, totalBytes: total };
  }, [map]);

  return {
    has,
    toggle,
    set,
    setMany,
    clear,
    paths,
    count: map.size,
    totalBytes,
  };
}
