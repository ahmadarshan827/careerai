import re

ALIASES = {
    "reactjs": "react", "react.js": "react",
    "node": "nodejs", "node.js": "nodejs",
    "expressjs": "express", "express.js": "express",
    "postgres": "postgresql",
    "mongo": "mongodb",
    "js": "javascript", "ts": "typescript",
    "k8s": "kubernetes",
    "rest apis": "rest api", "restful api": "rest api", "restful apis": "rest api",
    "amazon web services": "aws",
    "gcp": "google cloud", "google cloud platform": "google cloud",
    "dsa": "data structures and algorithms",
    "data structures": "data structures and algorithms",
    "ml": "machine learning",
    "oops": "oop", "object oriented programming": "oop",
    "object-oriented programming": "oop",
    "cpp": "c++",
}

NOISE_PREFIXES = (
    "strong ", "good ", "solid ", "basic ", "hands-on ", "any ",
    "knowledge of ", "experience with ", "experience in ", "familiarity with ",
    "understanding of ", "proficiency in ", "building ", "developing ",
    "writing ", "using ",
)

SECTION_PATTERNS = {
    "education": r"^\W*education\b",
    "experience": r"^\W*(?:work\s+)?experience\b|^\W*internships?\b|^\W*employment\b",
    "projects": r"^\W*(?:personal\s+)?projects?\b",
    "skills": r"^\W*(?:technical\s+)?skills?\b",
}

# (name, max points)
WEIGHTS = {
    "Required skills": 40,
    "Preferred skills": 10,
    "Keywords": 20,
    "Resume structure": 15,
    "Resume quality": 15,
}

GENERIC_KEYWORDS = {
    "intern", "internship", "platform", "team", "developer", "engineer",
    "backend developer", "software engineer", "software developer",
}


def _strip_prefixes(s: str) -> str:
    changed = True
    while changed:
        changed = False
        for prefix in NOISE_PREFIXES:
            if s.startswith(prefix):
                s = s[len(prefix):]
                changed = True
    return s


def normalize_skill(raw: str) -> str:
    s = raw.lower().replace("ci/cd", "cicd").strip().strip(".,;:")
    s = _strip_prefixes(s)
    s = re.sub(r"\s+platforms?$", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return ALIASES.get(s, s)


def alternatives(raw: str) -> list[str]:
    """'FastAPI or Flask' -> ['fastapi', 'flask']: matching any one satisfies it."""
    s = raw.lower().replace("ci/cd", "cicd")
    parts = re.split(r"\s+or\s+|/|,", s)
    return [a for a in (normalize_skill(p) for p in parts) if a]


def _variants(canonical: str) -> set[str]:
    return {canonical} | {a for a, c in ALIASES.items() if c == canonical}


def _in_text(phrase: str, text: str) -> bool:
    pattern = rf"(?<![a-z0-9+#]){re.escape(phrase)}(?![a-z0-9+#])"
    return re.search(pattern, text) is not None


def match_requirement(raw: str, resume_skills: set[str], text: str) -> str | None:
    for alt in alternatives(raw):
        if alt in resume_skills:
            return alt
        # very short terms (c, r, go, js) are too ambiguous to search for in free text
        if any(len(v) > 2 and _in_text(v, text) for v in _variants(alt)):
            return alt
    return None


def _check(items: list[str], skills: set[str], text: str) -> list[dict]:
    results = []
    for item in dict.fromkeys(items):  # dedupe, keep order
        hit = match_requirement(item, skills, text)
        results.append({"requirement": item, "matched": hit is not None, "matched_by": hit})
    return results


def _ratio(results: list[dict]) -> float:
    return sum(r["matched"] for r in results) / len(results) if results else 0.0


def compute_match(
    resume_text: str, resume_skills: list[str], resume_score: int, job: dict
) -> dict:
    text = resume_text.lower()
    skills = {normalize_skill(s) for s in resume_skills}

    required = _check(job.get("required_skills", []), skills, text)
    preferred = _check(job.get("preferred_skills", []), skills, text)
    keywords = _check(
        [k for k in job.get("keywords", []) if k.lower() not in GENERIC_KEYWORDS],
        skills,
        text,
    )

    req_hits = sum(r["matched"] for r in required)
    pref_hits = sum(r["matched"] for r in preferred)
    denominator = 2 * len(required) + len(preferred)
    match_percentage = round(100 * (2 * req_hits + pref_hits) / denominator) if denominator else 0

    sections = [
        name for name, pat in SECTION_PATTERNS.items()
        if re.search(pat, text, re.MULTILINE)
    ]

    components = [
        {
            "name": "Required skills",
            "score": round(WEIGHTS["Required skills"] * _ratio(required), 1),
            "max_score": WEIGHTS["Required skills"],
            "detail": f"{req_hits} of {len(required)} required skills found",
        },
        {
            "name": "Preferred skills",
            "score": round(WEIGHTS["Preferred skills"] * _ratio(preferred), 1),
            "max_score": WEIGHTS["Preferred skills"],
            "detail": f"{pref_hits} of {len(preferred)} preferred skills found",
        },
        {
            "name": "Keywords",
            "score": round(WEIGHTS["Keywords"] * _ratio(keywords), 1),
            "max_score": WEIGHTS["Keywords"],
            "detail": f"{sum(k['matched'] for k in keywords)} of {len(keywords)} keywords found",
        },
        {
            "name": "Resume structure",
            "score": round(WEIGHTS["Resume structure"] * len(sections) / 4, 1),
            "max_score": WEIGHTS["Resume structure"],
            "detail": f"Sections found: {', '.join(sections) or 'none'}",
        },
        {
            "name": "Resume quality",
            "score": round(WEIGHTS["Resume quality"] * resume_score / 100, 1),
            "max_score": WEIGHTS["Resume quality"],
            "detail": f"Resume analysis score: {resume_score}/100",
        },
    ]

    return {
        "match_percentage": match_percentage,
        "ats_score": round(sum(c["score"] for c in components)),
        "result": {
            "required": required,
            "preferred": preferred,
            "keywords": keywords,
            "components": components,
        },
    }