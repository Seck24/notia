import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Check, FileText, Calculator } from 'lucide-react'
import useAuthStore from '../../stores/authStore'
import api from '../../services/api'
import Logo from '../../components/layout/Logo'

const STEPS = ['Identité', 'Numérotation', 'Modèles', 'Barème']
const TYPES_ACTES = [
  { id: 'vente_immobiliere', label: 'Vente immobilière' },
  { id: 'constitution_sarl', label: 'Constitution société' },
  { id: 'succession', label: 'Succession' },
  { id: 'donation', label: 'Donation' },
  { id: 'ouverture_credit', label: 'Ouverture de crédit' },
]

export default function Onboarding() {
  const nav = useNavigate()
  const { cabinet, initialize } = useAuthStore()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [identite, setIdentite] = useState({ telephone: '', adresse: '' })
  const [format, setFormat] = useState('{ANNEE}/{SEQ:04d}')
  const [modeles, setModeles] = useState({})

  const cabinetId = cabinet?.id

  function previewNumero() {
    return format.replace('{ANNEE}', '2026').replace('{SEQ:04d}', '0001').replace('{ID}', cabinetId || 'ADE')
  }

  async function saveIdentite() {
    setLoading(true)
    try {
      await api.put(`/cabinets/${cabinetId}`, identite)
      setStep(1)
    } catch { }
    setLoading(false)
  }

  async function saveFormat() {
    setLoading(true)
    try {
      await api.put(`/cabinets/${cabinetId}/config`, { format_numero: format })
      setStep(2)
    } catch { }
    setLoading(false)
  }

  async function uploadModele(typeActe, file) {
    const fd = new FormData()
    fd.append('file', file)
    try {
      await api.post(`/cabinets/${cabinetId}/modele-acte`, fd)
      setModeles(m => ({ ...m, [typeActe]: true }))
    } catch { }
  }

  async function finish() {
    setLoading(true)
    await initialize()
    nav('/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center px-4 py-8">
      <Logo size="md" />
      <p className="text-muted text-sm mt-2 mb-8">Configuration de votre étude</p>

      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-8 w-full max-w-lg">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= step ? 'bg-gold' : 'bg-border'}`} />
            <p className={`text-xs mt-1 text-center ${i <= step ? 'text-gold font-medium' : 'text-muted'}`}>{s}</p>
          </div>
        ))}
      </div>

      <div className="card w-full max-w-lg">
        {/* Step 1: Identité */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-display font-bold text-navy">Identité de l'étude</h2>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Téléphone</label>
              <input value={identite.telephone} onChange={e => setIdentite(f => ({ ...f, telephone: e.target.value }))} className="input-field" placeholder="+225 07 00 00 00 00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Adresse</label>
              <input value={identite.adresse} onChange={e => setIdentite(f => ({ ...f, adresse: e.target.value }))} className="input-field" placeholder="Cocody, Abidjan" />
            </div>
            <button onClick={saveIdentite} disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? 'Enregistrement...' : 'Continuer'}
            </button>
          </div>
        )}

        {/* Step 2: Numérotation */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-display font-bold text-navy">Format de numérotation</h2>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Format</label>
              <input value={format} onChange={e => setFormat(e.target.value)} className="input-field font-mono" />
            </div>
            <div className="bg-surface rounded-lg p-3 border border-border">
              <p className="text-xs text-muted mb-1">Prévisualisation</p>
              <p className="font-mono text-navy font-semibold">{previewNumero()}</p>
            </div>
            <div className="text-xs text-muted space-y-1">
              <p><code className="bg-gray-100 px-1 rounded">{'{ANNEE}'}</code> — Année en cours</p>
              <p><code className="bg-gray-100 px-1 rounded">{'{SEQ:04d}'}</code> — Numéro séquentiel (4 chiffres)</p>
              <p><code className="bg-gray-100 px-1 rounded">{'{ID}'}</code> — Identifiant cabinet</p>
            </div>
            <button onClick={saveFormat} disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? 'Enregistrement...' : 'Continuer'}
            </button>
          </div>
        )}

        {/* Step 3: Modèles */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-display font-bold text-navy">Modèles d'actes</h2>
            <p className="text-sm text-muted">Uploadez vos modèles Word pour chaque type d'acte. L'app fonctionnera avec un modèle générique jusqu'à l'upload.</p>
            <div className="space-y-2">
              {TYPES_ACTES.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-surface rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    {modeles[t.id] ? <Check size={16} className="text-success" /> : <FileText size={16} className="text-muted" />}
                    <span className="text-sm">{t.label}</span>
                  </div>
                  <label className="btn-secondary text-xs cursor-pointer py-1.5 px-3">
                    <Upload size={14} className="inline mr-1" />
                    {modeles[t.id] ? 'Remplacer' : 'Upload'}
                    <input type="file" accept=".docx,.doc" className="hidden" onChange={e => e.target.files[0] && uploadModele(t.id, e.target.files[0])} />
                  </label>
                </div>
              ))}
            </div>
            <button onClick={() => setStep(3)} className="btn-primary w-full">Continuer</button>
            <button onClick={() => setStep(3)} className="text-sm text-muted hover:underline w-full text-center">Passer cette étape</button>
          </div>
        )}

        {/* Step 4: Barème */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-display font-bold text-navy">Barème tarifaire</h2>
            <p className="text-sm text-muted">Uploadez votre barème de frais notariaux (Excel ou PDF). Le barème DGI CI standard sera utilisé par défaut.</p>
            <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-gold/50 transition-colors">
              <Calculator size={32} className="text-muted mb-2" />
              <span className="text-sm text-muted">Cliquez ou déposez votre fichier</span>
              <span className="text-xs text-muted/60 mt-1">Excel (.xlsx) ou PDF</span>
              <input type="file" accept=".xlsx,.xls,.pdf" className="hidden" />
            </label>
            <button onClick={finish} disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? 'Finalisation...' : 'Terminer la configuration'}
            </button>
            <button onClick={finish} className="text-sm text-muted hover:underline w-full text-center">Utiliser le barème DGI standard</button>
          </div>
        )}
      </div>
    </div>
  )
}
