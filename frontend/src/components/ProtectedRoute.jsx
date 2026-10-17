import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <p className="p-8 text-slate-300">Loading...</p>
  return user ? children : <Navigate to="/login" replace />
}