import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { User, FileText, Info, Plus, Link2, Download, Loader2 } from 'lucide-react'
import api from '../../services/api'
import StatutBadge from '../../components/dossiers/StatutBadge'

const STATUTS = [
  'reception_client', 'analyse_interne', 'attente_pieces',
  'demarches_admin', 'redaction_projet', 'observations_client', 'signature_finale',
]

const DOC_ICONS = { manquant: '⏳', recu: '📄', valide: '✅', rejete: '❌' }

export default function DetailDossier() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState(null)
  const [tab, setTab] = useState('docs')

  async function load() {
    try {
      const { data: d } = await api.get(`/dossiers/${id}`)
      setData(d)
    } catch { }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function changerStatut(statut) {
    await api.put(`/dossiers/${id}`, { statut })
    load()
  }

  async function genererActe() {
    setGenerating(true)
    setGenResult(null)
    try {
      const { data: r } = await api.post(`/dossiers/${id}/generer`)
      setGenResult(r)
      load()
    } catch (err) {
      setGenResult({ error: err.response?.data?.detail || 'Erreur de génération' })
    }
    setGenerating(false)
  }

  async function envoyerLienUpload() {
    try {
      const { data: r } = await api.post(`/dossiers/${id}/upload-link`)
      const url = `${window.location.origin}/upload/${r.token}`
      await navigator.clipboard.writeText(url)
      alert(`Lien copié !\n${url}\n\nValide 72h.`)
    } catch (err) {
      alert(err.response?.data?.detail || 'Erreur')
    }
  }

  if (loading) return <p className="text-muted text-center py-12">Chargement...</p>
  if (!data) return <p className="text-red-500 text-center py-12">Dossier non trouvé</p>

  const { dossier, parties, documents, actes } = data
  const docsRecus = documents.filter(d => d.statut !== 'manquant').length
  const docsTotal = documents.length
  const pct = docsTotal ? Math.round(docsRecus / docsTotal * 100) : 0

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-xl font-display font-bold text-navy font-mono">{dossier.numero_dossier}</h1>
        <StatutBadge statut={dossier.statut} />
        <span className="text-sm text-muted capitalize">{dossier.type_acte?.replace(/_/g, ' ')}</span>
      </div>

      {/* Mobile tabs */}
      <div className="flex md:hidden gap-1 bg-surface rounded-lg p-1 mb-4">
        {[['parties', 'Parties'], ['docs', 'Documents'], ['infos', 'Infos']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 py-2 text-xs font-medium rounded-md ${tab === k ? 'bg-white shadow text-navy' : 'text-muted'}`}>{l}</button>
        ))}
      </div>

      {/* 3 panels */}
      <div className="grid md:grid-cols-[320px_1fr_320px] gap-4">
        {/* Panel: Parties */}
        <div className={`card ${tab !== 'parties' ? 'hidden md:block' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-navy flex items-center gap-2"><User size={16} /> Parties</h2>
          </div>
          {parties.length === 0 ? (
            <p className="text-sm text-muted">Aucune partie ajoutée</p>
          ) : (
            <div className="space-y-3">
              {parties.map(p => (
                <div key={p.id} className="p-3 bg-surface rounded-lg border border-border">
                  <p className="text-xs text-gold font-semibold uppercase">{p.role}</p>
                  <p className="text-sm font-medium text-navy">{p.type_partie === 'personne_physique' ? `${p.prenom || ''} ${p.nom || ''}`.trim() : p.raison_sociale}</p>
                  {p.telephone && <p className="text-xs text-muted">{p.telephone}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panel: Documents */}
        <div className={`card ${tab !== 'docs' ? 'hidden md:block' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-navy flex items-center gap-2"><FileText size={16} /> Documents</h2>
            <button onClick={envoyerLienUpload} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
              <Link2 size={14} /> Lien client
            </button>
          </div>
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-muted mb-1">
              <span>{docsRecus}/{docsTotal} reçus</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-success rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="space-y-2">
            {documents.map(d => (
              <div key={d.id} className="flex items-center justify-between p-2.5 bg-surface rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  <span>{DOC_ICONS[d.statut] || '⏳'}</span>
                  <span className="text-sm">{d.nom_document}</span>
                </div>
                {d.statut === 'recu' && (
                  <button onClick={() => api.post(`/dossiers/${id}/documents/${d.nom_document}/valider`).then(load)} className="text-xs text-success font-medium hover:underline">Valider</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Panel: Infos + Generation */}
        <div className={`space-y-4 ${tab !== 'infos' ? 'hidden md:block' : ''}`}>
          <div className="card">
            <h2 className="font-display font-semibold text-navy flex items-center gap-2 mb-3"><Info size={16} /> Infos dossier</h2>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-muted">Statut</p>
                <select value={dossier.statut} onChange={e => changerStatut(e.target.value)} className="input-field text-sm mt-1">
                  {STATUTS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              {dossier.infos_specifiques && Object.keys(dossier.infos_specifiques).length > 0 && (
                <div className="mt-3 space-y-1">
                  {Object.entries(dossier.infos_specifiques).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-muted capitalize">{k.replace(/_/g, ' ')}</span>
                      <span className="text-navy font-medium">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="font-display font-semibold text-navy mb-3">Génération</h2>
            <button onClick={genererActe} disabled={generating} className="btn-navy w-full flex items-center justify-center gap-2 disabled:opacity-50">
              {generating ? <><Loader2 size={16} className="animate-spin" /> Génération en cours...</> : 'Générer le projet d\'acte'}
            </button>
            {genResult?.error && <p className="text-red-500 text-sm mt-2">{genResult.error}</p>}
            {genResult?.success && <p className="text-success text-sm mt-2">Acte v{genResult.version} généré</p>}

            {actes.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-muted font-medium">Versions générées</p>
                {actes.map(a => (
                  <div key={a.id} className="flex items-center justify-between p-2 bg-surface rounded-lg text-sm">
                    <span>Version {a.version}</span>
                    <span className="text-xs text-muted">{new Date(a.created_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
