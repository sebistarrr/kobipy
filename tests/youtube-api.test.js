import assert from 'node:assert/strict'
import test from 'node:test'
import { apiUrl, formatDuration, parseChannel, parsePlaylistItems, parseVideos } from '../scripts/youtube-api.js'

test('convertit les durées ISO 8601', () => {
  assert.equal(formatDuration('PT9M48S'), '9:48')
  assert.equal(formatDuration('PT16M41S'), '16:41')
  assert.equal(formatDuration('PT45S'), '0:45')
  assert.equal(formatDuration('PT1H'), '1:00:00')
  assert.equal(formatDuration('PT1H2M3S'), '1:02:03')
  assert.equal(formatDuration('PT2M'), '2:00')
  assert.equal(formatDuration('P1DT2H'), '26:00:00')
})

test('rejette une durée absente, nulle ou illisible', () => {
  for(const bad of ['', 'PT0S', 'P', '9:48', 'bonjour', null, undefined, 42]){
    assert.equal(formatDuration(bad), null, `devrait rejeter : ${bad}`)
  }
})

test('lit la playlist des mises en ligne et les statistiques de chaîne', () => {
  const channel = parseChannel({ items: [{
    contentDetails: { relatedPlaylists: { uploads: 'UUabcdefghijklmnopqrstuv' } },
    statistics: { subscriberCount: '10600', videoCount: '26', viewCount: '413000' }
  }] })
  assert.equal(channel.uploadsPlaylistId, 'UUabcdefghijklmnopqrstuv')
  assert.equal(channel.subscribers, 10600)
  assert.equal(channel.videoCount, 26)
  assert.equal(channel.totalViews, 413000)
})

test('respecte une chaîne qui masque son nombre d’abonnés', () => {
  const channel = parseChannel({ items: [{
    contentDetails: { relatedPlaylists: { uploads: 'UUabcdefghijklmnopqrstuv' } },
    statistics: { hiddenSubscriberCount: true, subscriberCount: '0', videoCount: '26', viewCount: '413000' }
  }] })
  assert.equal(channel.subscribers, null)
  assert.equal(channel.videoCount, 26, 'le reste reste exploitable')
})

test('renvoie null si la réponse ne contient aucune chaîne', () => {
  assert.equal(parseChannel({ items: [] }), null)
  assert.equal(parseChannel({}), null)
  assert.equal(parseChannel(null), null)
})

test('tolère des statistiques absentes ou absurdes', () => {
  const channel = parseChannel({ items: [{ contentDetails: {}, statistics: { subscriberCount: 'beaucoup', viewCount: '-5' } }] })
  assert.equal(channel.uploadsPlaylistId, null)
  assert.equal(channel.subscribers, null)
  assert.equal(channel.videoCount, null)
  assert.equal(channel.totalViews, null)
})

test('collecte les identifiants de la playlist et le jeton de page', () => {
  const listed = parsePlaylistItems({
    items: [
      { contentDetails: { videoId: 'K3jf5BFsPiw' } },
      { snippet: { resourceId: { videoId: 'PCklKViZapo' } } },
      { contentDetails: { videoId: 'K3jf5BFsPiw' } },      // doublon
      { contentDetails: { videoId: 'trop-court' } },        // mal formé
      {}
    ],
    nextPageToken: 'PAGE2'
  })
  assert.deepEqual(listed.ids, ['K3jf5BFsPiw', 'PCklKViZapo'])
  assert.equal(listed.nextPageToken, 'PAGE2')
})

test('signale l’absence de page suivante', () => {
  assert.equal(parsePlaylistItems({ items: [] }).nextPageToken, null)
  assert.deepEqual(parsePlaylistItems(null).ids, [])
})

test('lit le détail des vidéos', () => {
  const [video] = parseVideos({ items: [{
    id: 'K3jf5BFsPiw',
    snippet: { title: '  Permuter limite et intégrale  ', description: 'Une description.\nAvec des chapitres.', publishedAt: '2025-07-30T18:33:39Z' },
    contentDetails: { duration: 'PT9M48S' },
    statistics: { viewCount: '19472' }
  }] })
  assert.equal(video.title, 'Permuter limite et intégrale')
  assert.equal(video.duration, '9:48')
  assert.equal(video.views, 19472)
  assert.equal(video.publishedAt, '2025-07-30T18:33:39Z')
})

test('ignore une vidéo sans identifiant valide ou sans titre', () => {
  const videos = parseVideos({ items: [
    { id: 'trop-court', snippet: { title: 'Titre' } },
    { id: '"><script>x', snippet: { title: 'Titre' } },
    { id: 'K3jf5BFsPiw', snippet: { title: '   ' } },
    { id: 'PCklKViZapo', snippet: { title: 'Valide' } }
  ] })
  assert.deepEqual(videos.map(v => v.id), ['PCklKViZapo'])
})

test('tolère durée, vues et date manquantes', () => {
  const [video] = parseVideos({ items: [{ id: 'K3jf5BFsPiw', snippet: { title: 'Titre' } }] })
  assert.equal(video.duration, null)
  assert.equal(video.views, null)
  assert.equal(video.publishedAt, null)
  assert.equal(video.description, '')
})

test('encode les paramètres d’URL', () => {
  const url = apiUrl('videos', { part: 'snippet,contentDetails', id: 'a&b', key: 'clé secrète', pageToken: null })
  assert.ok(url.startsWith('https://www.googleapis.com/youtube/v3/videos?'))
  assert.match(url, /id=a%26b/)
  assert.match(url, /key=cl%C3%A9\+secr%C3%A8te/)
  assert.ok(!url.includes('pageToken'), 'les paramètres vides sont omis')
})
