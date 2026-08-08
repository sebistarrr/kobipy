import assert from 'node:assert/strict'
import test from 'node:test'
import { CURATED, DEFAULT_CATEGORY, EDITORIAL, buildCatalogue, formatViews, summarize } from '../src/videos.js'

const feedEntry = (overrides = {}) => ({
  id: 'K3jf5BFsPiw',
  title: 'Mais POURQUOI ne peut-on pas permuter LIMITE et INTÉGRALE ?! - Episode 3 #SoME4',
  description: 'Une description YouTube.',
  publishedAt: '2025-07-30T18:33:39+00:00',
  views: 19432,
  ...overrides
})

test('un flux vide, absent ou invalide renvoie le catalogue éditorial', () => {
  assert.equal(buildCatalogue([]), CURATED)
  assert.equal(buildCatalogue(null), CURATED)
  assert.equal(buildCatalogue(undefined), CURATED)
  assert.equal(buildCatalogue('pas un tableau'), CURATED)
})

test('le titre affiché est celui de YouTube, même pour une vidéo répertoriée', () => {
  const [video] = buildCatalogue([feedEntry()])
  assert.equal(video.title, 'Mais POURQUOI ne peut-on pas permuter LIMITE et INTÉGRALE ?! - Episode 3 #SoME4')
  // Le reste des métadonnées éditoriales continue de s'appliquer.
  assert.equal(video.category, 'Analyse')
  assert.equal(video.duration, '9:48')
  assert.match(video.description, /^Une exploration visuelle/)
})

test('le titre éditorial ne sert que de repli si le flux n’en fournit pas', () => {
  const [video] = buildCatalogue([feedEntry({ title: '' })])
  assert.equal(video.title, 'Pourquoi ne peut-on pas permuter limite et intégrale ?')
})

test('une vidéo inconnue du catalogue est reprise du flux', () => {
  const [video] = buildCatalogue([feedEntry({ id: 'ZZZZZZZZZZZ', title: 'Nouvelle vidéo' })])
  assert.equal(video.title, 'Nouvelle vidéo')
  assert.equal(video.category, DEFAULT_CATEGORY)
  assert.equal(video.duration, null, 'le flux ne fournit pas de durée')
  assert.equal(video.description, 'Une description YouTube.')
})

test('les vues du flux priment sur les vues éditoriales', () => {
  assert.equal(buildCatalogue([feedEntry()])[0].views, '19 k vues')
  // Sans vues dans le flux, la valeur éditoriale prend le relais.
  assert.equal(buildCatalogue([feedEntry({ views: null })])[0].views, '19 k vues')
  assert.equal(buildCatalogue([feedEntry({ id: 'ZZZZZZZZZZZ', views: null })])[0].views, null)
})

test('l’année affichée vient de la date de publication', () => {
  assert.equal(buildCatalogue([feedEntry()])[0].date, '2025')
  assert.equal(buildCatalogue([feedEntry({ publishedAt: null })])[0].date, '2025', 'repli éditorial')
})

test('le catalogue est reclassé du plus récent au plus ancien', () => {
  const catalogue = buildCatalogue([
    feedEntry({ id: 'U2xmox321_k', publishedAt: '2023-01-01T00:00:00+00:00' }),
    feedEntry({ id: 'K3jf5BFsPiw', publishedAt: '2025-07-30T00:00:00+00:00' }),
    feedEntry({ id: 'Oigh-j52CqE', publishedAt: '2024-05-05T00:00:00+00:00' })
  ])
  assert.deepEqual(catalogue.map(v => v.id), ['K3jf5BFsPiw', 'Oigh-j52CqE', 'U2xmox321_k'])
})

test('les vidéos sans date passent en fin de liste sans disparaître', () => {
  const catalogue = buildCatalogue([
    feedEntry({ id: 'ZZZZZZZZZZZ', publishedAt: null }),
    feedEntry({ id: 'K3jf5BFsPiw' })
  ])
  assert.deepEqual(catalogue.map(v => v.id), ['K3jf5BFsPiw', 'ZZZZZZZZZZZ'])
})

test('formatViews suit les conventions françaises', () => {
  assert.equal(formatViews(842), '842 vues')
  assert.equal(formatViews(1500), '1,5 k vues')
  assert.equal(formatViews(19432), '19 k vues')
  assert.equal(formatViews(413000), '413 k vues')
  assert.equal(formatViews(1250000), '1,3 M vues')
})

test('formatViews rejette les valeurs absurdes', () => {
  for(const bad of [null, undefined, -5, NaN, Infinity, 'beaucoup']) assert.equal(formatViews(bad), null)
})

test('summarize ne garde que la première ligne utile', () => {
  const description = '\n\n  Une exploration visuelle.  \n\n🔔 Abonne-toi !\n0:00 Introduction\n'
  assert.equal(summarize(description), 'Une exploration visuelle.')
})

test('summarize tronque sur une frontière de mot', () => {
  const result = summarize('mot '.repeat(200))
  assert.ok(result.length <= 171, `longueur ${result.length}`)
  assert.ok(result.endsWith('…'))
  assert.ok(!result.includes('mo…'), 'ne doit pas couper au milieu d’un mot')
})

test('summarize tolère une description vide ou absente', () => {
  assert.equal(summarize(''), '')
  assert.equal(summarize(null), '')
  assert.equal(summarize(undefined), '')
  assert.equal(summarize('\n \n'), '')
})

test('toutes les clés éditoriales sont des identifiants YouTube valides', () => {
  for(const id of Object.keys(EDITORIAL)){
    assert.match(id, /^[A-Za-z0-9_-]{11}$/, `identifiant suspect : ${id}`)
  }
})

test('le catalogue de repli n’a que des entrées complètes', () => {
  for(const video of CURATED){
    for(const champ of ['title', 'category', 'duration', 'views', 'date', 'description']){
      assert.ok(video[champ], `${video.id} : ${champ} manquant`)
    }
  }
})

test('une entrée éditoriale réduite à un thème laisse le flux fournir le reste', () => {
  const [video] = buildCatalogue([{
    id: 'pwTAg2sgT0E', title: 'Pendule sonore', description: 'Une description.',
    publishedAt: '2024-09-18T00:00:00+00:00', views: 1789
  }])
  assert.equal(video.category, 'Musique', 'le thème vient de EDITORIAL')
  assert.equal(video.title, 'Pendule sonore', 'le titre vient du flux')
  assert.equal(video.views, '1,8 k vues')
  assert.equal(video.duration, null, 'le flux ne fournit pas de durée')
})
