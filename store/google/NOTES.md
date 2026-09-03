# Google Play — image de présentation

Ces fichiers **ne sont pas utilisés par le site**. Uploader depuis `conforme/` dans Play Console.

## Contraintes — image de présentation (feature graphic)

| Règle | Valeur |
|-------|--------|
| Format | **PNG** ou **JPEG** |
| Poids | jusqu’à **15 Mo** |
| Taille | **1024 × 500** px (exactement) |
| Usage | mise en avant de l’appli sur le Play Store |

Ce n’est **pas** une capture d’écran téléphone. Une image 1200×627 (Open Graph du site) ou une pub portrait sera refusée.

## `conforme/` — à uploader

| Fichier | Taille | Poids |
|---------|--------|-------|
| `feature-graphic-1024x500.jpg` | 1024 × 500 | ~30 Ko (JPEG) |

Recadrage de `assets/brand/og-image.jpg` (laissé en place pour le site).

## `non-conforme/` — ne pas uploader

| Fichier | Taille réelle | Pourquoi ça casse |
|---------|---------------|-------------------|
| `og-image-1200x627.jpg` | 1200 × 627 | Même visuel que le site, mais **pas** 1024×500 |

L’original du site reste `assets/brand/og-image.jpg` — ne pas le déplacer.

## Captures téléphone (hors image de présentation)

Les captures du site `assets/screenshots/` (575×1024, ~9:16) peuvent servir de **screenshots** Play. Elles ne remplacent pas le feature graphic 1024×500.
