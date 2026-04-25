/**
 * Format parties display based on type_acte.
 * @param {Array} parties - [{nom, prenom, role}]
 * @param {string} typeActe - vente_immobiliere, constitution_sarl, etc.
 * @returns {string} formatted display string
 */
export default function formatParties(parties, typeActe) {
  if (!parties || parties.length === 0) return ''

  const short = (p) => {
    const prenom = p.prenom ? `${p.prenom.charAt(0)}.` : ''
    return `${p.nom || '?'} ${prenom}`.trim()
  }

  const findRole = (role) => parties.find(p => p.role === role)

  switch (typeActe) {
    case 'vente_immobiliere': {
      const vendeur = findRole('vendeur')
      const acquereur = findRole('acquereur')
      if (vendeur && acquereur) return `${short(vendeur)} → ${short(acquereur)}`
      if (vendeur) return short(vendeur)
      if (acquereur) return short(acquereur)
      return short(parties[0])
    }

    case 'constitution_sarl': {
      const gerant = findRole('gerant') || parties[0]
      const others = parties.length - 1
      if (others > 0) return `${short(gerant)} + ${others} associé${others > 1 ? 's' : ''}`
      return short(gerant)
    }

    case 'succession': {
      const defunt = findRole('defunt')
      if (defunt) return `Succession ${short(defunt)}`
      return `Succession ${short(parties[0])}`
    }

    case 'donation': {
      const donateur = findRole('donateur')
      const donataire = findRole('donataire')
      if (donateur && donataire) return `${short(donateur)} → ${short(donataire)}`
      if (donateur) return short(donateur)
      return short(parties[0])
    }

    case 'ouverture_credit': {
      const debiteur = findRole('debiteur')
      const creancier = findRole('creancier')
      if (debiteur && creancier) return `${short(debiteur)} / ${short(creancier)}`
      if (debiteur) return short(debiteur)
      return short(parties[0])
    }

    default:
      return parties.map(p => short(p)).join(', ')
  }
}
