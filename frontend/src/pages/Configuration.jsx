import { useEffect, useState } from 'react'
import { Upload, Check, FileText, Calculator, Users, Save, Eye, EyeOff, Building2, Hash, Loader2 } from 'lucide-react'
import useAuthStore from '../stores/authStore'
import api from '../services/api'

const TYPES_ACTES = [
  { id: 'vente_immobiliere', label: 'Vente immobilière' },
  { id: 'constitution_sarl', label: 'Constitution société' },
  { id: 'succession', label: 'Succession' },
  { id: 'donation', label: 'Donation' },
  { id: 'ouverture_credit', label: 'Ouverture de crédit' },
]

const FORMAT_EXAMPLES = [
  { format: 'ADE/{ANNEE}/{SEQ:04d}', preview: 'ADE/2026/0001' },
  { format: '{ANNEE}-{SEQ:04d}', preview: '2026-0001' },
  { format: '{ID}/{ANNEE}/{SEQ:04d}', preview: 'MON-CAB/2026/0001' },
]

export default function Configuration() {
  const { cabinet, config, initialize } = useAuthStore()
  const cabinetId = cabinet?.id

  // Section 1: Identité
  const [identite, setIdentite] = useState({ nom: '', adresse: '', telephone: '', ville: '' })
  const [logoFile, setLogoFile] = useState(null)
  const [savingIdentite, setSavingIdentite] = useState(false)
  const [savedIdentite, setSavedIdentite] = useState(false)

  // Section 2: Numérotation
  const [format, setFormat] = useState('')
  const [savingFormat, setSavingFormat] = useState(false)
  const [savedFormat, setSavedFormat] = useState(false)

  // Section 3: Modèles
  const [modeles, setModeles] = useState({})
  const [uploadingModele, setUploadingModele] = useState(null)

  // Section 4: Barème
  const [uploadingBareme, setUploadingBareme] = useState(false)
  const [baremeUploaded, setBaremeUploaded] = useState(false)

  // Section 5: Utilisateurs
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)

  useEffect(() => {
    if (cabinet) {
      setIdentite({ nom: cabinet.nom || '', adresse: cabinet.adresse || '', telephone: cabinet.telephone || '', ville: cabinet.ville || '' })
    }
    if (config) {
      setFormat(config.format_numero || '{ANNEE}/{SEQ:04d}')
      if (config.bareme) setBaremeUploaded(true)
    }
    loadUsers()
  }, [cabinet, config])

  async function loadUsers() {
    if (!cabinetId) return
    try {
      const { data } = await api.get(`/auth/me`)
      setUsers(data.user ? [data.user] : [])
    } catch { }
    setLoadingUsers(false)
  }

  function previewNumero() {
    return format
      .replace('{ANNEE}', '2026')
      .replace('{SEQ:04d}', '0001')
      .replace('{ID}', cabinetId?.split('-')[0]?.toUpperCase() || 'CAB')
  }

  async function saveIdentite() {
    setSavingIdentite(true)
    setSavedIdentite(false)
    try {
      await api.put(`/cabinets/${cabinetId}`, identite)
      if (logoFile) {
        const fd = new FormData()
        fd.append('file', logoFile)
        await api.post(`/cabinets/${cabinetId}/logo`, fd)
      }
      setSavedIdentite(true)
      await initialize()
      setTimeout(() => setSavedIdentite(false), 3000)
    } catch { }
    setSavingIdentite(false)
  }

  async function saveFormat() {
    setSavingFormat(true)
    setSavedFormat(false)
    try {
      await api.put(`/cabinets/${cabinetId}/config`, { format_numero: format })
      setSavedFormat(true)
      await initialize()
      setTimeout(() => setSavedFormat(false), 3000)
    } catch { }
    setSavingFormat(false)
  }

  async function uploadModele(typeActe, file) {
    setUploadingModele(typeActe)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.post(`/cabinets/${cabinetId}/modele-acte`, fd)
      setModeles(m => ({ ...m, [typeActe]: true }))
    } catch { }
    setUploadingModele(null)
  }

  async function uploadBareme(file) {
    setUploadingBareme(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.post(`/cabinets/${cabinetId}/bareme`, fd)
      setBaremeUploaded(true)
    } catch { }
    setUploadingBareme(false)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-display font-bold text-navy">Configuration</h1>

      {/* Section 1: Identité */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Building2 size={18} className="text-gold" />
          <h2 className="text-lg font-display font-semibold text-navy">Identité de l'étude</h2>
        </div>
        <div className="space-y-3">
          {cabinet?.logo_url && (
            <div className="flex items-center gap-3 mb-2">
              <img src={cabinet.logo_url} alt="Logo" className="w-16 h-16 rounded-lg object-cover border border-border" />
              <span className="text-xs text-muted">Logo actuel</span>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Logo de l'étude</label>
            <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] || null)} className="text-sm text-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-border file:text-sm file:font-medium file:bg-surface file:text-navy hover:file:bg-border/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Nom de l'étude</label>
              <input value={identite.nom} onChange={e => setIdentite(f => ({ ...f, nom: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Ville</label>
              <input value={identite.ville} onChange={e => setIdentite(f => ({ ...f, ville: e.target.value }))} className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Adresse</label>
            <input value={identite.adresse} onChange={e => setIdentite(f => ({ ...f, adresse: e.target.value }))} className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Téléphone</label>
            <input value={identite.telephone} onChange={e => setIdentite(f => ({ ...f, telephone: e.target.value }))} className="input-field" placeholder="+225 07 00 00 00 00" />
          </div>
          <button onClick={saveIdentite} disabled={savingIdentite} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {savingIdentite ? <Loader2 size={16} className="animate-spin" /> : savedIdentite ? <Check size={16} /> : <Save size={16} />}
            {savingIdentite ? 'Enregistrement...' : savedIdentite ? 'Enregistré' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* Section 2: Numérotation */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Hash size={18} className="text-gold" />
          <h2 className="text-lg font-display font-semibold text-navy">Numérotation des dossiers</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Format</label>
            <input value={format} onChange={e => setFormat(e.target.value)} className="input-field font-mono" />
          </div>
          <div className="bg-surface rounded-lg p-3 border border-border">
            <p className="text-xs text-muted mb-1">Prévisualisation du prochain numéro</p>
            <p className="font-mono text-navy font-semibold text-lg">{previewNumero()}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {FORMAT_EXAMPLES.map(ex => (
              <button key={ex.format} onClick={() => setFormat(ex.format)} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${format === ex.format ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted hover:border-gold/50'}`}>
                {ex.preview}
              </button>
            ))}
          </div>
          <div className="text-xs text-muted space-y-0.5">
            <p><code className="bg-gray-100 px-1 rounded">{'{ANNEE}'}</code> Année en cours</p>
            <p><code className="bg-gray-100 px-1 rounded">{'{SEQ:04d}'}</code> Numéro séquentiel (4 chiffres)</p>
            <p><code className="bg-gray-100 px-1 rounded">{'{ID}'}</code> Identifiant cabinet</p>
          </div>
          <button onClick={saveFormat} disabled={savingFormat} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {savingFormat ? <Loader2 size={16} className="animate-spin" /> : savedFormat ? <Check size={16} /> : <Save size={16} />}
            {savingFormat ? 'Enregistrement...' : savedFormat ? 'Enregistré' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* Section 3: Modèles d'actes */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={18} className="text-gold" />
          <h2 className="text-lg font-display font-semibold text-navy">Modèles d'actes</h2>
        </div>
        <p className="text-sm text-muted mb-4">Sans modèle personnalisé, Notia utilisera un modèle standard pour la génération.</p>
        <div className="space-y-2">
          {TYPES_ACTES.map(t => (
            <div key={t.id} className="flex items-center justify-between p-3 bg-surface rounded-lg border border-border">
              <div className="flex items-center gap-3">
                {modeles[t.id] ? <Check size={16} className="text-success" /> : <span className="text-muted text-sm">⏳</span>}
                <div>
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-muted">{modeles[t.id] ? 'Votre modèle' : 'Modèle générique'}</p>
                </div>
              </div>
              <label className="btn-secondary text-xs cursor-pointer py-1.5 px-3 flex items-center gap-1">
                {uploadingModele === t.id ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {modeles[t.id] ? 'Remplacer' : 'Upload .docx'}
                <input type="file" accept=".docx,.doc" className="hidden" onChange={e => e.target.files[0] && uploadModele(t.id, e.target.files[0])} />
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Section 4: Barème tarifaire */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Calculator size={18} className="text-gold" />
          <h2 className="text-lg font-display font-semibold text-navy">Barème tarifaire</h2>
        </div>
        <p className="text-sm text-muted mb-4">{baremeUploaded ? 'Barème personnalisé actif.' : 'Le barème DGI CI standard est utilisé par défaut.'}</p>
        <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-gold/50 transition-colors">
          {uploadingBareme ? (
            <Loader2 size={32} className="text-muted animate-spin mb-2" />
          ) : baremeUploaded ? (
            <Check size={32} className="text-success mb-2" />
          ) : (
            <Calculator size={32} className="text-muted mb-2" />
          )}
          <span className="text-sm text-muted">{baremeUploaded ? 'Cliquez pour remplacer' : 'Cliquez ou déposez votre fichier'}</span>
          <span className="text-xs text-muted/60 mt-1">Excel (.xlsx) ou PDF</span>
          <input type="file" accept=".xlsx,.xls,.pdf" className="hidden" onChange={e => e.target.files[0] && uploadBareme(e.target.files[0])} />
        </label>
      </div>

      {/* Section 5: Utilisateurs */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-gold" />
            <h2 className="text-lg font-display font-semibold text-navy">Utilisateurs</h2>
          </div>
        </div>
        {loadingUsers ? (
          <p className="text-sm text-muted">Chargement...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="pb-2 font-medium">Nom</th>
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Rôle</th>
                  <th className="pb-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-border/50">
                    <td className="py-2.5 font-medium text-navy">{u.nom}</td>
                    <td className="py-2.5 text-muted">{u.email}</td>
                    <td className="py-2.5 capitalize">{u.role}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.actif ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                        {u.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
