import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Loader2, Check, AlertTriangle, User, Building2, FileText, CreditCard, Shield, UserCheck, UserPlus, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react'
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
  const [partiesDecisions, setPartiesDecisions] = useState([])
  const [showInfoForm, setShowInfoForm] = useState({})
  const [infosSupp, setInfosSupp] = useState({})

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
      initPartiesDecisions(data.analyse)
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
      initPartiesDecisions(data.analyse)
      setCorrection('')
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur')
    }
    setAnalyzing(false)
  }

  function initPartiesDecisions(ana) {
    const decisions = (ana.parties || []).map((p, i) => {
      const best = p.clients_similaires?.[0]
      return {
        index: i,
        action: p.action_suggeree === 'lier' ? 'lier' : p.action_suggeree === 'suggerer' ? 'suggerer' : 'creer',
        client_id: p.action_suggeree === 'lier' && best ? best.id : null,
      }
    })
    setPartiesDecisions(decisions)
    setShowInfoForm({})
    setInfosSupp({})
  }

  function updateDecision(index, action, clientId = null) {
    setPartiesDecisions(prev => prev.map(d =>
      d.index === index ? { ...d, action, client_id: clientId } : d
    ))
  }

  async function creerDossier() {
    setCreating(true)
    setError('')
    try {
      // Préparer les décisions finales
      const decisions = partiesDecisions.map(d => ({
        index: d.index,
        action: d.action === 'suggerer' ? 'creer' : d.action, // suggerer non confirmé → créer
        client_id: d.action === 'lier' ? d.client_id : null,
        infos_supplementaires: d.action === 'creer' ? (infosSupp[d.index] || null) : null,
      }))
      const { data } = await api.post('/dossiers/creer-depuis-analyse', { analyse, parties_decisions: decisions })
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
            placeholder={"Exemples :\n• Kouamé Assi veut vendre sa maison à Cocody à Zadi Gro. Le bien est hypothéqué à la BACI, paiement par crédit SGBCI. Kouamé est marié sous communauté.\n\n• Constitution d'une SARL entre Traoré Michel et Soro Lacina, capital 1 000 000 FCFA, siège à Yopougon.\n\n• Succession de feu Daho Gnagne, 3 héritiers : sa femme et 2 enfants."}
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
                <div className="space-y-3">
                  {analyse.parties.map((p, i) => {
                    const decision = partiesDecisions[i]
                    const similaires = p.clients_similaires || []
                    const best = similaires[0]
                    const isLier = decision?.action === 'lier'
                    const isSuggerer = decision?.action === 'suggerer'
                    const isCreer = decision?.action === 'creer'

                    return (
                      <div key={i} className={`rounded-lg border p-3 ${isLier ? 'border-green-200 bg-green-50/30' : isSuggerer ? 'border-amber-200 bg-amber-50/30' : 'border-border bg-slate-50/30'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-muted">{ROLE_LABELS[p.role] || p.role}</span>
                          {isLier && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">Client existant</span>}
                          {isSuggerer && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Client similaire trouvé</span>}
                          {isCreer && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600">Nouveau client</span>}
                        </div>

                        {/* ÉTAT 1 — Client existant (confiance haute, lié) */}
                        {isLier && best && (
                          <div>
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-xs font-semibold text-green-700">
                                {(best.prenom?.[0] || '').toUpperCase()}{(best.nom?.[0] || '').toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-navy">{best.prenom} {best.nom}</p>
                                <p className="text-xs text-muted">
                                  {best.situation_matrimoniale ? `${best.situation_matrimoniale}` : ''}
                                  {best.nb_dossiers > 0 ? ` · ${best.nb_dossiers} dossier${best.nb_dossiers > 1 ? 's' : ''}` : ''}
                                </p>
                              </div>
                              <UserCheck size={16} className="text-green-600 shrink-0" />
                            </div>
                            <button
                              onClick={() => updateDecision(i, 'creer')}
                              className="text-[11px] text-muted hover:text-navy mt-1.5 transition-colors"
                            >
                              Créer un nouveau client à la place
                            </button>
                          </div>
                        )}

                        {/* ÉTAT 2 — Suggestion (confiance moyenne) */}
                        {isSuggerer && best && (
                          <div>
                            <p className="text-xs text-amber-700 mb-2">Est-ce que vous voulez dire :</p>
                            <div className="flex items-center gap-2.5 mb-2">
                              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-xs font-semibold text-amber-700">
                                {(best.prenom?.[0] || '').toUpperCase()}{(best.nom?.[0] || '').toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-navy">{best.prenom} {best.nom}</p>
                                <p className="text-xs text-muted">
                                  {best.situation_matrimoniale ? `${best.situation_matrimoniale}` : ''}
                                  {best.nb_dossiers > 0 ? ` · ${best.nb_dossiers} dossier${best.nb_dossiers > 1 ? 's' : ''}` : ''}
                                </p>
                              </div>
                              <HelpCircle size={16} className="text-amber-500 shrink-0" />
                            </div>
                            {similaires.length > 1 && (
                              <div className="mb-2 space-y-1">
                                {similaires.slice(1).map((c, j) => (
                                  <button
                                    key={j}
                                    onClick={() => updateDecision(i, 'lier', c.id)}
                                    className="text-xs text-muted hover:text-navy block transition-colors"
                                  >
                                    Ou : {c.prenom} {c.nom} ?
                                  </button>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <button
                                onClick={() => updateDecision(i, 'lier', best.id)}
                                className="text-xs px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition-colors"
                              >
                                Oui c'est lui
                              </button>
                              <button
                                onClick={() => updateDecision(i, 'creer')}
                                className="text-xs px-3 py-1.5 rounded-lg bg-slate-50 border border-border text-muted hover:bg-slate-100 transition-colors"
                              >
                                Non, créer nouveau
                              </button>
                            </div>
                          </div>
                        )}

                        {/* ÉTAT 3 — Nouveau client */}
                        {isCreer && (
                          <div>
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-500">
                                {(p.prenom?.[0] || '').toUpperCase()}{(p.nom?.[0] || '').toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-navy">{p.prenom || ''} {p.nom || ''}</p>
                                <p className="text-xs text-muted">Sera créé lors de la validation</p>
                              </div>
                              <UserPlus size={16} className="text-slate-400 shrink-0" />
                            </div>
                            {/* Bouton pour revenir à un client existant si des similaires existent */}
                            {similaires.length > 0 && (
                              <button
                                onClick={() => updateDecision(i, best.confiance === 'haute' ? 'lier' : 'suggerer', best.confiance === 'haute' ? best.id : null)}
                                className="text-[11px] text-muted hover:text-navy mt-1.5 transition-colors"
                              >
                                Utiliser un client existant à la place
                              </button>
                            )}
                            {/* Formulaire optionnel pour compléter les infos */}
                            <button
                              onClick={() => setShowInfoForm(prev => ({ ...prev, [i]: !prev[i] }))}
                              className="flex items-center gap-1 text-[11px] text-gold hover:text-gold/80 mt-1.5 transition-colors"
                            >
                              Compléter ses infos
                              {showInfoForm[i] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                            {showInfoForm[i] && (
                              <div className="mt-2 space-y-2 pl-10">
                                <input
                                  value={infosSupp[i]?.telephone || ''}
                                  onChange={e => setInfosSupp(prev => ({ ...prev, [i]: { ...prev[i], telephone: e.target.value } }))}
                                  className="input-field text-xs w-full"
                                  placeholder="Téléphone (optionnel)"
                                />
                                <input
                                  value={infosSupp[i]?.email || ''}
                                  onChange={e => setInfosSupp(prev => ({ ...prev, [i]: { ...prev[i], email: e.target.value } }))}
                                  className="input-field text-xs w-full"
                                  placeholder="Email (optionnel)"
                                />
                                <select
                                  value={infosSupp[i]?.situation_matrimoniale || ''}
                                  onChange={e => setInfosSupp(prev => ({ ...prev, [i]: { ...prev[i], situation_matrimoniale: e.target.value } }))}
                                  className="input-field text-xs w-full"
                                >
                                  <option value="">Situation matrimoniale (optionnel)</option>
                                  <option value="celibataire">Célibataire</option>
                                  <option value="marie">Marié(e)</option>
                                  <option value="divorce">Divorcé(e)</option>
                                  <option value="veuf">Veuf/Veuve</option>
                                </select>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
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
