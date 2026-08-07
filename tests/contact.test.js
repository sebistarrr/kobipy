import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMailtoUrl, LIMITS, singleLine } from '../src/contact.js'

const RECIPIENT = 'contact@exemple.fr'
const valide = { name: 'Sébastien', email: 'test@exemple.fr', subject: 'Bonjour', message: 'Une question.' }

// Les en-têtes mailto sont portés par la query string : c'est là que les sauts
// de ligne seraient dangereux. Le corps, lui, a le droit d'en contenir.
const params = url => new URLSearchParams(new URL(url).search)

test('construit une URL mailto correcte', () => {
  const { url, error } = buildMailtoUrl(RECIPIENT, valide)
  assert.equal(error, undefined)
  assert.ok(url.startsWith('mailto:contact%40exemple.fr?subject='))
  assert.match(url, /S%C3%A9bastien/)
})

test('neutralise une tentative d’injection d’en-tête dans le sujet', () => {
  const { url } = buildMailtoUrl(RECIPIENT, { ...valide, subject: 'Salut\r\nBcc: pirate@exemple.fr' })
  const subject = params(url).get('subject')
  assert.ok(!/[\r\n]/.test(subject), 'le sujet ne doit contenir aucun saut de ligne')
  assert.equal(subject, 'Salut Bcc: pirate@exemple.fr')
  // L'URL entière ne contient pas non plus de saut de ligne brut.
  assert.ok(!/[\r\n]/.test(url))
})

test('neutralise une tentative d’injection via le nom', () => {
  const { url } = buildMailtoUrl(RECIPIENT, { ...valide, subject: '', name: 'X\nCc: pirate@exemple.fr' })
  const subject = params(url).get('subject')
  assert.ok(!/[\r\n]/.test(subject))
  assert.equal(subject, 'Message de X Cc: pirate@exemple.fr')
})

test('le destinataire n’est jamais influencé par la saisie', () => {
  const { url } = buildMailtoUrl(RECIPIENT, { ...valide, name: 'a?to=pirate@exemple.fr&x=1' })
  assert.ok(url.startsWith('mailto:contact%40exemple.fr?'))
  assert.equal(params(url).get('to'), null)
})

test('les caractères spéciaux du corps sont encodés', () => {
  const { url } = buildMailtoUrl(RECIPIENT, { ...valide, message: 'a&b=c ?d #e' })
  assert.ok(url.endsWith('a%26b%3Dc%20%3Fd%20%23e'))
})

test('refuse une adresse e-mail invalide', () => {
  for(const email of ['pas-un-email', 'a@b', 'a b@c.fr', '', '@exemple.fr']){
    assert.match(buildMailtoUrl(RECIPIENT, { ...valide, email }).error, /e-mail valide/)
  }
})

test('refuse un nom ou un message vide', () => {
  assert.match(buildMailtoUrl(RECIPIENT, { ...valide, name: '   ' }).error, /nom et votre message/)
  assert.match(buildMailtoUrl(RECIPIENT, { ...valide, message: '\n\n' }).error, /nom et votre message/)
})

test('tronque les saisies démesurées', () => {
  const { url } = buildMailtoUrl(RECIPIENT, { ...valide, message: 'z'.repeat(50_000) })
  assert.ok(url.length < LIMITS.message + 400)
})

test('singleLine tolère les valeurs absentes', () => {
  assert.equal(singleLine(undefined, 10), '')
  assert.equal(singleLine(null, 10), '')
})
