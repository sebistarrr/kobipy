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

- Vidéos, FAQ et statistiques : `src/main.jsx`
- Chaîne interrogée pour la section « Nouveauté » : `CHANNEL_HANDLE` dans `vite.config.js`
- Couleurs et mise en page : `src/styles.css`
- Titre et métadonnées : `index.html`
- Liens YouTube, Tipeee et adresse de contact : constantes en haut de `src/main.jsx`
- Origines externes autorisées (CSP) : `vite.config.js`

Une vidéo ajoutée à la liste `videos` doit porter un identifiant YouTube valide
(11 caractères) et la liste doit rester classée du plus récent au plus ancien :
c'est elle qui sert de repli si le flux YouTube est injoignable au build.

## Section « Dernière vidéo publiée »

La section `#nouveaute` met en avant la vidéo la plus récente de la chaîne.

Elle est alimentée **au moment du build**, pas dans le navigateur : le plugin
`kobipy-derniere-video` de `vite.config.js` lit la page de la chaîne pour en
extraire l'identifiant `UC…`, puis le flux Atom public
`https://www.youtube.com/feeds/videos.xml?channel_id=…`. Ce flux ne demande
aucune clé d'API — ce qui compte pour un site public où rien ne peut rester
secret — et la lecture au build évite deux impasses : le flux n'envoie pas
d'en-tête CORS, et la CSP du site interdit les appels réseau sortants.

Si la récupération échoue (réseau coupé, YouTube indisponible, format du flux
modifié), le build **n'échoue pas** : un avertissement est affiché dans le log
et le site se rabat sur la première entrée du catalogue `videos` de
`src/main.jsx`, classé du plus récent au plus ancien. Le flux ne fournissant ni
description, ni durée, ni thème, ces champs sont repris du catalogue quand la
vidéo y figure déjà.

Comme la donnée est figée au build, une nouvelle vidéo n'apparaît qu'à la
reconstruction suivante : le workflow tourne donc aussi une fois par jour
(`schedule` dans `.github/workflows/deploy.yml`).

Le découpage du flux est isolé dans `scripts/youtube-feed.js` et couvert par
`tests/youtube-feed.test.js` : identifiants revalidés, entités XML décodées,
flux vide ou tronqué traité sans exception.

## Choix de sécurité

- **CSP** injectée dans le HTML au build (`vite.config.js`). GitHub Pages ne
  permettant pas d'ajouter d'en-têtes HTTP, `frame-ancestors` n'est pas
  utilisable ici : une balise `meta` ne peut pas porter cette directive.
- **Lecteur YouTube** chargé depuis `youtube-nocookie.com`, dans une iframe
  `sandbox` qui lui interdit notamment de naviguer la page parente, avec un
  `allow` réduit aux permissions réellement nécessaires.
- **Liens externes** en `rel="noopener noreferrer"`, vignettes en
  `referrerPolicy="no-referrer"`.
- **Dernière vidéo** lue au build depuis le flux Atom public, sans clé d'API ni
  appel réseau depuis le navigateur ; identifiants de chaîne et de vidéo
  revalidés avant de construire la moindre URL.
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

Les statistiques sont actuellement indicatives et renseignées dans le code. Une actualisation automatique nécessite un service externe ou une API, car une clé privée ne doit pas être placée dans un site GitHub Pages public.
