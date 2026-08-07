import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Origines réellement utilisées par le site. Toute ressource hors de cette liste
// est bloquée par le navigateur.
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://img.youtube.com https://i.ytimg.com",
  // youtube.com est autorisé en plus de youtube-nocookie.com car le lecteur
  // peut y rediriger la frame dans certains cas.
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
  "connect-src 'self'",
  "form-action 'none'",
  "object-src 'none'",
  "upgrade-insecure-requests"
].join('; ')

// GitHub Pages ne permet pas d'ajouter des en-têtes HTTP : la politique est donc
// injectée dans le HTML produit. Uniquement au build, car le serveur de
// développement de Vite s'appuie sur des scripts inline pour le rechargement à
// chaud.
function cspPlugin(){
  return {
    name: 'kobipy-csp',
    apply: 'build',
    transformIndexHtml(){
      return [{
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy },
        injectTo: 'head-prepend'
      }]
    }
  }
}

export default defineConfig({
  plugins: [react(), cspPlugin()],
  // Fonctionne automatiquement pour un dépôt projet ou <utilisateur>.github.io.
  base: process.env.GITHUB_ACTIONS ? `/${process.env.GITHUB_REPOSITORY?.split('/')[1] || ''}/` : '/',
})
