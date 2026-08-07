import assert from 'node:assert/strict'
import test from 'node:test'
import { feedUrl, parseChannelId, parseLatestVideo, parseVideos } from '../scripts/youtube-feed.js'

// Extrait représentatif du flux Atom renvoyé par YouTube.
const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <title>KobiPy</title>
  <entry>
    <id>yt:video:K3jf5BFsPiw</id>
    <yt:videoId>K3jf5BFsPiw</yt:videoId>
    <title>Limite &amp; intégrale : pourquoi &quot;permuter&quot; échoue</title>
    <published>2026-03-12T17:00:04+00:00</published>
    <media:group>
      <media:title>Limite &amp; intégrale</media:title>
      <media:description>Une exploration visuelle.
Avec un lien : https://exemple.fr</media:description>
      <media:community>
        <media:starRating count="1200" average="5.00" min="1" max="5"/>
        <media:statistics views="19432"/>
      </media:community>
    </media:group>
  </entry>
  <entry>
    <id>yt:video:PCklKViZapo</id>
    <yt:videoId>PCklKViZapo</yt:videoId>
    <title>Une vidéo plus ancienne</title>
    <published>2026-01-05T17:00:04+00:00</published>
  </entry>
</feed>`

test('retient la première entrée du flux', () => {
  const latest = parseLatestVideo(FEED)
  assert.equal(latest.id, 'K3jf5BFsPiw')
  assert.equal(latest.publishedAt, '2026-03-12T17:00:04+00:00')
})

test('décode les entités XML du titre', () => {
  assert.equal(parseLatestVideo(FEED).title, 'Limite & intégrale : pourquoi "permuter" échoue')
})

test('ne confond pas <title> et <media:title>', () => {
  assert.ok(!parseLatestVideo(FEED).title.endsWith('intégrale'))
})

test('ignore une entrée dont l’identifiant est mal formé', () => {
  for(const bad of ['court', '../../evil', 'K3jf5BFsPiw!', '"><script>']){
    const xml = FEED.replace('<yt:videoId>K3jf5BFsPiw</yt:videoId>', `<yt:videoId>${bad}</yt:videoId>`)
    const videos = parseVideos(xml)
    // L'entrée fautive disparaît, la suivante reste exploitable.
    assert.deepEqual(videos.map(v => v.id), ['PCklKViZapo'], `devrait ignorer : ${bad}`)
  }
})

test('lit toutes les entrées du flux, dans l’ordre', () => {
  assert.deepEqual(parseVideos(FEED).map(v => v.id), ['K3jf5BFsPiw', 'PCklKViZapo'])
})

test('extrait description et nombre de vues quand le flux les fournit', () => {
  const [latest] = parseVideos(FEED)
  assert.equal(latest.description, 'Une exploration visuelle.\nAvec un lien : https://exemple.fr')
  assert.equal(latest.views, 19432)
})

test('description et vues valent respectivement "" et null si absentes du flux', () => {
  const [, older] = parseVideos(FEED)
  assert.equal(older.description, '')
  assert.equal(older.views, null)
})

test('ignore un doublon d’identifiant', () => {
  const doubled = FEED.replace('<yt:videoId>PCklKViZapo</yt:videoId>', '<yt:videoId>K3jf5BFsPiw</yt:videoId>')
  assert.equal(parseVideos(doubled).length, 1)
})

test('renvoie un tableau vide sur un flux vide, tronqué ou absent', () => {
  assert.deepEqual(parseVideos('<feed></feed>'), [])
  assert.deepEqual(parseVideos(''), [])
  assert.deepEqual(parseVideos(null), [])
})

test('renvoie null sur un flux vide, tronqué ou absent', () => {
  assert.equal(parseLatestVideo('<feed></feed>'), null)
  assert.equal(parseLatestVideo('<feed><entry><yt:videoId>K3jf5BFsPiw'), null)
  assert.equal(parseLatestVideo(''), null)
  assert.equal(parseLatestVideo(null), null)
  assert.equal(parseLatestVideo(undefined), null)
})

test('ignore une date de publication invalide sans perdre la vidéo', () => {
  const xml = FEED.replace('2026-03-12T17:00:04+00:00', 'pas-une-date')
  const latest = parseLatestVideo(xml)
  assert.equal(latest.id, 'K3jf5BFsPiw')
  assert.equal(latest.publishedAt, null)
})

test('extrait l’identifiant de chaîne', () => {
  assert.equal(parseChannelId('{"channelId":"UCabcdefghijklmnopqrstuv"}'), 'UCabcdefghijklmnopqrstuv')
  assert.equal(parseChannelId('{"externalId":"UCabcdefghijklmnopqrstuv"}'), 'UCabcdefghijklmnopqrstuv')
})

test('rejette un identifiant de chaîne mal formé', () => {
  assert.equal(parseChannelId('{"channelId":"XXabcdefghijklmnopqrstuv"}'), null)
  assert.equal(parseChannelId('{"channelId":"UCtropcourt"}'), null)
  assert.equal(parseChannelId(''), null)
  assert.equal(parseChannelId(null), null)
})

test('construit l’URL du flux', () => {
  assert.equal(
    feedUrl('UCabcdefghijklmnopqrstuv'),
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCabcdefghijklmnopqrstuv'
  )
})
