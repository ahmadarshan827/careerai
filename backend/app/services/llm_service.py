import logging
import time

from google import genai
from google.genai import errors, types
from pydantic import BaseModel, ValidationError

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class LLMError(Exception):
    """The AI call failed or returned unusable output."""


class LLMBusyError(LLMError):
    """Rate limit or temporary server problem."""


def generate_structured(
    prompt: str,
    schema: type[BaseModel],
    system_instruction: str | None = None,
    max_attempts: int = 3,
) -> BaseModel:
    settings = get_settings()
    client = genai.Client(api_key=settings.gemini_api_key)
    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        response_mime_type="application/json",
        response_schema=schema,
        temperature=0.2,
    )

    busy = False
    for attempt in range(max_attempts):
        try:
            response = client.models.generate_content(
                model=settings.gemini_model, contents=prompt, config=config
            )
            if isinstance(response.parsed, schema):
                return response.parsed
            return schema.model_validate_json(response.text or "")
        except errors.APIError as exc:
            code = getattr(exc, "code", None)
            if code == 429 or (isinstance(code, int) and code >= 500):
                busy = True
                logger.warning("Gemini busy (code %s), attempt %s", code, attempt + 1)
                time.sleep(2**attempt)  # 1s, 2s, 4s backoff
                continue
            logger.error("Gemini API error (code %s)", code)
            raise LLMError("AI request was rejected") from exc
        except (ValidationError, ValueError):
            logger.warning("Gemini returned invalid JSON, attempt %s", attempt + 1)
            busy = False
            continue

    if busy:
        raise LLMBusyError("AI service is busy")
    raise LLMError("AI returned invalid output")