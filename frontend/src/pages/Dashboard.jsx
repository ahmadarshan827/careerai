import { useAuth } from '../auth/AuthContext'
import ResumeSection from '../components/ResumeSection'
import JobSection from '../components/JobSection'
import MatchSection from '../components/MatchSection'

export default function Dashboard() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-slate-900 p-8 text-white">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">CareerAI Dashboard</h1>
        <button onClick={logout} className="rounded bg-slate-700 px-4 py-2 hover:bg-slate-600">
          Log out
        </button>
      </div>
      <p className="mt-6 text-slate-300">Welcome, {user.name} ({user.email})</p>

      <ResumeSection />
      <JobSection />
      <MatchSection />
    </div>
  )
}