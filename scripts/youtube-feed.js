// Lecture du flux Atom public d'une chaîne YouTube.
//
// Ces fonctions sont volontairement pures et sans réseau : elles sont couvertes
// par tests/youtube-feed.test.js. Les appels réseau vivent dans vite.config.js
// et n'ont lieu qu'au build, jamais dans le navigateur — le flux YouTube
// n'envoie pas d'en-tête CORS et une requête depuis la page serait bloquée.

export const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
export const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" }

const decodeXml = value =>
  value.replace(/&(#\d+|[a-z]+);/gi, (match, name) => {
    if(name in ENTITIES) return ENTITIES[name]
    if(name.startsWith('#')){
      const code = Number(name.slice(1))
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match
    }
    return match
  })

/** Extrait l'identifiant UC... depuis le HTML d'une page de chaîne. */
export function parseChannelId(html){
  const found = String(html ?? '').match(/"(?:channelId|externalId)":"(UC[A-Za-z0-9_-]{22})"/)
  return found && CHANNEL_ID.test(found[1]) ? found[1] : null
}

// Une entrée dont l'identifiant est absent ou mal formé est ignorée plutôt que
// de faire échouer toute la lecture : elle ne doit jamais atteindre la
// construction d'une URL.
function parseEntry(entry){
  const id = entry.match(/<yt:videoId>\s*([^<\s]+)\s*<\/yt:videoId>/)?.[1]
  const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]
  if(!id || !YOUTUBE_ID.test(id) || !title?.trim()) return null

  const published = entry.match(/<published>\s*([^<\s]+)\s*<\/published>/)?.[1]
  const description = entry.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1]
  const views = entry.match(/<media:statistics\b[^>]*\bviews="(\d+)"/)?.[1]

  return {
    id,
    title: decodeXml(title).trim(),
    description: description ? decodeXml(description).trim() : '',
    publishedAt: published && !Number.isNaN(Date.parse(published)) ? published : null,
    views: views !== undefined && Number.isSafeInteger(Number(views)) ? Number(views) : null
  }
}

/**
 * Renvoie toutes les vidéos du flux, de la plus récente à la plus ancienne
 * (YouTube en publie une quinzaine). Un flux vide, tronqué ou illisible donne
 * un tableau vide plutôt qu'une exception.
 */
export function parseVideos(xml){
  const videos = []
  const seen = new Set()
  for(const [, entry] of String(xml ?? '').matchAll(/<entry>([\s\S]*?)<\/entry>/g)){
    const video = parseEntry(entry)
    if(!video || seen.has(video.id)) continue
    seen.add(video.id)
    videos.push(video)
  }
  return videos
}

/** Vidéo la plus récente du flux, ou null. */
export const parseLatestVideo = xml => parseVideos(xml)[0] ?? null

export const feedUrl = channelId => `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
