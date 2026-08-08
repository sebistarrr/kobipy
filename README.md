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
- FAQ et statistiques : `src/main.jsx`
- Chaîne interrogée : `CHANNEL_HANDLE` dans `vite.config.js`
- Couleurs et mise en page : `src/styles.css`
- Titre et métadonnées : `index.html`
- Liens YouTube, Tipeee et adresse de contact : constantes en haut de `src/main.jsx`
- Origines externes autorisées (CSP) : `vite.config.js`

Une nouvelle vidéo publiée sur la chaîne apparaît toute seule, sans toucher au
code. Lui ajouter une entrée dans `EDITORIAL` sert seulement à lui donner un
thème, une durée et des textes rédigés — voir la section suivante.

## Vidéothèque alimentée par la chaîne

La vidéothèque et la section `#nouveaute` sont construites **au moment du
build**, pas dans le navigateur : le plugin `kobipy-videos-youtube` de
`vite.config.js` lit la page de la chaîne pour en extraire l'identifiant `UC…`,
puis le flux Atom public
`https://www.youtube.com/feeds/videos.xml?channel_id=…`, qui publie la
quinzaine de vidéos les plus récentes.

Ce flux ne demande aucune clé d'API — ce qui compte pour un site public où rien
ne peut rester secret — et la lecture au build évite deux impasses : le flux
n'envoie pas d'en-tête CORS, et la CSP du site interdit les appels réseau
sortants.

### Ce qui vient d'où

| Donnée | Source |
|---|---|
| Identifiant, titre, date de publication | flux YouTube |
| Nombre de vues | flux YouTube quand il le fournit, sinon `EDITORIAL` |
| Description | `EDITORIAL` quand elle existe, sinon le flux |
| Thème et durée | `EDITORIAL` uniquement — absents du flux |
| Statistiques de la page d'accueil | saisies à la main dans `src/main.jsx` |

**Le titre affiché est toujours celui de YouTube**, pour que le site et la chaîne
concordent : le titre de `EDITORIAL` ne sert que de repli si le flux est
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

### Construire contre un flux enregistré

Pour travailler sans réseau, ou pour vérifier le rendu d'une vidéo non
répertoriée :

```bash
KOBIPY_FEED_FIXTURE=chemin/vers/flux.xml npm run build
```

Le découpage du flux vit dans `scripts/youtube-feed.js`, la fusion avec les
métadonnées éditoriales dans `src/videos.js` ; les deux sont couverts par
`tests/`.

## Choix de sécurité

- **CSP** injectée dans le HTML au build (`vite.config.js`). GitHub Pages ne
  permettant pas d'ajouter d'en-têtes HTTP, `frame-ancestors` n'est pas
  utilisable ici : une balise `meta` ne peut pas porter cette directive.
- **Lecteur YouTube** chargé depuis `youtube-nocookie.com`, dans une iframe
  `sandbox` qui lui interdit notamment de naviguer la page parente, avec un
  `allow` réduit aux permissions réellement nécessaires.
- **Liens externes** en `rel="noopener noreferrer"`, vignettes en
  `referrerPolicy="no-referrer"`.
- **Vidéos** lues au build depuis le flux Atom public, sans clé d'API ni appel
  réseau depuis le navigateur ; identifiants de chaîne et de vidéo revalidés
  avant de construire la moindre URL, entrée ignorée si le format surprend.
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

Les statistiques de la page d'accueil (abonnés, vues cumulées) restent saisies à
la main : le flux Atom ne porte aucune donnée au niveau de la chaîne, et il ne
publie que les quinze dernières vidéos, dont on ne peut pas déduire un total.

Les rendre automatiques demande l'API YouTube Data v3, donc une clé. Elle n'a
pas à être exposée pour autant : comme les données sont lues au build, la clé
peut vivre dans **Settings → Secrets and variables → Actions** et ne jamais
atteindre le navigateur — seuls les chiffres obtenus finissent dans le bundle.
