import { useState } from 'react'
import { User, Building2 } from 'lucide-react'

const EMPTY_PARTIE = {
  type_partie: 'personne_physique',
  nom: '', prenom: '', date_naissance: '', lieu_naissance: '',
  nationalite: 'Ivoirienne', adresse: '', telephone: '',
  situation_matrimoniale: '', regime_matrimonial: '', conjoint_nom: '', conjoint_prenom: '',
  raison_sociale: '', forme_juridique: '', numero_rccm: '', gerant_nom: '', gerant_prenom: '',
  type_piece: '', numero_piece: '',
}

export default function FormulairePartie({ role, initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { ...EMPTY_PARTIE, role })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const isPhysique = form.type_partie === 'personne_physique'
  const showConjoint = form.regime_matrimonial === 'communaute'

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button onClick={() => set('type_partie', 'personne_physique')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-colors ${isPhysique ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted'}`}>
          <User size={16} /> Personne physique
        </button>
        <button onClick={() => set('type_partie', 'personne_morale')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-colors ${!isPhysique ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted'}`}>
          <Building2 size={16} /> Personne morale
        </button>
      </div>

      {isPhysique ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Nom</label>
              <input value={form.nom} onChange={e => set('nom', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Prénom</label>
              <input value={form.prenom} onChange={e => set('prenom', e.target.value)} className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Date de naissance</label>
              <input type="date" value={form.date_naissance} onChange={e => set('date_naissance', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Lieu de naissance</label>
              <input value={form.lieu_naissance} onChange={e => set('lieu_naissance', e.target.value)} className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Nationalité</label>
              <input value={form.nationalite} onChange={e => set('nationalite', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Téléphone</label>
              <input value={form.telephone} onChange={e => set('telephone', e.target.value)} className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Adresse</label>
            <input value={form.adresse} onChange={e => set('adresse', e.target.value)} className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Type de pièce</label>
              <select value={form.type_piece} onChange={e => set('type_piece', e.target.value)} className="input-field">
                <option value="">— Sélectionner —</option>
                <option value="cni">CNI</option>
                <option value="passeport">Passeport</option>
                <option value="carte_sejour">Carte de séjour</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">N° de pièce</label>
              <input value={form.numero_piece} onChange={e => set('numero_piece', e.target.value)} className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Situation matrimoniale</label>
              <select value={form.situation_matrimoniale} onChange={e => set('situation_matrimoniale', e.target.value)} className="input-field">
                <option value="">— Sélectionner —</option>
                <option value="celibataire">Célibataire</option>
                <option value="marie">Marié(e)</option>
                <option value="divorce">Divorcé(e)</option>
                <option value="veuf">Veuf/Veuve</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Régime matrimonial</label>
              <select value={form.regime_matrimonial} onChange={e => set('regime_matrimonial', e.target.value)} className="input-field">
                <option value="">— Sélectionner —</option>
                <option value="communaute">Communauté de biens</option>
                <option value="separation">Séparation de biens</option>
              </select>
            </div>
          </div>
          {showConjoint && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-surface rounded-lg border border-border">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Nom du conjoint</label>
                <input value={form.conjoint_nom} onChange={e => set('conjoint_nom', e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Prénom du conjoint</label>
                <input value={form.conjoint_prenom} onChange={e => set('conjoint_prenom', e.target.value)} className="input-field" />
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Raison sociale</label>
            <input value={form.raison_sociale} onChange={e => set('raison_sociale', e.target.value)} className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Forme juridique</label>
              <select value={form.forme_juridique} onChange={e => set('forme_juridique', e.target.value)} className="input-field">
                <option value="">— Sélectionner —</option>
                <option value="SARL">SARL</option>
                <option value="SAS">SAS</option>
                <option value="SA">SA</option>
                <option value="SNC">SNC</option>
                <option value="GIE">GIE</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">N° RCCM</label>
              <input value={form.numero_rccm} onChange={e => set('numero_rccm', e.target.value)} className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Nom du gérant</label>
              <input value={form.gerant_nom} onChange={e => set('gerant_nom', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Prénom du gérant</label>
              <input value={form.gerant_prenom} onChange={e => set('gerant_prenom', e.target.value)} className="input-field" />
            </div>
          </div>
        </>
      )}

      <div className="flex gap-2 pt-2">
        {onCancel && <button onClick={onCancel} className="btn-secondary flex-1">Annuler</button>}
        <button onClick={() => onSave(form)} className="btn-primary flex-1">Enregistrer</button>
      </div>
    </div>
  )
}
