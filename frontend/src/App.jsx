import { useEffect, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL

export default function App() {
  const [status, setStatus] = useState('checking...')

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((res) => {
        if (!res.ok) throw new Error('unhealthy')
        return res.json()
      })
      .then((data) => setStatus(`${data.status} (database: ${data.database})`))
      .catch(() => setStatus('backend unreachable'))
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
      <h1 className="text-4xl font-bold">CareerAI</h1>
      <p className="mt-4 text-slate-300">API status: {status}</p>
    </div>
  )
}