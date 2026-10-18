import { useEffect, useState } from 'react'
import { api } from '../api'

function SkillList({ title, items }) {
  if (!items?.length) return null
  return (
    <div>
      <h4 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h4>
      <ul className="space-y-1 text-sm">
        {items.map((s, i) => (
          <li key={i} className={s.matched ? 'text-green-300' : 'text-red-300'}>
            {s.matched ? '✓' : '✗'} {s.requirement}
          </li>
        ))}
      </ul>
    </div>
  )
}

function BigNumber({ label, value, suffix }) {
  const color = value >= 75 ? 'text-green-400' : value >= 50 ? 'text-yellow-400' : 'text-red-400'
  return (
    <div className="text-center">
      <div className={`text-5xl font-bold ${color}`}>
        {value}
        {suffix}
      </div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  )
}

function MatchResult({ match }) {
  const missingKeywords = match.result.keywords.filter((k) => !k.matched).map((k) => k.requirement)

  return (
    <div className="mt-5 space-y-5 rounded-lg bg-slate-900 p-5">
      <div className="flex gap-10">
        <BigNumber label="Estimated match" value={match.match_percentage} suffix="%" />
        <BigNumber label="ATS-style score / 100" value={match.ats_score} suffix="" />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <SkillList title="Required skills" items={match.result.required} />
        <SkillList title="Preferred skills" items={match.result.preferred} />
      </div>

      {missingKeywords.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Missing keywords
          </h4>
          <div className="flex flex-wrap gap-2">
            {missingKeywords.map((k, i) => (
              <span key={i} className="rounded-full bg-red-900/50 px-3 py-1 text-xs text-red-200">
                {k}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Score breakdown
        </h4>
        <div className="space-y-3">
          {match.result.components.map((c) => (
            <div key={c.name}>
              <div className="flex justify-between text-xs text-slate-300">
                <span>{c.name}</span>
                <span>
                  {c.score} / {c.max_score}
                </span>
              </div>
              <div className="h-2 rounded bg-slate-700">
                <div
                  className="h-2 rounded bg-indigo-500"
                  style={{ width: `${(c.score / c.max_score) * 100}%` }}
                />
              </div>
              <p className="text-xs text-slate-500">{c.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {match.advice ? (
        <div>
          <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Recommendations
          </h4>
          <p className="mb-2 text-sm text-slate-200">{match.advice.summary}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
            {match.advice.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-slate-400">
          Written recommendations are unavailable right now. Run the match again to retry.
        </p>
      )}

      <p className="text-xs text-slate-500">
        Estimated, project-specific scores calculated from skill and keyword overlap. They are
        not how any real applicant tracking system scores resumes.
      </p>
    </div>
  )
}

export default function MatchSection() {
  const [resumes, setResumes] = useState([])
  const [jobs, setJobs] = useState([])
  const [resumeId, setResumeId] = useState('')
  const [jobId, setJobId] = useState('')
  const [match, setMatch] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function loadLists() {
    try {
      const [r, j] = await Promise.all([api('/resumes'), api('/jobs')])
      setResumes(r)
      setJobs(j)
      setResumeId((cur) => cur || (r[0] ? String(r[0].id) : ''))
      setJobId((cur) => cur || (j[0] ? String(j[0].id) : ''))
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    loadLists()
  }, [])

  async function run(force = false) {
    setError('')
    setBusy(true)
    try {
      setMatch(
        await api('/matches', {
          method: 'POST',
          body: { resume_id: Number(resumeId), job_id: Number(jobId), force },
        }),
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const select = 'rounded bg-slate-700 p-2 text-sm'

  return (
    <section className="mt-8 rounded-xl bg-slate-800 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Match a resume to a job</h2>
        <button onClick={loadLists} className="text-sm text-slate-400 hover:text-slate-200">
          Refresh lists
        </button>
      </div>

      <p className="mt-1 text-sm text-slate-400">
        Analyze the resume and the job first, then run the match.
      </p>

      {error && <p className="mt-3 rounded bg-red-900/50 p-2 text-sm text-red-200">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select className={select} value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
          {resumes.length === 0 && <option value="">No resumes</option>}
          {resumes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.filename}
            </option>
          ))}
        </select>
        <select className={select} value={jobId} onChange={(e) => setJobId(e.target.value)}>
          {jobs.length === 0 && <option value="">No jobs</option>}
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </select>
        <button
          onClick={() => run(false)}
          disabled={busy || !resumeId || !jobId}
          className="rounded bg-indigo-600 px-4 py-2 font-semibold hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? 'Matching...' : 'Run match'}
        </button>
        {match && (
          <button
            onClick={() => run(true)}
            disabled={busy}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            Recalculate
          </button>
        )}
      </div>

      {match && <MatchResult match={match} />}
    </section>
  )
}