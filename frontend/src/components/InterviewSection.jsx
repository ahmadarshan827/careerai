import { useEffect, useState } from 'react'
import { api } from '../api'

const DIMENSIONS = [
  ['relevance', 'Relevance'],
  ['technical_correctness', 'Technical correctness'],
  ['clarity', 'Clarity'],
  ['completeness', 'Completeness'],
  ['communication', 'Communication'],
]

const scoreColor = (s) =>
  s >= 75 ? 'text-green-400' : s >= 50 ? 'text-yellow-400' : 'text-red-400'

function categoryAverages(questions) {
  const groups = {}
  questions.forEach((q) => {
    if (q.score != null) (groups[q.category] ||= []).push(q.score)
  })
  return Object.entries(groups).map(([category, scores]) => [
    category,
    Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
  ])
}

function Feedback({ question }) {
  const f = question.feedback
  if (!f) return null
  return (
    <div className="mt-3 space-y-4 rounded-lg bg-slate-900 p-4">
      <div className="flex items-center gap-4">
        <div className={`text-4xl font-bold ${scoreColor(question.score)}`}>{question.score}</div>
        <div className="text-xs text-slate-400">Score for this answer / 100</div>
      </div>

      <div className="space-y-2">
        {DIMENSIONS.map(([key, label]) => (
          <div key={key}>
            <div className="flex justify-between text-xs text-slate-300">
              <span>{label}</span>
              <span>{f[key]} / 10</span>
            </div>
            <div className="h-1.5 rounded bg-slate-700">
              <div className="h-1.5 rounded bg-indigo-500" style={{ width: `${f[key] * 10}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {f.strengths.length > 0 && (
          <div>
            <h5 className="mb-1 text-xs font-semibold uppercase text-slate-400">What worked</h5>
            <ul className="list-disc space-y-1 pl-5 text-sm text-green-200">
              {f.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        {f.improvements.length > 0 && (
          <div>
            <h5 className="mb-1 text-xs font-semibold uppercase text-slate-400">To improve</h5>
            <ul className="list-disc space-y-1 pl-5 text-sm text-yellow-200">
              {f.improvements.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <h5 className="mb-1 text-xs font-semibold uppercase text-slate-400">
          A stronger version (a template, not your experience)
        </h5>
        <p className="text-sm text-slate-300">{f.improved_answer}</p>
      </div>
    </div>
  )
}

export default function InterviewSection() {
  const [resumes, setResumes] = useState([])
  const [jobs, setJobs] = useState([])
  const [history, setHistory] = useState([])
  const [resumeId, setResumeId] = useState('')
  const [jobId, setJobId] = useState('')
  const [difficulty, setDifficulty] = useState('medium')
  const [count, setCount] = useState(5)
  const [active, setActive] = useState(null)
  const [answer, setAnswer] = useState('')
  const [lastAnsweredId, setLastAnsweredId] = useState(null)
  const [busy, setBusy] = useState(null) // null | 'starting' | 'submitting'
  const [error, setError] = useState('')

  const refreshHistory = () =>
    api('/interviews').then(setHistory).catch((err) => setError(err.message))

  async function loadAll() {
    try {
      const [r, j, h] = await Promise.all([api('/resumes'), api('/jobs'), api('/interviews')])
      setResumes(r)
      setJobs(j)
      setHistory(h)
      setResumeId((cur) => cur || (r[0] ? String(r[0].id) : ''))
      setJobId((cur) => cur || (j[0] ? String(j[0].id) : ''))
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function open(id) {
    setError('')
    try {
      setActive(await api(`/interviews/${id}`))
      setAnswer('')
      setLastAnsweredId(null)
    } catch (err) {
      setError(err.message)
    }
  }

  async function start() {
    setError('')
    setBusy('starting')
    try {
      const detail = await api('/interviews', {
        method: 'POST',
        body: {
          resume_id: Number(resumeId),
          job_id: Number(jobId),
          difficulty,
          num_questions: Number(count),
        },
      })
      setActive(detail)
      setAnswer('')
      setLastAnsweredId(null)
      refreshHistory()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  async function submit(e) {
    e.preventDefault()
    const current = active.questions.find((q) => q.answer === null)
    if (!current || !answer.trim()) return
    setError('')
    setBusy('submitting')
    try {
      const detail = await api(`/interviews/${active.id}/questions/${current.id}/answer`, {
        method: 'POST',
        body: { answer },
      })
      setActive(detail)
      setLastAnsweredId(current.id)
      setAnswer('')
      refreshHistory()
    } catch (err) {
      setError(err.message) // the typed answer stays in the box so it can be resubmitted
      if (err.status === 409) open(active.id) // already answered: reload the real state
    } finally {
      setBusy(null)
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this interview and its feedback?')) return
    try {
      await api(`/interviews/${id}`, { method: 'DELETE' })
      if (active?.id === id) setActive(null)
      refreshHistory()
    } catch (err) {
      setError(err.message)
    }
  }

  const select = 'rounded bg-slate-700 p-2 text-sm'
  const current = active?.questions.find((q) => q.answer === null)
  const answered = active?.questions.filter((q) => q.answer !== null) ?? []
  const lastAnswered = answered.find((q) => q.id === lastAnsweredId)
  const earlier = answered.filter((q) => q.id !== lastAnsweredId)

  return (
    <section className="mt-8 rounded-xl bg-slate-800 p-6">
      <h2 className="text-xl font-semibold">Mock interview</h2>
      <p className="mt-1 text-sm text-slate-400">
        Questions are generated from your analyzed resume and an analyzed job description.
      </p>

      {error && <p className="mt-3 rounded bg-red-900/50 p-2 text-sm text-red-200">{error}</p>}

      {!active && (
        <>
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
            <select className={select} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <select className={select} value={count} onChange={(e) => setCount(e.target.value)}>
              {[3, 5, 7, 10].map((n) => (
                <option key={n} value={n}>
                  {n} questions
                </option>
              ))}
            </select>
            <button
              onClick={start}
              disabled={busy !== null || !resumeId || !jobId}
              className="rounded bg-indigo-600 px-4 py-2 font-semibold hover:bg-indigo-500 disabled:opacity-50"
            >
              {busy === 'starting' ? 'Preparing questions...' : 'Start interview'}
            </button>
            <button onClick={loadAll} className="text-sm text-slate-400 hover:text-slate-200">
              Refresh lists
            </button>
          </div>

          <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Past interviews
          </h3>
          <ul className="mt-2 space-y-2">
            {history.length === 0 && <li className="text-slate-400">No interviews yet.</li>}
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between rounded bg-slate-700 p-3">
                <span className="text-sm">
                  {h.title}
                  <span className="ml-2 text-slate-400">
                    {h.difficulty} · {new Date(h.created_at).toLocaleDateString()}
                  </span>
                </span>
                <span className="flex items-center gap-4">
                  {h.status === 'completed' ? (
                    <span className={`font-semibold ${scoreColor(h.overall_score)}`}>
                      {h.overall_score}/100
                    </span>
                  ) : (
                    <span className="text-xs text-yellow-300">in progress</span>
                  )}
                  <button
                    onClick={() => open(h.id)}
                    className="text-sm text-indigo-300 hover:text-indigo-200"
                  >
                    {h.status === 'completed' ? 'Review' : 'Resume'}
                  </button>
                  <button
                    onClick={() => remove(h.id)}
                    className="text-sm text-red-300 hover:text-red-200"
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {active && (
        <div className="mt-4 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{active.title}</p>
              <p className="text-xs text-slate-400">
                {active.difficulty} · {active.answered_count} of {active.questions.length} answered
              </p>
            </div>
            <button
              onClick={() => {
                setActive(null)
                refreshHistory()
              }}
              className="text-sm text-slate-400 hover:text-slate-200"
            >
              Back to interviews
            </button>
          </div>

          {lastAnswered && (
            <div>
              <h4 className="text-sm font-semibold text-slate-300">Feedback on your last answer</h4>
              <p className="mt-1 text-sm text-slate-400">{lastAnswered.question}</p>
              <Feedback question={lastAnswered} />
            </div>
          )}

          {current && (
            <form onSubmit={submit} className="space-y-3 rounded-lg bg-slate-700 p-4">
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <span>
                  Question {current.position} of {active.questions.length}
                </span>
                <span className="rounded-full bg-indigo-700 px-2 py-0.5">{current.category}</span>
              </div>
              <p className="text-lg">{current.question}</p>
              <textarea
                className="h-40 w-full rounded bg-slate-800 p-3 text-sm"
                placeholder="Type your answer as you would say it in an interview..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                maxLength={4000}
                required
              />
              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={busy !== null || !answer.trim()}
                  className="rounded bg-indigo-600 px-4 py-2 font-semibold hover:bg-indigo-500 disabled:opacity-50"
                >
                  {busy === 'submitting' ? 'Evaluating...' : 'Submit answer'}
                </button>
                <span className="text-xs text-slate-400">{answer.length} / 4000</span>
              </div>
            </form>
          )}

          {active.status === 'completed' && (
            <div className="rounded-lg bg-slate-900 p-5">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className={`text-5xl font-bold ${scoreColor(active.overall_score)}`}>
                    {active.overall_score}
                  </div>
                  <div className="text-xs text-slate-400">Overall interview score / 100</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {categoryAverages(active.questions).map(([category, score]) => (
                    <span key={category} className="rounded-full bg-slate-700 px-3 py-1 text-xs">
                      {category}: {score}
                    </span>
                  ))}
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Scores are AI-generated estimates for practice, not a prediction of real interview
                results.
              </p>
            </div>
          )}

          {earlier.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-300">Answered questions</h4>
              {earlier.map((q) => (
                <details key={q.id} className="rounded bg-slate-700 p-3">
                  <summary className="cursor-pointer text-sm">
                    <span className={`mr-2 font-semibold ${scoreColor(q.score)}`}>{q.score}</span>
                    {q.question}
                  </summary>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">
                    <span className="font-semibold text-slate-200">Your answer: </span>
                    {q.answer}
                  </p>
                  <Feedback question={q} />
                </details>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}