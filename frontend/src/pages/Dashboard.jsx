import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, FolderOpen, Clock, FileCheck, PenTool } from 'lucide-react'
import api from '../services/api'
import StatutBadge from '../components/dossiers/StatutBadge'

const INDICATORS = [
  { key: 'en_cours', label: 'En cours', icon: FolderOpen, color: 'text-blue-600 bg-blue-50' },
  { key: 'attente', label: 'Attente pièces', icon: Clock, color: 'text-amber-600 bg-amber-50' },
  { key: 'redaction', label: 'En rédaction', icon: PenTool, color: 'text-indigo-600 bg-indigo-50' },
  { key: 'finalises', label: 'Finalisés ce mois', icon: FileCheck, color: 'text-emerald-600 bg-emerald-50' },
]

export default function Dashboard() {
  const [dossiers, setDossiers] = useState([])
  const [stats, setStats] = useState({ en_cours: 0, attente: 0, redaction: 0, finalises: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get('/dossiers?limit=10')
        const list = data.dossiers || []
        setDossiers(list)
        setStats({
          en_cours: list.filter(d => !['signature_finale', 'archive'].includes(d.statut)).length,
          attente: list.filter(d => d.statut === 'attente_pieces').length,
          redaction: list.filter(d => d.statut === 'redaction_projet').length,
          finalises: list.filter(d => d.statut === 'signature_finale').length,
        })
      } catch { }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold text-navy">Tableau de bord</h1>
        <Link to="/dossiers/nouveau" className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Nouveau dossier
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {INDICATORS.map(({ key, label, icon: Icon, color }) => (
          <div key={key} className="card flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
              <Icon size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-navy">{stats[key]}</p>
              <p className="text-xs text-muted">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Dossiers Table */}
      <div className="card">
        <h2 className="text-lg font-display font-semibold text-navy mb-4">Dossiers récents</h2>
        {loading ? (
          <p className="text-muted text-sm py-8 text-center">Chargement...</p>
        ) : dossiers.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen size={48} className="mx-auto text-muted/30 mb-3" />
            <p className="text-muted">Aucun dossier pour le moment</p>
            <Link to="/dossiers/nouveau" className="btn-primary inline-flex items-center gap-2 mt-4">
              <Plus size={16} /> Créer le premier dossier
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th className="pb-3 font-medium">N° Dossier</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Clerc</th>
                    <th className="pb-3 font-medium">Statut</th>
                    <th className="pb-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {dossiers.map(d => (
                    <tr key={d.id} className="border-b border-border/50 hover:bg-surface/50 cursor-pointer" onClick={() => window.location.href = `/dossiers/${d.id}`}>
                      <td className="py-3 font-mono text-navy font-medium">{d.numero_dossier}</td>
                      <td className="py-3 capitalize">{d.type_acte?.replace(/_/g, ' ')}</td>
                      <td className="py-3 text-muted">{d.utilisateurs?.nom || '—'}</td>
                      <td className="py-3"><StatutBadge statut={d.statut} /></td>
                      <td className="py-3 text-muted">{new Date(d.created_at).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {dossiers.map(d => (
                <Link key={d.id} to={`/dossiers/${d.id}`} className="block p-3 bg-surface rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm font-medium text-navy">{d.numero_dossier}</span>
                    <StatutBadge statut={d.statut} />
                  </div>
                  <p className="text-sm text-muted capitalize">{d.type_acte?.replace(/_/g, ' ')}</p>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
