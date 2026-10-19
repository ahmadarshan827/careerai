import { useEffect, useState } from 'react'
import { api } from '../api'

export default function RoadmapView({ matchId }) {
  const [roadmap, setRoadmap] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // If a roadmap already exists for this match, show it
  useEffect(() => {
    api('/roadmaps')
      .then((list) => setRoadmap(list.find((r) => r.match_id === matchId) || null))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [matchId])

  async function generate(force = false) {
    if (force && !window.confirm('Regenerating resets your progress. Continue?')) return
    setError('')
    setBusy(true)
    try {
      setRoadmap(
        await api('/roadmaps', {
          method: 'POST',
          body: { match_id: matchId, weeks: 4, force },
        }),
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function toggle(step) {
    setError('')
    try {
      setRoadmap(
        await api(`/roadmaps/${roadmap.id}/steps/${step.id}`, {
          method: 'PATCH',
          body: { completed: !step.completed },
        }),
      )
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return null

  return (
    <div className="border-t border-slate-700 pt-5">
      <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Learning roadmap
      </h4>

      {error && <p className="mb-3 rounded bg-red-900/50 p-2 text-sm text-red-200">{error}</p>}

      {!roadmap ? (
        <button
          onClick={() => generate(false)}
          disabled={busy}
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? 'Generating roadmap...' : 'Generate learning roadmap'}
        </button>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="font-semibold">{roadmap.title}</p>
            <p className="mt-1 text-sm text-slate-300">{roadmap.summary}</p>
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300">
              <span>Progress</span>
              <span>{roadmap.progress}%</span>
            </div>
            <div className="h-2 rounded bg-slate-700">
              <div
                className="h-2 rounded bg-green-500 transition-all"
                style={{ width: `${roadmap.progress}%` }}
              />
            </div>
          </div>

          {roadmap.steps.map((s) => (
            <div key={s.id} className="rounded bg-slate-800 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={s.completed}
                  onChange={() => toggle(s)}
                  className="mt-1"
                />
                <span>
                  <span className="font-semibold">
                    Week {s.week}: {s.focus}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-2">
                    {s.skills.map((sk, i) => (
                      <span key={i} className="rounded-full bg-indigo-700 px-2 py-0.5 text-xs">
                        {sk}
                      </span>
                    ))}
                  </span>
                </span>
              </label>
              <ul className="mt-2 list-disc space-y-1 pl-9 text-sm text-slate-300">
                {s.tasks.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          ))}

          {roadmap.final_project && (
            <p className="text-sm text-slate-300">
              <span className="font-semibold text-slate-200">Final project: </span>
              {roadmap.final_project}
            </p>
          )}

          <button
            onClick={() => generate(true)}
            disabled={busy}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            {busy ? 'Regenerating...' : 'Regenerate roadmap'}
          </button>
        </div>
      )}
    </div>
  )
}