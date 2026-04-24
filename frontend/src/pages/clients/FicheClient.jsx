import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Phone, Mail, MapPin, CreditCard, Heart, Globe, Calendar, Building2, User, Pencil, Plus, FolderOpen } from 'lucide-react'
import api from '../../services/api'
import StatutBadge from '../../components/dossiers/StatutBadge'
import ModalNouveauClient from '../../components/clients/ModalNouveauClient'

function InfoLine({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon size={15} className="text-muted mt-0.5 shrink-0" />
      <div><p className="text-xs text-muted">{label}</p><p className="text-sm text-navy">{value}</p></div>
    </div>
  )
}

export default function FicheClient() {
  const { id } = useParams()
  const [client, setClient] = useState(null)
  const [dossiers, setDossiers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  async function load() {
    try {
      const { data } = await api.get(`/clients/${id}`)
      setClient(data.client)
      setDossiers(data.dossiers || [])
      setNotes(data.client?.notes || '')
    } catch { }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function saveNotes() {
    setSavingNotes(true)
    try {
      await api.put(`/clients/${id}`, { notes })
    } catch { }
    setSavingNotes(false)
  }

  function handleUpdated(updated) {
    setClient(updated)
    setEditing(false)
    load()
  }

  if (loading) return <p className="text-muted text-center py-12">Chargement...</p>
  if (!client) return <p className="text-red-500 text-center py-12">Client non trouvé</p>

  const isEntreprise = client.type_client === 'entreprise'
  const name = isEntreprise ? client.raison_sociale : `${client.prenom || ''} ${client.nom || ''}`.trim()
  const initials = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div>
      <div className="grid md:grid-cols-[380px_1fr] gap-6">
        {/* Left: Identity */}
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center text-gold text-xl font-bold">{initials}</div>
              <div>
                <h1 className="text-xl font-display font-bold text-navy">{name}</h1>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold mt-1 ${isEntreprise ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                  {isEntreprise ? <Building2 size={12} /> : <User size={12} />}
                  {isEntreprise ? 'Entreprise' : 'Particulier'}
                </span>
              </div>
            </div>

            <div className="divide-y divide-border">
              {isEntreprise ? (
                <>
                  <InfoLine icon={Phone} label="Téléphone" value={client.telephone} />
                  <InfoLine icon={Mail} label="Email" value={client.email} />
                  <InfoLine icon={MapPin} label="Siège social" value={client.siege_social} />
                  <InfoLine icon={CreditCard} label="RCCM" value={client.numero_rccm} />
                  <InfoLine icon={Building2} label="Forme juridique" value={client.forme_juridique} />
                  <InfoLine icon={User} label="Représentant" value={`${client.representant_prenom || ''} ${client.representant_nom || ''}`.trim()} />
                </>
              ) : (
                <>
                  <InfoLine icon={Phone} label="Téléphone" value={client.telephone} />
                  <InfoLine icon={Mail} label="Email" value={client.email} />
                  <InfoLine icon={MapPin} label="Adresse" value={client.adresse} />
                  <InfoLine icon={CreditCard} label={client.type_piece?.toUpperCase() || 'Pièce'} value={client.numero_piece} />
                  <InfoLine icon={Heart} label="Situation" value={client.situation_matrimoniale} />
                  {client.regime_matrimonial && <InfoLine icon={Heart} label="Régime" value={client.regime_matrimonial === 'communaute' ? `Communauté — ${client.conjoint_prenom || ''} ${client.conjoint_nom || ''}`.trim() : 'Séparation de biens'} />}
                  <InfoLine icon={Calendar} label="Naissance" value={client.date_naissance} />
                  <InfoLine icon={Globe} label="Nationalité" value={client.nationalite} />
                </>
              )}
            </div>

            <button onClick={() => setEditing(true)} className="btn-secondary w-full mt-4 flex items-center justify-center gap-2">
              <Pencil size={14} /> Modifier les informations
            </button>
          </div>

          {/* Notes */}
          <div className="card">
            <p className="text-xs font-medium text-muted mb-2">Notes internes</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={saveNotes} className="input-field text-sm" rows={3} placeholder="Notes sur ce client..." />
            {savingNotes && <p className="text-xs text-muted mt-1">Enregistrement...</p>}
          </div>
        </div>

        {/* Right: Dossiers */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold text-navy">Dossiers de ce client</h2>
            <Link to="/dossiers/nouveau" className="btn-primary text-sm flex items-center gap-1">
              <Plus size={14} /> Nouveau dossier
            </Link>
          </div>

          {dossiers.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen size={40} className="mx-auto text-muted/30 mb-3" />
              <p className="text-muted text-sm">Ce client n'a pas encore de dossier</p>
              <Link to="/dossiers/nouveau" className="btn-primary inline-flex items-center gap-2 mt-4 text-sm">
                <Plus size={14} /> Ouvrir un dossier
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {dossiers.map(d => (
                <Link key={d.id} to={`/dossiers/${d.id}`} className="block p-4 bg-surface rounded-lg border border-border hover:border-gold/50 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm font-medium text-navy">{d.numero_dossier}</span>
                    <StatutBadge statut={d.statut} />
                  </div>
                  <p className="text-sm text-muted capitalize">{d.type_acte?.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-muted mt-1">{new Date(d.created_at).toLocaleDateString('fr-FR')}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit modal - reuse ModalNouveauClient with initial data */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditing(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-display font-bold text-navy">Modifier le client</h2>
              <button onClick={() => setEditing(false)} className="text-muted hover:text-navy text-xl">&times;</button>
            </div>
            <EditClientForm client={client} onSave={handleUpdated} onCancel={() => setEditing(false)} />
          </div>
        </div>
      )}
    </div>
  )
}

function EditClientForm({ client, onSave, onCancel }) {
  const [form, setForm] = useState({ ...client })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.put(`/clients/${client.id}`, form)
      onSave(data.client)
    } catch (err) { setError(err.response?.data?.detail || 'Erreur') }
    setLoading(false)
  }

  const isEntreprise = form.type_client === 'entreprise'

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-3">
      {isEntreprise ? (
        <>
          <div><label className="block text-xs font-medium text-muted mb-1">Raison sociale</label><input value={form.raison_sociale || ''} onChange={e => set('raison_sociale', e.target.value)} className="input-field" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-muted mb-1">Forme juridique</label><input value={form.forme_juridique || ''} onChange={e => set('forme_juridique', e.target.value)} className="input-field" /></div>
            <div><label className="block text-xs font-medium text-muted mb-1">RCCM</label><input value={form.numero_rccm || ''} onChange={e => set('numero_rccm', e.target.value)} className="input-field" /></div>
          </div>
          <div><label className="block text-xs font-medium text-muted mb-1">Siège social</label><input value={form.siege_social || ''} onChange={e => set('siege_social', e.target.value)} className="input-field" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-muted mb-1">Représentant nom</label><input value={form.representant_nom || ''} onChange={e => set('representant_nom', e.target.value)} className="input-field" /></div>
            <div><label className="block text-xs font-medium text-muted mb-1">Représentant prénom</label><input value={form.representant_prenom || ''} onChange={e => set('representant_prenom', e.target.value)} className="input-field" /></div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-muted mb-1">Nom</label><input value={form.nom || ''} onChange={e => set('nom', e.target.value)} className="input-field" /></div>
            <div><label className="block text-xs font-medium text-muted mb-1">Prénom</label><input value={form.prenom || ''} onChange={e => set('prenom', e.target.value)} className="input-field" /></div>
          </div>
          <div><label className="block text-xs font-medium text-muted mb-1">Adresse</label><input value={form.adresse || ''} onChange={e => set('adresse', e.target.value)} className="input-field" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-muted mb-1">Situation matrimoniale</label>
              <select value={form.situation_matrimoniale || ''} onChange={e => set('situation_matrimoniale', e.target.value)} className="input-field">
                <option value="">—</option><option value="celibataire">Célibataire</option><option value="marie">Marié(e)</option><option value="divorce">Divorcé(e)</option><option value="veuf">Veuf/Veuve</option>
              </select></div>
            <div><label className="block text-xs font-medium text-muted mb-1">Régime</label>
              <select value={form.regime_matrimonial || ''} onChange={e => set('regime_matrimonial', e.target.value)} className="input-field">
                <option value="">—</option><option value="communaute">Communauté</option><option value="separation">Séparation</option>
              </select></div>
          </div>
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-xs font-medium text-muted mb-1">Téléphone</label><input value={form.telephone || ''} onChange={e => set('telephone', e.target.value)} className="input-field" /></div>
        <div><label className="block text-xs font-medium text-muted mb-1">Email</label><input value={form.email || ''} onChange={e => set('email', e.target.value)} className="input-field" /></div>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Annuler</button>
        <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-50">{loading ? 'Enregistrement...' : 'Enregistrer'}</button>
      </div>
    </form>
  )
}
