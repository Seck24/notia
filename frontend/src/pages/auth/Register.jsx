import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useAuthStore from '../../stores/authStore'
import Logo from '../../components/layout/Logo'

export default function Register() {
  const nav = useNavigate()
  const { register, login } = useAuthStore()
  const [form, setForm] = useState({ nom_cabinet: '', email: '', password: '', password2: '', ville: 'Abidjan' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password !== form.password2) { setError('Les mots de passe ne correspondent pas'); return }
    if (form.password.length < 8) { setError('Mot de passe : 8 caractères minimum'); return }
    setLoading(true)
    try {
      await register({ nom_cabinet: form.nom_cabinet, email: form.email, password: form.password, ville: form.ville })
      await login(form.email, form.password)
      nav('/onboarding', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de l\'inscription')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Logo size="lg" />
          <p className="text-muted text-sm mt-2">Créez votre espace notarial</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Nom de l'étude</label>
              <input value={form.nom_cabinet} onChange={e => set('nom_cabinet', e.target.value)} required className="input-field" placeholder="Étude Maître Diakité" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Email professionnel</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required className="input-field" placeholder="notaire@exemple.ci" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Mot de passe</label>
                <input type="password" value={form.password} onChange={e => set('password', e.target.value)} required className="input-field" placeholder="8 car. min" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Confirmer</label>
                <input type="password" value={form.password2} onChange={e => set('password2', e.target.value)} required className="input-field" placeholder="••••••••" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Ville</label>
              <input value={form.ville} onChange={e => set('ville', e.target.value)} className="input-field" placeholder="Abidjan" />
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? 'Création...' : 'Créer mon étude'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-muted mt-6">
          Déjà inscrit ? <Link to="/login" className="text-gold font-medium hover:underline">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
