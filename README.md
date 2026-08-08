# KobiPy — site GitHub Pages

Site vitrine React/Vite pour la chaîne YouTube KobiPy.

## Lancer en local

Prérequis : Node.js 20 ou version supérieure.

```bash
npm install
npm run dev
```

## Tester

```bash
npm test          # tests unitaires (lanceur intégré de Node, sans dépendance)
npm run audit     # failles connues dans les dépendances
npm run build     # build de production
npm run preview   # sert le build, avec la politique CSP
```

La CSP n'est injectée qu'au build : le serveur de développement de Vite a besoin
de scripts inline pour le rechargement à chaud. Pour vérifier la CSP, passez donc
toujours par `npm run build && npm run preview`.

## Publier sur GitHub Pages

1. Créez un dépôt GitHub, par exemple `kobipy-site`.
2. Placez l'ensemble des fichiers de ce dossier à la racine du dépôt.
3. Envoyez les fichiers sur la branche `main`.
4. Dans GitHub : **Settings > Pages > Build and deployment > Source**, choisissez **GitHub Actions**.
5. Ouvrez l'onglet **Actions** et attendez la fin du workflow `Deploy to GitHub Pages`.
6. Le lien du site apparaît dans **Settings > Pages**.

La configuration Vite détecte automatiquement le nom du dépôt pendant le build GitHub Actions. Il n'est donc pas nécessaire de modifier `base` pour un dépôt de type `https://utilisateur.github.io/nom-du-depot/`.

## Mettre à jour le contenu

- Thèmes, durées et textes soignés des vidéos : `EDITORIAL` dans `src/videos.js`
- Statistiques de repli : `FALLBACK_STATS` dans `src/stats.js`
- FAQ : `src/main.jsx`
- Chaîne interrogée : `CHANNEL_HANDLE` dans `vite.config.js`
- Couleurs et mise en page : `src/styles.css`
- Titre et métadonnées : `index.html`
- Liens YouTube, Tipeee et adresse de contact : constantes en haut de `src/main.jsx`
- Origines externes autorisées (CSP) : `vite.config.js`

Une nouvelle vidéo publiée sur la chaîne apparaît toute seule, sans toucher au
code. Lui ajouter une entrée dans `EDITORIAL` sert seulement à lui donner un
thème, une durée et des textes rédigés — voir la section suivante.

## Vidéothèque et statistiques alimentées par la chaîne

Tout est récupéré **au moment du build**, jamais dans le navigateur : le flux
YouTube n'envoie pas d'en-tête CORS, et la CSP du site interdit de toute façon
les appels réseau sortants. Le plugin `kobipy-videos-youtube` de
`vite.config.js` s'en charge, avec trois niveaux qui se relaient sans jamais
faire échouer le build.

| Source | Condition | Ce qu'on obtient |
|---|---|---|
| API YouTube Data v3 | `YOUTUBE_API_KEY` présente | catalogue complet, durées, vues, statistiques de chaîne |
| Flux Atom public | pas de clé, ou API en échec | quinze dernières vidéos, vues, sans durée ni statistiques |
| Catalogue éditorial | réseau indisponible | `CURATED` de `src/videos.js` |

### Mettre la clé en place

1. Console Google Cloud : créer un projet, activer **YouTube Data API v3**,
   générer une clé.
2. La restreindre à cette seule API. **Pas** de restriction par référent ni par
   adresse IP : l'appel part d'un runner GitHub dont l'adresse change à chaque
   exécution.
3. La déposer dans **Settings → Secrets and variables → Actions**, sous le nom
   `YOUTUBE_API_KEY`.

Rien d'autre à faire : le workflow la transmet déjà au build, et le site bascule
tout seul à la reconstruction suivante.

La clé ne quitte jamais le runner. Elle sert à appeler l'API pendant le build, et
seuls les chiffres obtenus entrent dans le bundle — c'est ce qui permet de
l'utiliser sur un site public sans jamais l'exposer. Elle ne doit pour autant
jamais être committée, dépôt privé ou non : `.gitignore` couvre déjà `.env*`
pour le développement local.

Le coût en quota est négligeable : trois appels par build (la chaîne, la playlist
des mises en ligne, le détail des vidéos par lots de 50), soit moins de dix
unités sur les 10 000 quotidiennes.

### Ce qui vient d'où

| Donnée | Source |
|---|---|
| Identifiant, titre, date de publication | YouTube |
| Nombre de vues | YouTube, sinon `EDITORIAL` |
| Durée | API uniquement ; sans clé, `EDITORIAL` prend le relais |
| Description | `EDITORIAL` quand elle existe, sinon YouTube |
| Thème | `EDITORIAL` uniquement — YouTube n'expose pas cette notion |
| Statistiques de la page d'accueil | API uniquement ; sans clé, `FALLBACK_STATS` |

**Le titre affiché est toujours celui de YouTube**, pour que le site et la chaîne
concordent : le titre de `EDITORIAL` ne sert que de repli si YouTube est
injoignable.

La description suit la règle inverse : celle du flux contient chapitres, liens
et crédits sur des dizaines de lignes, donc la version de `EDITORIAL` prime, et
à défaut le flux est réduit à sa première ligne utile. Une vidéo sans thème
éditorial est rangée sous `DEFAULT_CATEGORY`, et son bandeau de durée est
simplement omis.

Chaque champ de `EDITORIAL` est facultatif. Une entrée réduite à `{ category }`
range la vidéo sous un thème en laissant le flux fournir tout le reste — c'est le
cas des vidéos dont les textes n'ont pas été retravaillés. Les entrées complètes
alimentent en plus le catalogue de repli `CURATED`.

### Pagination

La grille s'ouvre sur `VIDEOS_INITIAL` vidéos (une rangée) et « Afficher plus de
vidéos » en révèle `VIDEOS_STEP` de plus à chaque clic ; les deux constantes sont
en haut de `src/main.jsx`. Changer de thème ou lancer une recherche repart d'une
rangée, et le bouton disparaît dès qu'il ne reste rien à révéler.

### Repli et fraîcheur

Si la récupération échoue (réseau coupé, YouTube indisponible, format du flux
modifié), le build **n'échoue pas** : un avertissement est affiché dans le log
et le site sert `CURATED` tel quel — les entrées de `EDITORIAL` assez complètes
pour tenir debout sans le flux.

La donnée étant figée au build, une nouvelle vidéo n'apparaît qu'à la
reconstruction suivante : le workflow tourne donc aussi une fois par jour
(`schedule` dans `.github/workflows/deploy.yml`).

### Construire contre des données enregistrées

Pour travailler sans réseau ni clé, ou pour vérifier le rendu d'un cas
particulier :

```bash
KOBIPY_FEED_FIXTURE=chemin/vers/flux.xml npm run build   # flux Atom
KOBIPY_API_FIXTURE=chemin/vers/reponses.json npm run build   # réponses d'API
```

Le fichier de réponses d'API regroupe les trois appels, sous les clés
`channels`, `playlistItems` et `videos` ; un tableau y simule des appels
successifs, ce qui permet d'exercer la pagination.

La lecture du flux vit dans `scripts/youtube-feed.js`, celle de l'API dans
`scripts/youtube-api.js`, la fusion avec les métadonnées éditoriales dans
`src/videos.js` et la bande de chiffres dans `src/stats.js` ; tous sont couverts
par `tests/`.

## Choix de sécurité

- **CSP** injectée dans le HTML au build (`vite.config.js`). GitHub Pages ne
  permettant pas d'ajouter d'en-têtes HTTP, `frame-ancestors` n'est pas
  utilisable ici : une balise `meta` ne peut pas porter cette directive.
- **Lecteur YouTube** chargé depuis `youtube-nocookie.com`, dans une iframe
  `sandbox` qui lui interdit notamment de naviguer la page parente, avec un
  `allow` réduit aux permissions réellement nécessaires.
- **Liens externes** en `rel="noopener noreferrer"`, vignettes en
  `referrerPolicy="no-referrer"`.
- **Vidéos et statistiques** lues au build, jamais depuis le navigateur. La clé
  d'API vit dans les secrets GitHub, sert pendant le build et n'entre pas dans le
  bundle. Identifiants de chaîne et de vidéo revalidés avant de construire la
  moindre URL, entrée ignorée si le format surprend.
- **Formulaire de contact** : aucune donnée n'est envoyée par le site, il prépare
  seulement un lien `mailto:`. La construction de ce lien est isolée dans
  `src/contact.js` et couverte par `tests/contact.test.js`, notamment contre
  l'injection d'en-têtes via un saut de ligne dans le sujet.
- **Dépendances** : versions bornées et `package-lock.json` committé — `latest`
  laissait chaque build récupérer une version arbitraire. Le CI installe avec
  `npm ci --ignore-scripts`.
- **GitHub Actions** épinglées par empreinte de commit, permissions accordées
  job par job, et `persist-credentials: false` au checkout.

## Remarque sur les statistiques

Sans clé d'API, la bande de chiffres de la page d'accueil garde les valeurs
indicatives de `FALLBACK_STATS` (`src/stats.js`) : le flux Atom ne porte aucune
donnée au niveau de la chaîne. Avec une clé, abonnés, nombre de vidéos et vues
cumulées deviennent réels, et la moyenne est calculée.

Chaque chiffre retombe individuellement sur sa valeur de repli s'il manque —
une chaîne qui masque son nombre d'abonnés garde donc une bande complète.
