import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FileText, Building2, Users, Gift, Landmark, Plus, Trash2, Search, X, Check } from 'lucide-react'
import api from '../../services/api'
import FormulairePartie from '../../components/parties/FormulairePartie'
import ModalNouveauClient from '../../components/clients/ModalNouveauClient'

const STEPS = ['Client', 'Type d\'acte', 'Autres parties', 'Récapitulatif']

const TYPES = [
  { id: 'vente_immobiliere', label: 'Vente immobilière', icon: Landmark, desc: 'Cession d\'un bien immobilier', roles: ['vendeur', 'acquereur'] },
  { id: 'constitution_sarl', label: 'Constitution de société', icon: Building2, desc: 'Création SARL, SA, SAS...', roles: ['associe', 'gerant'] },
  { id: 'succession', label: 'Succession', icon: Users, desc: 'Règlement d\'une succession', roles: ['defunt', 'heritier'] },
  { id: 'donation', label: 'Donation', icon: Gift, desc: 'Transmission à titre gratuit', roles: ['donateur', 'donataire'] },
  { id: 'ouverture_credit', label: 'Ouverture de crédit', icon: FileText, desc: 'Prêt bancaire avec garanties', roles: ['debiteur', 'creancier'] },
]

const ROLE_LABELS = {
  vendeur: 'Vendeur', acquereur: 'Acquéreur', associe: 'Associé', gerant: 'Gérant',
  defunt: 'Défunt', heritier: 'Héritier', donateur: 'Donateur', donataire: 'Donataire',
  debiteur: 'Débiteur / Emprunteur', creancier: 'Créancier / Prêteur',
}

function clientName(c) {
  return c?.type_client === 'entreprise' ? c.raison_sociale : `${c?.prenom || ''} ${c?.nom || ''}`.trim()
}

export default function NouveauDossier() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [step, setStep] = useState(0)
  const [client, setClient] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [typeActe, setTypeActe] = useState(null)
  const [infos, setInfos] = useState({})
  const [parties, setParties] = useState([])
  const [editingPartie, setEditingPartie] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const typeConfig = TYPES.find(t => t.id === typeActe)

  useEffect(() => {
    const clientId = params.get('client')
    if (clientId) {
      api.get(`/clients/${clientId}`).then(({ data }) => { if (data.client) setClient(data.client) }).catch(() => {})
    }
  }, [])

  const handleSearch = useCallback(async (q) => {
    setSearchQuery(q)
    if (q.length < 2) { setSearchResults([]); return }
    try { const { data } = await api.get(`/clients/search?q=${encodeURIComponent(q)}`); setSearchResults(data.clients || []) } catch { setSearchResults([]) }
  }, [])

  function addPartie(data) {
    if (editingPartie?.index !== undefined) { setParties(p => p.map((item, i) => i === editingPartie.index ? data : item)) } else { setParties(p => [...p, data]) }
    setEditingPartie(null)
  }

  async function creerDossier() {
    setLoading(true); setError('')
    try {
      const { data } = await api.post('/dossiers', { type_acte: typeActe, client_id: client.id, infos_specifiques: infos })
      const dossierId = data.dossier.id
      for (const partie of parties) { await api.post(`/dossiers/${dossierId}/parties`, partie) }
      nav(`/dossiers/${dossierId}`)
    } catch (err) { setError(err.response?.data?.detail || 'Erreur lors de la création') }
    setLoading(false)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-display font-bold text-navy mb-6">Nouveau dossier</h1>

      {/* Stepper */}
      <div className="flex items-center gap-1 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1 flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i < step ? 'bg-gold text-white' : i === step ? 'bg-gold/20 text-gold border-2 border-gold' : 'bg-border text-muted'}`}>
              {i < step ? <Check size={14} /> : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${i <= step ? 'text-navy' : 'text-muted'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? 'bg-gold' : 'bg-border'}`} />}
          </div>
        ))}
      </div>

      {/* Step 0: Client */}
      {step === 0 && (
        <div className="space-y-4">
          <div><h2 className="text-lg font-display font-semibold text-navy">Pour qui ouvrez-vous ce dossier ?</h2><p className="text-sm text-muted mt-1">Recherchez un client existant ou créez-en un nouveau</p></div>
          {client ? (
            <div className="card bg-gold/5 border-gold/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold">{(clientName(client) || '?')[0]?.toUpperCase()}</div>
                  <div>
                    <p className="font-medium text-navy">{clientName(client)}</p>
                    <p className="text-xs text-muted">{client.telephone || client.email || ''}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${client.type_client === 'entreprise' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>{client.type_client === 'entreprise' ? 'Entreprise' : 'Particulier'}</span>
                  </div>
                </div>
                <button onClick={() => setClient(null)} className="text-muted hover:text-red-500"><X size={18} /></button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input value={searchQuery} onChange={e => handleSearch(e.target.value)} className="input-field pl-9" placeholder="Nom, téléphone, email..." autoFocus />
                {searchResults.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map(c => (
                      <button key={c.id} onClick={() => { setClient(c); setSearchQuery(''); setSearchResults([]) }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface border-b border-border/50 last:border-0">
                        <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-gold text-xs font-bold">{(clientName(c) || '?')[0]?.toUpperCase()}</div>
                        <div><p className="text-sm font-medium text-navy">{clientName(c)}</p><p className="text-xs text-muted">{c.telephone || ''}</p></div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 text-muted text-sm"><div className="flex-1 h-px bg-border" /> ou <div className="flex-1 h-px bg-border" /></div>
              <button onClick={() => setShowCreateModal(true)} className="btn-secondary w-full flex items-center justify-center gap-2"><Plus size={16} /> Créer un nouveau client</button>
            </>
          )}
          <button onClick={() => setStep(1)} disabled={!client} className="btn-primary w-full disabled:opacity-50">Suivant</button>
        </div>
      )}

      {/* Step 1: Type d'acte */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-display font-semibold text-navy">Quel est l'objet du dossier ?</h2>
          <div className="grid grid-cols-2 gap-3">
            {TYPES.map(t => (
              <button key={t.id} onClick={() => setTypeActe(t.id)} className={`card text-left hover:border-gold transition-colors ${typeActe === t.id ? 'border-gold bg-gold/5' : ''}`}>
                <div className="w-10 h-10 rounded-lg bg-navy/5 flex items-center justify-center mb-2"><t.icon size={20} className="text-navy" /></div>
                <p className="font-medium text-navy text-sm">{t.label}</p>
                <p className="text-xs text-muted mt-0.5">{t.desc}</p>
              </button>
            ))}
          </div>
          {typeActe === 'vente_immobiliere' && (
            <div className="card space-y-3">
              <p className="text-xs font-semibold text-muted uppercase">Informations complémentaires</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-muted mb-1">Nature du bien</label><select value={infos.nature_bien || ''} onChange={e => setInfos(f => ({ ...f, nature_bien: e.target.value }))} className="input-field"><option value="">—</option><option value="terrain">Terrain</option><option value="maison">Maison/Villa</option><option value="appartement">Appartement</option><option value="local_commercial">Local commercial</option></select></div>
                <div><label className="block text-xs font-medium text-muted mb-1">Valeur (FCFA)</label><input type="number" value={infos.valeur_bien || ''} onChange={e => setInfos(f => ({ ...f, valeur_bien: e.target.value }))} className="input-field" /></div>
              </div>
              <div><label className="block text-xs font-medium text-muted mb-1">Mode de paiement</label><select value={infos.mode_paiement || ''} onChange={e => setInfos(f => ({ ...f, mode_paiement: e.target.value }))} className="input-field"><option value="">—</option><option value="comptant">Comptant</option><option value="credit_bancaire">Crédit bancaire</option><option value="echelonne">Échelonné</option></select></div>
              {infos.mode_paiement === 'credit_bancaire' && <div><label className="block text-xs font-medium text-muted mb-1">Banque</label><input value={infos.banque || ''} onChange={e => setInfos(f => ({ ...f, banque: e.target.value }))} className="input-field" /></div>}
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={infos.bien_hypotheque || false} onChange={e => setInfos(f => ({ ...f, bien_hypotheque: e.target.checked }))} className="rounded border-border text-gold focus:ring-gold" /> Bien hypothéqué</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={infos.condition_suspensive || false} onChange={e => setInfos(f => ({ ...f, condition_suspensive: e.target.checked }))} className="rounded border-border text-gold focus:ring-gold" /> Condition suspensive</label>
              </div>
            </div>
          )}
          {typeActe === 'constitution_sarl' && (
            <div className="card space-y-3"><p className="text-xs font-semibold text-muted uppercase">Informations complémentaires</p>
              <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-medium text-muted mb-1">Capital (FCFA)</label><input type="number" value={infos.capital || ''} onChange={e => setInfos(f => ({ ...f, capital: e.target.value }))} className="input-field" /></div><div><label className="block text-xs font-medium text-muted mb-1">Siège social</label><input value={infos.siege_social || ''} onChange={e => setInfos(f => ({ ...f, siege_social: e.target.value }))} className="input-field" /></div></div>
            </div>
          )}
          {typeActe === 'succession' && (
            <div className="card space-y-3"><p className="text-xs font-semibold text-muted uppercase">Informations complémentaires</p>
              <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-medium text-muted mb-1">Date décès</label><input type="date" value={infos.date_deces || ''} onChange={e => setInfos(f => ({ ...f, date_deces: e.target.value }))} className="input-field" /></div><div><label className="block text-xs font-medium text-muted mb-1">Lieu décès</label><input value={infos.lieu_deces || ''} onChange={e => setInfos(f => ({ ...f, lieu_deces: e.target.value }))} className="input-field" /></div></div>
            </div>
          )}
          <div className="flex gap-3"><button onClick={() => setStep(0)} className="btn-secondary flex-1">Précédent</button><button onClick={() => setStep(2)} disabled={!typeActe} className="btn-primary flex-1 disabled:opacity-50">Suivant</button></div>
        </div>
      )}

      {/* Step 2: Parties */}
      {step === 2 && typeConfig && (
        <div className="space-y-4">
          <div><h2 className="text-lg font-display font-semibold text-navy">Autres parties au dossier</h2><p className="text-sm text-muted mt-1">Le client principal est inclus. Ajoutez les autres parties si nécessaire.</p></div>
          {editingPartie ? (
            <div className="card border-gold"><p className="text-xs font-semibold text-gold uppercase mb-3">{ROLE_LABELS[editingPartie.role]}</p><FormulairePartie role={editingPartie.role} initial={editingPartie.index !== undefined ? parties[editingPartie.index] : undefined} onSave={addPartie} onCancel={() => setEditingPartie(null)} /></div>
          ) : (
            <>
              {typeConfig.roles.map(role => {
                const rp = parties.filter(p => p.role === role)
                return (
                  <div key={role} className="card">
                    <div className="flex items-center justify-between mb-3"><p className="text-sm font-semibold text-navy">{ROLE_LABELS[role]}(s)</p><button onClick={() => setEditingPartie({ role })} className="text-xs text-gold font-medium flex items-center gap-1 hover:underline"><Plus size={14} /> Ajouter</button></div>
                    {rp.length === 0 ? <p className="text-xs text-muted italic">Aucun ajouté — optionnel</p> : (
                      <div className="space-y-2">{rp.map(p => { const idx = parties.indexOf(p); const nm = p.type_partie === 'personne_physique' ? `${p.prenom || ''} ${p.nom || ''}`.trim() || 'Sans nom' : p.raison_sociale || 'Sans nom'; return (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-surface rounded-lg border border-border"><div><p className="text-sm font-medium text-navy">{nm}</p></div><div className="flex gap-1"><button onClick={() => setEditingPartie({ role, index: idx })} className="text-xs text-muted hover:text-navy px-2 py-1">Modifier</button><button onClick={() => setParties(ps => ps.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 px-1"><Trash2 size={14} /></button></div></div>
                      )})}</div>
                    )}
                  </div>
                )
              })}
              <div className="flex gap-3"><button onClick={() => setStep(1)} className="btn-secondary flex-1">Précédent</button><button onClick={() => setStep(3)} className="btn-primary flex-1">Suivant</button></div>
            </>
          )}
        </div>
      )}

      {/* Step 3: Récap */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-display font-semibold text-navy">Récapitulatif</h2>
          <div className="card bg-surface space-y-3">
            <div className="flex justify-between text-sm"><span className="text-muted">Client</span><span className="font-medium text-navy">{clientName(client)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted">Type d'acte</span><span className="font-medium text-navy capitalize">{typeActe?.replace(/_/g, ' ')}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted">Autres parties</span><span className="font-medium text-navy">{parties.length}</span></div>
            {infos.valeur_bien && <div className="flex justify-between text-sm"><span className="text-muted">Valeur</span><span className="font-medium text-navy">{Number(infos.valeur_bien).toLocaleString('fr-FR')} FCFA</span></div>}
          </div>
          {parties.length > 0 && (
            <div className="card"><p className="text-xs font-semibold text-muted uppercase mb-2">Parties</p>{parties.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 text-sm"><span className="text-navy">{p.type_partie === 'personne_physique' ? `${p.prenom || ''} ${p.nom || ''}`.trim() : p.raison_sociale}</span><span className="text-xs text-muted">{ROLE_LABELS[p.role]}</span></div>
            ))}</div>
          )}
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <div className="flex gap-3"><button onClick={() => setStep(2)} className="btn-secondary flex-1">Précédent</button><button onClick={creerDossier} disabled={loading} className="btn-navy flex-1 disabled:opacity-50">{loading ? 'Création...' : 'Créer le dossier'}</button></div>
        </div>
      )}

      {showCreateModal && <ModalNouveauClient onClose={() => setShowCreateModal(false)} onCreated={(c) => { setClient(c); setShowCreateModal(false) }} />}
    </div>
  )
}
