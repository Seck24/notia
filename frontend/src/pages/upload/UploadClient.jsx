import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Camera, ImageIcon, Check, AlertCircle, Loader2 } from 'lucide-react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'https://api-notia.preo-ia.info'

export default function UploadClient() {
  const { token } = useParams()
  const [state, setState] = useState('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [info, setInfo] = useState(null)
  const [docs, setDocs] = useState([])
  const [uploading, setUploading] = useState(null) // nom_document being uploaded
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const [activeDoc, setActiveDoc] = useState(null)

  useEffect(() => {
    axios.get(`${API_URL}/upload/${token}`)
      .then(({ data }) => {
        setInfo(data)
        setDocs(data.documents || [])
        const allRecus = (data.documents || []).every(d => d.statut !== 'manquant')
        setState(allRecus ? 'allDone' : 'main')
      })
      .catch(err => {
        setErrorMsg(err.response?.data?.detail || 'Ce lien est invalide ou a expiré')
        setState('error')
      })
  }, [token])

  function selectDoc(doc, source) {
    setActiveDoc(doc)
    if (source === 'camera') {
      cameraInputRef.current?.click()
    } else {
      fileInputRef.current?.click()
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file || !activeDoc) return

    setUploading(activeDoc.nom_document)

    const fd = new FormData()
    fd.append('nom_document', activeDoc.nom_document)
    fd.append('file', file, file.name)

    try {
      await axios.post(`${API_URL}/upload/${token}/fichier`, fd)
      setDocs(prev => prev.map(d =>
        d.nom_document === activeDoc.nom_document ? { ...d, statut: 'recu' } : d
      ))
      // Check if all done
      const remaining = docs.filter(d => d.nom_document !== activeDoc.nom_document && d.statut === 'manquant')
      if (remaining.length === 0) {
        setTimeout(() => setState('allDone'), 1500)
      }
    } catch {
      alert('Erreur lors de l\'envoi. Veuillez réessayer.')
    }
    setUploading(null)
    setActiveDoc(null)
    // Reset input
    e.target.value = ''
  }

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
        <Loader2 size={24} className="text-gray-400 animate-spin mb-3" />
        <p className="text-sm text-gray-500">Chargement...</p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 text-center">
        <AlertCircle size={48} className="text-red-400 mb-4" />
        <p className="text-lg font-semibold text-gray-800 mb-2">Lien invalide</p>
        <p className="text-sm text-gray-500 max-w-xs">{errorMsg}</p>
        <p className="text-xs text-gray-400 mt-4">Contactez votre notaire pour obtenir un nouveau lien.</p>
      </div>
    )
  }

  if (state === 'allDone') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <Check size={32} className="text-green-600" />
        </div>
        <p className="text-lg font-semibold text-gray-800 mb-2">Merci !</p>
        <p className="text-sm text-gray-500 max-w-xs">
          Tous vos documents ont été transmis à {info?.cabinet?.nom || 'votre notaire'}.
          Vous serez contacté prochainement.
        </p>
      </div>
    )
  }

  // Main list
  const pending = docs.filter(d => d.statut === 'manquant')
  const received = docs.filter(d => d.statut !== 'manquant')

  return (
    <div className="min-h-screen bg-white px-4 py-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          {info?.cabinet?.nom && <p className="text-sm text-gray-500">{info.cabinet.nom}</p>}
          <p className="text-lg font-semibold text-gray-800 mt-1">Documents à envoyer</p>
        </div>

        {/* Hidden file inputs */}
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
        <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} />

        {/* Pending documents */}
        {pending.length > 0 && (
          <div className="space-y-3 mb-6">
            {pending.map(d => (
              <div key={d.nom_document} className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-800 mb-3">{d.nom_document}</p>
                {uploading === d.nom_document ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-2">
                    <Loader2 size={16} className="animate-spin" /> Envoi en cours...
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => selectDoc(d, 'camera')}
                      className="flex-1 flex items-center justify-center gap-2 bg-gray-800 text-white py-2.5 rounded-lg text-sm font-medium"
                    >
                      <Camera size={16} /> Photo
                    </button>
                    <button
                      onClick={() => selectDoc(d, 'file')}
                      className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium"
                    >
                      <ImageIcon size={16} /> Fichier
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Received documents */}
        {received.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 uppercase font-medium mb-2">Documents reçus</p>
            <div className="space-y-2">
              {received.map(d => (
                <div key={d.nom_document} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <Check size={18} className="text-green-600 shrink-0" />
                  <p className="text-sm text-green-700">{d.nom_document}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
