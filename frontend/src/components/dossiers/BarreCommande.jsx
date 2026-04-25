import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, Loader2, Check, X, AlertCircle, HelpCircle } from 'lucide-react'
import api from '../../services/api'

const SUGGESTIONS = {
  reception_client: ['Passer en analyse', 'Ajouter une note', 'Envoyer lien client'],
  analyse_interne: ['Passer en attente pièces', 'Envoyer lien client', 'Ajouter une note'],
  attente_pieces: ['CNI vendeur reçu', 'Titre foncier reçu', 'Tous les documents sont là', 'Envoyer lien client', 'Relancer le client'],
  demarches_admin: ['Passer en rédaction', 'État foncier obtenu', 'Ajouter une note'],
  redaction_projet: ['Générer l\'acte', 'Valeur du bien : ...', 'Passer aux observations'],
  observations_client: ['Regénérer l\'acte', 'Passer à la signature', 'Ajouter une note'],
  signature_finale: ['Clôturer le dossier'],
}

export default function BarreCommande({ dossierId, statut, onActionExecuted }) {
  const [texte, setTexte] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef(null)

  const suggestions = SUGGESTIONS[statut] || SUGGESTIONS.attente_pieces

  useEffect(() => {
    if (result?.type === 'success') {
      const t = setTimeout(() => setResult(null), 4000)
      return () => clearTimeout(t)
    }
  }, [result])

  async function envoyer(cmd) {
    const commande = cmd || texte.trim()
    if (!commande || loading) return
    setLoading(true)
    setResult(null)
    setShowSuggestions(false)

    try {
      const { data } = await api.post(`/dossiers/${dossierId}/commande`, { texte: commande })

      if (data.statut === 'ok') {
        setResult({ type: 'success', message: data.confirmation })
        setTexte('')
        // Notifier le parent avec les données mises à jour pour update local
        onActionExecuted?.(data.needs_frontend_action || null, data.donnees_mises_a_jour || {}, data.action)
      } else if (data.statut === 'inconnu') {
        setResult({ type: 'inconnu', suggestions: data.suggestions || [] })
      } else if (data.statut === 'erreur') {
        setResult({ type: 'error', message: data.message || 'Erreur technique' })
      } else {
        // Fallback pour ancien format de réponse
        if (data.executed) {
          setResult({ type: 'success', message: data.confirmation })
          setTexte('')
          onActionExecuted?.(data.needs_frontend_action || null, {}, data.action)
        } else if (data.action === 'inconnu') {
          setResult({ type: 'inconnu', suggestions: [] })
        } else {
          setResult({ type: 'error', message: data.confirmation || 'Action non exécutée' })
        }
      }
    } catch (err) {
      setResult({ type: 'error', message: err.response?.data?.detail || 'Erreur de connexion' })
    }
    setLoading(false)
  }

  function clickSuggestion(s) {
    setTexte(s)
    setShowSuggestions(false)
    setResult(null)
    // Auto-send if it's a clear command
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <div className="sticky bottom-0 bg-white border-t border-border py-3 px-4 md:px-6 z-30">
      {/* Result pill */}
      {result && (
        <div className={`mb-2 max-w-[600px] mx-auto rounded-lg px-4 py-2.5 text-sm flex items-start gap-2 ${
          result.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
          result.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' :
          'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          {result.type === 'success' && <Check size={16} className="shrink-0 mt-0.5" />}
          {result.type === 'error' && <AlertCircle size={16} className="shrink-0 mt-0.5" />}
          {result.type === 'inconnu' && <HelpCircle size={16} className="shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            {result.type === 'inconnu' ? (
              <>
                <p className="mb-1.5">Je n'ai pas compris. Essayez :</p>
                <div className="flex flex-wrap gap-1.5">
                  {(result.suggestions || []).map(s => (
                    <button key={s} onClick={() => { setResult(null); clickSuggestion(s) }} className="text-xs px-2.5 py-1 rounded-full border border-amber-300 hover:bg-amber-100 transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <span>{result.message}</span>
            )}
          </div>
          <button onClick={() => setResult(null)} className="shrink-0 opacity-50 hover:opacity-100 mt-0.5"><X size={14} /></button>
        </div>
      )}

      {/* Suggestions contextuelles */}
      {showSuggestions && !loading && !result && (
        <div className="mb-2 max-w-[600px] mx-auto flex flex-wrap gap-1.5">
          {suggestions.map(s => (
            <button key={s} onClick={() => clickSuggestion(s)} className="text-xs px-3 py-1.5 rounded-full border border-border text-muted hover:border-gold hover:text-gold transition-colors">
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
          onChange={e => { setTexte(e.target.value); if (result?.type === 'error') setResult(null) }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onKeyDown={e => e.key === 'Enter' && envoyer()}
          className="w-full border border-border rounded-xl pl-10 pr-12 py-3 text-sm focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 bg-white"
          placeholder="Que voulez-vous faire ? Ex: CNI vendeur reçu, passer en rédaction..."
          disabled={loading}
        />
        <button onClick={() => envoyer()} disabled={loading || !texte.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg bg-gold text-white disabled:opacity-30 transition-opacity">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>
    </div>
  )
}
