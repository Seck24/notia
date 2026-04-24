import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, FolderOpen, Clock, FileCheck, PenTool, AlertTriangle, FileText, Upload as UploadIcon, Check, Zap } from 'lucide-react'
import api from '../services/api'
import useAuthStore from '../stores/authStore'
import StatutBadge from '../components/dossiers/StatutBadge'

const INDICATORS = [
  { key: 'en_cours', label: 'En cours', icon: FolderOpen, color: 'text-blue-600 bg-blue-50', link: '/dossiers' },
  { key: 'attente', label: 'Attente pièces', icon: Clock, color: 'text-amber-600 bg-amber-50', link: '/dossiers?statut=attente_pieces' },
  { key: 'redaction', label: 'En rédaction', icon: PenTool, color: 'text-indigo-600 bg-indigo-50', link: '/dossiers?statut=redaction_projet' },
  { key: 'finalises', label: 'Finalisés ce mois', icon: FileCheck, color: 'text-emerald-600 bg-emerald-50', link: '/dossiers?statut=signature_finale' },
]

const ACTION_ICONS = {
  dossier_cree: FolderOpen,
  statut_change: Check,
  document_recu: UploadIcon,
  acte_genere: Zap,
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `il y a ${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'hier'
  return `il y a ${days} jours`
}

function formatDate() {
  return new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function Dashboard() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState({ en_cours: 0, attente: 0, redaction: 0, finalises: 0 })
  const [urgents, setUrgents] = useState([])
  const [activites, setActivites] = useState([])
  const [dossiers, setDossiers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [dashRes, dossiersRes] = await Promise.all([
          api.get('/dossiers/dashboard-stats'),
          api.get('/dossiers?limit=5'),
        ])
        setStats(dashRes.data.stats)
        setUrgents(dashRes.data.urgents || [])
        setActivites(dashRes.data.activites || [])
        setDossiers(dossiersRes.data.dossiers || [])
      } catch { }
      setLoading(false)
    }
    load()
  }, [])

  const prenom = user?.prenom || user?.nom?.split(' ')[0] || 'Maître'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-navy">Bonjour {prenom}</h1>
          <p className="text-sm text-muted capitalize">{formatDate()}</p>
        </div>
        <Link to="/dossiers/nouveau" className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Nouveau dossier
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {INDICATORS.map(({ key, label, icon: Icon, color, link }) => (
          <Link key={key} to={link} className="card flex items-center gap-4 hover:border-gold/50 transition-colors">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
              <Icon size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-navy">{loading ? '—' : stats[key]}</p>
              <p className="text-xs text-muted">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Urgents */}
      {urgents.length > 0 && (
        <div className="card mb-6 border-amber-200 bg-amber-50/30">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-amber-600" />
            <h2 className="text-sm font-semibold text-amber-800">Dossiers en attente depuis plus de 7 jours</h2>
          </div>
          <div className="space-y-2">
            {urgents.map(d => (
              <Link key={d.id} to={`/dossiers/${d.id}`} className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-amber-200 hover:border-amber-300">
                <div>
                  <p className="text-sm font-mono font-medium text-navy">{d.numero_dossier || d.id?.slice(0, 8)}</p>
                  <p className="text-xs text-muted capitalize">{d.type_acte?.replace(/_/g, ' ')}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${d.jours_attente > 14 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                  {d.jours_attente}j
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent activity */}
        <div className="card">
          <h2 className="text-lg font-display font-semibold text-navy mb-4">Activité récente</h2>
          {activites.length === 0 ? (
            <p className="text-sm text-muted py-4 text-center">Aucune activité pour le moment</p>
          ) : (
            <div className="space-y-3">
              {activites.map(a => {
                const Icon = ACTION_ICONS[a.type_action] || FileText
                return (
                  <div key={a.id} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-surface flex items-center justify-center shrink-0 mt-0.5">
                      <Icon size={14} className="text-muted" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-navy">{a.description}</p>
                      <p className="text-xs text-muted">{timeAgo(a.created_at)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent dossiers */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold text-navy">Dossiers récents</h2>
            <Link to="/dossiers" className="text-xs text-gold font-medium hover:underline">Voir tous</Link>
          </div>
          {loading ? (
            <p className="text-muted text-sm py-4 text-center">Chargement...</p>
          ) : dossiers.length === 0 ? (
            <div className="text-center py-8">
              <FolderOpen size={40} className="mx-auto text-muted/30 mb-3" />
              <p className="text-muted text-sm">Aucun dossier</p>
              <Link to="/dossiers/nouveau" className="btn-primary inline-flex items-center gap-2 mt-3 text-sm">
                <Plus size={14} /> Premier dossier
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {dossiers.map(d => (
                <Link key={d.id} to={`/dossiers/${d.id}`} className="flex items-center justify-between p-3 bg-surface rounded-lg border border-border hover:border-gold/50 transition-colors">
                  <div>
                    <p className="font-mono text-sm font-medium text-navy">{d.numero_dossier}</p>
                    <p className="text-xs text-muted capitalize">{d.type_acte?.replace(/_/g, ' ')}</p>
                  </div>
                  <div className="text-right">
                    <StatutBadge statut={d.statut} />
                    <p className="text-xs text-muted mt-1">{new Date(d.created_at).toLocaleDateString('fr-FR')}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
