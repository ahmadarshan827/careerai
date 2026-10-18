import { useEffect, useState } from 'react'
import { api } from '../api'

const EMPTY_FORM = { title: '', company: '', raw_text: '' }

function Chips({ title, items, tone }) {
  if (!items?.length) return null
  return (
    <div className="mt-3">
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h4>
      <div className="flex flex-wrap gap-2">
        {items.map((s, i) => (
          <span key={i} className={`rounded-full px-3 py-1 text-xs ${tone}`}>
            {s}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function JobSection() {
  const [jobs, setJobs] = useState([])
  const [analyses, setAnalyses] = useState({})
  const [openId, setOpenId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => api('/jobs').then(setJobs).catch((err) => setError(err.message))

  useEffect(() => {
    load()
  }, [])

  async function analyze(id) {
    if (analyses[id]) {
      setOpenId(openId === id ? null : id)
      return
    }
    setError('')
    setBusyId(id)
    try {
      const detail = await api(`/jobs/${id}/analyze`, { method: 'POST' })
      setAnalyses((prev) => ({ ...prev, [id]: detail.analysis }))
      setOpenId(id)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const job = await api('/jobs', {
        method: 'POST',
        body: { title: form.title, company: form.company || null, raw_text: form.raw_text },
      })
      setForm(EMPTY_FORM)
      await load()
      await analyze(job.id) // handles its own errors; the job stays saved if the AI fails
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    try {
      await api(`/jobs/${id}`, { method: 'DELETE' })
      if (openId === id) setOpenId(null)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const input = 'w-full rounded bg-slate-700 p-2 text-sm'

  return (
    <section className="mt-8 rounded-xl bg-slate-800 p-6">
      <h2 className="text-xl font-semibold">Job descriptions</h2>

      {error && <p className="mt-3 rounded bg-red-900/50 p-2 text-sm text-red-200">{error}</p>}

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className={input}
            placeholder="Job title (e.g. Backend Developer Intern)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            maxLength={200}
          />
          <input
            className={input}
            placeholder="Company (optional)"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            maxLength={200}
          />
        </div>
        <textarea
          className={`${input} h-40`}
          placeholder="Paste the full job description here (at least 100 characters)"
          value={form.raw_text}
          onChange={(e) => setForm({ ...form, raw_text: e.target.value })}
          required
          minLength={100}
          maxLength={20000}
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-indigo-600 px-4 py-2 font-semibold hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? 'Saving and analyzing...' : 'Save and analyze'}
        </button>
      </form>

      <ul className="mt-5 space-y-3">
        {jobs.length === 0 && <li className="text-slate-400">No job descriptions yet.</li>}
        {jobs.map((j) => (
          <li key={j.id} className="rounded bg-slate-700 p-3">
            <div className="flex items-center justify-between">
              <span>
                {j.title}
                {j.company && <span className="ml-2 text-sm text-slate-400">at {j.company}</span>}
              </span>
              <span className="flex gap-4">
                <button
                  onClick={() => analyze(j.id)}
                  disabled={busyId === j.id}
                  className="text-sm text-indigo-300 hover:text-indigo-200 disabled:opacity-50"
                >
                  {busyId === j.id ? 'Analyzing...' : openId === j.id ? 'Hide' : 'View requirements'}
                </button>
                <button
                  onClick={() => handleDelete(j.id)}
                  className="text-sm text-red-300 hover:text-red-200"
                >
                  Delete
                </button>
              </span>
            </div>
            {openId === j.id && analyses[j.id] && (
              <div className="mt-3 rounded-lg bg-slate-900 p-4">
                <p className="text-sm text-slate-200">{analyses[j.id].summary}</p>
                <Chips title="Required" items={analyses[j.id].required_skills} tone="bg-indigo-700" />
                <Chips title="Preferred" items={analyses[j.id].preferred_skills} tone="bg-slate-600" />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}