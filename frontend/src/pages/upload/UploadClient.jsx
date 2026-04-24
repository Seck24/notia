import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Camera, Image, Check, AlertCircle } from 'lucide-react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'https://api-notia.preo-ia.info'

export default function UploadClient() {
  const { token } = useParams()
  const [info, setInfo] = useState(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(null)
  const [docs, setDocs] = useState([])

  useEffect(() => {
    axios.get(`${API_URL}/upload/${token}`)
      .then(({ data }) => {
        setInfo(data)
        setDocs(data.documents || [])
      })
      .catch(err => {
        const msg = err.response?.data?.detail || 'Lien invalide ou expiré'
        setError(msg)
      })
  }, [token])

  async function handleUpload(nomDoc, file) {
    setUploading(nomDoc)
    const fd = new FormData()
    fd.append('nom_document', nomDoc)
    fd.append('file', file)
    try {
      await axios.post(`${API_URL}/upload/${token}/fichier`, fd)
      setDocs(prev => prev.map(d => d.nom_document === nomDoc ? { ...d, statut: 'recu' } : d))
    } catch { }
    setUploading(null)
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto text-red-400 mb-3" />
          <p className="text-lg font-semibold text-navy">{error}</p>
          <p className="text-sm text-muted mt-2">Contactez votre notaire pour obtenir un nouveau lien.</p>
        </div>
      </div>
    )
  }

  if (!info) {
    return <div className="min-h-screen bg-surface flex items-center justify-center"><p className="text-muted">Chargement...</p></div>
  }

  const allDone = docs.every(d => d.statut !== 'manquant')

  return (
    <div className="min-h-screen bg-surface px-4 py-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <span className="font-display italic text-gold text-2xl font-bold">N</span>
          <span className="font-sans font-semibold text-navy text-lg">otia</span>
          {info.cabinet && <p className="text-sm text-muted mt-2">{info.cabinet.nom}</p>}
          <p className="text-navy font-medium mt-1">Documents à envoyer pour votre dossier</p>
        </div>

        {allDone ? (
          <div className="card text-center py-8">
            <Check size={48} className="mx-auto text-success mb-3" />
            <p className="text-lg font-semibold text-navy">Tous vos documents ont été reçus</p>
            <p className="text-sm text-muted mt-2">L'étude vous contactera prochainement.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {docs.map(d => (
              <div key={d.nom_document} className="card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {d.statut === 'manquant' ? (
                    <span className="text-lg">⏳</span>
                  ) : (
                    <span className="text-lg">✅</span>
                  )}
                  <span className="text-sm font-medium">{d.nom_document}</span>
                </div>
                {d.statut === 'manquant' && (
                  <div className="flex gap-2">
                    <label className="flex items-center gap-1 bg-navy text-white text-xs font-medium py-2 px-3 rounded-lg cursor-pointer">
                      {uploading === d.nom_document ? (
                        'Envoi...'
                      ) : (
                        <>
                          <Camera size={14} />
                          <span className="hidden sm:inline">Photo</span>
                          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files[0] && handleUpload(d.nom_document, e.target.files[0])} />
                        </>
                      )}
                    </label>
                    <label className="flex items-center gap-1 bg-surface border border-border text-navy text-xs font-medium py-2 px-3 rounded-lg cursor-pointer">
                      <Image size={14} />
                      <span className="hidden sm:inline">Galerie</span>
                      <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => e.target.files[0] && handleUpload(d.nom_document, e.target.files[0])} />
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
