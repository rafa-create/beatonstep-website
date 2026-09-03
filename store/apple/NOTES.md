# App Store (Apple) — captures d’écran

Ces fichiers **ne sont pas utilisés par le site**. Uploader depuis `conforme/` dans App Store Connect.

**Source :** `screenshots-archive/Brut/` (captures 1179×2556).  
Régénérer : `python store/generate.py`

## Contraintes (erreur Connect si une seule image est hors taille)

Au moins une capture doit être exactement :

| Orientation | Dimensions |
|-------------|------------|
| Portrait | **1242 × 2688** px |
| Paysage | **2688 × 1242** px |
| Portrait | **1284 × 2778** px |
| Paysage | **2778 × 1284** px |

PNG ou JPEG.

## `conforme/` — à uploader

```
conforme/1242x2688/   01-adaptatif  02-fixe  03-reglages  04-bibliotheque
conforme/1284x2778/
conforme/2688x1242/
conforme/2778x1284/
```

| # | Écran | Fichier Brut |
|---|--------|----------------|
| 01 | Adaptatif (Mix démo) | `music_mix.PNG` |
| 02 | Fixe (Apple Music) | `apple_music_fixed_mode.PNG` |
| 03 | Réglages | `source_mode_param.PNG` |
| 04 | Bibliothèque (analyse BPM) | `big_analyze_music_tel.PNG` |

`conforme/archives-precedentes/` : anciennes composites, dimensions OK, contenu périmé.

## `non-conforme/` — ne pas uploader

| Fichier / dossier | Taille réelle | Pourquoi ça casse |
|-------------------|---------------|-------------------|
| `captures-brutes-750x1334/` | 750 × 1334 | Captures iPhone brutes, hors liste Apple |
| `pub-testflight-1024x1536.png` | 1024 × 1536 | Pub portrait TestFlight, pas une capture store |

Les PNG dans `screenshots-archive/Brut/` (1179×2556) ne sont **pas** uploadables tels quels.
