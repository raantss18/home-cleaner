import type { FileInfo } from "../types";
import type { Selection } from "../hooks/useSelection";
import { Row } from "./Row";
import { Empty } from "./DuplicatesTab";

export function LargeFilesTab({
  files,
  sel,
}: {
  files: FileInfo[];
  sel: Selection;
}) {
  if (files.length === 0) {
    return <Empty label="Aucun gros fichier au-dessus du seuil." />;
  }
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <p className="text-sm text-neutral-500">
          {files.length} plus gros fichiers de $HOME.
        </p>
        <div className="ml-auto flex gap-2">
          <button
            className="btn-ghost !py-1 !px-2 text-xs"
            onClick={() =>
              sel.setMany(
                files.map((f) => ({ path: f.path, size: f.size })),
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
                files.map((f) => ({ path: f.path, size: f.size })),
                false
              )
            }
          >
            Aucun
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {files.map((f) => (
          <Row
            key={f.path}
            path={f.path}
            size={f.size}
            modified={f.modified}
            warnings={f.warnings}
            isSymlink={f.is_symlink}
            checked={sel.has(f.path)}
            onToggle={() => sel.toggle(f.path, f.size)}
          />
        ))}
      </div>
    </div>
  );
}
