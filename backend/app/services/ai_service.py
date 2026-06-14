import json
import re
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings


class AIService:
    """Wraps the Gemma 3 Ollama-compatible API."""

    def __init__(self):
        self.url = settings.AI_API_URL
        self.headers = {"apikey": settings.AI_API_KEY, "Content-Type": "application/json"}
        self.model = settings.AI_MODEL
        self.timeout = settings.AI_TIMEOUT

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def _call(self, prompt: str) -> str:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                self.url,
                headers=self.headers,
                json={"model": self.model, "prompt": prompt, "stream": False},
            )
            resp.raise_for_status()
            return resp.json().get("response", "")

    def _extract_json(self, text: str) -> Any:
        """Extract JSON from LLM response — handles markdown fences and loose text."""
        # Try fenced code block first
        match = re.search(r"```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```", text, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        # Try bare JSON object or array
        match = re.search(r"(\{.*\}|\[.*\])", text, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        raise ValueError(f"No JSON found in response: {text[:200]}")

    async def extract_resume(self, raw_text: str) -> dict:
        prompt = f"""You are a resume parser. Extract structured information from the resume below.
Return ONLY valid JSON. Do not add any explanation or markdown. If a field is missing, use null or empty array.

Schema:
{{
  "name": "string or null",
  "email": "string or null",
  "phone": "string or null",
  "skills": ["list of skills"],
  "experience": [
    {{"title": "job title", "company": "company name", "duration_years": number or null, "description": "brief summary"}}
  ],
  "education": [
    {{"degree": "degree name", "field": "field of study", "institution": "institution name", "year": number or null}}
  ],
  "certifications": ["list of certifications"],
  "total_experience_years": number or null
}}

Resume:
{raw_text[:6000]}

JSON:"""
        response = await self._call(prompt)
        return self._extract_json(response)

    async def score_candidate(self, candidate_data: dict, jd: dict, weights: dict) -> dict:
        prompt = f"""You are an objective hiring analyst. Score this candidate against the job description.
Return ONLY valid JSON. Do not add explanation outside the JSON.

Score each dimension from 0 to 100. Be factual. Do not favour or penalise based on name, age, gender, or university prestige.

Dimensions to score:
- skills_match: how well candidate skills match required skills
- role_relevance: how similar past roles are to this job
- years_experience: candidate experience vs required minimum
- education: degree/field match to requirements
- career_progression: upward career trajectory
- certifications: relevant certifications present

Schema:
{{
  "scores": {{
    "skills_match": 0-100,
    "role_relevance": 0-100,
    "years_experience": 0-100,
    "education": 0-100,
    "career_progression": 0-100,
    "certifications": 0-100
  }},
  "explanations": {{
    "skills_match": "1-2 sentence explanation",
    "role_relevance": "1-2 sentence explanation",
    "years_experience": "1-2 sentence explanation",
    "education": "1-2 sentence explanation",
    "career_progression": "1-2 sentence explanation",
    "certifications": "1-2 sentence explanation"
  }},
  "summary": "2-3 sentence overall candidate summary"
}}

Candidate:
{json.dumps(candidate_data, indent=2)[:2000]}

Job Description:
{json.dumps(jd, indent=2)[:1500]}

JSON:"""
        response = await self._call(prompt)
        return self._extract_json(response)

    async def detect_bias(self, candidate_data: dict, jd: dict, scores: dict) -> list:
        prompt = f"""You are a DEI compliance reviewer. Analyse this candidate's profile and scores for potential bias signals.
Return ONLY valid JSON array. Return empty array [] if no bias signals found.

Check for:
1. gender_inference - scoring influenced by inferred gender
2. name_ethnicity - name/ethnicity may have influenced scoring
3. age_inference - graduation year or experience implies age discrimination
4. employment_gap - unexplained gaps penalised unfairly
5. institution_prestige - over-weighting university prestige
6. over_qualification - candidate over-qualified by more than 50%
7. geographic - location used beyond legitimate requirements

Only flag high-confidence signals. Each flag must cite a specific field or score.

Schema:
[
  {{
    "type": "one of the 7 types above",
    "severity": "high | medium | low",
    "description": "specific description of the signal detected",
    "recommendation": "what the recruiter should do"
  }}
]

Candidate: {json.dumps(candidate_data, indent=2)[:1500]}
Scores: {json.dumps(scores, indent=2)}
JD: {json.dumps(jd, indent=2)[:1000]}

JSON array:"""
        response = await self._call(prompt)
        result = self._extract_json(response)
        return result if isinstance(result, list) else []

    async def match_interviewers(self, candidate_skills: list[str], interviewers: list[dict]) -> list:
        prompt = f"""Rank these interviewers by suitability to interview this candidate based on skill overlap.
Return ONLY valid JSON array sorted by match_score descending.

Schema:
[
  {{
    "interviewer_id": "uuid string",
    "match_score": 0-100,
    "matched_skills": ["list of overlapping skills"],
    "reason": "1 sentence reason"
  }}
]

Candidate skills: {json.dumps(candidate_skills)}
Interviewers: {json.dumps(interviewers, indent=2)[:2000]}

JSON array:"""
        response = await self._call(prompt)
        result = self._extract_json(response)
        return result if isinstance(result, list) else []


ai_service = AIService()
