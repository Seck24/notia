import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import useAuthStore from './stores/authStore'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/layout/ProtectedRoute'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import Onboarding from './pages/onboarding/Onboarding'
import Dashboard from './pages/Dashboard'
import ListeDossiers from './pages/dossiers/ListeDossiers'
import NouveauDossier from './pages/dossiers/NouveauDossier'
import DetailDossier from './pages/dossiers/DetailDossier'
import UploadClient from './pages/upload/UploadClient'
import Configuration from './pages/Configuration'

export default function App() {
  const { initialize } = useAuthStore()
  useEffect(() => { initialize() }, [])

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/upload/:token" element={<UploadClient />} />

        {/* Protected: Onboarding (no sidebar) */}
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

        {/* Protected: App with sidebar */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dossiers" element={<ListeDossiers />} />
          <Route path="/dossiers/nouveau" element={<NouveauDossier />} />
          <Route path="/dossiers/:id" element={<DetailDossier />} />
          <Route path="/configuration" element={<Configuration />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
