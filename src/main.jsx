import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ChevronDown, Clock, ExternalLink, Heart, Mail, Menu, Play, Search, Send, Sparkles, Trash2, X } from 'lucide-react'
import { LIMITS, buildMailtoUrl } from './contact.js'
import './styles.css'

const CHANNEL_URL = 'https://www.youtube.com/@kobipy'
const TIPEEE_URL = 'https://fr.tipeee.com/kobipy/'
const CONTACT_EMAIL = 'sebastientran23@gmail.com'

const HISTORY_KEY = 'kobipy:historique'
const HISTORY_MAX = 5
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

const videos = [
  { id:'K3jf5BFsPiw', title:'Pourquoi ne peut-on pas permuter limite et intégrale ?', category:'Analyse', views:'19 k vues', duration:'9:48', date:'2025', description:'Une exploration visuelle des hypothèses cachées derrière le passage à la limite sous le signe intégral.' },
  { id:'PCklKViZapo', title:"La continuité : un concept plus difficile qu'il n'y paraît", category:'Analyse', views:'20 k vues', duration:'11:25', date:'2025', description:"Comprendre intuitivement les différentes formes de continuité grâce à l'animation." },
  { id:'K-JRFkrq7CA', title:'Comprendre les convergences simple et uniforme', category:'Analyse', views:'26 k vues', duration:'9:17', date:'2024', description:"Deux notions proches en apparence, mais profondément différentes lorsqu'on les visualise." },
  { id:'Oigh-j52CqE', title:"La puissance de l'intégrale de Lebesgue", category:'Intégration', views:'81 k vues', duration:'16:41', date:'2024', description:"Pourquoi l'intégrale de Lebesgue dépasse-t-elle celle de Riemann ? Une réponse visuelle." },
  { id:'U2xmox321_k', title:"Où est le cercle ? L'intégrale de Gauss", category:'Géométrie', views:'62 k vues', duration:'6:32', date:'2023', description:"Un cercle invisible apparaît au cœur d'une intégrale célèbre." },
  { id:'37tG_qvBb3M', title:'La fonction de Weierstrass est un monstre mathématique', category:'Fonctions', views:'48 k vues', duration:'5:31', date:'2023', description:'Une fonction continue partout et dérivable nulle part, révélée image par image.' }
]

const videosById = new Map(videos.filter(v => YOUTUBE_ID.test(v.id)).map(v => [v.id, v]))

const faqs = [
  ['À qui s’adressent les vidéos KobiPy ?', 'Aux curieux, étudiants et passionnés qui veulent comprendre les mathématiques par l’intuition, les animations et la visualisation, sans renoncer à la rigueur.'],
  ['Quels outils sont utilisés pour créer les animations ?', 'Les animations sont principalement réalisées avec Python, notamment Manim et Pygame, ainsi qu’avec Blender pour certaines scènes.'],
  ['Puis-je utiliser les vidéos dans un cadre pédagogique ?', 'Vous pouvez partager les liens vers les vidéos. Pour toute reproduction ou intégration plus large, contactez directement KobiPy.'],
  ['Le site conserve-t-il des données personnelles ?', 'Aucune donnée n’est envoyée à un serveur. La dernière vidéo visualisée est mémorisée uniquement dans votre navigateur et peut être effacée à tout moment depuis la section « Reprendre ».'],
  ['Comment soutenir la chaîne ?', 'Vous pouvez vous abonner, partager les vidéos ou contribuer directement via la page Tipeee de KobiPy.']
]

const thumbnailUrl = id => `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`
const embedUrl = id => `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`

// Le contenu de localStorage est modifiable par l'utilisateur ou par un script
// tiers : on ne réutilise donc jamais les valeurs telles quelles, chaque entrée
// est revalidée contre le catalogue avant d'être affichée.
function readHistory(){
  try{
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? '[]')
    if(!Array.isArray(parsed)) return []
    const entries = []
    const seen = new Set()
    for(const entry of parsed){
      if(!entry || typeof entry !== 'object') continue
      const { id, watchedAt } = entry
      if(!videosById.has(id) || seen.has(id)) continue
      if(!Number.isFinite(watchedAt) || watchedAt <= 0) continue
      seen.add(id)
      entries.push({ id, watchedAt })
      if(entries.length === HISTORY_MAX) break
    }
    return entries
  }catch{
    return []
  }
}

const relative = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })

function formatWatchedAt(timestamp){
  // Borné à maintenant : un horodatage falsifié ne doit pas afficher « dans 3 jours ».
  const elapsed = Math.min(timestamp, Date.now()) - Date.now()
  const minutes = Math.round(elapsed / 60000)
  if(Math.abs(minutes) < 60) return relative.format(minutes, 'minute')
  const hours = Math.round(elapsed / 3600000)
  if(Math.abs(hours) < 24) return relative.format(hours, 'hour')
  return relative.format(Math.round(elapsed / 86400000), 'day')
}

function App(){
  const [menu,setMenu]=useState(false), [category,setCategory]=useState('Toutes'), [query,setQuery]=useState(''), [openFaq,setOpenFaq]=useState(0), [activeVideo,setActiveVideo]=useState(null)
  const [contact,setContact]=useState({name:'',email:'',subject:'',message:''})
  const [contactError,setContactError]=useState('')
  const [history,setHistory]=useState(readHistory)

  const categories=['Toutes',...new Set(videos.map(v=>v.category))]
  const filtered=useMemo(()=>videos.filter(v=>(category==='Toutes'||v.category===category)&&v.title.toLowerCase().includes(query.toLowerCase())),[category,query])
  const watched=useMemo(()=>history.map(e=>({...videosById.get(e.id),watchedAt:e.watchedAt})),[history])
  const lastWatched=watched[0]
  const alsoWatched=watched.slice(1)

  const go=useCallback(id=>{document.getElementById(id)?.scrollIntoView({behavior:'smooth'});setMenu(false)},[])

  const openVideo=useCallback(video=>{
    setActiveVideo(video)
    setHistory(previous=>[{id:video.id,watchedAt:Date.now()},...previous.filter(e=>e.id!==video.id)].slice(0,HISTORY_MAX))
  },[])

  const clearHistory=useCallback(()=>setHistory([]),[])

  // Persistance best-effort : navigation privée, quota atteint ou stockage
  // désactivé ne doivent jamais casser la page. Un historique vidé retire la clé
  // au lieu d'y laisser un tableau vide.
  useEffect(()=>{
    try{
      if(history.length) window.localStorage.setItem(HISTORY_KEY,JSON.stringify(history))
      else window.localStorage.removeItem(HISTORY_KEY)
    }catch{ /* historique simplement non persisté */ }
  },[history])

  // Fermeture au clavier et blocage du défilement de l'arrière-plan.
  useEffect(()=>{
    if(!activeVideo) return
    const onKeyDown=event=>{ if(event.key==='Escape') setActiveVideo(null) }
    document.addEventListener('keydown',onKeyDown)
    document.body.classList.add('modal-open')
    return ()=>{ document.removeEventListener('keydown',onKeyDown); document.body.classList.remove('modal-open') }
  },[activeVideo])

  const sendContact=event=>{
    event.preventDefault()
    const { url, error }=buildMailtoUrl(CONTACT_EMAIL,contact)
    setContactError(error??'')
    if(url) window.location.href=url
  }

  const navLinks=[['accueil','Accueil'],...(lastWatched?[['reprendre','Reprendre']]:[]),['videos','Vidéos'],['apropos','À propos'],['stats','Statistiques'],['contact','Contact'],['faq','FAQ']]

  return <div>
    <header className="header"><div className="nav-wrap">
      <button className="brand" onClick={()=>go('accueil')}><span className="brand-mark">K</span><span><strong>KobiPy</strong><small>Maths en mouvement</small></span></button>
      <nav className={menu?'nav open':'nav'}>{navLinks.map(([id,l])=><button key={id} onClick={()=>go(id)}>{l}</button>)}</nav>
      <div className="header-actions"><a className="link-btn" href={CHANNEL_URL} target="_blank" rel="noopener noreferrer"><Play size={18} fill="currentColor"/> YouTube</a><a className="gold-btn" href={TIPEEE_URL} target="_blank" rel="noopener noreferrer"><Heart size={17}/> Soutenir</a></div>
      <button className="menu-btn" onClick={()=>setMenu(!menu)} aria-label="Menu" aria-expanded={menu}>{menu?<X/>:<Menu/>}</button>
    </div></header>

    <main>
      <section id="accueil" className="hero"><div className="hero-inner">
        <div><div className="eyebrow"><Sparkles size={15}/> Mathématiques & informatique visuelles</div><h1>Voir les mathématiques <em>autrement.</em></h1><p>Des idées complexes rendues intuitives par l’animation, la géométrie et le code. Découvrez les mathématiques comme un paysage à explorer.</p><div className="hero-actions"><button className="cyan-btn" onClick={()=>go('videos')}><Play size={17} fill="currentColor"/> Voir les vidéos</button><button className="outline-btn" onClick={()=>go('apropos')}>Découvrir KobiPy</button></div></div>
        <div className="math-card"><div className="grid-lines"></div><svg viewBox="0 0 600 500"><defs><linearGradient id="curve"><stop stopColor="#dfab5d"/><stop offset="1" stopColor="#3dc7ca"/></linearGradient></defs><path d="M35 350 C115 350 140 140 220 140 C300 140 310 410 400 410 C475 410 500 220 575 220" fill="none" stroke="url(#curve)" strokeWidth="8" strokeLinecap="round"/><circle cx="220" cy="140" r="9" fill="#dfab5d"/><circle cx="400" cy="410" r="11" fill="#3dc7ca"/></svg><div className="math-caption"><small>VISUALISER POUR COMPRENDRE</small><strong>Analyse • Géométrie • Informatique</strong></div></div>
      </div></section>

      <section id="stats" className="stats">{[['10,6 k+','abonnés'],['26','vidéos'],['413 k+','vues cumulées'],['15,9 k','vues moyennes / vidéo']].map(([n,l])=><div key={l}><strong>{n}</strong><span>{l}</span></div>)}</section>

      {lastWatched&&<section id="reprendre" className="resume"><div className="section resume-inner">
        <div className="resume-head">
          <div><span className="kicker">DERNIÈRE VIDÉO VISUALISÉE</span><h2>Reprendre où vous en étiez.</h2><p>Cet historique reste dans votre navigateur : rien n’est envoyé ni stocké en ligne.</p></div>
          <button className="ghost-btn" onClick={clearHistory}><Trash2 size={16}/> Effacer l’historique</button>
        </div>
        <article className="resume-card">
          <button className="thumb" onClick={()=>openVideo(lastWatched)} aria-label={`Revoir ${lastWatched.title}`}>
            <img src={thumbnailUrl(lastWatched.id)} alt="" loading="lazy" referrerPolicy="no-referrer"/>
            <span className="play"><Play fill="currentColor"/></span>
            <small>{lastWatched.duration}</small>
          </button>
          <div className="resume-body">
            <div className="meta"><Clock size={13}/> Vue {formatWatchedAt(lastWatched.watchedAt)} · {lastWatched.category}</div>
            <h3>{lastWatched.title}</h3>
            <p>{lastWatched.description}</p>
            <button className="cyan-btn" onClick={()=>openVideo(lastWatched)}><Play size={17} fill="currentColor"/> Revoir la vidéo</button>
          </div>
        </article>
        {alsoWatched.length>0&&<div className="resume-recent">
          <small>Également vues récemment</small>
          <div className="resume-recent-list">{alsoWatched.map(v=><button key={v.id} onClick={()=>openVideo(v)} title={v.title}>
            <img src={thumbnailUrl(v.id)} alt="" loading="lazy" referrerPolicy="no-referrer"/>
            <span>{v.title}</span>
          </button>)}</div>
        </div>}
      </div></section>}

      <section id="videos" className="section videos"><div className="section-head"><div><span className="kicker">LA VIDÉOTHÈQUE</span><h2>Explorer les leçons</h2><p>Une bibliothèque de concepts expliqués par l’image, classés par thème.</p></div><label className="search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} maxLength={100} placeholder="Rechercher une vidéo"/></label></div>
        <div className="filters">{categories.map(c=><button className={c===category?'active':''} onClick={()=>setCategory(c)} key={c}>{c}</button>)}</div>
        <div className="video-grid">{filtered.map(v=><article className="video-card" key={v.id}><button className="thumb" onClick={()=>openVideo(v)} aria-label={`Lire ${v.title}`}><img src={thumbnailUrl(v.id)} alt="" loading="lazy" referrerPolicy="no-referrer"/><span className="play"><Play fill="currentColor"/></span><small>{v.duration}</small></button><div className="video-body"><div className="meta">{v.category} · {v.date}</div><h3>{v.title}</h3><p>{v.description}</p><footer><span>{v.views}</span><ExternalLink size={17}/></footer></div></article>)}</div>
        <div className="center"><a className="outline-dark" href={`${CHANNEL_URL}/videos`} target="_blank" rel="noopener noreferrer">Toutes les vidéos sur YouTube <ExternalLink size={16}/></a></div>
      </section>

      <section id="apropos" className="about"><div className="section about-grid"><div className="quote"><span>π</span><blockquote>« L’intuition n’est pas l’opposé de la rigueur. Elle en est souvent la porte d’entrée. »</blockquote><small>— L’approche KobiPy</small></div><div><span className="kicker">À PROPOS DE LA CHAÎNE</span><h2>Donner une forme aux idées abstraites.</h2><p className="lead">KobiPy est une chaîne dédiée aux mathématiques et à l’informatique, avec un accent particulier sur l’animation et la visualisation.</p><p>Les vidéos mêlent vulgarisation, divertissement et notions du supérieur. Python, Manim, Pygame et Blender deviennent ici des instruments pour rendre visibles les mécanismes cachés derrière les formules.</p><div className="principles">{[['01','Comprendre'],['02','Visualiser'],['03','Approfondir'],['04','Partager']].map(([n,t])=><div key={n}><small>{n}</small><strong>{t}</strong></div>)}</div></div></div></section>

      <section className="support"><div><span>SOUTENIR LA CRÉATION</span><h2>Aidez KobiPy à faire bouger les mathématiques.</h2><p>Votre soutien finance le temps de recherche, d’écriture et d’animation nécessaire à chaque nouvelle vidéo.</p></div><a className="gold-btn large" href={TIPEEE_URL} target="_blank" rel="noopener noreferrer"><Heart/> Soutenir sur Tipeee</a></section>

      <section id="contact" className="contact-section"><div className="section contact-grid"><div className="contact-copy"><span className="kicker">PRENDRE CONTACT</span><h2>Une question, une collaboration ou une idée de vidéo ?</h2><p>Écrivez directement à KobiPy. Le formulaire prépare un message dans votre application de messagerie, sans stocker vos données sur le site.</p><div className="contact-direct"><Mail size={20}/><div><small>Adresse de contact</small><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></div></div></div><form className="contact-form" onSubmit={sendContact}><div className="form-row"><label>Nom<input required autoComplete="name" maxLength={LIMITS.name} value={contact.name} onChange={e=>setContact({...contact,name:e.target.value})} placeholder="Votre nom"/></label><label>E-mail<input required type="email" autoComplete="email" maxLength={LIMITS.email} value={contact.email} onChange={e=>setContact({...contact,email:e.target.value})} placeholder="vous@exemple.fr"/></label></div><label>Objet<input maxLength={LIMITS.subject} value={contact.subject} onChange={e=>setContact({...contact,subject:e.target.value})} placeholder="Objet de votre message"/></label><label>Message<textarea required rows="6" maxLength={LIMITS.message} value={contact.message} onChange={e=>setContact({...contact,message:e.target.value})} placeholder="Votre message..."/></label>{contactError&&<p className="form-error" role="alert">{contactError}</p>}<button className="cyan-btn" type="submit"><Send size={17}/> Préparer le message</button></form></div></section>
      <section id="faq" className="section faq"><div className="center"><span className="kicker">QUESTIONS FRÉQUENTES</span><h2>FAQ</h2></div><div className="faq-list">{faqs.map(([q,a],i)=><div key={q}><button onClick={()=>setOpenFaq(openFaq===i?-1:i)} aria-expanded={openFaq===i}><strong>{q}</strong><ChevronDown className={openFaq===i?'rotate':''}/></button>{openFaq===i&&<p>{a}</p>}</div>)}</div></section>
    </main>
    {activeVideo&&<div className="video-modal" role="dialog" aria-modal="true" aria-label={activeVideo.title} onClick={()=>setActiveVideo(null)}><div className="video-dialog" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setActiveVideo(null)} aria-label="Fermer"><X/></button><div className="iframe-wrap"><iframe src={embedUrl(activeVideo.id)} title={activeVideo.title} referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen></iframe></div><div className="modal-info"><span>{activeVideo.category}</span><h3>{activeVideo.title}</h3></div></div></div>}
    <footer className="footer"><div className="brand inverse"><span className="brand-mark">K</span><span><strong>KobiPy</strong><small>Mathématiques en mouvement</small></span></div><div><a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer">YouTube</a><a href={TIPEEE_URL} target="_blank" rel="noopener noreferrer">Tipeee</a><button onClick={()=>go('faq')}>FAQ</button></div><small>Prototype éditorial — données publiques indicatives</small></footer>
  </div>
}

const container = document.getElementById('root')
if(container) createRoot(container).render(<React.StrictMode><App/></React.StrictMode>)
