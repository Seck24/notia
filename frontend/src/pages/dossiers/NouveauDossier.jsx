import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Building2, Users, Gift, Landmark, Plus, Trash2, ChevronLeft } from 'lucide-react'
import api from '../../services/api'
import FormulairePartie from '../../components/parties/FormulairePartie'

const TYPES = [
  { id: 'vente_immobiliere', label: 'Vente immobilière', icon: Landmark, desc: 'Acte de vente de bien immobilier', roles: ['vendeur', 'acquereur'] },
  { id: 'constitution_sarl', label: 'Constitution société', icon: Building2, desc: 'SARL, SAS, SA, SNC, GIE', roles: ['associe', 'gerant'] },
  { id: 'succession', label: 'Succession', icon: Users, desc: 'Acte de notoriété, attestation', roles: ['defunt', 'heritier'] },
  { id: 'donation', label: 'Donation', icon: Gift, desc: 'Donation simple, avec charge, usufruit', roles: ['donateur', 'donataire'] },
  { id: 'ouverture_credit', label: 'Ouverture de crédit', icon: FileText, desc: 'Prêt bancaire avec garanties', roles: ['debiteur', 'creancier'] },
]

const ROLE_LABELS = {
  vendeur: 'Vendeur', acquereur: 'Acquéreur', associe: 'Associé', gerant: 'Gérant',
  defunt: 'Défunt', heritier: 'Héritier', donateur: 'Donateur', donataire: 'Donataire',
  debiteur: 'Débiteur / Emprunteur', creancier: 'Créancier / Prêteur',
}

export default function NouveauDossier() {
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [typeActe, setTypeActe] = useState(null)
  const [parties, setParties] = useState([])
  const [editingPartie, setEditingPartie] = useState(null)
  const [infos, setInfos] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const typeConfig = TYPES.find(t => t.id === typeActe)

  function addPartie(data) {
    if (editingPartie?.index !== undefined) {
      setParties(p => p.map((item, i) => i === editingPartie.index ? data : item))
    } else {
      setParties(p => [...p, data])
    }
    setEditingPartie(null)
  }

  function removePartie(index) {
    setParties(p => p.filter((_, i) => i !== index))
  }

  async function creerDossier() {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/dossiers', { type_acte: typeActe, infos_specifiques: infos })
      const dossierId = data.dossier.id
      for (const partie of parties) {
        await api.post(`/dossiers/${dossierId}/parties`, partie)
      }
      nav(`/dossiers/${dossierId}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la création')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-display font-bold text-navy mb-6">Nouveau dossier</h1>

      {step === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted mb-4">Sélectionnez le type d'acte</p>
          {TYPES.map(t => (
            <button key={t.id} onClick={() => { setTypeActe(t.id); setStep(1) }} className="w-full card flex items-center gap-4 text-left hover:border-gold transition-colors">
              <div className="w-12 h-12 rounded-lg bg-navy/5 flex items-center justify-center shrink-0"><t.icon size={22} className="text-navy" /></div>
              <div><p className="font-medium text-navy">{t.label}</p><p className="text-xs text-muted">{t.desc}</p></div>
            </button>
          ))}
        </div>
      )}

      {step === 1 && typeConfig && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => { setStep(0); setParties([]); setTypeActe(null) }} className="text-muted hover:text-navy"><ChevronLeft size={20} /></button>
            <div><h2 className="text-lg font-display font-semibold text-navy">Parties du dossier</h2><p className="text-xs text-muted">{typeConfig.label}</p></div>
          </div>

          {editingPartie ? (
            <div className="card border-gold">
              <p className="text-xs font-semibold text-gold uppercase mb-3">{ROLE_LABELS[editingPartie.role] || editingPartie.role}</p>
              <FormulairePartie role={editingPartie.role} initial={editingPartie.index !== undefined ? parties[editingPartie.index] : undefined} onSave={addPartie} onCancel={() => setEditingPartie(null)} />
            </div>
          ) : (
            <>
              {typeConfig.roles.map(role => {
                const roleParties = parties.filter(p => p.role === role)
                return (
                  <div key={role} className="card">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-navy">{ROLE_LABELS[role]}(s)</p>
                      <button onClick={() => setEditingPartie({ role })} className="text-xs text-gold font-medium flex items-center gap-1 hover:underline"><Plus size={14} /> Ajouter</button>
                    </div>
                    {roleParties.length === 0 ? (
                      <p className="text-xs text-muted">Aucun {ROLE_LABELS[role]?.toLowerCase()} ajouté</p>
                    ) : (
                      <div className="space-y-2">
                        {roleParties.map(p => {
                          const realIdx = parties.indexOf(p)
                          const name = p.type_partie === 'personne_physique' ? `${p.prenom || ''} ${p.nom || ''}`.trim() || 'Sans nom' : p.raison_sociale || 'Sans nom'
                          return (
                            <div key={realIdx} className="flex items-center justify-between p-2.5 bg-surface rounded-lg border border-border">
                              <div><p className="text-sm font-medium text-navy">{name}</p><p className="text-xs text-muted">{p.type_partie === 'personne_physique' ? 'Personne physique' : p.forme_juridique || 'Personne morale'}</p></div>
                              <div className="flex gap-1">
                                <button onClick={() => setEditingPartie({ role, index: realIdx })} className="text-xs text-muted hover:text-navy px-2 py-1">Modifier</button>
                                <button onClick={() => removePartie(realIdx)} className="text-red-400 hover:text-red-600 px-1"><Trash2 size={14} /></button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              <button onClick={() => setStep(2)} className="btn-primary w-full" disabled={parties.length === 0}>Continuer</button>
            </>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => setStep(1)} className="text-muted hover:text-navy"><ChevronLeft size={20} /></button>
            <h2 className="text-lg font-display font-semibold text-navy">Informations spécifiques</h2>
          </div>

          <div className="card space-y-3">
            {typeActe === 'vente_immobiliere' && (
              <>
                <div><label className="block text-xs font-medium text-muted mb-1">Nature du bien</label>
                  <select value={infos.nature_bien || ''} onChange={e => setInfos(f => ({ ...f, nature_bien: e.target.value }))} className="input-field">
                    <option value="">— Sélectionner —</option><option value="tf_immatricule">TF immatriculé</option><option value="tf_en_cours">TF en cours</option><option value="indivision">Indivision</option><option value="terrain">Terrain nu</option><option value="maison">Maison / Villa</option><option value="appartement">Appartement</option><option value="local_commercial">Local commercial</option>
                  </select></div>
                <div><label className="block text-xs font-medium text-muted mb-1">Valeur estimée (FCFA)</label>
                  <input type="number" value={infos.valeur_bien || ''} onChange={e => setInfos(f => ({ ...f, valeur_bien: e.target.value }))} className="input-field" placeholder="50 000 000" /></div>
                <div><label className="block text-xs font-medium text-muted mb-1">Mode de paiement</label>
                  <select value={infos.mode_paiement || ''} onChange={e => setInfos(f => ({ ...f, mode_paiement: e.target.value }))} className="input-field">
                    <option value="">— Sélectionner —</option><option value="comptant">Comptant</option><option value="credit_bancaire">Crédit bancaire</option><option value="echelonne">Échelonné</option>
                  </select></div>
                {infos.mode_paiement === 'credit_bancaire' && (
                  <div><label className="block text-xs font-medium text-muted mb-1">Banque</label><input value={infos.banque || ''} onChange={e => setInfos(f => ({ ...f, banque: e.target.value }))} className="input-field" placeholder="SGBCI, BICICI..." /></div>
                )}
                <div className="flex items-center gap-2"><input type="checkbox" checked={infos.bien_hypotheque || false} onChange={e => setInfos(f => ({ ...f, bien_hypotheque: e.target.checked }))} className="rounded border-border text-gold focus:ring-gold" /><label className="text-sm">Bien hypothéqué</label></div>
                <div className="flex items-center gap-2"><input type="checkbox" checked={infos.condition_suspensive || false} onChange={e => setInfos(f => ({ ...f, condition_suspensive: e.target.checked }))} className="rounded border-border text-gold focus:ring-gold" /><label className="text-sm">Condition suspensive de prêt</label></div>
              </>
            )}
            {typeActe === 'constitution_sarl' && (
              <>
                <div><label className="block text-xs font-medium text-muted mb-1">Capital social (FCFA)</label><input type="number" value={infos.capital || ''} onChange={e => setInfos(f => ({ ...f, capital: e.target.value }))} className="input-field" placeholder="1 000 000" /></div>
                <div><label className="block text-xs font-medium text-muted mb-1">Siège social</label><input value={infos.siege_social || ''} onChange={e => setInfos(f => ({ ...f, siege_social: e.target.value }))} className="input-field" placeholder="Abidjan, Cocody..." /></div>
              </>
            )}
            {typeActe === 'succession' && (
              <>
                <div><label className="block text-xs font-medium text-muted mb-1">Date de décès</label><input type="date" value={infos.date_deces || ''} onChange={e => setInfos(f => ({ ...f, date_deces: e.target.value }))} className="input-field" /></div>
                <div><label className="block text-xs font-medium text-muted mb-1">Lieu de décès</label><input value={infos.lieu_deces || ''} onChange={e => setInfos(f => ({ ...f, lieu_deces: e.target.value }))} className="input-field" /></div>
              </>
            )}
            <div><label className="block text-xs font-medium text-muted mb-1">Notes internes</label><textarea value={infos.notes || ''} onChange={e => setInfos(f => ({ ...f, notes: e.target.value }))} className="input-field" rows={3} placeholder="Observations..." /></div>
          </div>

          <div className="card bg-surface">
            <h3 className="text-sm font-semibold text-navy mb-3">Résumé</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted">Type</span><span className="font-medium capitalize">{typeActe?.replace(/_/g, ' ')}</span></div>
              <div className="flex justify-between"><span className="text-muted">Parties</span><span className="font-medium">{parties.length}</span></div>
              {infos.valeur_bien && <div className="flex justify-between"><span className="text-muted">Valeur</span><span className="font-medium">{Number(infos.valeur_bien).toLocaleString('fr-FR')} FCFA</span></div>}
            </div>
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button onClick={creerDossier} disabled={loading} className="btn-navy w-full disabled:opacity-50">{loading ? 'Création...' : 'Créer le dossier'}</button>
        </div>
      )}
    </div>
  )
}
