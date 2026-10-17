import { useEffect, useState } from 'react'
import { api } from '../api'
import AnalysisPanel from './AnalysisPanel'

export default function ResumeSection() {
  const [resumes, setResumes] = useState([])
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [analyses, setAnalyses] = useState({})
  const [openId, setOpenId] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = () =>
    api('/resumes').then(setResumes).catch((err) => setError(err.message))

  useEffect(() => {
    load()
  }, [])

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setError('')
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      await api('/resumes', { method: 'POST', formData })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleAnalyze(id) {
    if (analyses[id]) {
      setOpenId(openId === id ? null : id) // already loaded: just toggle
      return
    }
    setError('')
    setBusyId(id)
    try {
      const detail = await api(`/resumes/${id}/analyze`, { method: 'POST' })
      setAnalyses((prev) => ({ ...prev, [id]: detail.analysis }))
      setOpenId(id)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(id) {
    try {
      await api(`/resumes/${id}`, { method: 'DELETE' })
      if (openId === id) setOpenId(null)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="mt-8 rounded-xl bg-slate-800 p-6">
      <h2 className="text-xl font-semibold">Your resumes</h2>

      {error && <p className="mt-3 rounded bg-red-900/50 p-2 text-sm text-red-200">{error}</p>}

      <label className="mt-4 inline-block cursor-pointer rounded bg-indigo-600 px-4 py-2 font-semibold hover:bg-indigo-500">
        {uploading ? 'Uploading...' : 'Upload PDF'}
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFile}
          disabled={uploading}
          className="hidden"
        />
      </label>

      <ul className="mt-4 space-y-3">
        {resumes.length === 0 && <li className="text-slate-400">No resumes yet.</li>}
        {resumes.map((r) => (
          <li key={r.id} className="rounded bg-slate-700 p-3">
            <div className="flex items-center justify-between">
              <span>
                {r.filename}
                <span className="ml-3 text-sm text-slate-400">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </span>
              <span className="flex gap-4">
                <button
                  onClick={() => handleAnalyze(r.id)}
                  disabled={busyId === r.id}
                  className="text-sm text-indigo-300 hover:text-indigo-200 disabled:opacity-50"
                >
                  {busyId === r.id
                    ? 'Analyzing...'
                    : openId === r.id
                      ? 'Hide analysis'
                      : 'Analyze'}
                </button>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="text-sm text-red-300 hover:text-red-200"
                >
                  Delete
                </button>
              </span>
            </div>
            {openId === r.id && analyses[r.id] && <AnalysisPanel analysis={analyses[r.id]} />}
          </li>
        ))}
      </ul>
    </section>
  )
}