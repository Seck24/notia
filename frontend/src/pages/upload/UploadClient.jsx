import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Camera, ImageIcon, Check, AlertCircle, RotateCcw, Upload, Loader2 } from 'lucide-react'
import { Cropper } from 'react-advanced-cropper'
import 'react-advanced-cropper/dist/style.css'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'https://api-notia.preo-ia.info'

const FILTERS = [
  { id: 'original', label: 'Original', css: 'none' },
  { id: 'net', label: 'Net', css: 'contrast(1.4) brightness(1.05)' },
  { id: 'nb', label: 'N&B', css: 'grayscale(1) contrast(1.6)' },
  { id: 'lumineux', label: 'Lumineux', css: 'brightness(1.4) contrast(1.2)' },
]

export default function UploadClient() {
  const { token } = useParams()
  const [state, setState] = useState('loading') // loading | error | main | capture | uploading | done | allDone
  const [errorMsg, setErrorMsg] = useState('')
  const [info, setInfo] = useState(null)
  const [docs, setDocs] = useState([])
  const [currentDoc, setCurrentDoc] = useState(null)
  const [imageUrl, setImageUrl] = useState(null)
  const [filter, setFilter] = useState('net')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [doneDoc, setDoneDoc] = useState(null)
  const cropperRef = useRef(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

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

  function startCapture(doc) {
    setCurrentDoc(doc)
    setImageUrl(null)
    setFilter('net')
    setState('capture')
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setImageUrl(url)
  }

  async function submitUpload() {
    if (!cropperRef.current || !currentDoc) return

    setState('uploading')
    setUploadProgress(0)

    const canvas = cropperRef.current.getCanvas()
    if (!canvas) { setState('capture'); return }

    // Apply CSS filter to canvas
    const filterDef = FILTERS.find(f => f.id === filter)
    const filteredCanvas = document.createElement('canvas')
    filteredCanvas.width = canvas.width
    filteredCanvas.height = canvas.height
    const ctx = filteredCanvas.getContext('2d')
    ctx.filter = filterDef?.css || 'none'
    ctx.drawImage(canvas, 0, 0)

    filteredCanvas.toBlob(async (blob) => {
      if (!blob || blob.size < 20000) {
        alert('Image trop petite ou illisible. Veuillez reprendre la photo.')
        setState('capture')
        return
      }

      const fd = new FormData()
      fd.append('nom_document', currentDoc.nom_document)
      fd.append('file', blob, `${currentDoc.nom_document}.jpg`)

      try {
        await axios.post(`${API_URL}/upload/${token}/fichier`, fd, {
          onUploadProgress: (e) => {
            if (e.total) setUploadProgress(Math.round(e.loaded / e.total * 100))
          },
        })
        setDoneDoc(currentDoc.nom_document)
        setState('done')

        // Update local doc list
        setDocs(prev => prev.map(d => d.nom_document === currentDoc.nom_document ? { ...d, statut: 'recu' } : d))

        // Auto return after 2s
        setTimeout(() => {
          const remaining = docs.filter(d => d.nom_document !== currentDoc.nom_document && d.statut === 'manquant')
          setState(remaining.length === 0 ? 'allDone' : 'main')
          setCurrentDoc(null)
          setImageUrl(null)
          setDoneDoc(null)
        }, 2000)
      } catch {
        alert('Erreur lors de l\'envoi. Réessayez.')
        setState('capture')
      }
    }, 'image/jpeg', 0.82)
  }

  // Loading
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4">
        <img src="/logo-notia.jpg" alt="Notia" className="h-12 w-auto mb-4" />
        <Loader2 size={24} className="text-muted animate-spin mb-2" />
        <p className="text-sm text-muted">Vérification du lien...</p>
      </div>
    )
  }

  // Error
  if (state === 'error') {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 text-center">
        <AlertCircle size={56} className="text-red-400 mb-4" />
        <p className="text-lg font-semibold text-navy mb-2">Lien invalide</p>
        <p className="text-sm text-muted max-w-xs">{errorMsg}</p>
        <p className="text-xs text-muted mt-4">Contactez votre étude notariale pour obtenir un nouveau lien.</p>
      </div>
    )
  }

  // All done
  if (state === 'allDone') {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <Check size={40} className="text-green-600" />
        </div>
        <p className="text-xl font-display font-bold text-navy mb-2">Tous vos documents ont été transmis</p>
        <p className="text-sm text-muted max-w-xs">
          L'étude {info?.cabinet?.nom || ''} a bien reçu l'ensemble de vos documents.
          Vous serez contacté prochainement.
        </p>
      </div>
    )
  }

  // Single doc done confirmation
  if (state === 'done') {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <Check size={32} className="text-green-600" />
        </div>
        <p className="text-lg font-semibold text-navy mb-1">Document reçu avec succès</p>
        <p className="text-sm text-muted">{doneDoc}</p>
      </div>
    )
  }

  // Uploading
  if (state === 'uploading') {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 text-center">
        <Upload size={40} className="text-gold mb-4 animate-bounce" />
        <p className="text-lg font-semibold text-navy mb-3">Envoi en cours...</p>
        <div className="w-48 h-2 bg-border rounded-full overflow-hidden">
          <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
        </div>
        <p className="text-xs text-muted mt-2">{uploadProgress}%</p>
      </div>
    )
  }

  // Capture flow
  if (state === 'capture' && currentDoc) {
    return (
      <div className="min-h-screen bg-white px-4 py-6">
        <div className="max-w-md mx-auto">
          <p className="text-sm font-semibold text-navy mb-4">{currentDoc.nom_document}</p>

          {!imageUrl ? (
            // Step A: Choose source
            <div className="space-y-4">
              <p className="text-sm text-muted">Comment voulez-vous l'envoyer ?</p>
              <button onClick={() => cameraInputRef.current?.click()} className="w-full flex items-center justify-center gap-3 bg-navy text-white py-4 rounded-xl text-base font-semibold">
                <Camera size={22} /> Prendre une photo
              </button>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />

              <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-3 bg-surface border border-border text-navy py-4 rounded-xl text-base font-semibold">
                <ImageIcon size={22} /> Choisir dans la galerie
              </button>
              <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileSelect} />

              <div className="bg-gold/5 border border-gold/20 rounded-lg p-3">
                <p className="text-xs text-muted">💡 Document posé à plat, bonne lumière, tous les coins visibles</p>
              </div>

              <button onClick={() => setState('main')} className="text-sm text-muted hover:underline w-full text-center mt-4">Annuler</button>
            </div>
          ) : (
            // Step B: Crop + Filter
            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden border border-border" style={{ height: 280 }}>
                <Cropper ref={cropperRef} src={imageUrl} className="h-full" style={{ filter: FILTERS.find(f => f.id === filter)?.css || 'none' }} />
              </div>

              <div className="flex gap-2">
                {FILTERS.map(f => (
                  <button key={f.id} onClick={() => setFilter(f.id)} className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${filter === f.id ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted'}`}>
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setImageUrl(null)} className="flex-1 flex items-center justify-center gap-2 bg-surface border border-border text-navy py-3 rounded-xl font-medium">
                  <RotateCcw size={16} /> Reprendre
                </button>
                <button onClick={submitUpload} className="flex-1 flex items-center justify-center gap-2 bg-gold text-white py-3 rounded-xl font-semibold">
                  <Check size={16} /> Envoyer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Main list
  const pending = docs.filter(d => d.statut === 'manquant')
  const received = docs.filter(d => d.statut !== 'manquant')
  const progress = docs.length ? Math.round(received.length / docs.length * 100) : 0

  return (
    <div className="min-h-screen bg-surface px-4 py-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <img src="/logo-notia.jpg" alt="Notia" className="h-10 w-auto mx-auto" />
          {info?.cabinet?.nom && <p className="text-sm text-muted mt-1">{info.cabinet.nom}</p>}
          <p className="text-navy font-medium mt-1">Documents à transmettre</p>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-muted mb-1">
            <span>{received.length} document{received.length > 1 ? 's' : ''} reçu{received.length > 1 ? 's' : ''} sur {docs.length}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2.5 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Document list */}
        <div className="space-y-3">
          {docs.map(d => {
            const isReceived = d.statut !== 'manquant'
            const isRejected = d.statut === 'rejete'
            return (
              <div key={d.nom_document} className={`p-4 rounded-xl border ${isReceived ? 'bg-green-50/50 border-green-200' : isRejected ? 'bg-red-50/50 border-red-200' : 'bg-white border-border'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{isReceived ? '✅' : isRejected ? '❌' : '📄'}</span>
                    <div>
                      <p className={`text-sm font-medium ${isReceived ? 'text-green-700' : 'text-navy'}`}>{d.nom_document}</p>
                      {isReceived && <p className="text-xs text-green-600">Reçu — merci</p>}
                      {isRejected && <p className="text-xs text-red-500">Veuillez renvoyer ce document</p>}
                    </div>
                  </div>
                  {!isReceived && (
                    <button onClick={() => startCapture(d)} className="bg-navy text-white text-xs font-semibold py-2 px-4 rounded-lg flex items-center gap-1.5">
                      <Camera size={14} /> Envoyer
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
