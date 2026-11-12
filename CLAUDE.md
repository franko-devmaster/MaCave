# Ma Cave — Project Instructions

## Overview

Ma Cave est une application mobile personnelle de gestion de cave à vin, augmentée par Claude. Un seul utilisateur, un iPhone 16 Pro, français. Elle stocke les vins de la cave, les dégustations et un profil de goûts ; Claude lit les étiquettes, juge un vin inconnu en magasin, propose l'accord avec un plat et synthétise les goûts.

Pas de backend. L'application est une PWA Angular installée sur l'écran d'accueil ; les données vivent sur le téléphone (IndexedDB) avec export et import JSON ; l'API Claude est appelée directement depuis l'application avec la clé de l'utilisateur.

Documents de référence :

- `docs/01-description-fonctionnelle.md` — périmètre, exigences, modèle de données, stack, plan d'itérations
- Maquette (7 écrans) : https://claude.ai/artifact/Q2iFq9qLcrrZuZPZXdjcY2

## Domaines fonctionnels

- Cave — liste groupée par couleur, filtres, recherche, fiche vin, stock (+1 acheté, −1 ouvert), à boire
- Ajouter — photo d'étiquette lue par Claude ou description libre, confirmation manuelle, référentiels pays / régions / cépages
- Dégustations — note 1 à 5, descripteurs aimés et gênants, commentaire, à racheter
- Profil de goûts — synthèse par Claude, cinq axes, cépages favoris, à éviter, corrections utilisateur
- Magasin — verdict d'affinité pour un vin inconnu, raisons + / − / i
- Accords — plat → choix principal dans la cave, alternatives, écartés
- Réglages — clé API Claude, export / import JSON, langue

## Tech Stack

- Frontend : Angular 22 zoneless (standalone + signals + OnPush), TypeScript 6 strict, SCSS, PWA (`@angular/pwa`, service worker). Node 22.22.3 ou plus récent
- UI : CSS maison à partir des tokens de la maquette. Pas d'Angular Material, pas de Bootstrap. Polices auto-hébergées via `@fontsource` (disponibles hors ligne)
- Forms : Reactive Forms typés. Pas de ngx-formly
- Stockage : IndexedDB via Dexie 4, une base `macave`, export / import JSON complet (vins, mouvements, dégustations, profil, verdicts, accords, photos en base64)
- IA : `@anthropic-ai/sdk` chargé à la demande (import dynamique) et appelé depuis le navigateur (`dangerouslyAllowBrowser: true`), modèle `claude-opus-5-5`, sorties structurées (`output_config.format` + schéma JSON strict), vision pour les étiquettes et les plats
- i18n : `@ngx-translate` 18, traductions embarquées dans le bundle (`src/i18n/fr.json`, chargeur `BundledTranslateLoader`), français complet en v1, clés prêtes pour de / en, locale fr-CH
- Tests : Vitest via `ng test` (jsdom, `fake-indexeddb`) pour la logique ; Playwright pour les parcours, avec le profil `iPhone 16 Pro` rendu par Chromium (viewport, user agent, tactile). WebKit n'est pas utilisé : le vrai Safari est validé sur le téléphone
- Lint : angular-eslint, OnPush et `no-explicit-any` en erreur
- Build / déploiement : GitHub Actions → GitHub Pages (site statique). Aucun conteneur, aucune base serveur

## Solution Structure

```
app/                         Projet Angular (racine du workspace Angular)
  src/build-info.ts          Version, commit, date de build (réécrit en CI par scripts/write-build-info.mjs)
  src/i18n/fr.json           Traductions
  src/app/
    pages/                   Un dossier par écran : cave/, fiche/, modifier/, ajouter/, noter/, accords/, magasin/, gouts/, reglages/
    components/              Composants partagés : tab-bar, page-header, empty-state, add-mode-switch, wine-row, badge-icon, wine-form, color-dot, label-photo, info-attachment, media-viewer, score-picker, chip-group, tasting-list, wine-advice
    datastore/               Classes signal-based : WineDatastore, ReferenceDatastore, SettingsDatastore, AddWineDatastore, TastingDatastore, ProfileDatastore, PairingDatastore, VerdictDatastore, AdviceDatastore
    services/                ClaudeService (appels IA), BackupService (export/import), PhotoService (redimensionnement + lecture), ScrollService (défilement), NetworkService (en ligne / hors ligne), AppUpdateService, StoragePersistenceService, FileShareService
    db/                      Dexie : schema.ts (tables, versions), repositories (wine, photo, tasting, profile, pairing, verdict, reference, settings)
    models/                  Types et enums du domaine
    ai/                      Prompts, schémas JSON de sortie, parseurs
    testing/                 Utilitaires de test (base Dexie isolée, fixtures)
    pipes/ directives/ utils/ constants/
  src/styles/                tokens.scss (couleurs, typographie, espacements), base.scss
  e2e/                       Tests Playwright, un fichier par itération, helpers.ts, claude-mock.ts (API simulée), static-server.mjs (sert le build sous /MaCave/ comme Pages)
  scripts/                   write-build-info.mjs, generate-icons.mjs
docs/                        Description fonctionnelle et décisions
.github/workflows/           ci.yml (lint + tests + build + déploiement Pages)
```

## Conventions Angular

### Pour tout le code

- Standalone components, pas de NgModules
- Signals partout : `signal()`, `computed()`, `input()`, `output()`, `linkedSignal()` si besoin
- Contrôle de flux `@if` / `@for` / `@switch` uniquement
- `inject()` au lieu de l'injection par constructeur
- `ChangeDetectionStrategy.OnPush` obligatoire
- Jamais `any` — `unknown` + type guards, ou types propres
- `takeUntilDestroyed`, `viewChild`, `resource()` ou `forkJoin` pour l'asynchrone
- Datastore pattern : une classe par agrégat dans `datastore/`, état en signals, persistance via les repositories Dexie, aucun appel Dexie depuis un composant
- Composants de page sans logique métier : ils lisent les datastores et appellent leurs méthodes
- Indicateurs de la liste (`badge-icon`) : puce sous le nombre de bouteilles, rouge `--color-soon` ou verte `--color-ready`, selon `readiness()` (fin de garde, puis état du conseil, puis début de garde), qui alimente aussi le compteur « à boire » ; à gauche du nombre, étoile puis couronne, sans colonne réservée. Sur la fiche, `wineBadges()` liste les mêmes indicateurs avec libellé, à droite du millésime. `starWineIds` dans `WineDatastore` (moyenne des notes ≥ 4, sinon `advice.affinity` ≥ 8) ; `isGrandCru` = `advice.grandCru`, l'évaluation de Claude, jamais le nom. Filtres `CellarFilters` (`utils/cellar-filters.ts`) : couleur, moment, goût ; OU dans un groupe, ET entre groupes. Aucun appel dédié : tout vient des données locales et du conseil de fiche
- Modifier le vin : tous les champs sont éditables, y compris le stock en cave et le prix payé. Le stock est la somme des mouvements : un écart devient un mouvement `correction`, le prix corrige le dernier achat (`setLastPrice`). `update` ne change `updatedAt` que si un champ descriptif change
- Nommage : `XxxPage`, `XxxComponent`, `XxxDatastore`, `XxxService`, `XxxRepository` ; fichiers en kebab-case
- Couleurs et tailles uniquement via les tokens de `src/styles/tokens.scss` — pas de hex dans les composants
- Le conteneur qui défile est `main.content`, pas la fenêtre : passer par `ScrollService` (`toTop()` après un enregistrement qui reste sur l'écran ; le service remet en haut à chaque navigation et rend la position au retour). Pas de défilement animé : iOS l'interrompt quand la hauteur du contenu change
- Transitions entre écrans par `withViewTransitions()`, désactivées par `prefers-reduced-motion`
- Un `<form>` sans `ReactiveFormsModule` n'a pas de `ngSubmit` : écouter `(submit)` avec `$event.preventDefault()`
- Contrôles de saisie réutilisables (score-picker, chip-group) en `ControlValueAccessor`, branchés par `formControlName` ; boutons radio et cases natifs masqués visuellement, le libellé sert de cible tactile (en Playwright, toucher le `label`, pas l'`input`)

### Design system « Étiquette »

- Fond blanc `#FFFFFF`, surface secondaire `#F3F1EC`, encre `#17120F`, texte atténué `#6B625B`, filet `#ECE8E1`, bordure `#E3DED6`
- Un seul accent : bordeaux `#7A1F2E`, pour l'action principale, les notes et le signal IA. Exception voulue par l'utilisateur : puces d'état de la cave, rouge `#C62828` (à boire rapidement) et verte `#2E7D32` (prêt à boire), toujours avec un libellé accessible
- Couleurs de vin : rouge `#7A1F2E`, blanc `#D4A72C`, rosé `#E08A9B`, bulles `#4F7F96`. Toujours accompagnées du libellé
- Typographie : Barlow Condensed 600 / 700 pour titres et millésimes ; Inter 400 / 500 / 600 pour le texte ; IBM Plex Mono 400 / 500 en capitales espacées pour les étiquettes de champ
- Cibles tactiles 44 px au minimum, contrastes 4.5:1, pas de barre d'état simulée, pas d'emoji, icônes SVG en trait
- L'IA est signalée par l'icône étincelle et le libellé « Conseil » ou « Verdict », jamais par un chat

### PWA / iOS

- Installable sur l'écran d'accueil (manifest, icônes, `apple-mobile-web-app-capable`, `viewport-fit=cover`, safe areas via `env(safe-area-inset-*)`). Écran de lancement `apple-touch-startup-image` pour l'iPhone 16 Pro (1206 × 2622), généré par `scripts/generate-icons.mjs` ; un autre modèle d'iPhone demande sa propre taille
- Photo via `<input type="file" accept="image/*" capture="environment">`, redimensionnée côté client à 1 280 px de grand côté en JPEG avant stockage et envoi
- Deux fichiers par vin, tous deux dans la table `photos` : la photo Bouteille (`labelPhotoId`) et la fiche info (`infoAttachmentId`, image à 2 048 px ou PDF de 10 Mo au plus, choisi sans `capture` pour accéder à Fichiers). Ajouter ou remplacer un fichier ne modifie pas `updatedAt`. Toucher la photo Bouteille l'ouvre dans la visionneuse plein écran partagée (`media-viewer`, fond blanc, croix de fermeture, actions projetées en bas avec `viewerAction class="btn"`), d'où on la remplace ; sans photo, toucher ouvre l'appareil photo
- Service worker activé, y compris sur Safari iOS : vérifier à chaque itération que l'installation et la mise à jour fonctionnent ; en cas de problème, désactiver par userAgent comme sur AquaPlan et le documenter ici
- IndexedDB est la source de vérité. Demander `navigator.storage.persist()` au premier lancement. Rappeler l'export si le dernier remonte à plus de 30 jours
- Consultation de la cave hors ligne ; les fonctions IA affichent un état explicite sans réseau

## Intégration Claude

- Un seul `ClaudeService` ; les prompts et schémas de sortie vivent dans `src/app/ai/`, un fichier par cas d'usage : `label-reading`, `store-verdict`, `pairing`, `taste-profile`, `wine-advice`. Chaque fichier expose une fonction `xxxRequest()` qui renvoie un `StructuredRequest` (système, contenu, schéma, effort, parseur)
- Appels via `client.beta.messages.create` avec `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) : un refus est rejoué côté serveur sur un modèle de repli
- Effort `low` pour l'extraction et les textes courts (étiquettes, descriptions, conseil de fiche), `medium` pour la synthèse et le raisonnement (profil de goûts, accords, verdict magasin) ; à relever seulement si la qualité le justifie, mesures à l'appui
- Schémas stricts : toutes les propriétés dans `required`, `additionalProperties: false`, nullabilité par `anyOf` avec `{ "type": "null" }`, pas de `minimum` / `maximum` (bornes contrôlées par le parseur, qui met à null une valeur hors bornes)
- Test de clé par `models.retrieve` : aucun texte généré, rien de facturé
- Erreurs classées par les classes typées du SDK (`classifyError`), jamais par le texte du message
- Toujours `output_config.format` avec un schéma JSON strict ; jamais de parsing de texte libre
- Contexte envoyé : inventaire résumé + profil, placés en tête comme préfixe stable ; la requête variable en fin
- Images : JPEG base64 redimensionné, jamais l'original
- Réutiliser plutôt que dupliquer : le verdict magasin imbrique `LABEL_READING_SCHEMA`, `parseLabelReading` et `LABEL_FIELD_RULES` ; `profileText` sert aux accords et au verdict
- Conseil de fiche : demandé une fois par vin, mémorisé sur le vin (`advice`), redemandé seulement après modification du vin, changement d'année ou changement de fiche info (`isAdviceFresh`) ; `setAdvice` ne modifie pas `updatedAt`. La photo Bouteille n'est jamais envoyée pour le conseil
- Conseil de fiche : rend aussi `affinity` (0 à 10, null sans profil ni dégustation, consigne d'exigence) et `grandCru` (premier rang seulement, false dans le doute) ; un conseil sans ces champs est redemandé une fois (`isAdviceFresh`)
- Fiche info : envoyée avec la demande de conseil (bloc `document` pour un PDF, `image` sinon) ; Claude en rend un résumé (`infoSummary`) mémorisé avec le conseil. Les accords réutilisent ce résumé (`currentInfoSummary`) au lieu de renvoyer le fichier
- Calibration : chaque verdict suivi d'un achat (`boughtWineId`) puis d'une note est renvoyé à Claude dans les verdicts suivants (`calibrationText`)
- Le parseur ne garde que des identifiants de vins présents dans le contexte envoyé (en stock pour les accords) : un vin inventé ou épuisé est écarté sans erreur
- Gérer `stop_reason`, les erreurs réseau, les erreurs 401 (clé invalide → renvoi vers Réglages) et 429
- Le profil de goûts n'est recalculé qu'après une nouvelle dégustation ou une correction, jamais à l'ouverture : il garde la signature (`profileSignature`) des dégustations et corrections utilisées, et `refreshIfStale()` n'appelle Claude que si elle a changé. Les corrections de l'utilisateur s'appliquent localement tout de suite (`applyOverrides`) et sont envoyées à Claude comme prioritaires
- Tester la logique autour des appels (construction des prompts, parsing, erreurs) avec des réponses fixtures ; aucun appel réel dans les tests. Vitest : `testing/fake-claude.ts` (client factice, vraies classes d'erreurs). Playwright : `e2e/claude-mock.ts` intercepte `api.anthropic.com`, avec `serviceWorkers: 'block'` car le service worker relaie les requêtes hors de portée de l'interception

## Sécurité

Application personnelle, un seul utilisateur, mais la clé API a une valeur monétaire.

- La clé API est saisie dans Réglages et stockée dans IndexedDB sur l'appareil. Elle ne figure jamais dans le code, le dépôt, les logs ou l'export JSON
- Utiliser une clé dédiée à l'application avec une limite de dépense dans la Console Anthropic ; la révoquer si le téléphone est perdu
- Pas de `bypassSecurityTrust*`
- Les photos ne quittent l'appareil que vers l'API Anthropic, pour la durée de la requête
- Jamais commiter de secrets ; `.env` et fichiers locaux ignorés par Git

## Principes

- KISS — le plus simple qui marche
- YAGNI — uniquement ce qui est demandé maintenant
- DRY — extraire la duplication quand elle est prouvée (règle de trois)
- Changements minimaux — ne toucher que ce qui est strictement nécessaire
- Une itération = une tranche verticale testable sur le téléphone. Voir le plan dans `docs/01-description-fonctionnelle.md` § 10
- Version : `0.<itération>.<correctif>` dans `app/package.json`, affichée dans Réglages

## Tests

- Vitest obligatoire sur datastores, repositories, services, utilitaires et toute la couche `ai/`. Pas de logique sans test
- Nommage : `<méthode> should <attendu>` ou `<méthode> when <condition> should <attendu>`
- Sujet sous test : `sut`
- Playwright : un parcours par itération au minimum, profil `iPhone 16 Pro`, contre le build de production servi sous `/MaCave/` ; `npm run e2e` désactive les traces
- Sélecteurs Playwright : viser un lien d'onglet dans `navigation "Navigation principale"`, utiliser `exact: true` quand un libellé est contenu dans un autre, et attendre la confirmation propre à l'action (pas un message générique déjà affiché)
- Vérification manuelle de l'UI sur le vrai téléphone via l'URL GitHub Pages à la fin de chaque itération

## Déploiements

| Cible | URL | Build | Data |
|---|---|---|---|
| localhost (dev) | http://localhost:4200 | `cd app && npm start` (service worker inactif) | IndexedDB du navigateur |
| localhost (comme Pages) | http://localhost:4310/MaCave/ | `npm run build:pages && node e2e/static-server.mjs` | IndexedDB du navigateur |
| Téléphone en local | http://<ip-du-mac>:4200 (même Wi-Fi), ou tunnel HTTPS pour tester la PWA | `npm start -- --host 0.0.0.0` | IndexedDB de Safari |
| GitHub Pages | https://franko-devmaster.github.io/MaCave/ | push sur `main` → `.github/workflows/ci.yml` | IndexedDB du téléphone |

`npm run build:pages` construit avec `--base-href /MaCave/` et copie `index.html` en `404.html` pour les routes profondes. Pages doit être activé une fois dans les réglages du dépôt, source « GitHub Actions ».

### Workflow typique

```bash
# 1. Dev local
cd app && npm start
# 2. Lint et tests
npm run lint && npm test
npm run build:pages && npm run e2e
# 3. Commit + push
git add ...
git commit -m "feat(cave): ..."
git push -u origin <branche>
# 4. Pull request vers main → CI → GitHub Pages
# 5. Ouvrir l'URL Pages sur l'iPhone, forcer la mise à jour de la PWA si besoin
```

## GitHub

- Repo : https://github.com/franko-devmaster/MaCave
- Branche par défaut : `main`. Développement sur branches `claude/*`, fusion par pull request
- CI : `.github/workflows/ci.yml` (lint, tests, build, déploiement Pages)
- Pas de force-push sur `main`, pas de `--no-verify`

### Message de commit

- Format : `type(scope): description courte`
- Types : feat, fix, refactor, docs, test, chore
- Scopes : cave, ajouter, noter, gouts, accords, magasin, reglages, ai, db, pwa, ci, docs
- Terminer par la ligne Co-Authored-By demandée par le harness

### Avant de commit

- `git status` pour voir ce qui est staged
- Vérifier qu'aucune clé API ni photo personnelle ne part dans le dépôt

## Workflow Claude

Pas de suivi Jira ni de tests Xray. Tout reste dans Claude Code + GitHub.

Pour une itération :

1. Relire la tranche dans `docs/01-description-fonctionnelle.md` § 10 et la maquette
2. Écrire le code Angular et les tests Vitest ; un parcours Playwright
3. Lancer `npm run lint`, `npm test`, `npm run build:pages`, `npm run e2e`
4. Commit + push, pull request vers `main`
5. Test manuel sur l'iPhone, retours dans la conversation, corrections

Si bloqué :

- Service worker iOS : vider le site dans Réglages Safari, réinstaller la PWA
- Données : exporter le JSON avant toute migration de schéma Dexie ; les migrations sont versionnées dans `db/schema.ts`
- API Claude : vérifier la clé, la limite de dépense et le message d'erreur exact avant de toucher au code
