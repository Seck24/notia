import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, Loader2, Check, X, AlertCircle } from 'lucide-react'
import api from '../../services/api'

const SUGGESTIONS = {
  attente_pieces: ['CNI vendeur reçu', 'Titre foncier reçu', 'Envoyer lien client', 'Relancer le client'],
  redaction_projet: ['Générer l\'acte', 'Valeur du bien : ...', 'Passer aux observations'],
  reception_client: ['Passer en analyse', 'Ajouter une note'],
  analyse_interne: ['Passer en attente pièces', 'Envoyer lien client'],
  demarches_admin: ['Passer en rédaction', 'État foncier obtenu'],
  observations_client: ['Regénérer l\'acte', 'Passer à la signature'],
  signature_finale: ['Clôturer le dossier'],
}

export default function BarreCommande({ dossierId, statut, onActionExecuted }) {
  const [texte, setTexte] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null) // { type: 'success'|'confirm'|'error', message, action, params }
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef(null)

  const suggestions = SUGGESTIONS[statut] || SUGGESTIONS.attente_pieces

  useEffect(() => {
    if (result?.type === 'success') {
      const t = setTimeout(() => setResult(null), 3000)
      return () => clearTimeout(t)
    }
  }, [result])

  async function envoyer() {
    if (!texte.trim() || loading) return
    setLoading(true)
    setResult(null)
    setShowSuggestions(false)

    try {
      const { data } = await api.post(`/dossiers/${dossierId}/commande`, { texte: texte.trim() })

      if (data.action === 'inconnu') {
        setResult({ type: 'error', message: data.confirmation || "Je n'ai pas compris. Essayez : 'CNI vendeur reçu' ou 'passer en rédaction'" })
      } else if (data.executed) {
        setResult({ type: 'success', message: data.confirmation })
        setTexte('')
        onActionExecuted?.()
      } else if (data.needs_frontend_action) {
        setResult({ type: 'success', message: data.confirmation })
        setTexte('')
        onActionExecuted?.(data.needs_frontend_action)
      } else {
        setResult({ type: 'confirm', message: data.confirmation, action: data.action, params: data.params, originalTexte: texte })
      }
    } catch (err) {
      setResult({ type: 'error', message: err.response?.data?.detail || 'Erreur' })
    }
    setLoading(false)
  }

  async function confirmer() {
    if (!result) return
    setLoading(true)
    try {
      // Re-send with forced execute
      const { data } = await api.post(`/dossiers/${dossierId}/commande`, { texte: result.originalTexte + " (confirmer l'action)" })
      if (data.executed) {
        setResult({ type: 'success', message: data.confirmation })
        setTexte('')
        onActionExecuted?.()
      }
    } catch { }
    setLoading(false)
  }

  return (
    <div className="sticky bottom-0 bg-white border-t border-border py-3 px-4 md:px-6 z-30">
      {/* Result pill */}
      {result && (
        <div className={`mb-2 max-w-[600px] mx-auto rounded-lg px-4 py-2.5 text-sm flex items-center gap-2 ${
          result.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
          result.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' :
          'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          {result.type === 'success' && <Check size={16} className="shrink-0" />}
          {result.type === 'error' && <AlertCircle size={16} className="shrink-0" />}
          <span className="flex-1">{result.type === 'confirm' ? `Voulez-vous ${result.message} ?` : result.message}</span>
          {result.type === 'confirm' && (
            <div className="flex gap-2 shrink-0">
              <button onClick={confirmer} className="text-xs font-semibold bg-amber-600 text-white px-3 py-1 rounded-md">Oui</button>
              <button onClick={() => setResult(null)} className="text-xs font-semibold text-amber-600 px-2">Non</button>
            </div>
          )}
          {result.type !== 'confirm' && (
            <button onClick={() => setResult(null)} className="shrink-0 opacity-50 hover:opacity-100"><X size={14} /></button>
          )}
        </div>
      )}

      {/* Suggestions */}
      {showSuggestions && !loading && !result && (
        <div className="mb-2 max-w-[600px] mx-auto flex flex-wrap gap-1.5">
          {suggestions.map(s => (
            <button key={s} onClick={() => { setTexte(s); setShowSuggestions(false); inputRef.current?.focus() }} className="text-xs px-3 py-1.5 rounded-full border border-border text-muted hover:border-gold hover:text-gold transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="max-w-[600px] mx-auto relative">
        <Sparkles size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold" />
        <input
          ref={inputRef}
          value={texte}
          onChange={e => setTexte(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onKeyDown={e => e.key === 'Enter' && envoyer()}
          className="w-full border border-border rounded-xl pl-10 pr-12 py-3 text-sm focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 bg-white"
          placeholder="Que voulez-vous faire ? Ex: CNI vendeur reçu, passer en rédaction..."
          disabled={loading}
        />
        <button onClick={envoyer} disabled={loading || !texte.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg bg-gold text-white disabled:opacity-30 transition-opacity">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>
    </div>
  )
}
