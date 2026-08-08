// Lecture de l'API YouTube Data v3.
//
// Comme pour le flux Atom, ces fonctions sont pures et sans réseau : les appels
// vivent dans vite.config.js et n'ont lieu qu'au build. La clé d'API ne quitte
// jamais le runner — seuls les chiffres obtenus entrent dans le bundle.
//
// Toute réponse est traitée comme non fiable : un champ manquant ou d'un type
// inattendu donne null plutôt qu'une exception ou une valeur fantaisiste.

import { YOUTUBE_ID } from './youtube-feed.js'

export const API_ROOT = 'https://www.googleapis.com/youtube/v3'

// L'API renvoie les durées en ISO 8601 : PT9M48S, PT1H2M3S, P1DT2H…
const ISO_DURATION = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/

/** PT9M48S → « 9:48 », PT1H2M3S → « 1:02:03 ». null si illisible ou nulle. */
export function formatDuration(iso){
  const found = ISO_DURATION.exec(String(iso ?? ''))
  if(!found) return null
  const [, days, hours, minutes, seconds] = found.map(part => (part === undefined ? 0 : Number(part)))
  const total = ((days * 24 + hours) * 60 + minutes) * 60 + seconds
  if(!Number.isFinite(total) || total <= 0) return null

  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = value => String(value).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

const toCount = value => {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

/**
 * channels.list → identifiant de la playlist des mises en ligne et statistiques
 * de la chaîne. Renvoie null si la réponse ne contient pas de chaîne.
 *
 * subscriberCount est absent quand la chaîne masque son nombre d'abonnés : le
 * champ vaut alors null, sans empêcher le reste.
 */
export function parseChannel(json){
  const channel = json?.items?.[0]
  if(!channel) return null

  const uploads = channel.contentDetails?.relatedPlaylists?.uploads
  const stats = channel.statistics ?? {}
  return {
    uploadsPlaylistId: typeof uploads === 'string' && uploads ? uploads : null,
    subscribers: channel.statistics?.hiddenSubscriberCount ? null : toCount(stats.subscriberCount),
    videoCount: toCount(stats.videoCount),
    totalViews: toCount(stats.viewCount)
  }
}

/** playlistItems.list → identifiants de vidéos et jeton de page suivante. */
export function parsePlaylistItems(json){
  const ids = []
  for(const item of json?.items ?? []){
    const id = item?.contentDetails?.videoId ?? item?.snippet?.resourceId?.videoId
    if(typeof id === 'string' && YOUTUBE_ID.test(id) && !ids.includes(id)) ids.push(id)
  }
  const token = json?.nextPageToken
  return { ids, nextPageToken: typeof token === 'string' && token ? token : null }
}

/**
 * videos.list → vidéos exploitables, dans l'ordre renvoyé par l'API. Une entrée
 * dont l'identifiant ou le titre manque est ignorée : elle ne doit jamais
 * atteindre la construction d'une URL.
 */
export function parseVideos(json){
  const videos = []
  for(const item of json?.items ?? []){
    const id = item?.id
    const title = item?.snippet?.title
    if(typeof id !== 'string' || !YOUTUBE_ID.test(id)) continue
    if(typeof title !== 'string' || !title.trim()) continue

    const publishedAt = item.snippet?.publishedAt
    videos.push({
      id,
      title: title.trim(),
      description: typeof item.snippet?.description === 'string' ? item.snippet.description.trim() : '',
      publishedAt: publishedAt && !Number.isNaN(Date.parse(publishedAt)) ? publishedAt : null,
      views: toCount(item.statistics?.viewCount),
      duration: formatDuration(item.contentDetails?.duration)
    })
  }
  return videos
}

/** Construit une URL d'API en encodant chaque paramètre. */
export function apiUrl(endpoint, params){
  const url = new URL(`${API_ROOT}/${endpoint}`)
  for(const [key, value] of Object.entries(params)){
    if(value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  }
  return url.toString()
}
