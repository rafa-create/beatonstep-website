# Cartes sportives — prototype de calcul métier isolé

**Mise à jour : 13 octobre 2026, après le nouvel arbitrage produit.**
Code uniquement sur la branche de recherche du site, en PR draft #22.
Aucune route Worker, aucune mutation D1, aucun octroi de carte, aucune
modification du build iOS TestFlight en cours.

## Catalogue V1 et identité mondiale

- **400 m** : exception `sub1`, niveau Expert si preuve sportive fiable.
- **Chaque kilomètre entier de 1 à 200 inclus** : 200 familles,
  cartes par minute `sub N` réellement atteinte (pas de précréation).
- **Semi-marathon exact** : 21 097,5 m, entre 21 km et 22 km.
- **Marathon exact** : 42 195 m, entre 42 km et 43 km.

Soit **203 familles**, mais chaque `(distance_cm,sub_minute)` n'est
créé qu'à la demande après une vraie course attestée. La distance
centimétrique est une clé d'identité exacte, **pas une promesse de
précision GPS au centimètre**.

La sortie finalisée ne peut produire **qu'une seule carte**, celle
du **plus grand jalon reconnu franchi** avec un temps de passage
continu et fiable **pauses comprises**. Aucune retombée sur les
petits kilomètres si le plus grand jalon n'est pas admissible.
Exemples : 14,7 km → candidature 14 km ; 21,5 km → semi ;
22 km → 22 km ; 42,3 km → marathon ; 43 km → 43 km.

## Niveaux de difficulté accessibles et visuellement discrets

De **1 à 42 km**, ainsi que **semi** et **marathon**, la grille V1
détermine **sept niveaux** sur chaque kilomètre. Tous les modèles
sont valorisants : distance et temps dominent la carte; la couleur
du niveau n'est qu'un petit détail discret et accessible. **Aucune
rareté** ni style inférieur pour les Débutants.

Les six premiers seuils sportifs (Élite mondiale, Légende, Expert,
Intermédiaire, Régulier et Amateur) suivent la formule de #451 :
`round(ancre_marathon × (distance/42,195km)^1.06)`, avec
progression stricte des tranches.

Le plafond **Débutant** est assoupli par la décision produit :
`max(plafond_original,round(91 × (distance/10km)^1.06))`, toujours
strictement au-dessus d'Amateur. À **10 km**, un parcours en
**1h29:59 → sub90 Débutant**, **1h30:00 → sub91 Débutant**,
**1h31:00 → sub92 non éligible**. Le plafond est une convention de
jeu, **pas une mesure de la valeur du coureur ni un seuil médical**.
À 14 km, 1h09:59 donne `sub70`, Intermédiaire.

**À partir de 43 km et jusqu'à 200 km**, toute course crédible,
authentifiée et dont les mesures sont fiables donne un candidat
« **Légende longue distance** » indépendamment de sa vitesse.
Cela ne dispense ni du contrôle anti-fraude, ni de la validation des
pauses/horodatages, ni des obligations de sécurité et santé.
Marathon 42,195 km conserve les sept niveaux ordinaires.

Les codes de skin sont les identifiants fonctionnels de #451 :
`difficulty_beginner_v1` à `difficulty_world_elite_v1`.
Le rendu graphique réel, les couleurs, les textures et l'accessibilité
doivent être approuvés **dans une étape visuelle séparée**.

## Pas de vol ni de gain avant vérification

Le moteur `worker/sport-card-rules.js` expose un
`evaluateSportCardCandidate(...)` **pur**. Le résultat positif est
seulement `status:'candidate'`, **jamais** « attribué ».
Il dépend d'une preuve de course finalisée, authentifiée et validée
**par un serveur de confiance**, et de jalons sportifs horodatés,
pas de simples données envoyées par le client.

La règle de propriété mondiale reste **un seul exemplaire exact**
par distance canonique × minute. Pour ce palier, une nouvelle course
vérifiée peut voler automatiquement cette même carte au détenteur
précédent. Si personne ne la possède, le coureur l'obtient sans vol.
La multiplication des paliers favorise les occasions de gagner une
carte, mais **ne garantit pas qu'un vol sera possible** : la carte
exacte doit être déjà possédée par quelqu'un d'autre.

## Distance Garmin prioritaire, sans confusion sur le pilote iPhone

Les bilans actuels de courses mobiles préfèrent la distance Garmin
quand une lecture récente et associée à la bonne course existe.
Le pilote GPS iPhone du build 1.7.2 reste **phone_gps uniquement**.
Pour les futures cartes, une distance Garmin fiable est prioritaire
sur la distance du téléphone, mais une durée `timerMs` Garmin active
n'est pas équivalente au **temps sportif réel pauses comprises**.
Ne jamais assembler opportunément des fragments de deux sources.
Le serveur doit vérifier activité, origine, jalons et anti-rejeu.

## Contrôles et livraison

Le lot ajoute les tests `tests/sport-card-rules.test.mjs` au
`npm run build` : toutes les distances, 7 niveaux 1..42,
plafonds accessibles, sub-minute strict, 400m, semi, marathon,
ultras Légende, absence de repli, falsifications évidentes.
Il ne valide **ni l'authenticité de preuves Garmin/GPS**, ni le
Worker transactionnel, ni le design final, ni les transferts D1.

**Ne pas fusionner sur la release iOS** pendant le TestFlight.
`DISTANCE_CHALLENGES_ENABLED=false` reste impératif.
Les migrations **0005/0006** ont été déclarées appliquées
précédemment et ne doivent **pas** être rejouées.
