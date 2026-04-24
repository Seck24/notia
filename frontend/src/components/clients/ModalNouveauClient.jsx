import { useState } from 'react'
import { X, User, Building2, Loader2 } from 'lucide-react'
import api from '../../services/api'

export default function ModalNouveauClient({ onClose, onCreated }) {
  const [type, setType] = useState('particulier')
  const [form, setForm] = useState({ nationalite: 'Ivoirienne' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const showConjoint = form.situation_matrimoniale === 'marie' && form.regime_matrimonial === 'communaute'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (type === 'particulier' && (!form.nom || !form.prenom || !form.telephone)) {
      setError('Nom, prénom et téléphone obligatoires'); return
    }
    if (type === 'entreprise' && (!form.raison_sociale || !form.representant_nom || !form.telephone)) {
      setError('Raison sociale, représentant et téléphone obligatoires'); return
    }
    setLoading(true)
    try {
      const { data } = await api.post('/clients', { ...form, type_client: type })
      onCreated(data.client)
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur')
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-display font-bold text-navy">Nouveau client</h2>
          <button onClick={onClose} className="text-muted hover:text-navy"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Type tabs */}
          <div className="flex gap-2">
            <button type="button" onClick={() => setType('particulier')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-colors ${type === 'particulier' ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted'}`}>
              <User size={16} /> Particulier
            </button>
            <button type="button" onClick={() => setType('entreprise')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-colors ${type === 'entreprise' ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted'}`}>
              <Building2 size={16} /> Entreprise
            </button>
          </div>

          {type === 'particulier' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-muted mb-1">Nom *</label><input value={form.nom || ''} onChange={e => set('nom', e.target.value)} className="input-field" required /></div>
                <div><label className="block text-xs font-medium text-muted mb-1">Prénom *</label><input value={form.prenom || ''} onChange={e => set('prenom', e.target.value)} className="input-field" required /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-muted mb-1">Téléphone *</label><input value={form.telephone || ''} onChange={e => set('telephone', e.target.value)} className="input-field" required /></div>
                <div><label className="block text-xs font-medium text-muted mb-1">Email</label><input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} className="input-field" /></div>
              </div>
              <div><label className="block text-xs font-medium text-muted mb-1">Adresse</label><input value={form.adresse || ''} onChange={e => set('adresse', e.target.value)} className="input-field" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-muted mb-1">Date de naissance</label><input type="date" value={form.date_naissance || ''} onChange={e => set('date_naissance', e.target.value)} className="input-field" /></div>
                <div><label className="block text-xs font-medium text-muted mb-1">Nationalité</label><input value={form.nationalite || 'Ivoirienne'} onChange={e => set('nationalite', e.target.value)} className="input-field" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-muted mb-1">Situation matrimoniale</label>
                  <select value={form.situation_matrimoniale || ''} onChange={e => set('situation_matrimoniale', e.target.value)} className="input-field">
                    <option value="">—</option><option value="celibataire">Célibataire</option><option value="marie">Marié(e)</option><option value="divorce">Divorcé(e)</option><option value="veuf">Veuf/Veuve</option>
                  </select></div>
                <div><label className="block text-xs font-medium text-muted mb-1">Régime matrimonial</label>
                  <select value={form.regime_matrimonial || ''} onChange={e => set('regime_matrimonial', e.target.value)} className="input-field">
                    <option value="">—</option><option value="communaute">Communauté</option><option value="separation">Séparation</option>
                  </select></div>
              </div>
              {showConjoint && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-surface rounded-lg border border-border">
                  <div><label className="block text-xs font-medium text-muted mb-1">Conjoint nom</label><input value={form.conjoint_nom || ''} onChange={e => set('conjoint_nom', e.target.value)} className="input-field" /></div>
                  <div><label className="block text-xs font-medium text-muted mb-1">Conjoint prénom</label><input value={form.conjoint_prenom || ''} onChange={e => set('conjoint_prenom', e.target.value)} className="input-field" /></div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-muted mb-1">Type pièce</label>
                  <select value={form.type_piece || ''} onChange={e => set('type_piece', e.target.value)} className="input-field">
                    <option value="">—</option><option value="cni">CNI</option><option value="passeport">Passeport</option><option value="carte_sejour">Carte de séjour</option>
                  </select></div>
                <div><label className="block text-xs font-medium text-muted mb-1">N° pièce</label><input value={form.numero_piece || ''} onChange={e => set('numero_piece', e.target.value)} className="input-field" /></div>
              </div>
            </>
          ) : (
            <>
              <div><label className="block text-xs font-medium text-muted mb-1">Raison sociale *</label><input value={form.raison_sociale || ''} onChange={e => set('raison_sociale', e.target.value)} className="input-field" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-muted mb-1">Forme juridique *</label>
                  <select value={form.forme_juridique || ''} onChange={e => set('forme_juridique', e.target.value)} className="input-field" required>
                    <option value="">—</option><option value="SARL">SARL</option><option value="SAS">SAS</option><option value="SA">SA</option><option value="SNC">SNC</option><option value="GIE">GIE</option>
                  </select></div>
                <div><label className="block text-xs font-medium text-muted mb-1">N° RCCM</label><input value={form.numero_rccm || ''} onChange={e => set('numero_rccm', e.target.value)} className="input-field" /></div>
              </div>
              <div><label className="block text-xs font-medium text-muted mb-1">Siège social</label><input value={form.siege_social || ''} onChange={e => set('siege_social', e.target.value)} className="input-field" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-muted mb-1">Représentant nom *</label><input value={form.representant_nom || ''} onChange={e => set('representant_nom', e.target.value)} className="input-field" required /></div>
                <div><label className="block text-xs font-medium text-muted mb-1">Représentant prénom *</label><input value={form.representant_prenom || ''} onChange={e => set('representant_prenom', e.target.value)} className="input-field" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-muted mb-1">Téléphone *</label><input value={form.telephone || ''} onChange={e => set('telephone', e.target.value)} className="input-field" required /></div>
                <div><label className="block text-xs font-medium text-muted mb-1">Email</label><input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} className="input-field" /></div>
              </div>
            </>
          )}

          <div><label className="block text-xs font-medium text-muted mb-1">Notes</label><textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} className="input-field" rows={2} placeholder="Notes internes..." /></div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? <><Loader2 size={16} className="inline animate-spin mr-2" />Création...</> : 'Enregistrer'}
          </button>
        </form>
      </div>
    </div>
  )
}
