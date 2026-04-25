import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Loader2, Check, AlertTriangle, User, Building2, FileText, CreditCard, Shield } from 'lucide-react'
import api from '../../services/api'

const TYPES_LABELS = {
  vente_immobiliere: 'Vente immobilière',
  constitution_sarl: 'Constitution de société',
  succession: 'Succession',
  donation: 'Donation',
  ouverture_credit: 'Ouverture de crédit',
}

const ROLE_LABELS = {
  vendeur: 'Vendeur', acquereur: 'Acquéreur', associe: 'Associé', gerant: 'Gérant',
  defunt: 'Défunt', heritier: 'Héritier', donateur: 'Donateur', donataire: 'Donataire',
  debiteur: 'Débiteur', creancier: 'Créancier',
}

export default function NouveauDossier() {
  const nav = useNavigate()
  const [phase, setPhase] = useState(1)
  const [description, setDescription] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyse, setAnalyse] = useState(null)
  const [error, setError] = useState('')
  const [correction, setCorrection] = useState('')
  const [creating, setCreating] = useState(false)

  async function analyser() {
    if (!description.trim() || description.trim().length < 10) {
      setError('Décrivez le dossier en quelques mots (minimum 10 caractères)')
      return
    }
    setAnalyzing(true)
    setError('')
    try {
      const { data } = await api.post('/dossiers/analyser-description', { description: description.trim() })
      setAnalyse(data.analyse)
      setPhase(2)
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de l\'analyse. Réessayez avec plus de détails.')
    }
    setAnalyzing(false)
  }

  async function corriger() {
    if (!correction.trim()) return
    setAnalyzing(true)
    setError('')
    try {
      const { data } = await api.post('/dossiers/analyser-description', {
        description: `${description}\n\nCorrection : ${correction.trim()}`,
      })
      setAnalyse(data.analyse)
      setCorrection('')
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur')
    }
    setAnalyzing(false)
  }

  async function creerDossier() {
    setCreating(true)
    setError('')
    try {
      const { data } = await api.post('/dossiers/creer-depuis-analyse', { analyse })
      nav(`/dossiers/${data.dossier_id}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la création')
    }
    setCreating(false)
  }

  return (
    <div className="max-w-[680px] mx-auto">
      <h1 className="text-2xl font-display font-bold text-navy mb-1">Nouveau dossier</h1>

      {phase === 1 && (
        <div className="space-y-4 mt-6">
          <p className="text-sm text-muted">Décrivez le dossier en quelques mots</p>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="input-field text-sm"
            rows={7}
            placeholder={"Exemples :\n• Koné Amara veut vendre sa maison à Cocody à Diabaté Seydou. Le bien est hypothéqué à la BACI, paiement par crédit SGBCI. Koné est marié sous communauté.\n\n• Constitution d'une SARL entre Traoré Michel et Bamba Fatou, capital 1 000 000 FCFA, siège à Yopougon.\n\n• Succession de feu Kouamé Jean, 3 héritiers : sa femme et 2 enfants."}
            autoFocus
          />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button onClick={analyser} disabled={analyzing || !description.trim()} className="btn-primary w-full py-3 text-base disabled:opacity-50 flex items-center justify-center gap-2">
            {analyzing ? <><Loader2 size={18} className="animate-spin" /> Analyse en cours...</> : 'Analyser le dossier →'}
          </button>
          <div className="text-center">
            <Link to="/dossiers/nouveau/formulaire" className="text-xs text-muted hover:text-gold transition-colors">
              Préférer le formulaire étape par étape →
            </Link>
          </div>
        </div>
      )}

      {phase === 2 && analyse && (
        <div className="space-y-4 mt-6">
          <div className="card border-green-200 bg-green-50/30">
            <div className="flex items-center gap-2 mb-4">
              <Check size={18} className="text-green-600" />
              <p className="font-semibold text-navy">Voici ce que j'ai compris</p>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted">Type</span>
              <span className="text-sm font-medium text-navy">{TYPES_LABELS[analyse.type_acte] || analyse.type_acte || '—'}</span>
            </div>

            {analyse.parties?.length > 0 && (
              <div className="py-3 border-b border-border/50">
                <p className="text-sm text-muted mb-2">Parties</p>
                <div className="space-y-2">
                  {analyse.parties.map((p, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-gold/10 flex items-center justify-center">
                        {p.type_partie === 'personne_morale' ? <Building2 size={13} className="text-gold" /> : <User size={13} className="text-gold" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-navy">{p.prenom || ''} {p.nom || ''} <span className="text-muted font-normal">— {ROLE_LABELS[p.role] || p.role}</span></p>
                        {p.situation_matrimoniale === 'marie' && p.regime_matrimonial && (
                          <p className="text-xs text-muted">{p.regime_matrimonial === 'communaute' ? 'Marié(e), communauté de biens' : 'Marié(e), séparation de biens'}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analyse.points_attention?.length > 0 && (
              <div className="py-3 border-b border-border/50">
                <p className="text-sm text-muted mb-2">Particularités</p>
                <div className="space-y-1">
                  {analyse.points_attention.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Shield size={13} className="text-amber-500 shrink-0" />
                      <span className="text-navy">{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analyse.infos_specifiques && (
              <div className="py-3 border-b border-border/50">
                <p className="text-sm text-muted mb-2">Détails</p>
                <div className="space-y-1 text-sm">
                  {analyse.infos_specifiques.bien_hypotheque && <div className="flex items-center gap-2"><CreditCard size={13} className="text-amber-500" /><span>Bien hypothéqué{analyse.infos_specifiques.banque_hypotheque ? ` (${analyse.infos_specifiques.banque_hypotheque})` : ''}</span></div>}
                  {analyse.infos_specifiques.mode_paiement === 'credit_bancaire' && <div className="flex items-center gap-2"><CreditCard size={13} className="text-blue-500" /><span>Crédit bancaire{analyse.infos_specifiques.banque_credit ? ` (${analyse.infos_specifiques.banque_credit})` : ''}</span></div>}
                  {analyse.infos_specifiques.condition_suspensive && <div className="flex items-center gap-2"><AlertTriangle size={13} className="text-amber-500" /><span>Condition suspensive</span></div>}
                  {analyse.infos_specifiques.capital_social && <div className="flex items-center gap-2"><Building2 size={13} className="text-indigo-500" /><span>Capital : {Number(analyse.infos_specifiques.capital_social).toLocaleString('fr-FR')} FCFA</span></div>}
                  {analyse.infos_specifiques.siege_social && <div className="flex items-center gap-2"><Building2 size={13} className="text-muted" /><span>Siège : {analyse.infos_specifiques.siege_social}</span></div>}
                </div>
              </div>
            )}

            {analyse.documents_requis?.length > 0 && (
              <div className="py-3">
                <p className="text-sm text-muted mb-1"><FileText size={13} className="inline mr-1" />{analyse.documents_requis.length} documents requis</p>
                <p className="text-xs text-muted">{analyse.documents_requis.join(', ')}</p>
              </div>
            )}
          </div>

          {!analyse.type_acte && (
            <div className="card border-amber-200 bg-amber-50/30">
              <p className="text-sm text-amber-700 mb-3">Type d'acte non identifié. Sélectionnez-le :</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(TYPES_LABELS).map(([k, v]) => (
                  <button key={k} onClick={() => setAnalyse(a => ({ ...a, type_acte: k }))} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:border-gold hover:bg-gold/5">{v}</button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-muted mb-1.5">Quelque chose à corriger ?</p>
            <div className="flex gap-2">
              <input value={correction} onChange={e => setCorrection(e.target.value)} className="input-field flex-1 text-sm" placeholder="Ajouter, corriger ou préciser..." onKeyDown={e => e.key === 'Enter' && corriger()} />
              {correction && <button onClick={corriger} disabled={analyzing} className="btn-secondary text-sm px-4 disabled:opacity-50">{analyzing ? '...' : 'Corriger'}</button>}
            </div>
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <div className="flex gap-3">
            <button onClick={() => setPhase(1)} className="btn-secondary flex-1">← Modifier</button>
            <button onClick={creerDossier} disabled={creating || !analyse.type_acte} className="btn-primary flex-1 py-3 disabled:opacity-50">
              {creating ? <><Loader2 size={16} className="inline animate-spin mr-2" />Création...</> : '✅ Créer ce dossier'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
