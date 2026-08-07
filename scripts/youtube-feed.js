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

/**
 * Renvoie la vidéo la plus récente du flux, ou null si le flux est vide ou
 * illisible. Le format est revalidé : une réponse inattendue ne doit jamais
 * produire une URL d'embed fantaisiste.
 */
export function parseLatestVideo(xml){
  const entry = String(xml ?? '').match(/<entry>([\s\S]*?)<\/entry>/)?.[1]
  if(!entry) return null

  const id = entry.match(/<yt:videoId>\s*([^<\s]+)\s*<\/yt:videoId>/)?.[1]
  const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]
  const published = entry.match(/<published>\s*([^<\s]+)\s*<\/published>/)?.[1]
  if(!id || !YOUTUBE_ID.test(id) || !title?.trim()) return null

  const publishedAt = published && !Number.isNaN(Date.parse(published)) ? published : null
  return { id, title: decodeXml(title).trim(), publishedAt }
}

export const feedUrl = channelId => `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
