function Section({ title, items }) {
  if (!items?.length) return null
  return (
    <div>
      <h4 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h4>
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function Chips({ title, items }) {
  if (!items?.length) return null
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h4>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span key={i} className="rounded-full bg-slate-600 px-3 py-1 text-xs">
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function AnalysisPanel({ analysis }) {
  const score = analysis.resume_score
  const color = score >= 75 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="mt-3 space-y-5 rounded-lg bg-slate-900 p-5">
      <div className="flex items-start gap-5">
        <div className="text-center">
          <div className={`text-5xl font-bold ${color}`}>{score}</div>
          <div className="text-xs text-slate-400">Resume score / 100</div>
        </div>
        <div>
          <p className="text-sm text-slate-200">{analysis.summary}</p>
          <p className="mt-2 text-xs text-slate-400">{analysis.score_reasoning}</p>
        </div>
      </div>

      <Chips title="Technical skills" items={analysis.technical_skills} />
      <Chips title="Soft skills" items={analysis.soft_skills} />

      <div className="grid gap-5 md:grid-cols-2">
        <Section title="Strengths" items={analysis.strengths} />
        <Section title="Weaknesses" items={analysis.weaknesses} />
        <Section title="Missing information" items={analysis.missing_information} />
        <Section title="Suggestions" items={analysis.improvement_suggestions} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Section title="Education" items={analysis.education} />
        <Section title="Experience" items={analysis.experience} />
        <Section title="Projects" items={analysis.projects} />
        <Section title="Certifications" items={analysis.certifications} />
      </div>

      <p className="text-xs text-slate-500">
        AI-generated estimate. It can contain mistakes, so check it against your resume.
      </p>
    </div>
  )
}