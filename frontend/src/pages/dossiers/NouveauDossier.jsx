import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Building2, Users, Gift, Landmark } from 'lucide-react'
import api from '../../services/api'

const TYPES = [
  { id: 'vente_immobiliere', label: 'Vente immobilière', icon: Landmark, desc: 'Acte de vente de bien immobilier' },
  { id: 'constitution_sarl', label: 'Constitution société', icon: Building2, desc: 'SARL, SAS, SA, SNC, GIE' },
  { id: 'succession', label: 'Succession', icon: Users, desc: 'Acte de notoriété, attestation' },
  { id: 'donation', label: 'Donation', icon: Gift, desc: 'Donation simple, avec charge, usufruit' },
  { id: 'ouverture_credit', label: 'Ouverture de crédit', icon: FileText, desc: 'Prêt bancaire avec garanties' },
]

export default function NouveauDossier() {
  const nav = useNavigate()
  const [typeActe, setTypeActe] = useState(null)
  const [infos, setInfos] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(0)

  async function creerDossier() {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/dossiers', {
        type_acte: typeActe,
        infos_specifiques: infos,
      })
      nav(`/dossiers/${data.dossier.id}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la création')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-display font-bold text-navy mb-6">Nouveau dossier</h1>

      {/* Step 1: Type d'acte */}
      {step === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted mb-4">Sélectionnez le type d'acte</p>
          {TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => { setTypeActe(t.id); setStep(1) }}
              className={`w-full card flex items-center gap-4 text-left hover:border-gold transition-colors ${typeActe === t.id ? 'border-gold bg-gold/5' : ''}`}
            >
              <div className="w-12 h-12 rounded-lg bg-navy/5 flex items-center justify-center">
                <t.icon size={22} className="text-navy" />
              </div>
              <div>
                <p className="font-medium text-navy">{t.label}</p>
                <p className="text-xs text-muted">{t.desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step 2: Infos spécifiques */}
      {step === 1 && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display font-semibold text-navy">Informations spécifiques</h2>
            <button onClick={() => setStep(0)} className="text-sm text-muted hover:underline">Changer le type</button>
          </div>
          <p className="text-sm text-muted capitalize">{typeActe?.replace(/_/g, ' ')}</p>

          {typeActe === 'vente_immobiliere' && (
            <>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Régime matrimonial du vendeur</label>
                <select value={infos.regime_matrimonial || ''} onChange={e => setInfos(f => ({ ...f, regime_matrimonial: e.target.value }))} className="input-field">
                  <option value="">— Sélectionner —</option>
                  <option value="communaute">Communauté de biens</option>
                  <option value="separation">Séparation de biens</option>
                  <option value="celibataire">Célibataire</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Nature du bien</label>
                <select value={infos.nature_bien || ''} onChange={e => setInfos(f => ({ ...f, nature_bien: e.target.value }))} className="input-field">
                  <option value="">— Sélectionner —</option>
                  <option value="terrain">Terrain nu</option>
                  <option value="maison">Maison/Villa</option>
                  <option value="appartement">Appartement</option>
                  <option value="local_commercial">Local commercial</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Mode de paiement</label>
                <select value={infos.mode_paiement || ''} onChange={e => setInfos(f => ({ ...f, mode_paiement: e.target.value }))} className="input-field">
                  <option value="">— Sélectionner —</option>
                  <option value="comptant">Comptant</option>
                  <option value="credit_bancaire">Crédit bancaire</option>
                  <option value="echelonne">Échelonné</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={infos.condition_suspensive || false} onChange={e => setInfos(f => ({ ...f, condition_suspensive: e.target.checked }))} className="rounded border-border text-gold focus:ring-gold" />
                <label className="text-sm">Condition suspensive d'obtention de prêt</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={infos.bien_hypotheque || false} onChange={e => setInfos(f => ({ ...f, bien_hypotheque: e.target.checked }))} className="rounded border-border text-gold focus:ring-gold" />
                <label className="text-sm">Bien actuellement hypothéqué</label>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Notes internes</label>
            <textarea value={infos.notes || ''} onChange={e => setInfos(f => ({ ...f, notes: e.target.value }))} className="input-field" rows={3} placeholder="Observations du clerc..." />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button onClick={creerDossier} disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? 'Création...' : 'Créer le dossier'}
          </button>
        </div>
      )}
    </div>
  )
}
