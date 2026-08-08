import assert from 'node:assert/strict'
import test from 'node:test'
import { FALLBACK_STATS, buildStats } from '../src/stats.js'

const values = stats => stats.map(([value]) => value)
const labels = stats => stats.map(([, label]) => label)

test('sans données de chaîne, la bande garde ses valeurs de repli', () => {
  assert.equal(buildStats(null), FALLBACK_STATS)
  assert.equal(buildStats(undefined), FALLBACK_STATS)
})

test('met en forme les vrais chiffres et calcule la moyenne', () => {
  const stats = buildStats({ subscribers: 10600, videoCount: 26, totalViews: 413000 })
  assert.deepEqual(values(stats), ['10,6 k', '26', '413 k', '15,9 k'])
})

test('les intitulés ne changent jamais', () => {
  const attendus = ['abonnés', 'vidéos', 'vues cumulées', 'vues moyennes / vidéo']
  assert.deepEqual(labels(buildStats(null)), attendus)
  assert.deepEqual(labels(buildStats({ subscribers: 1, videoCount: 1, totalViews: 1 })), attendus)
})

test('un chiffre manquant reprend sa valeur de repli sans amputer la bande', () => {
  const stats = buildStats({ subscribers: null, videoCount: 26, totalViews: 413000 })
  assert.equal(stats.length, 4)
  assert.equal(values(stats)[0], FALLBACK_STATS[0][0], 'abonnés masqués → repli')
  assert.equal(values(stats)[1], '26', 'le reste vient bien de l’API')
})

test('évite la division par zéro sur une chaîne sans vidéo', () => {
  const stats = buildStats({ subscribers: 500, videoCount: 0, totalViews: 0 })
  assert.equal(values(stats)[3], FALLBACK_STATS[3][0], 'moyenne impossible → repli')
  assert.equal(values(stats)[0], '500')
})

test('abrège les grands nombres', () => {
  const stats = buildStats({ subscribers: 1250000, videoCount: 300, totalViews: 45000000 })
  assert.deepEqual(values(stats), ['1,3 M', '300', '45 M', '150 k'])
})
