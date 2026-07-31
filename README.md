# KobiPy — site GitHub Pages

Site vitrine React/Vite pour la chaîne YouTube KobiPy.

## Lancer en local

Prérequis : Node.js 20 ou version supérieure.

```bash
npm install
npm run dev
```

## Tester la version de production

```bash
npm run build
npm run preview
```

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
- Couleurs et mise en page : `src/styles.css`
- Titre et métadonnées : `index.html`
- Liens YouTube et Tipeee : constantes en haut de `src/main.jsx`

## Remarque sur les statistiques

Les statistiques sont actuellement indicatives et renseignées dans le code. Une actualisation automatique nécessite un service externe ou une API, car une clé privée ne doit pas être placée dans un site GitHub Pages public.
