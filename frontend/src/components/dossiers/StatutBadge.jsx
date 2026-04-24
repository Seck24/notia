const STATUTS = {
  reception_client:    { label: 'Réception',      color: 'bg-gray-100 text-gray-600' },
  analyse_interne:     { label: 'Analyse',        color: 'bg-blue-100 text-blue-700' },
  attente_pieces:      { label: 'Attente pièces', color: 'bg-amber-100 text-amber-700' },
  demarches_admin:     { label: 'Démarches',      color: 'bg-purple-100 text-purple-700' },
  redaction_projet:    { label: 'Rédaction',       color: 'bg-indigo-100 text-indigo-700' },
  observations_client: { label: 'Observations',   color: 'bg-yellow-100 text-yellow-700' },
  signature_finale:    { label: 'Signature',       color: 'bg-emerald-100 text-emerald-700' },
  archive:             { label: 'Archivé',         color: 'bg-gray-200 text-gray-500' },
}

export default function StatutBadge({ statut }) {
  const s = STATUTS[statut] || { label: statut, color: 'bg-gray-100 text-gray-600' }
  return <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${s.color}`}>{s.label}</span>
}
