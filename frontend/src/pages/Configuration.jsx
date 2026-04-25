import { useEffect, useState } from 'react'
import { Upload, Check, FileText, Calculator, Users, Save, Building2, Hash, Loader2, Plus, X, Copy } from 'lucide-react'
import useAuthStore from '../stores/authStore'
import api from '../services/api'

const TYPES_ACTES = [
  { id: 'vente_immobiliere', label: 'Vente immobilière' },
  { id: 'constitution_sarl', label: 'Constitution société' },
  { id: 'succession', label: 'Succession' },
  { id: 'donation', label: 'Donation' },
  { id: 'ouverture_credit', label: 'Ouverture de crédit' },
]

const FORMAT_EXEMPLES = [
  'ADE/2026/0001',
  '2026-0001',
  'DOS-2026-0001',
  'N°0001/2026',
]

const ROLE_BADGES = {
  admin: 'bg-navy text-white',
  collaborateur: 'bg-gold/20 text-gold',
  limite: 'bg-gray-100 text-gray-600',
}

export default function Configuration() {
  const { cabinet, config, user, initialize } = useAuthStore()
  const cabinetId = cabinet?.id

  // Section 1: Identité
  const [identite, setIdentite] = useState({ nom: '', adresse: '', telephone: '', ville: '' })
  const [logoFile, setLogoFile] = useState(null)
  const [savingIdentite, setSavingIdentite] = useState(false)
  const [savedIdentite, setSavedIdentite] = useState(false)

  // Section 2: Numérotation
  const [format, setFormat] = useState('')
  const [formatExemple, setFormatExemple] = useState('')
  const [formatPreview, setFormatPreview] = useState('')
  const [compteurDepart, setCompteurDepart] = useState('')
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
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ prenom: '', nom: '', email: '', role: 'collaborateur' })
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState(null)

  useEffect(() => {
    if (cabinet) {
      setIdentite({ nom: cabinet.nom || '', adresse: cabinet.adresse || '', telephone: cabinet.telephone || '', ville: cabinet.ville || '' })
    }
    if (config) {
      setFormat(config.format_numero || '{ANNEE}/{SEQ:04d}')
      setCompteurDepart(config.compteur?.toString() || '0')
      if (config.bareme) setBaremeUploaded(true)
    }
    loadUsers()
  }, [cabinet, config])

  async function loadUsers() {
    if (!cabinetId) return
    try {
      const { data } = await api.get('/auth/utilisateurs')
      setUsers(data.utilisateurs || [])
    } catch {
      // Fallback: at least show current user
      if (user) setUsers([user])
    }
    setLoadingUsers(false)
  }

  function previewNumero() {
    return (formatPreview || format
      .replace('{ANNEE}', '2026')
      .replace('{SEQ:04d}', '0001')
      .replace('{SEQ:03d}', '001')
      .replace('{SEQ:05d}', '00001')
      .replace('{SEQ:02d}', '01')
      .replace('{ID}', cabinetId?.split('-')[0]?.toUpperCase() || 'CAB'))
  }

  async function parseExemple(exemple) {
    setFormatExemple(exemple)
    if (!exemple.trim()) return
    try {
      const { data } = await api.post(`/cabinets/${cabinetId}/parse-format`, { exemple })
      setFormat(data.format)
      setFormatPreview(data.preview)
    } catch { }
  }

  async function saveIdentite() {
    setSavingIdentite(true); setSavedIdentite(false)
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
    setSavingFormat(true); setSavedFormat(false)
    try {
      const updates = { format_numero: format }
      if (compteurDepart) updates.compteur = parseInt(compteurDepart) || 0
      await api.put(`/cabinets/${cabinetId}/config`, updates)
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

  async function handleInvite() {
    setInviting(true); setInviteResult(null)
    try {
      const { data } = await api.post('/auth/utilisateurs/inviter', inviteForm)
      setInviteResult(data)
      setInviteForm({ prenom: '', nom: '', email: '', role: 'collaborateur' })
      loadUsers()
    } catch (err) {
      setInviteResult({ error: err.response?.data?.detail || 'Erreur' })
    }
    setInviting(false)
  }

  async function changeRole(userId, newRole) {
    try {
      await api.put(`/auth/utilisateurs/${userId}/role`, { role: newRole })
      loadUsers()
    } catch { }
  }

  async function toggleActif(userId) {
    try {
      await api.put(`/auth/utilisateurs/${userId}/toggle-actif`)
      loadUsers()
    } catch (err) {
      alert(err.response?.data?.detail || 'Erreur')
    }
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
            <label className="block text-xs font-medium text-muted mb-1">Tapez un exemple de numéro de dossier</label>
            <input value={formatExemple} onChange={e => parseExemple(e.target.value)} className="input-field font-mono" placeholder="Ex: ADE/2026/0001" />
          </div>
          <div className="flex flex-wrap gap-2">
            <p className="text-xs text-muted w-full">Exemples courants :</p>
            {FORMAT_EXEMPLES.map(ex => (
              <button key={ex} onClick={() => parseExemple(ex)} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${formatExemple === ex ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted hover:border-gold/50'}`}>
                {ex}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Dernier numéro existant (pour reprendre la suite)</label>
            <input
              type="number"
              value={compteurDepart}
              onChange={e => setCompteurDepart(e.target.value)}
              className="input-field"
              placeholder="Ex: 45 (le prochain sera 46)"
              min="0"
            />
            <p className="text-xs text-muted mt-1">Si vous avez déjà 45 dossiers, tapez 45. Le prochain sera le n°46.</p>
          </div>
          {format && (
            <div className="bg-surface rounded-lg p-3 border border-border">
              <p className="text-xs text-muted mb-1">Prochain numéro généré</p>
              <p className="font-mono text-navy font-semibold text-lg">{previewNumero()}</p>
              <p className="text-xs text-muted mt-1">L'année et le numéro séquentiel seront mis à jour automatiquement</p>
            </div>
          )}
          <button onClick={saveFormat} disabled={savingFormat || !format} className="btn-primary flex items-center gap-2 disabled:opacity-50">
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
          <button onClick={() => { setShowInvite(true); setInviteResult(null) }} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
            <Plus size={14} /> Inviter un collaborateur
          </button>
        </div>

        {/* Invite modal */}
        {showInvite && (
          <div className="mb-4 p-4 border border-gold rounded-lg bg-gold/5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-navy">Nouvelle invitation</p>
              <button onClick={() => setShowInvite(false)} className="text-muted hover:text-navy"><X size={16} /></button>
            </div>
            {inviteResult?.success ? (
              <div className="space-y-3">
                <p className="text-sm text-green-700">Compte créé pour {inviteResult.email}</p>
                <div className="p-3 bg-white rounded-lg border border-border text-xs font-mono whitespace-pre-wrap">{inviteResult.invitation_text}</div>
                <button onClick={() => { navigator.clipboard.writeText(inviteResult.invitation_text); }} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"><Copy size={14} /> Copier l'invitation</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Prénom *</label>
                    <input value={inviteForm.prenom} onChange={e => setInviteForm(f => ({ ...f, prenom: e.target.value }))} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Nom *</label>
                    <input value={inviteForm.nom} onChange={e => setInviteForm(f => ({ ...f, nom: e.target.value }))} className="input-field" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Email *</label>
                  <input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Rôle</label>
                  <select value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))} className="input-field">
                    <option value="collaborateur">Collaborateur — accès complet aux dossiers</option>
                    <option value="limite">Limité — accès restreint à ses dossiers</option>
                  </select>
                </div>
                {inviteResult?.error && <p className="text-red-500 text-xs">{inviteResult.error}</p>}
                <button onClick={handleInvite} disabled={inviting || !inviteForm.nom || !inviteForm.email} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                  {inviting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {inviting ? 'Création...' : 'Envoyer l\'invitation'}
                </button>
              </div>
            )}
          </div>
        )}

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
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-border/50">
                    <td className="py-2.5 font-medium text-navy">{u.prenom ? `${u.prenom} ${u.nom}` : u.nom}</td>
                    <td className="py-2.5 text-muted">{u.email}</td>
                    <td className="py-2.5">
                      {u.id === user?.id ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_BADGES[u.role] || ROLE_BADGES.limite}`}>{u.role}</span>
                      ) : (
                        <select value={u.role} onChange={e => changeRole(u.id, e.target.value)} className="text-xs border border-border rounded px-2 py-1">
                          <option value="admin">Admin</option>
                          <option value="collaborateur">Collaborateur</option>
                          <option value="limite">Limité</option>
                        </select>
                      )}
                    </td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.actif !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                        {u.actif !== false ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="py-2.5">
                      {u.id !== user?.id && (
                        <button onClick={() => toggleActif(u.id)} className={`text-xs font-medium hover:underline ${u.actif !== false ? 'text-red-500' : 'text-green-600'}`}>
                          {u.actif !== false ? 'Désactiver' : 'Réactiver'}
                        </button>
                      )}
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
