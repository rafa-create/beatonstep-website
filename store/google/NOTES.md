# Google Play — image de présentation + captures

Ces fichiers **ne sont pas utilisés par le site**. Uploader depuis `conforme/` dans Play Console.

**Source :** `screenshots-archive/Brut/`  
Régénérer : `python store/generate.py`

## Contraintes — image de présentation (feature graphic)

| Règle | Valeur |
|-------|--------|
| Format | **PNG** ou **JPEG** |
| Poids | jusqu’à **15 Mo** |
| Taille | **1024 × 500** px (exactement) |
| Usage | mise en avant de l’appli sur le Play Store |

## Contraintes — captures téléphone

| Règle | Valeur |
|-------|--------|
| Format | PNG 24 bits (sans alpha) ou JPEG |
| Ratio | **9:16** (ici **1080 × 1920**) |
| Côtés | entre 320 px et 3840 px |
| Poids | jusqu’à 8 Mo / image |

Les captures iPhone brutes (1179×2556 ≈ 9:19,5) ne passent pas.

## `conforme/` — à uploader

| Fichier | Taille |
|---------|--------|
| `feature-graphic-1024x500.jpg` | 1024 × 500 |
| `1080x1920/01-adaptatif.png` | Adaptatif Apple Music (`music_mix.PNG`) |
| `1080x1920/02-fixe.png` | Fixe Apple Music (`apple_music_fixed_mode.PNG`) |
| `1080x1920/03-reglages.png` | Réglages (`source_mode_param.PNG`) |
| `1080x1920/04-bibliotheque.png` | Bibliothèque / analyse (`big_analyze_music_tel.PNG`) |

## `non-conforme/` — ne pas uploader

| Fichier | Taille réelle | Pourquoi ça casse |
|---------|---------------|-------------------|
| `og-image-1200x627.jpg` | 1200 × 627 | Visuel site, **pas** 1024×500 |
| `feature-graphic-bientot-1024x500.jpg` | 1024 × 500 | Ancien texte « Bientôt sur Google Play » |

L’original du site reste `assets/brand/og-image.jpg` — ne pas le déplacer.

## Maj 2026-09-10 — capture Réglages

- **Brut (choix store)** : `screenshots-archive/Brut/source_mode_param.PNG` = **sources toutes ON** (toggles couleurs marque).
- **Référence non store** : `screenshots-archive/Brut/source_mode_param_all_off.PNG` = toutes OFF (détail sources).
- Site : `assets/screenshots/app/settings-sources.png` (ON) · `settings-sources-all-off.png` (OFF).
- Composites régénérés : `03-reglages.png` (Apple + Play). Anciennes : `conforme/archives-precedentes/2026-09-10-reglages/`.
- Motif : remplacer l’ancien Réglages sombre / hors sync Path B Spotify·Deezer.
