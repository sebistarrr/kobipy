import { readFile } from 'node:fs/promises'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { CHANNEL_ID, feedUrl, parseChannelId, parseVideos as parseFeedVideos } from './scripts/youtube-feed.js'
import { apiUrl, describeHttpError, parseChannel, parsePlaylistItems, parseVideos as parseApiVideos } from './scripts/youtube-api.js'

const CHANNEL_HANDLE = '@kobipy'
const VIRTUAL_MODULE = 'virtual:videos-youtube'
const RESOLVED_MODULE = '\0' + VIRTUAL_MODULE
const FETCH_TIMEOUT_MS = 10_000
const API_PAGE_SIZE = 50
const API_MAX_PAGES = 20   // garde-fou : 1 000 vidéos, très au-delà du besoin

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
  if(!response.ok){
    // Le corps porte le motif exact de l'erreur. On ne journalise jamais l'URL,
    // qui contiendrait la clé, et describeHttpError masque toute clé résiduelle.
    throw new Error(describeHttpError(response.status, await response.text().catch(() => '')))
  }
  return response.text()
}

// Permet de construire contre des réponses d'API enregistrées, sans clé ni
// réseau : KOBIPY_API_FIXTURE=reponses.json npm run build
let apiFixture
async function loadApiFixture(){
  const path = process.env.KOBIPY_API_FIXTURE
  if(!path) return null
  apiFixture ??= JSON.parse(await readFile(path, 'utf8'))
  return apiFixture
}

async function fetchJson(url){
  const fixture = await loadApiFixture()
  if(fixture){
    const endpoint = new URL(url).pathname.split('/').pop()
    const queued = fixture[endpoint]
    // Un tableau simule des appels successifs (pagination), un objet une
    // réponse unique.
    const response = Array.isArray(queued) ? queued.shift() : queued
    if(!response) throw new Error(`aucune réponse enregistrée pour ${endpoint}`)
    return response
  }

  const text = await fetchText(url)
  try{ return JSON.parse(text) }
  catch{ throw new Error('réponse JSON illisible') }
}

/** Identifiant UC… de la chaîne, extrait de sa page publique. */
async function resolveChannelId(){
  const channelId = parseChannelId(await fetchText(`https://www.youtube.com/${CHANNEL_HANDLE}`))
  if(!channelId || !CHANNEL_ID.test(channelId)) throw new Error(`identifiant de chaîne introuvable pour ${CHANNEL_HANDLE}`)
  return channelId
}

/**
 * Catalogue complet via l'API YouTube Data v3.
 *
 * Trois appels suffisent pour une chaîne de cette taille : la chaîne, la
 * playlist de ses mises en ligne, puis le détail des vidéos par lots de 50 —
 * soit moins de dix unités de quota sur les 10 000 quotidiennes.
 *
 * La clé ne sort jamais du runner : elle sert ici, et seuls les résultats
 * entrent dans le bundle.
 */
async function fetchFromApi(apiKey, channelId){
  const channel = parseChannel(await fetchJson(apiUrl('channels', {
    part: 'contentDetails,statistics', id: channelId, key: apiKey
  })))
  if(!channel) throw new Error('chaîne absente de la réponse channels.list')
  if(!channel.uploadsPlaylistId) throw new Error('playlist des mises en ligne introuvable')

  const ids = []
  let pageToken = null
  for(let page = 0; page < API_MAX_PAGES; page++){
    const listed = parsePlaylistItems(await fetchJson(apiUrl('playlistItems', {
      part: 'contentDetails', playlistId: channel.uploadsPlaylistId,
      maxResults: API_PAGE_SIZE, pageToken, key: apiKey
    })))
    ids.push(...listed.ids)
    pageToken = listed.nextPageToken
    if(!pageToken) break
  }
  if(ids.length === 0) throw new Error('aucune vidéo dans la playlist des mises en ligne')

  const videos = []
  for(let i = 0; i < ids.length; i += API_PAGE_SIZE){
    videos.push(...parseApiVideos(await fetchJson(apiUrl('videos', {
      part: 'snippet,contentDetails,statistics',
      id: ids.slice(i, i + API_PAGE_SIZE).join(','), key: apiKey
    }))))
  }
  if(videos.length === 0) throw new Error('aucune vidéo exploitable dans videos.list')

  return { videos, channel }
}

/** Repli sans clé : le flux Atom public, limité aux quinze dernières vidéos. */
async function fetchFromFeed(channelId){
  const videos = parseFeedVideos(await fetchText(feedUrl(channelId)))
  if(videos.length === 0) throw new Error('flux Atom illisible ou vide')
  return { videos, channel: null }
}

function describe({ videos, channel }, source){
  console.log(`[kobipy] ${videos.length} vidéos récupérées (${source})`)
  if(channel){
    console.log(`[kobipy] chaîne : ${channel.subscribers ?? '—'} abonnés, ${channel.videoCount ?? '—'} vidéos, ${channel.totalViews ?? '—'} vues cumulées`)
  }
  const withDuration = videos.filter(v => v.duration).length
  console.log(`[kobipy] durées : ${withDuration}/${videos.length} — vues : ${videos.filter(v => v.views !== null).length}/${videos.length}`)
  for(const video of videos){
    console.log(`[kobipy]   ${video.publishedAt?.slice(0, 10) ?? '??????????'}  ${video.id}  ${String(video.duration ?? '—').padStart(7)}  ${video.views ?? '—'}  ${video.title}`)
  }
}

/**
 * Récupère vidéos et statistiques, en dégradant sans jamais faire échouer le
 * build : API si une clé est fournie, sinon flux Atom public, et en dernier
 * ressort le catalogue éditorial de src/videos.js.
 */
async function fetchChannelData(){
  const fixture = process.env.KOBIPY_FEED_FIXTURE
  if(fixture){
    const videos = parseFeedVideos(await readFile(fixture, 'utf8'))
    console.log(`[kobipy] flux local ${fixture} : ${videos.length} vidéos`)
    return { videos, channel: null }
  }

  if(process.env.KOBIPY_API_FIXTURE){
    const data = await fetchFromApi('clé-simulée', (await loadApiFixture()).channelId ?? 'UCsimulee00000000000000')
    describe(data, `réponses enregistrées ${process.env.KOBIPY_API_FIXTURE}`)
    return data
  }

  const apiKey = process.env.YOUTUBE_API_KEY?.trim()
  let channelId
  try{
    channelId = await resolveChannelId()
  }catch(error){
    console.warn(`[kobipy] chaîne introuvable (${error.message}) — repli sur le catalogue éditorial`)
    return { videos: [], channel: null }
  }

  if(apiKey){
    try{
      const data = await fetchFromApi(apiKey, channelId)
      describe(data, 'API YouTube Data v3')
      return data
    }catch(error){
      console.warn(`[kobipy] API indisponible (${error.message}) — repli sur le flux Atom`)
    }
  }else{
    console.log('[kobipy] pas de clé YOUTUBE_API_KEY : lecture du flux Atom public')
  }

  try{
    const data = await fetchFromFeed(channelId)
    describe(data, 'flux Atom public')
    return data
  }catch(error){
    console.warn(`[kobipy] récupération impossible (${error.message}) — repli sur le catalogue éditorial`)
    return { videos: [], channel: null }
  }
}

function youtubeVideosPlugin(){
  let pending
  return {
    name: 'kobipy-videos-youtube',
    resolveId: id => (id === VIRTUAL_MODULE ? RESOLVED_MODULE : null),
    async load(id){
      if(id !== RESOLVED_MODULE) return null
      pending ??= fetchChannelData()
      return `export default ${JSON.stringify(await pending)}`
    }
  }
}

export default defineConfig({
  plugins: [react(), youtubeVideosPlugin(), cspPlugin()],
  // Fonctionne automatiquement pour un dépôt projet ou <utilisateur>.github.io.
  base: process.env.GITHUB_ACTIONS ? `/${process.env.GITHUB_REPOSITORY?.split('/')[1] || ''}/` : '/',
})
