// Construction de la vidéothèque à partir du flux YouTube.
//
// Le flux fournit les identifiants, les titres, les descriptions, les dates de
// publication et — selon les versions du format — le nombre de vues. Il ne
// fournit ni durée, ni thème : ces deux champs sont éditoriaux et vivent dans
// CURATED ci-dessous, indexés par identifiant de vidéo.

export const DEFAULT_CATEGORY = 'Mathématiques'

// Sert à deux choses : enrichir les vidéos du flux, et servir de catalogue de
// repli si le flux est injoignable au moment du build. À garder classé du plus
// récent au plus ancien.
export const CURATED = [
  { id:'K3jf5BFsPiw', title:'Pourquoi ne peut-on pas permuter limite et intégrale ?', category:'Analyse', views:'19 k vues', duration:'9:48', date:'2025', description:'Une exploration visuelle des hypothèses cachées derrière le passage à la limite sous le signe intégral.' },
  { id:'PCklKViZapo', title:"La continuité : un concept plus difficile qu'il n'y paraît", category:'Analyse', views:'20 k vues', duration:'11:25', date:'2025', description:"Comprendre intuitivement les différentes formes de continuité grâce à l'animation." },
  { id:'K-JRFkrq7CA', title:'Comprendre les convergences simple et uniforme', category:'Analyse', views:'26 k vues', duration:'9:17', date:'2024', description:"Deux notions proches en apparence, mais profondément différentes lorsqu'on les visualise." },
  { id:'Oigh-j52CqE', title:"La puissance de l'intégrale de Lebesgue", category:'Intégration', views:'81 k vues', duration:'16:41', date:'2024', description:"Pourquoi l'intégrale de Lebesgue dépasse-t-elle celle de Riemann ? Une réponse visuelle." },
  { id:'U2xmox321_k', title:"Où est le cercle ? L'intégrale de Gauss", category:'Géométrie', views:'62 k vues', duration:'6:32', date:'2023', description:"Un cercle invisible apparaît au cœur d'une intégrale célèbre." },
  { id:'37tG_qvBb3M', title:'La fonction de Weierstrass est un monstre mathématique', category:'Fonctions', views:'48 k vues', duration:'5:31', date:'2023', description:'Une fonction continue partout et dérivable nulle part, révélée image par image.' }
]

const curatedById = new Map(CURATED.map(video => [video.id, video]))

const DESCRIPTION_MAX = 170

/**
 * Une description YouTube contient chapitres, liens et crédits sur plusieurs
 * dizaines de lignes. On n'en garde que la première phrase utile, tronquée sur
 * une frontière de mot.
 */
export function summarize(description){
  const firstLine = String(description ?? '').split('\n').map(l => l.trim()).find(Boolean)
  if(!firstLine) return ''
  const clean = firstLine.replace(/\s+/g, ' ')
  if(clean.length <= DESCRIPTION_MAX) return clean
  const cut = clean.slice(0, DESCRIPTION_MAX)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > DESCRIPTION_MAX / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/** Met en forme un nombre de vues à la française : 19 k vues, 1,2 M vues. */
export function formatViews(views){
  if(!Number.isFinite(views) || views < 0) return null
  if(views < 1000) return `${views} vues`
  if(views < 1e6){
    const thousands = views / 1000
    return `${thousands.toFixed(thousands < 10 ? 1 : 0).replace('.', ',')} k vues`
  }
  return `${(views / 1e6).toFixed(1).replace('.', ',')} M vues`
}

const publicationYear = publishedAt => {
  const parsed = Date.parse(publishedAt ?? '')
  return Number.isNaN(parsed) ? null : String(new Date(parsed).getUTCFullYear())
}

/**
 * Fusionne le flux et les métadonnées éditoriales.
 *
 * Les titres et descriptions YouTube sont écrits pour l'algorithme — majuscules,
 * hashtags, numéros d'épisode — et jurent avec la typographie du site. La
 * version éditoriale prime donc quand elle existe ; le flux prend le relais pour
 * les vidéos non répertoriées, qui apparaissent ainsi sans toucher au code.
 *
 * Un flux vide ou illisible renvoie le catalogue éditorial tel quel.
 */
export function buildCatalogue(feedVideos){
  if(!Array.isArray(feedVideos) || feedVideos.length === 0) return CURATED

  const merged = feedVideos.map(video => {
    const curated = curatedById.get(video.id)
    return {
      id: video.id,
      title: curated?.title || video.title,
      description: curated?.description || summarize(video.description),
      category: curated?.category ?? DEFAULT_CATEGORY,
      duration: curated?.duration ?? null,
      views: formatViews(video.views) ?? curated?.views ?? null,
      date: publicationYear(video.publishedAt) ?? curated?.date ?? '',
      publishedAt: video.publishedAt
    }
  })

  // L'ordre du flux est déjà antichronologique, mais on ne s'y fie pas.
  const dated = merged.filter(v => v.publishedAt)
  const undated = merged.filter(v => !v.publishedAt)
  dated.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
  return [...dated, ...undated]
}
