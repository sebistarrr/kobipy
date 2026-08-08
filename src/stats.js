// Bande de chiffres de la page d'accueil.
//
// Le flux Atom ne porte aucune donnée au niveau de la chaîne : ces valeurs ne
// deviennent réelles qu'avec l'API YouTube Data. Sans clé, le repli ci-dessous
// est servi — ce sont les chiffres indicatifs saisis à l'origine.

import { compactNumber } from './videos.js'

export const FALLBACK_STATS = [
  ['10,6 k+', 'abonnés'],
  ['26', 'vidéos'],
  ['413 k+', 'vues cumulées'],
  ['15,9 k', 'vues moyennes / vidéo']
]

/**
 * Met la bande en forme à partir des statistiques de chaîne renvoyées par
 * l'API. Chaque chiffre manquant reprend sa valeur de repli, de sorte qu'une
 * chaîne masquant ses abonnés n'ampute pas la bande.
 *
 * La moyenne est calculée : l'API ne la fournit pas.
 */
export function buildStats(channel){
  if(!channel) return FALLBACK_STATS

  const { subscribers, videoCount, totalViews } = channel
  const average = Number.isFinite(totalViews) && Number.isFinite(videoCount) && videoCount > 0
    ? Math.round(totalViews / videoCount)
    : null

  // Une décimale jusqu'à 100 k : « 10,6 k » plutôt que « 11 k ».
  const compact = count => compactNumber(count, { decimalBelow: 100 })
  const value = (formatted, index) => formatted ?? FALLBACK_STATS[index][0]
  return [
    [value(compact(subscribers), 0), 'abonnés'],
    [value(compact(videoCount), 1), 'vidéos'],
    [value(compact(totalViews), 2), 'vues cumulées'],
    [value(compact(average), 3), 'vues moyennes / vidéo']
  ]
}
