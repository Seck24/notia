import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import api from '../../services/api'
import StatutBadge from '../../components/dossiers/StatutBadge'

export default function ListeDossiers() {
  const [dossiers, setDossiers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filtre, setFiltre] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: 20 })
      if (filtre) params.set('statut', filtre)
      const { data } = await api.get(`/dossiers?${params}`)
      setDossiers(data.dossiers || [])
      setTotal(data.total || 0)
    } catch { }
    setLoading(false)
  }

  useEffect(() => { load() }, [page, filtre])

  const filtered = search
    ? dossiers.filter(d => d.numero_dossier?.toLowerCase().includes(search.toLowerCase()) || d.type_acte?.includes(search.toLowerCase()))
    : dossiers

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold text-navy">Dossiers</h1>
        <Link to="/dossiers/nouveau" className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Nouveau
        </Link>
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" placeholder="Rechercher..." />
          </div>
          <select value={filtre} onChange={e => { setFiltre(e.target.value); setPage(1) }} className="input-field w-auto">
            <option value="">Tous les statuts</option>
            <option value="reception_client">Réception</option>
            <option value="attente_pieces">Attente pièces</option>
            <option value="redaction_projet">Rédaction</option>
            <option value="signature_finale">Signature</option>
          </select>
        </div>

        {loading ? (
          <p className="text-muted text-sm py-8 text-center">Chargement...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted text-sm py-8 text-center">Aucun dossier trouvé</p>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th className="pb-3 font-medium">N° Dossier</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Statut</th>
                    <th className="pb-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(d => (
                    <tr key={d.id} className="border-b border-border/50 hover:bg-surface/50">
                      <td className="py-3"><Link to={`/dossiers/${d.id}`} className="font-mono text-navy font-medium hover:text-gold">{d.numero_dossier}</Link></td>
                      <td className="py-3 capitalize">{d.type_acte?.replace(/_/g, ' ')}</td>
                      <td className="py-3"><StatutBadge statut={d.statut} /></td>
                      <td className="py-3 text-muted">{new Date(d.created_at).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden space-y-3">
              {filtered.map(d => (
                <Link key={d.id} to={`/dossiers/${d.id}`} className="block p-3 bg-surface rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm font-medium text-navy">{d.numero_dossier}</span>
                    <StatutBadge statut={d.statut} />
                  </div>
                  <p className="text-sm text-muted capitalize">{d.type_acte?.replace(/_/g, ' ')}</p>
                </Link>
              ))}
            </div>
            {total > 20 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs disabled:opacity-50">Précédent</button>
                <span className="text-sm text-muted">Page {page}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total} className="btn-secondary text-xs disabled:opacity-50">Suivant</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
