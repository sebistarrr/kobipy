// Construction du lien mailto du formulaire de contact.
//
// Isolé du composant pour rester testable : c'est le seul endroit du site où
// une saisie utilisateur est réinjectée dans une URL.

export const LIMITS = { name: 80, email: 120, subject: 140, message: 2000 }

export const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// Un saut de ligne dans un sujet mailto permettrait d'injecter des en-têtes
// supplémentaires (Bcc, Content-Type…) dans certains clients de messagerie.
export const singleLine = (value, max) =>
  String(value ?? '').replace(/[\r\n]+/g, ' ').slice(0, max).trim()

/**
 * Valide la saisie et renvoie soit { url }, soit { error } avec un message
 * destiné à l'utilisateur. Ne déclenche jamais de navigation elle-même.
 */
export function buildMailtoUrl(recipient, input){
  const name = singleLine(input.name, LIMITS.name)
  const email = singleLine(input.email, LIMITS.email)
  const subject = singleLine(input.subject, LIMITS.subject) || `Message de ${name}`
  const message = String(input.message ?? '').slice(0, LIMITS.message).trim()

  if(!name || !message) return { error: 'Merci de renseigner votre nom et votre message.' }
  if(!EMAIL_FORMAT.test(email)) return { error: 'Merci de saisir une adresse e-mail valide.' }

  const body = `Nom : ${name}\nE-mail : ${email}\n\n${message}`
  const url = `mailto:${encodeURIComponent(recipient)}`
    + `?subject=${encodeURIComponent(subject)}`
    + `&body=${encodeURIComponent(body)}`
  return { url }
}
