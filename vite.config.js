import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { CHANNEL_ID, feedUrl, parseChannelId, parseLatestVideo } from './scripts/youtube-feed.js'

const CHANNEL_HANDLE = '@kobipy'
const VIRTUAL_MODULE = 'virtual:derniere-video'
const RESOLVED_MODULE = '\0' + VIRTUAL_MODULE
const FETCH_TIMEOUT_MS = 10_000

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

async function fetchText(url){
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'accept-language': 'fr,en;q=0.8' }
  })
  if(!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}

/**
 * Récupère la dernière vidéo publiée sur la chaîne, ou null.
 *
 * Le flux Atom de YouTube est public : aucune clé d'API n'est nécessaire, ce
 * qui compte pour un site GitHub Pages où rien n'est secret. L'appel a lieu au
 * build ; un échec (réseau coupé, YouTube indisponible, format modifié) est
 * seulement signalé, et le site se rabat sur le catalogue de src/main.jsx.
 */
async function fetchLatestVideo(){
  try{
    const channelId = parseChannelId(await fetchText(`https://www.youtube.com/${CHANNEL_HANDLE}`))
    if(!channelId) throw new Error(`identifiant de chaîne introuvable pour ${CHANNEL_HANDLE}`)
    if(!CHANNEL_ID.test(channelId)) throw new Error('identifiant de chaîne au format inattendu')

    const latest = parseLatestVideo(await fetchText(feedUrl(channelId)))
    if(!latest) throw new Error('flux Atom illisible ou vide')

    console.log(`[kobipy] dernière vidéo publiée : « ${latest.title} » (${latest.id}, ${latest.publishedAt ?? 'date inconnue'})`)
    return latest
  }catch(error){
    console.warn(`[kobipy] récupération de la dernière vidéo impossible (${error.message}) — repli sur le catalogue`)
    return null
  }
}

function latestVideoPlugin(){
  let pending
  return {
    name: 'kobipy-derniere-video',
    resolveId: id => (id === VIRTUAL_MODULE ? RESOLVED_MODULE : null),
    async load(id){
      if(id !== RESOLVED_MODULE) return null
      pending ??= fetchLatestVideo()
      return `export default ${JSON.stringify(await pending)}`
    }
  }
}

export default defineConfig({
  plugins: [react(), latestVideoPlugin(), cspPlugin()],
  // Fonctionne automatiquement pour un dépôt projet ou <utilisateur>.github.io.
  base: process.env.GITHUB_ACTIONS ? `/${process.env.GITHUB_REPOSITORY?.split('/')[1] || ''}/` : '/',
})
