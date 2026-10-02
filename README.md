# 🧹 Home Cleaner

Application desktop native (**Tauri 2 + Rust + React/TypeScript**) pour nettoyer
votre dossier personnel (`$HOME`) sous **EndeavourOS / Arch (KDE)**.

Elle **scanne l'intégralité de `$HOME`** et détecte :

- **Doublons** — par hash de contenu **Blake3** (pré-filtre par taille, puis
  hash parallèle multi-thread). Regroupés, avec choix de l'exemplaire à garder.
- **Dossiers obsolètes** — dossiers vides, caches connus (`~/.cache`,
  `node_modules`, `__pycache__`, `.venv`, `.mypy_cache`…), dossiers de build
  (`target/`, `dist/`, `build/`…), fichiers temporaires (`*.tmp`, `*~`,
  `.DS_Store`, `Thumbs.db`…) et fichiers inactifs au-delà d'un seuil configurable.
- **Gros fichiers** — top N par taille.
- **Liens symboliques cassés** — cible inexistante.

## Principes de sécurité

- **Aucune suppression automatique.** Le scan ne produit qu'un rapport. Vous
  cochez manuellement chaque élément (ou par lot) avant toute action.
- **Dry-run systématique** : avant de confirmer, une fenêtre récapitule
  exactement ce qui sera supprimé et l'espace récupérable réel.
- **Deux modes** : *Corbeille* XDG (réversible, par défaut) ou *Suppression
  définitive* (double confirmation : case à cocher **et** saisie de `SUPPRIMER`).
- **Garde-fou `$HOME`** : le backend refuse toute action hors de `$HOME`, même
  si l'UI la demandait.
- **Badges d'avertissement** : les chemins dans un dossier **Syncthing**
  (marqueur `.stfolder` + `config.xml`) ou de **configuration active**
  (`.config`, `.local/share`, `.ssh`, `.gnupg`…) sont signalés — sans être
  exclus du scan.
- **Journal horodaté** de toutes les actions (`~/.local/share/home-cleaner/journal.log`).
- **100 % local** : aucune télémétrie, aucun accès réseau.

## Prérequis (EndeavourOS / Arch)

```bash
# Chaîne de build système pour Tauri 2
sudo pacman -S --needed \
  base-devel curl wget file openssl \
  webkit2gtk-4.1 gtk3 librsvg \
  libappindicator-gtk3

# Rust (si absent)
sudo pacman -S --needed rust
# ou via rustup : https://rustup.rs

# Node.js + npm
sudo pacman -S --needed nodejs npm
```

> Le CLI Tauri n'a **pas** besoin d'être installé globalement : il est déclaré
> comme dépendance de développement du projet (`@tauri-apps/cli`) et invoqué via
> `npm run tauri`.

## Installation des dépendances du projet

```bash
cd home-cleaner
npm install
```

## Lancer en développement

```bash
npm run tauri dev
```

Le frontend Vite démarre sur `http://localhost:1420` et Tauri ouvre la fenêtre
native.

## Build de production

```bash
npm run tauri build
```

Artefacts générés dans `src-tauri/target/release/bundle/` :

- **AppImage** : `appimage/Home Cleaner_0.1.0_amd64.AppImage`
- **`.deb`** : `deb/Home Cleaner_0.1.0_amd64.deb`
- **Binaire natif** : `src-tauri/target/release/home-cleaner`

> Pour la première génération de l'AppImage, Tauri télécharge `linuxdeploy`.
> Le paquet `fuse2` (`sudo pacman -S fuse2`) est nécessaire pour *exécuter* une
> AppImage. Pour ne produire que l'AppImage : `npm run tauri build -- --bundles appimage`.

> **⚠ Arch/EndeavourOS récent — build AppImage :** utilisez `NO_STRIP=true` :
> ```bash
> NO_STRIP=true npm run tauri build -- --bundles appimage
> ```
> Sans cela, le bundle échoue (`failed to run linuxdeploy`) : le `strip` ancien
> embarqué dans `linuxdeploy` ne reconnaît pas la section `.relr.dyn`
> (relocations `DT_RELR`) des bibliothèques système récentes (`libwebkit2gtk-4.1`,
> `libwayland`, `libxml2`…). `NO_STRIP=true` saute cette étape de strip.

## Utilisation

1. Cliquez **Scanner $HOME** (réglez au besoin le seuil d'inactivité et la
   taille « gros fichier » dans l'en-tête). Une barre de progression suit le
   parcours puis le hash des doublons ; **Annuler** interrompt à tout moment.
2. Parcourez les onglets **Vue d'ensemble / Doublons / Obsolètes / Gros
   fichiers / Liens cassés**.
3. Cochez les éléments à supprimer (actions groupées disponibles : « Garder le
   1er » pour un groupe de doublons, « Tout sélectionner », etc.). L'estimation
   d'espace récupérable se met à jour en bas en temps réel.
4. Choisissez **Corbeille** ou **Définitif**, cliquez le bouton de suppression,
   vérifiez l'aperçu (dry-run) puis confirmez.
5. Consultez le **Journal** pour tracer toute action passée.

## Architecture

```
home-cleaner/
├── src/                    # Frontend React + TypeScript (Tailwind)
│   ├── App.tsx             # Orchestration UI, onglets, barre d'action
│   ├── types.ts            # Miroir TS des structures Rust
│   ├── lib/                # api (invoke/events), format
│   ├── hooks/useSelection  # Sélection globale + estimation temps réel
│   └── components/         # Onglets, dialogues, lignes
└── src-tauri/              # Backend Rust
    └── src/
        ├── model.rs        # Types partagés (serde)
        ├── scan.rs         # Parcours borné à $HOME, agrégation, classification
        ├── hashing.rs      # Doublons Blake3 (rayon)
        ├── heuristics.rs   # Règles cache / build / temporaire
        ├── syncthing.rs    # Détection dossiers synchronisés + config active
        ├── actions.rs      # Suppression corbeille/définitif + garde-fous
        ├── journal.rs      # Journal JSON Lines horodaté
        ├── fs_util.rs      # Garde-fou is_within_home, timestamps
        └── lib.rs          # Commandes + événements Tauri
```

### Notes techniques

- **Scan asynchrone** : lancé dans un thread Rust dédié ; la progression et le
  résultat remontent à l'UI via les événements Tauri `scan-progress`,
  `scan-complete`, `scan-error`. L'UI ne gèle jamais.
- **Symlinks** : suivis pendant le parcours mais **bornés à `$HOME`** (toute
  cible réelle hors de `$HOME` est ignorée), avec déduplication par chemin
  canonique pour ne pas compter deux fois le même fichier.
- **Doublons** : deux fichiers de tailles différentes ne peuvent être
  identiques → seuls les groupes de même taille (≥ 2 fichiers) sont hashés,
  en parallèle via `rayon`.
