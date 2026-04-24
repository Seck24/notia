import { Navigate } from 'react-router-dom'
import useAuthStore from '../../stores/authStore'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted">Chargement...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}
