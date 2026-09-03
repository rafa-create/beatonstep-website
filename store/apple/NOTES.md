# App Store (Apple) — captures d’écran

Ces fichiers **ne sont pas utilisés par le site**. Uploader depuis `conforme/` dans App Store Connect.

## Contraintes (erreur Connect si une seule image est hors taille)

Au moins une capture doit être exactement :

| Orientation | Dimensions |
|-------------|------------|
| Portrait | **1242 × 2688** px |
| Paysage | **2688 × 1242** px |
| Portrait | **1284 × 2778** px |
| Paysage | **2778 × 1284** px |

PNG ou JPEG. Pas de 750×1334, 575×1024, 1024×1536, etc.

## `conforme/` — à uploader

Composites actuelles aux 4 tailles Apple, générées par `generate.py` à partir des captures du site (`assets/screenshots/app/`).

```
conforme/1242x2688/   01-adaptatif … 04-bibliotheque
conforme/1284x2778/
conforme/2688x1242/
conforme/2778x1284/
```

`conforme/archives-precedentes/` : anciennes composites **aussi aux bonnes tailles**, mais contenu périmé (ne pas uploader).

Régénérer :

```
python store/apple/generate.py
```

## `non-conforme/` — ne pas uploader (c’est ça qui fait rejeter)

| Fichier / dossier | Taille réelle | Pourquoi ça casse |
|-------------------|---------------|-------------------|
| `captures-brutes-750x1334/` | 750 × 1334 | Captures iPhone brutes, hors liste Apple |
| `pub-testflight-1024x1536.png` | 1024 × 1536 | Pub portrait TestFlight, pas une capture store |
