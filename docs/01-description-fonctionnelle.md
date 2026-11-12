# Ma Cave — description fonctionnelle v0.3

Application mobile personnelle de gestion de cave à vin, augmentée par Claude.
Document de cadrage. La v0.2 a fixé le stack technique, l'hébergement et le plan d'itérations ; la v0.3 fixe le nom et le dépôt.

Maquette interactive (7 écrans) : https://claude.ai/artifact/Q2iFq9qLcrrZuZPZXdjcY2
Conventions de développement : `CLAUDE.md` à la racine du dépôt.

## 1. Vision

Une seule personne, une cave, un iPhone. Trois moments d'usage :

| Moment | Besoin | Écran |
|---|---|---|
| À la cave | Savoir ce que j'ai, ajouter ou retirer une bouteille en quelques secondes | Ma cave, Fiche vin, Ajouter |
| À table | Noter ce que je bois pour que l'app apprenne mes goûts ; choisir le vin qui va avec le plat | Noter, Accords |
| En magasin | Savoir si ce vin inconnu me plaira avant de l'acheter | Vérifier en magasin |

Principe directeur : chaque action courante tient en trois gestes au plus. L'IA ne se présente jamais comme un chat ; elle est un conseil contextuel, signalé par une icône unique, à quatre endroits précis.

## 2. Périmètre v1

Dans le périmètre :

- Inventaire des vins avec quantités, emplacement, prix payé, fenêtre de garde.
- Ajout par photo d'étiquette (lecture IA) ou par description libre, puis confirmation manuelle.
- Mouvements de stock : +1 acheté, −1 ouvert.
- Notation après ouverture : note 1 à 5, descripteurs aimés et gênants, commentaire, « à racheter ».
- Profil de goûts déduit et corrigeable par l'utilisateur.
- Verdict d'affinité pour un vin inconnu (photo ou description).
- Accord plat → vins de la cave, avec alternatives et vins écartés.
- Recherche et filtres (couleur, pays, région, cépage, à boire).
- Export et import complets des données en JSON.

Hors périmètre v1 : multi-utilisateurs, synchronisation entre appareils, partage, prix du marché, scan de code-barres, suivi de température, import depuis Vivino ou autre.

## 3. Exigences fonctionnelles

### E1 — Cave

- F1.1 Afficher la liste des vins groupés par couleur, avec millésime, nom, domaine, région et nombre de bouteilles.
- F1.2 Filtrer par couleur ; rechercher sur nom, domaine, cépage, région.
- F1.3 Signaler les vins « à boire maintenant » quand l'année courante atteint la fenêtre de garde.
- F1.4 Fiche vin : photo d'étiquette, données descriptives, stock, emplacement, prix, conseil IA de service et d'accord, historique des dégustations.
- F1.5 Actions de stock depuis la fiche : « J'en ouvre une » (−1 et ouverture de l'écran Noter) et « +1 achetée ».
- F1.6 Édition manuelle de tout champ.

### E2 — Ajouter un vin

- F2.1 Prendre une photo de l'étiquette ; l'IA extrait nom, domaine, millésime, couleur, pays, région, cépage(s), degré, mentions utiles.
- F2.2 Afficher les champs pré-remplis pour vérification ; aucun ajout sans confirmation explicite.
- F2.3 Sans photo : saisir une phrase (« Cornalin Germanier 2019 ») et obtenir la même pré-saisie.
- F2.4 Si le vin existe déjà en cave, proposer d'augmenter la quantité plutôt que de créer un doublon.
- F2.5 Référentiels alimentés automatiquement : couleurs (fixe), pays, régions, cépages. L'utilisateur peut corriger une entrée.
- F2.6 Ajout manuel complet sans IA, pour fonctionner sans clé API ou sans réseau.

### E3 — Noter une dégustation

- F3.1 Note de 1 à 5 avec libellés aux extrémités (« Pas pour moi » / « J'en veux encore »).
- F3.2 Descripteurs positifs (fruité, épicé, boisé, tanins souples, minéral, puissant, léger, long) et négatifs (trop acide, trop boisé, finale courte, alcool marqué, bouchonné). Liste extensible.
- F3.3 Commentaire libre court, contexte facultatif (plat, occasion).
- F3.4 Interrupteur « à racheter ».
- F3.5 Chaque enregistrement déclenche la mise à jour du profil de goûts.

### E4 — Profil de goûts

- F4.1 Synthèse en une phrase, produite par l'IA à partir de l'ensemble des dégustations.
- F4.2 Cinq axes notés sur 10 : fruit, fraîcheur, épices, puissance, boisé.
- F4.3 Cépages qui marchent, profils à éviter.
- F4.4 L'utilisateur peut contester une déduction ; la correction est mémorisée et pèse dans les synthèses suivantes.
- F4.5 Indiquer le nombre de dégustations sur lequel repose le profil. En dessous de 5 notes, afficher un profil « provisoire ».

### E5 — Vérifier en magasin

- F5.1 Photo d'étiquette ou description → identification du vin.
- F5.2 Verdict en trois niveaux (« Devrait vous plaire », « Mitigé », « Probablement pas pour vous ») et score d'affinité sur 10.
- F5.3 Trois à quatre raisons, signées + / − / i, qui citent des faits du profil et de la cave (« même domaine que votre Cornalin noté 5 », « 14 rouges déjà en cave »).
- F5.4 Actions : « J'achète, l'ajouter » (enchaîne sur l'écran Ajouter pré-rempli) ou « Je passe ».
- F5.5 Chaque verdict est journalisé ; si l'utilisateur achète puis note le vin, l'écart entre verdict et note sert à calibrer.

### E6 — Accords

- F6.1 Saisir le plat en texte, ou photographier le plat ou la recette.
- F6.2 Résultat : un choix principal dans la cave avec justification en deux phrases et conseil de service, puis deux alternatives, puis les vins écartés avec la raison.
- F6.3 Le choix tient compte du profil de goûts, des stocks et de la fenêtre de garde (privilégier les vins à boire).
- F6.4 Si rien ne convient en cave, le dire clairement et proposer un type de vin à acheter.
- F6.5 Un geste pour passer du choix à la fiche, puis à « J'en ouvre une ».

### E7 — Réglages et données

- F7.1 Saisie et test de la clé API Claude ; l'application fonctionne sans clé, fonctions IA désactivées avec un message clair.
- F7.2 Export JSON complet (vins, mouvements, dégustations, profil, verdicts, accords, photos) via la feuille de partage iOS, vers Fichiers / iCloud Drive.
- F7.3 Import JSON avec remplacement ou fusion, après confirmation.
- F7.4 Rappel d'export si le dernier remonte à plus de 30 jours.
- F7.5 Consultation de la cave hors ligne ; les fonctions IA exigent le réseau et l'indiquent.
- F7.6 Interface en français ; clés de traduction prêtes pour DE/EN sans refonte.

## 4. Exigences non fonctionnelles

- Simplicité : aucun écran ne demande plus de six champs ; aucune action courante au-delà de trois gestes.
- Temps de réponse : lecture d'étiquette et verdict sous 8 s ; accord sous 10 s ; état d'attente explicite.
- Données : sur l'appareil, aucune base serveur. La sauvegarde est de la responsabilité de l'utilisateur, assistée par le rappel d'export.
- Confidentialité : la clé API est stockée sur l'appareil uniquement ; les photos ne quittent l'appareil que vers l'API Anthropic, le temps de la requête.
- Coût : sous CHF 5 par mois pour 50 à 80 appels IA (estimation au § 6). Limite de dépense posée sur la clé dans la Console Anthropic.
- Accessibilité : contrastes 4.5:1, cibles tactiles 44 px, code couleur toujours doublé d'un libellé.
- Cible : iPhone 16 Pro, iOS 18 ou plus récent, Safari. Viewport 402 × 874 CSS px.

## 5. Modèle de données

Tables Dexie (IndexedDB), un enregistrement par ligne, identifiants UUID générés côté client.

```
wines            id, name, producer, vintage, color (rouge|blanc|rosé|bulles),
                 country, region, appellation, grapes[], alcohol, sweetness,
                 drinkFrom, drinkUntil, labelPhotoId, location, notes, createdAt, updatedAt
photos           id, blob (JPEG ≤ 1280 px), width, height, createdAt
stockMovements   id, wineId, delta (+1|-1), reason (achat|ouverture|casse|cadeau),
                 pricePaid, date
tastings         id, wineId, score (1-5), likedDescriptors[], dislikedDescriptors[],
                 comment, context, rebuy (bool), date
tasteProfile     id (singleton), summary, axes {fruit, freshness, spice, power, oak},
                 favoriteGrapes[], avoidPatterns[], basedOnTastings, generatedAt
profileOverrides id, field, userValue, reason, date
verdicts         id, wineIdentified (json), affinity (0-10), level, reasons[],
                 outcome (acheté|passé), date
pairingRequests  id, dish, photoId, topPickWineId, alternatives[], rejected[], date
settings         key, value   (clé API, langue, date du dernier export, préférences)
refCountries / refRegions / refGrapes   tables de référence alimentées à l'ajout
```

Le stock courant d'un vin est la somme de ses mouvements ; on garde l'historique plutôt qu'un compteur.
Le fichier d'export JSON est la sérialisation de toutes les tables, version de schéma incluse, photos en base64.

## 6. Intégration Claude

Quatre appels, émis directement depuis l'application avec la clé de l'utilisateur. Aucun chat libre en v1.

| Cas | Entrée | Sortie structurée | Modèle |
|---|---|---|---|
| Lecture d'étiquette | image + liste des vins déjà en cave | objet Wine partiel + confiance par champ + doublon probable | claude-opus-5-5 (vision) |
| Verdict magasin | image ou texte + profil + inventaire résumé | niveau, score, raisons[] | claude-opus-5-5 |
| Accord | plat (texte ou image) + inventaire + profil | choix, alternatives[], écartés[], service | claude-opus-5-5 |
| Synthèse du profil | toutes les dégustations + corrections utilisateur | TasteProfile | claude-opus-5-5 |

Choix techniques :

- SDK TypeScript officiel, option d'appel depuis le navigateur activée, en-tête CORS géré par le SDK.
- Sorties structurées (`output_config.format`) avec schéma JSON strict : l'app ne parse jamais de texte libre.
- Profil et inventaire résumé envoyés en tête de requête comme préfixe stable, pour le cache de prompt.
- La synthèse du profil n'est recalculée qu'après une nouvelle dégustation ou une correction.
- Haiku 5.5 reste une option pour la lecture d'étiquette si le coût devait compter ; à mesurer sur de vraies étiquettes.

Ordre de grandeur de coût (Opus 5.5 : 4 USD / M tokens en entrée, 20 USD / M en sortie) :

| Appel | Tokens entrée | Tokens sortie | Coût |
|---|---|---|---|
| Lecture d'étiquette (photo ≈ 1 500 tokens + contexte) | ≈ 3 000 | ≈ 400 | ≈ 0,02 USD |
| Verdict ou accord | ≈ 4 000 | ≈ 600 | ≈ 0,03 USD |
| Synthèse du profil (50 dégustations) | ≈ 6 000 | ≈ 500 | ≈ 0,03 USD |

À 60 appels par mois : moins de 2 USD.

## 7. Stack technique et hébergement (décision)

### Décision

PWA Angular sans backend, données embarquées sur le téléphone, hébergée sur GitHub Pages.

| Couche | Choix | Pourquoi |
|---|---|---|
| Application | Angular 22, standalone, signals, OnPush, SCSS, PWA | Votre stack, conventions AquaPlan réutilisées telles quelles |
| Base de données | IndexedDB via Dexie 4, sur l'appareil | « Base embarquée » au sens strict : aucun serveur, lecture instantanée, hors ligne natif. Export / import JSON pour la sauvegarde |
| IA | SDK Anthropic TypeScript depuis le navigateur, clé saisie dans Réglages | Supprime le seul composant qui aurait justifié un backend |
| Photos | Blob JPEG redimensionné dans IndexedDB | Quelques centaines de Ko par vin, acceptable pour une cave personnelle |
| Hébergement | GitHub Pages depuis ce dépôt, déploiement par GitHub Actions à chaque fusion sur `main` | Statique, gratuit, HTTPS, aucune maintenance. URL stable à installer une fois sur l'écran d'accueil |
| Tests | Vitest (logique) + Playwright (parcours, device iPhone 16 Pro) | Exécutables dans cet environnement à chaque itération, avant que vous testiez sur le téléphone |

### Pourquoi pas un fichier JSON côté serveur

Un fichier JSON derrière une API .NET aurait exigé un serveur allumé en permanence (Synology exposé ou Render, dont l'offre gratuite endort le service et impose 30 à 50 s de réveil sur mobile), un Docker à maintenir et une authentification. Pour un utilisateur unique, c'est trois composants pour zéro gain fonctionnel. IndexedDB est le fichier JSON local du navigateur, avec des index ; l'export JSON en donne une copie lisible.

### Pourquoi pas natif iOS

Vous avez demandé iOS ; une PWA installée sur l'écran d'accueil y répond sans Xcode, sans compte développeur et sans expiration. Je peux construire et tester chaque itération ici, puis vous la testez en ouvrant une URL. Avec Swift, aucune itération ne serait vérifiable de mon côté. Si la sensation native manquait, Capacitor réemballe le même code Angular ; la décision peut attendre la v1.

### Ce que ce choix coûte, dit clairement

- La clé API est sur le téléphone. Un seul utilisateur, clé dédiée, limite de dépense dans la Console, révocable : risque accepté.
- Les données sont sur un seul appareil. Pas de synchronisation. Perte du téléphone ou suppression de la PWA = perte des données depuis le dernier export. D'où F7.2 à F7.4.
- Safari iOS et les PWA : installation et mise à jour du service worker parfois capricieuses (vous l'avez vécu sur AquaPlan). À vérifier dès l'itération 0, avec repli documenté.
- Pas de viseur caméra intégré : la prise de photo passe par l'appareil photo système. Pour l'usage visé, c'est un geste de plus, pas un manque.

## 8. Décisions prises

1. Stack : PWA Angular, IndexedDB, Claude direct, GitHub Pages (§ 7).
2. Cible : iPhone 16 Pro, Safari, iOS 18+.
3. Langue : français seul en v1, clés prêtes pour DE/EN.
4. Pas de viseur intégré ; caméra système.
5. Historique des verdicts conservé (F5.5) : coût nul en local, utile pour calibrer.
6. Nom : **Ma Cave**. Libellé de l'écran d'accueil iOS : « Ma Cave ».
7. Dépôt dédié : `franko-devmaster/MaCave`, public (condition de GitHub Pages sur un compte gratuit). URL de l'application : https://franko-devmaster.github.io/MaCave/

Aucune décision ouverte. Prochaine étape : itération 0.

## 9. Stratégie de test par itération

Chaque itération se termine par trois vérifications, dans l'ordre :

1. Ici : `npm test` (Vitest), `npx playwright test` sur le device iPhone 16 Pro, `npm run build`. Captures d'écran Playwright jointes à la conversation.
2. GitHub Pages : fusion sur `main`, déploiement automatique.
3. Vous, sur l'iPhone : ouvrir l'URL (PWA installée dès l'itération 0), dérouler le scénario de recette de l'itération, retours dans la conversation.

Les fonctions IA sont testées ici avec des réponses fixtures ; les appels réels sont validés par vous, avec votre clé, sur le téléphone.

## 10. Plan d'itérations

Tranches verticales, chacune utilisable seule sur le téléphone.

| It. | Contenu | Scénario de recette sur l'iPhone | Dépend de |
|---|---|---|---|
| 0 — Socle | Projet Angular, tokens du design, tab bar, écrans vides, PWA installable, CI + GitHub Pages, Dexie initialisé, export/import JSON vide | Installer la PWA, la rouvrir, naviguer entre les 4 onglets, vérifier qu'une mise à jour est prise | — |
| 1 — Cave | E1 complet + F2.6 (ajout manuel) + F7.2 à F7.4 (export, import, rappel) | Saisir 5 vins à la main, filtrer, rechercher, ouvrir une fiche, +1 / −1, exporter vers Fichiers, réinstaller, importer | 0 |
| 2 — Connecteur Claude et lecture d'étiquette | F7.1 (clé, test de connexion), E2 par photo et par description (F2.1 à F2.5), redimensionnement photo, gestion d'erreurs | Saisir la clé, photographier 3 étiquettes réelles, corriger, ajouter ; tester une description libre ; tester sans réseau | 1 |
| 3 — Dégustations | E3, historique sur la fiche, enchaînement « J'en ouvre une » → Noter | Ouvrir un vin, le noter, revoir la note sur la fiche | 1 |
| 4 — Profil de goûts | E4 : synthèse IA, axes, cépages, corrections | Après 5 notes, voir le profil ; contester une déduction ; renoter et voir l'évolution | 3 |
| 5 — Accords | E6 : plat en texte puis photo, choix, alternatives, écartés, lien vers la fiche | Trois plats réels, un dont rien ne convient en cave | 4 |
| 6 — Magasin | E5 : verdict, raisons, journal, enchaînement vers Ajouter | Deux vins en magasin, un acheté puis noté | 4 |
| 7 — Finitions | Hors ligne robuste, conseil IA sur la fiche (F1.4), à boire (F1.3), icônes et écran de lancement, polissage des transitions | Scénario complet de bout en bout | 1 à 6 |

Ordre justifié : la cave sans IA est utile dès l'itération 1 ; le connecteur arrive en 2 parce qu'il conditionne tout le reste ; le profil (4) précède accords et magasin qui en dépendent. Les itérations 5 et 6 sont permutables.

## 11. Avancement

| It. | État |
|---|---|
| 0 — Socle | Livrée, recette validée |
| 1 — Cave | Livrée, recette validée |
| 2 — Connecteur Claude et lecture d'étiquette | Livrée, recette validée |
| 3 — Dégustations | Livrée, recette validée |
| 4 — Profil de goûts | Livrée, recette validée |
| 5 — Accords | Livrée, recette validée |
| 6 — Magasin | Livrée, recette validée |
| 7 — Finitions | Livrée, en recette |

Le plan de la v1 est entièrement livré.

### Évolutions après la v1

| Version | Évolution | État |
|---|---|---|
| 0.8.0 | Fiche info et photo Bouteille | Livrée, recette validée |
| 0.9.0 | Conseil enrichi par la fiche info, photo en plein écran | Livrée, retours intégrés en 0.10.0 |
| 0.10.0 | Visionneuse claire, libellés, stock et prix modifiables | Livrée |
| 0.11.0 | Indicateurs et filtres combinables dans la cave | Livrée, en recette |

0.8.0 — Fiche info et photo Bouteille, à la demande de l'utilisateur :

- Deux emplacements par vin : « Bouteille » (la photo affichée sur la fiche) et « Fiche info » (photo ou PDF, par exemple un descriptif QoQa).
- Aucune de ces opérations n'appelle Claude ni ne modifie la fiche descriptive.
- En remplaçant la photo Bouteille, l'application propose de garder l'ancienne comme fiche info si le vin n'en a pas encore : la photo prise à l'achat pour ses informations n'est pas perdue quand on photographie ensuite l'étiquette de face.
- La fiche info s'ouvre en plein écran ; un PDF peut aussi être partagé ou enregistré dans Fichiers.
- Correctif : changer une photo ne fait plus recalculer le conseil de la fiche.

0.9.0 — Conseil enrichi par la fiche info, photo en plein écran, à la demande de l'utilisateur :

- La fiche info (PDF ou photo) est envoyée à Claude avec la demande de conseil. Ses informations (garde, service, accords du producteur) priment sur les estimations générales, jamais sur les dégustations.
- Claude en tire un résumé d'une ligne, affiché sous le conseil (« D'après la fiche info : … ») et mémorisé sur le vin. Les accords le reçoivent avec l'inventaire, sans renvoyer le fichier.
- Ajouter, remplacer ou supprimer la fiche info redemande le conseil ; changer la photo Bouteille ne le redemande toujours pas.
- Toucher la photo Bouteille l'affiche en plein écran. « Remplacer la photo » se trouve dans la visionneuse. Sans photo, toucher l'emplacement ouvre l'appareil photo.
- La visionneuse plein écran est partagée entre la photo Bouteille et la fiche info.

0.10.0 — Retours de recette de la 0.9.0 :

- Visionneuse sur fond blanc comme le reste de l'application : croix de fermeture en haut, titre, actions en bas sous forme de boutons du design system.
- Fiche info : « Remplacer la fiche » en bouton, « Supprimer la fiche » en bouton discret bordeaux.
- Libellés : « Ouvrir une bouteille » et « Ajouter une bouteille » (au lieu de « J'en ouvre une » et « + 1 achetée »), empilés sur toute la largeur ; « Prix payé », « Cépages », « Modifier le vin », « Ajouter une photo », « Photo de la bouteille », « Je l'achète » en magasin.
- Modifier le vin : tous les champs sont modifiables, y compris le nombre de bouteilles en cave (0 accepté) et le prix payé par bouteille. Un écart de stock est enregistré comme mouvement « correction » ; le prix corrige celui du dernier achat.
- Enregistrer la fiche sans rien changer ne fait plus redemander le conseil de Claude ; corriger seulement le stock ou le prix non plus.

0.11.0 — Indicateurs et filtres combinables dans la cave :

- Puce sous le nombre de bouteilles, l'une ou l'autre : rouge « À boire rapidement », verte « Prêt à boire ». La fin de la garde atteinte prime, puis l'état du conseil de Claude (en déclin → rouge ; prêt ou à son apogée → vert ; trop jeune → rien), puis le début de la garde atteint (→ vert). Le compteur « à boire » suit la même règle.
- À gauche du nombre, dans cet ordre et sans colonne réservée : étoile bordeaux « Selon vos goûts », puis couronne « Grand cru ». Les deux viennent de l'évaluation de Claude dans le conseil de la fiche :
  - étoile : vin dégusté, moyenne de vos notes d'au moins 4 sur 5 ; pas encore dégusté, affinité d'au moins 8 sur 10 donnée par Claude d'après le profil et les dégustations (consigne d'exigence dans le prompt) ;
  - couronne : Claude juge le vin de tout premier rang (grand cru officiel, cru classé, ou référence majeure de sa région) ; une mention « grand cru » dans le nom ne suffit pas.
  - Un vin dont la fiche n'a jamais été ouverte n'a ni affinité ni évaluation : pas d'étoile (sauf note), pas de couronne. Les conseils d'avant cette version sont redemandés une fois, à l'ouverture de la fiche.
- Filtres en trois groupes, une ligne chacun : couleur ; quand le boire (à boire vite, prêt à boire) ; goût et rang (mes goûts, grands crus). Dans un groupe, les choix s'additionnent (rouges ou blancs) ; entre groupes, ils se cumulent (rouges et prêts à boire). « Tous » efface tout.
- Aucun appel supplémentaire : l'affinité et le grand cru sont deux champs de plus dans la réponse du conseil. Le texte « à boire » disparaît des lignes : la puce le remplace. Deux couleurs d'état s'ajoutent à la palette, à la demande de l'utilisateur : `--color-soon` (rouge) et `--color-ready` (vert).

Choix faits pendant l'itération 1, à confirmer en recette :

- L'écran Ajouter reste ouvert après un enregistrement et se vide, pour enchaîner la saisie initiale de la cave.
- Le formulaire montre six champs ; pays, région, cépages, garde, degré, douceur, emplacement et notes sont sous « Plus de détails ».
- Les vins épuisés sortent de la liste mais restent consultables, pour retrouver un vin à racheter.
- Le rappel d'export compte depuis le premier vin saisi tant qu'aucun export n'a été fait.
- Un référentiel de 16 pays, environ 140 régions et 80 cépages est chargé au premier lancement, puis enrichi par les saisies.

Choix faits pendant l'itération 2, à confirmer en recette :

- La clé API n'est enregistrée qu'après un test réussi auprès de l'API. Ce test lit la fiche du modèle et ne coûte rien.
- Claude estime aussi la fenêtre de garde ; elle est toujours signalée « à vérifier ».
- Une description peut contenir la quantité et le prix (« 6 bouteilles à 34 francs ») : ils sont repris dans le formulaire.
- Un doublon est détecté par Claude ou, à défaut, par nom, producteur et millésime identiques. La proposition apparaît au moment d'enregistrer, y compris pour une saisie manuelle.
- La photo d'un vin saisi à la main peut être ajoutée ou changée depuis sa fiche.
- La photo est réduite à 1 280 px en JPEG avant l'envoi et le stockage ; l'export JSON contient les photos en base64.

Choix faits pendant l'itération 3, à confirmer en recette :

- « J'en ouvre une » retire la bouteille et ouvre directement l'écran Noter. L'ouverture s'y annule si elle était involontaire ; « Fiche » permet de noter plus tard.
- On peut aussi noter sans ouvrir de bouteille, depuis « Noter » sur la fiche, par exemple pour un vin bu ailleurs.
- Une note se modifie ou se supprime en touchant la ligne dans l'historique ; la date d'origine est conservée.
- Les descripteurs prédéfinis sont stockés par identifiant, les descripteurs ajoutés avec « + Autre » en texte libre.
- Un vin épuisé dont la dernière note est « à racheter » le signale dans la liste des vins épuisés.
- Le champ « Avec quoi, avec qui » est séparé du commentaire : il servira aux accords mets et vins.

Choix faits pendant l'itération 4, à confirmer en recette :

- Le profil est calculé dès la première dégustation, affiché « provisoire » en dessous de cinq.
- Il est recalculé à l'ouverture de l'onglet Goûts, seulement si une note ou une correction a changé depuis le dernier calcul, et après chaque correction. Aucun appel au lancement de l'application.
- Quatre corrections possibles : ajuster un axe (0 à 10), retirer un cépage favori, retirer un profil à éviter, ajouter une précision libre. Elles s'appliquent immédiatement à l'écran, restent prioritaires sur les déductions de Claude et se retirent depuis « Vos corrections ».
- Les axes corrigés à la main sont soulignés.
- Effort de réflexion « medium » pour la synthèse, plus exigeante que la lecture d'étiquette.

Choix faits pendant l'itération 5, à confirmer en recette :

- Claude reçoit le profil corrigé, les seuls vins en stock avec leur garde (« à boire maintenant », « trop jeune »), vos notes et les plats avec lesquels vous les avez déjà bus.
- Un vin inventé ou épuisé dans la réponse est écarté par l'application ; si aucun vin ne convient, Claude le dit et propose un style de vin à acheter.
- Le plat suit le vin choisi : depuis la carte, la fiche puis « J'en ouvre une » préremplissent « Avec quoi, avec qui » dans Noter. Le profil apprend ainsi de vos vrais accords.
- La photo d'un plat n'est pas conservée ; les dix derniers accords le sont et se réaffichent sans nouvel appel.
- Le profil utilisé est le dernier calculé ; il n'est pas recalculé avant un accord, pour ne pas ralentir la réponse.

Choix faits pendant l'itération 6, à confirmer en recette :

- Un seul appel à Claude identifie le vin et rend le verdict ; l'identification suit exactement les règles de la lecture d'étiquette.
- Claude reçoit le profil, la composition de la cave par couleur, tous les vins dégustés avec leurs notes (même épuisés), la calibration et la liste des vins pour repérer un doublon.
- Calibration (F5.5) : un verdict est relié au vin quand on l'achète via « J'achète, l'ajouter » ; dès que ce vin est noté, l'écart entre l'affinité prédite et la note réelle est envoyé avec les verdicts suivants.
- « J'achète, l'ajouter » ouvre l'écran Ajouter prérempli (lecture, photo, prix affiché, une bouteille) sans nouvel appel.
- Tous les verdicts sont conservés avec leur issue (acheté, passé ou sans suite) ; ils ne sont pas affichés en liste, faute de besoin exprimé.

Choix faits pendant l'itération 7, à confirmer en recette :

- Retour de recette traité : après un ajout, l'écran revient en haut sur la confirmation, clavier fermé, sans défilement animé (iOS l'interrompait pendant que le formulaire se vide).
- Entre écrans : un écran s'ouvre en haut ; un retour arrière rend la position dans la liste.
- Conseil sur la fiche (F1.4) : état de garde et conseil de service et de plats, demandé une fois par vin quand une clé est présente, mémorisé, renouvelé après modification du vin ou au changement d'année, ou à la demande.
- Hors ligne : un bandeau le signale ; la cave et les fiches restent consultables.
- Écran de lancement pour l'iPhone 16 Pro, transitions brèves entre écrans, supprimées si « Réduire les animations » est activé sur l'iPhone.
- F1.3 (à boire) était déjà livré à l'itération 1.

Décision prise avant l'itération 6 : « Vérifier en magasin » s'ouvre depuis l'onglet Ajouter, par une bascule « Je l'ai acheté » / « Je suis en magasin ». La barre reste à quatre onglets.
