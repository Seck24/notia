import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Users, Building2, User } from 'lucide-react'
import api from '../../services/api'
import ModalNouveauClient from '../../components/clients/ModalNouveauClient'

export default function ListeClients() {
  const nav = useNavigate()
  const [clients, setClients] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  async function loadClients() {
    setLoading(true)
    try {
      const { data } = await api.get(`/clients?page=${page}&limit=20`)
      setClients(data.clients || [])
      setTotal(data.total || 0)
    } catch { }
    setLoading(false)
  }

  async function searchClients(q) {
    if (q.length < 2) { loadClients(); return }
    try {
      const { data } = await api.get(`/clients/search?q=${encodeURIComponent(q)}`)
      setClients(data.clients || [])
      setTotal(data.clients?.length || 0)
    } catch { }
  }

  useEffect(() => { if (!search) loadClients() }, [page])

  const handleSearch = useCallback((val) => {
    setSearch(val)
    if (val.length >= 2) searchClients(val)
    else if (val.length === 0) loadClients()
  }, [])

  function clientName(c) {
    return c.type_client === 'entreprise' ? c.raison_sociale : `${c.prenom || ''} ${c.nom || ''}`.trim()
  }

  function handleCreated(client) {
    setShowModal(false)
    nav(`/clients/${client.id}`)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold text-navy">Clients</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Nouveau client
        </button>
      </div>

      <div className="card">
        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={search} onChange={e => handleSearch(e.target.value)} className="input-field pl-9" placeholder="Rechercher par nom, email, téléphone..." />
          </div>
        </div>

        {loading ? (
          <p className="text-muted text-sm py-8 text-center">Chargement...</p>
        ) : clients.length === 0 ? (
          <div className="text-center py-12">
            <Users size={48} className="mx-auto text-muted/30 mb-3" />
            <p className="text-muted">{search ? 'Aucun résultat' : 'Aucun client pour le moment'}</p>
            {!search && (
              <button onClick={() => setShowModal(true)} className="btn-primary inline-flex items-center gap-2 mt-4">
                <Plus size={16} /> Créer le premier client
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th className="pb-3 font-medium">Client</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Téléphone</th>
                    <th className="pb-3 font-medium">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map(c => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-surface/50 cursor-pointer" onClick={() => nav(`/clients/${c.id}`)}>
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-gold text-xs font-bold">
                            {(clientName(c) || '?')[0]?.toUpperCase()}
                          </div>
                          <span className="font-medium text-navy">{clientName(c) || '—'}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${c.type_client === 'entreprise' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                          {c.type_client === 'entreprise' ? <Building2 size={12} /> : <User size={12} />}
                          {c.type_client === 'entreprise' ? 'Entreprise' : 'Particulier'}
                        </span>
                      </td>
                      <td className="py-3 text-muted">{c.telephone || '—'}</td>
                      <td className="py-3 text-muted">{c.email || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {clients.map(c => (
                <Link key={c.id} to={`/clients/${c.id}`} className="block p-3 bg-surface rounded-lg border border-border">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-gold text-xs font-bold">
                      {(clientName(c) || '?')[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-navy">{clientName(c)}</p>
                      <p className="text-xs text-muted">{c.telephone || c.email || '—'}</p>
                    </div>
                    <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-semibold ${c.type_client === 'entreprise' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                      {c.type_client === 'entreprise' ? 'Entreprise' : 'Particulier'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {total > 20 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs disabled:opacity-50">Précédent</button>
                <span className="text-sm text-muted">Page {page}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total} className="btn-secondary text-xs disabled:opacity-50">Suivant</button>
              </div>
            )}
          </>
        )}
      </div>

      {showModal && <ModalNouveauClient onClose={() => setShowModal(false)} onCreated={handleCreated} />}
    </div>
  )
}
