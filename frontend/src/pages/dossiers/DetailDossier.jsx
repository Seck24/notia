import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { User, FileText, Plus, Link2, Download, Loader2, Check, Circle, ChevronRight, Eye, Upload, Pencil, Trash2, Landmark, Building2, Users as UsersIcon, Gift, CreditCard, Copy, AlertTriangle } from 'lucide-react'
import api from '../../services/api'
import useAuthStore from '../../stores/authStore'
import StatutBadge from '../../components/dossiers/StatutBadge'
import FormulairePartie from '../../components/parties/FormulairePartie'

const STATUTS = [
  { id: 'reception_client', label: 'Réception client', idx: 0 },
  { id: 'analyse_interne', label: 'Analyse interne', idx: 1 },
  { id: 'attente_pieces', label: 'Attente pièces', idx: 2 },
  { id: 'demarches_admin', label: 'Démarches admin', idx: 3 },
  { id: 'redaction_projet', label: 'Rédaction projet', idx: 4 },
  { id: 'observations_client', label: 'Observations client', idx: 5 },
  { id: 'signature_finale', label: 'Signature finale', idx: 6 },
]

const TYPE_ICONS = { vente_immobiliere: Landmark, constitution_sarl: Building2, succession: UsersIcon, donation: Gift, ouverture_credit: CreditCard }
const DOC_STATUS = { manquant: { icon: '⏳', color: 'text-amber-500' }, recu: { icon: '📄', color: 'text-blue-500' }, valide: { icon: '✅', color: 'text-green-600' }, rejete: { icon: '❌', color: 'text-red-500' } }

function calculerFrais(prix) {
  if (!prix || prix <= 0) return null
  const droits = prix * 0.07, taxe = prix * 0.012, fixe = 3000, conserv = 15000
  let emol
  if (prix <= 5e6) emol = prix * 0.05
  else if (prix <= 20e6) emol = 5e6 * 0.05 + (prix - 5e6) * 0.03
  else if (prix <= 50e6) emol = 5e6 * 0.05 + 15e6 * 0.03 + (prix - 20e6) * 0.02
  else emol = 5e6 * 0.05 + 15e6 * 0.03 + 30e6 * 0.02 + (prix - 50e6) * 0.01
  const total = droits + taxe + fixe + conserv + emol + 75000
  return { droits: Math.round(droits), taxe: Math.round(taxe), fixe, conserv, emol: Math.round(emol), debours: 75000, total: Math.round(total) }
}

function fmt(n) { return n?.toLocaleString('fr-FR') }

export default function DetailDossier() {
  const { id } = useParams()
  const { user } = useAuthStore()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState(null)
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [uploadLink, setUploadLink] = useState(null)
  const [tab, setTab] = useState('main') // mobile
  const [addingPartie, setAddingPartie] = useState(null)
  const [valeurBien, setValeurBien] = useState('')

  async function load() {
    try {
      const { data: d } = await api.get(`/dossiers/${id}`)
      setData(d)
      setNotes(d.dossier?.notes_internes || '')
      setValeurBien(d.dossier?.infos_specifiques?.valeur_bien || '')
    } catch { }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const dossier = data?.dossier
  const parties = data?.parties || []
  const documents = data?.documents || []
  const actes = data?.actes || []
  const currentIdx = STATUTS.findIndex(s => s.id === dossier?.statut)

  async function nextStep() {
    if (currentIdx < STATUTS.length - 1) {
      await api.put(`/dossiers/${id}`, { statut: STATUTS[currentIdx + 1].id })
      load()
    }
  }

  async function saveNotes() {
    setSavingNotes(true)
    await api.put(`/dossiers/${id}`, { notes_internes: notes }).catch(() => {})
    setSavingNotes(false)
  }

  async function genererActe() {
    setGenerating(true); setGenResult(null)
    try {
      const { data: r } = await api.post(`/dossiers/${id}/generer`)
      setGenResult(r); load()
    } catch (err) { setGenResult({ error: err.response?.data?.detail || 'Erreur' }) }
    setGenerating(false)
  }

  async function genUploadLink() {
    try {
      const { data: r } = await api.post(`/dossiers/${id}/upload-link`)
      setUploadLink(`${window.location.origin}/upload/${r.token}`)
    } catch (err) { alert(err.response?.data?.detail || 'Erreur') }
  }

  async function validerDoc(nom) {
    await api.post(`/dossiers/${id}/documents/${encodeURIComponent(nom)}/valider`).catch(() => {})
    load()
  }

  async function addPartie(data) {
    await api.post(`/dossiers/${id}/parties`, data)
    setAddingPartie(null); load()
  }

  if (loading) return <p className="text-muted text-center py-12">Chargement...</p>
  if (!dossier) return <p className="text-red-500 text-center py-12">Dossier non trouvé</p>

  const docsRecus = documents.filter(d => d.statut !== 'manquant').length
  const docsTotal = documents.length
  const pct = docsTotal ? Math.round(docsRecus / docsTotal * 100) : 0
  const frais = calculerFrais(Number(valeurBien))
  const TypeIcon = TYPE_ICONS[dossier.type_acte] || FileText

  return (
    <div>
      {/* Mobile tabs */}
      <div className="flex md:hidden gap-1 bg-surface rounded-lg p-1 mb-4">
        {[['main', 'Dossier'], ['docs', 'Documents'], ['parties', 'Parties']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 py-2 text-xs font-medium rounded-md ${tab === k ? 'bg-white shadow text-navy' : 'text-muted'}`}>{l}</button>
        ))}
      </div>

      <div className="grid md:grid-cols-[280px_1fr] gap-6">
        {/* LEFT: Info + Timeline */}
        <div className={`space-y-4 ${tab !== 'main' && tab !== 'docs' ? 'hidden md:block' : 'md:block'}`}>
          {/* Dossier info */}
          <div className="card">
            <p className="font-mono text-lg font-bold text-gold mb-2">{dossier.numero_dossier}</p>
            <div className="flex items-center gap-2 mb-3">
              <TypeIcon size={16} className="text-navy" />
              <StatutBadge statut={dossier.statut} />
            </div>
            <div className="space-y-1.5 text-sm">
              {dossier.client_id && <p className="text-muted">Client : <Link to={`/clients/${dossier.client_id}`} className="text-gold hover:underline">Voir fiche</Link></p>}
              <p className="text-muted">Ouvert le {new Date(dossier.created_at).toLocaleDateString('fr-FR')}</p>
            </div>
          </div>

          {/* Timeline */}
          <div className="card">
            <p className="text-xs font-semibold text-muted uppercase mb-4">Progression</p>
            <div className="space-y-0">
              {STATUTS.map((s, i) => {
                const done = i < currentIdx
                const active = i === currentIdx
                return (
                  <div key={s.id} className="flex items-start gap-3 relative">
                    <div className="flex flex-col items-center">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${done ? 'bg-success text-white' : active ? 'bg-gold text-white' : 'bg-border text-muted'}`}>
                        {done ? <Check size={12} /> : <Circle size={10} />}
                      </div>
                      {i < STATUTS.length - 1 && <div className={`w-0.5 h-6 ${done ? 'bg-success' : 'bg-border'}`} />}
                    </div>
                    <p className={`text-sm pb-4 ${active ? 'font-semibold text-navy' : done ? 'text-muted' : 'text-muted/60'}`}>{s.label}</p>
                  </div>
                )
              })}
            </div>
            <button onClick={nextStep} disabled={currentIdx >= STATUTS.length - 1} className="btn-primary w-full text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              <ChevronRight size={16} /> Étape suivante
            </button>
          </div>
        </div>

        {/* RIGHT: Dynamic content */}
        <div className={`space-y-4 ${tab === 'parties' ? 'hidden md:block' : ''}`}>
          {/* STEP CONTENT */}
          {(currentIdx <= 1 || tab === 'main') && (
            <div className="card">
              <h2 className="text-lg font-display font-semibold text-navy mb-3">
                {currentIdx === 0 ? 'Notes de l\'entretien' : currentIdx === 1 ? 'Analyse du dossier' : STATUTS[currentIdx]?.label}
              </h2>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={saveNotes} className="input-field text-sm" rows={4} placeholder="Notes internes du clerc..." />
              {savingNotes && <p className="text-xs text-muted mt-1">Enregistrement...</p>}

              {dossier.infos_specifiques && Object.keys(dossier.infos_specifiques).length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs font-semibold text-muted uppercase mb-2">Informations spécifiques</p>
                  {Object.entries(dossier.infos_specifiques).filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm py-1"><span className="text-muted capitalize">{k.replace(/_/g, ' ')}</span><span className="font-medium text-navy">{String(v)}</span></div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DOCUMENTS — visible steps 2-3 and tab docs */}
          {(currentIdx >= 2 || tab === 'docs') && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-display font-semibold text-navy">Documents</h2>
                <button onClick={genUploadLink} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"><Link2 size={14} /> Lien client</button>
              </div>

              {uploadLink && (
                <div className="mb-4 p-3 bg-gold/5 border border-gold/20 rounded-lg">
                  <p className="text-xs text-muted mb-1">Lien à envoyer au client (valide 72h)</p>
                  <div className="flex gap-2">
                    <input value={uploadLink} readOnly className="input-field text-xs font-mono flex-1" />
                    <button onClick={() => { navigator.clipboard.writeText(uploadLink); }} className="btn-primary text-xs py-1.5 px-3"><Copy size={14} /></button>
                  </div>
                </div>
              )}

              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-muted mb-1"><span>{docsRecus}/{docsTotal} reçus</span><span>{pct}%</span></div>
                <div className="h-2 bg-border rounded-full overflow-hidden"><div className="h-full bg-success rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
              </div>

              <div className="space-y-2">
                {documents.map(d => {
                  const st = DOC_STATUS[d.statut] || DOC_STATUS.manquant
                  return (
                    <div key={d.id} className="flex items-center justify-between p-2.5 bg-surface rounded-lg border border-border">
                      <div className="flex items-center gap-2">
                        <span className={st.color}>{st.icon}</span>
                        <div>
                          <p className="text-sm">{d.nom_document}</p>
                          {d.uploaded_at && <p className="text-xs text-muted">Reçu le {new Date(d.uploaded_at).toLocaleDateString('fr-FR')}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {d.statut === 'recu' && <button onClick={() => validerDoc(d.nom_document)} className="text-xs text-success font-medium hover:underline px-2">Valider</button>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* GENERATION — visible step 4+ */}
          {currentIdx >= 4 && (
            <div className="card">
              <h2 className="text-lg font-display font-semibold text-navy mb-4">Génération d'acte</h2>

              {/* Readiness check */}
              <div className="mb-4 space-y-1.5">
                <div className="flex items-center gap-2 text-sm">{parties.length > 0 ? <Check size={14} className="text-success" /> : <AlertTriangle size={14} className="text-amber-500" />}<span>Parties renseignées : {parties.length}</span></div>
                <div className="flex items-center gap-2 text-sm">{docsRecus > 0 ? <Check size={14} className="text-success" /> : <span className="text-muted text-xs">○</span>}<span>Documents reçus : {docsRecus}/{docsTotal}</span></div>
                {dossier.infos_specifiques?.regime_matrimonial ? (
                  <div className="flex items-center gap-2 text-sm"><Check size={14} className="text-success" /><span>Régime matrimonial renseigné</span></div>
                ) : dossier.type_acte === 'vente_immobiliere' && (
                  <div className="flex items-center gap-2 text-sm"><AlertTriangle size={14} className="text-amber-500" /><span className="text-amber-600">Régime matrimonial non renseigné</span></div>
                )}
              </div>

              {/* Calcul frais */}
              {dossier.type_acte === 'vente_immobiliere' && (
                <div className="mb-4 p-4 bg-surface rounded-lg border border-border">
                  <p className="text-xs font-semibold text-muted uppercase mb-2">Calcul des frais notariaux</p>
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-muted mb-1">Valeur du bien (FCFA)</label>
                    <input type="number" value={valeurBien} onChange={e => setValeurBien(e.target.value)} className="input-field" placeholder="50 000 000" />
                  </div>
                  {frais && (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-muted">Émoluments</span><span>{fmt(frais.emol)} FCFA</span></div>
                      <div className="flex justify-between"><span className="text-muted">Droits enregistrement (7%)</span><span>{fmt(frais.droits)} FCFA</span></div>
                      <div className="flex justify-between"><span className="text-muted">Taxe publicité (1.2%)</span><span>{fmt(frais.taxe)} FCFA</span></div>
                      <div className="flex justify-between"><span className="text-muted">Conservation foncière</span><span>{fmt(frais.conserv)} FCFA</span></div>
                      <div className="flex justify-between"><span className="text-muted">Droit fixe + débours</span><span>{fmt(frais.fixe + frais.debours)} FCFA</span></div>
                      <div className="flex justify-between font-bold text-navy border-t border-border pt-1 mt-1"><span>TOTAL</span><span>{fmt(frais.total)} FCFA</span></div>
                    </div>
                  )}
                </div>
              )}

              {/* Generate button */}
              {!generating && !genResult?.success && (
                <button onClick={genererActe} disabled={generating || parties.length === 0} className="btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2 disabled:opacity-50">
                  ⚡ Générer le projet d'acte
                </button>
              )}

              {/* Generating state */}
              {generating && (
                <div className="text-center py-6">
                  <Loader2 size={32} className="animate-spin text-gold mx-auto mb-3" />
                  <p className="text-navy font-semibold">Génération en cours...</p>
                  <p className="text-sm text-muted mt-1">Analyse du dossier et des obligations légales applicables</p>
                  <div className="w-48 h-1.5 bg-border rounded-full mx-auto mt-4 overflow-hidden"><div className="h-full bg-gold rounded-full animate-pulse" style={{ width: '60%' }} /></div>
                  <p className="text-xs text-muted mt-2">Durée estimée : ~30 secondes</p>
                </div>
              )}

              {/* Error state */}
              {genResult?.error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 font-semibold mb-1">Erreur lors de la génération</p>
                  <p className="text-sm text-red-500">{genResult.error}</p>
                  <button onClick={() => { setGenResult(null); genererActe() }} className="btn-secondary text-sm mt-3">Réessayer</button>
                </div>
              )}

              {/* Success state */}
              {genResult?.success && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-700 font-semibold mb-1">Projet d'acte v{genResult.version} généré</p>
                  <p className="text-xs text-green-600 mb-3">Par {user?.nom} — {new Date().toLocaleString('fr-FR')}</p>
                  {genResult.clauses_detectees?.length > 0 && (
                    <div className="mb-3 text-xs text-green-700"><p className="font-medium mb-1">Clauses incluses :</p>{genResult.clauses_detectees.map((c, i) => <p key={i}>• {c}</p>)}</div>
                  )}
                  <div className="flex gap-2">
                    <a href={`${api.defaults.baseURL}/dossiers/${id}/actes/${genResult.acte_id}/download`} className="btn-navy text-sm flex items-center gap-2 flex-1 justify-center"><Download size={14} /> Word</a>
                    <a href={`${api.defaults.baseURL}/dossiers/${id}/actes/${genResult.acte_id}/pdf`} className="btn-secondary text-sm flex items-center gap-2 flex-1 justify-center"><Download size={14} /> PDF</a>
                  </div>
                  <button onClick={() => { setGenResult(null) }} className="text-sm text-muted hover:underline w-full text-center mt-3">Regénérer une nouvelle version</button>
                </div>
              )}

              {/* Version history */}
              {actes.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-muted uppercase mb-2">Historique des versions</p>
                  {actes.map(a => (
                    <div key={a.id} className="flex items-center justify-between p-2.5 bg-surface rounded-lg text-sm mb-1.5">
                      <div>
                        <span className="font-medium text-navy">v{a.version}</span>
                        <span className="text-xs text-muted ml-2">{new Date(a.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex gap-1">
                        <a href={`${api.defaults.baseURL}/dossiers/${id}/actes/${a.id}/download`} className="text-xs text-gold hover:underline">Word</a>
                        <span className="text-muted">|</span>
                        <a href={`${api.defaults.baseURL}/dossiers/${id}/actes/${a.id}/pdf`} className="text-xs text-gold hover:underline">PDF</a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PARTIES — always visible */}
          <div className={`card ${tab === 'parties' ? '' : tab !== 'main' && tab !== 'docs' ? 'hidden md:block' : ''}`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-display font-semibold text-navy">Parties du dossier</h2>
              <button onClick={() => setAddingPartie('vendeur')} className="text-xs text-gold font-medium flex items-center gap-1"><Plus size={14} /> Ajouter</button>
            </div>

            {addingPartie && (
              <div className="mb-4 p-4 border border-gold rounded-lg">
                <FormulairePartie role={addingPartie} onSave={addPartie} onCancel={() => setAddingPartie(null)} />
              </div>
            )}

            {parties.length === 0 ? (
              <p className="text-sm text-muted">Aucune partie</p>
            ) : (
              <div className="space-y-2">
                {parties.map(p => {
                  const name = p.type_partie === 'personne_physique' ? `${p.prenom || ''} ${p.nom || ''}`.trim() : p.raison_sociale
                  return (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-surface rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center text-navy text-xs font-bold">{(name || '?')[0]?.toUpperCase()}</div>
                        <div>
                          <p className="text-sm font-medium text-navy">{name || '—'}</p>
                          <p className="text-xs text-gold capitalize">{p.role?.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                      {p.telephone && <p className="text-xs text-muted hidden sm:block">{p.telephone}</p>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
