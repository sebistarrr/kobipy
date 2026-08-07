import { readFile } from 'node:fs/promises'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { CHANNEL_ID, feedUrl, parseChannelId, parseVideos } from './scripts/youtube-feed.js'

const CHANNEL_HANDLE = '@kobipy'
const VIRTUAL_MODULE = 'virtual:videos-youtube'
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
 * Récupère les vidéos de la chaîne, de la plus récente à la plus ancienne, ou
 * un tableau vide.
 *
 * Le flux Atom de YouTube est public : aucune clé d'API n'est nécessaire, ce
 * qui compte pour un site GitHub Pages où rien n'est secret. L'appel a lieu au
 * build ; un échec (réseau coupé, YouTube indisponible, format modifié) est
 * seulement signalé, et le site se rabat sur le catalogue éditorial de
 * src/videos.js.
 */
async function fetchChannelVideos(){
  try{
    // Permet de construire le site contre un flux enregistré, sans réseau :
    // KOBIPY_FEED_FIXTURE=flux.xml npm run build
    const fixture = process.env.KOBIPY_FEED_FIXTURE
    if(fixture){
      const videos = parseVideos(await readFile(fixture, 'utf8'))
      console.log(`[kobipy] flux local ${fixture} : ${videos.length} vidéos`)
      return videos
    }

    const channelId = parseChannelId(await fetchText(`https://www.youtube.com/${CHANNEL_HANDLE}`))
    if(!channelId) throw new Error(`identifiant de chaîne introuvable pour ${CHANNEL_HANDLE}`)
    if(!CHANNEL_ID.test(channelId)) throw new Error('identifiant de chaîne au format inattendu')

    const videos = parseVideos(await fetchText(feedUrl(channelId)))
    if(videos.length === 0) throw new Error('flux Atom illisible ou vide')

    const withViews = videos.filter(video => video.views !== null).length
    console.log(`[kobipy] ${videos.length} vidéos récupérées depuis le flux de la chaîne`)
    console.log(`[kobipy] vues fournies par le flux : ${withViews}/${videos.length} — descriptions : ${videos.filter(v => v.description).length}/${videos.length}`)
    for(const video of videos){
      console.log(`[kobipy]   ${video.publishedAt?.slice(0, 10) ?? '??????????'}  ${video.id}  ${video.views ?? '—'}  ${video.title}`)
    }
    return videos
  }catch(error){
    console.warn(`[kobipy] récupération des vidéos impossible (${error.message}) — repli sur le catalogue éditorial`)
    return []
  }
}

function youtubeVideosPlugin(){
  let pending
  return {
    name: 'kobipy-videos-youtube',
    resolveId: id => (id === VIRTUAL_MODULE ? RESOLVED_MODULE : null),
    async load(id){
      if(id !== RESOLVED_MODULE) return null
      pending ??= fetchChannelVideos()
      return `export default ${JSON.stringify(await pending)}`
    }
  }
}

export default defineConfig({
  plugins: [react(), youtubeVideosPlugin(), cspPlugin()],
  // Fonctionne automatiquement pour un dépôt projet ou <utilisateur>.github.io.
  base: process.env.GITHUB_ACTIONS ? `/${process.env.GITHUB_REPOSITORY?.split('/')[1] || ''}/` : '/',
})
