import logging
import time
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

logger = logging.getLogger("backend.services.gemini")

# Quota exhaustion error signals eligible for immediate model fallback (no wasteful retries)
_QUOTA_SIGNALS = ("429", "resource_exhausted", "resource exhausted", "generaterequestsperdayperprojectpermodel", "quota")

# Transient 503 / high demand server signals eligible for exponential backoff retries
_TRANSIENT_503_SIGNALS = ("503", "unavailable", "high demand", "overloaded")

# Total number of attempts (1 initial + 2 retries) and the delay schedule in seconds for 503 errors.
_MAX_ATTEMPTS = 3
_BACKOFF_DELAYS = (2, 4)  # wait before attempt 2, then attempt 3


# Fallback model when primary suffers transient 503 exhaustion or 429 quota exhaustion
FALLBACK_MODEL = "gemini-3.5-flash-lite"


class GeminiServiceError(RuntimeError):
    """Raised when the Gemini service cannot be called or fails."""
    pass


class GeminiTranslationSummary(BaseModel):
    translated_text: str = Field(description="Translation of the input text into the target language")
    summary: str = Field(description="Concise summary of the input text")


def _is_quota_exhausted(exc: Exception) -> bool:
    """Return True if the exception indicates rate limit or quota exhaustion (429 / RESOURCE_EXHAUSTED)."""
    msg = str(exc).lower()
    return any(sig in msg for sig in _QUOTA_SIGNALS)


def _is_transient_503(exc: Exception) -> bool:
    """Return True if the exception looks like a recoverable 503 / high demand server error."""
    msg = str(exc).lower()
    return any(sig in msg for sig in _TRANSIENT_503_SIGNALS)


def _is_transient(exc: Exception) -> bool:
    """Compatibility helper: return True if the exception is 503 or 429."""
    return _is_transient_503(exc) or _is_quota_exhausted(exc)


def _invoke_gemini_content(
    client: genai.Client,
    model: str,
    prompt: str,
) -> Dict[str, str]:
    """Issues a single generate_content call with structured translation & summary schema."""
    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=GeminiTranslationSummary,
        ),
    )

    # ── Parse structured output ──────────────────────────────────────
    parsed: Optional[GeminiTranslationSummary] = response.parsed
    if parsed and parsed.translated_text:
        return {
            "translated_text": parsed.translated_text,
            "summary": parsed.summary or "",
        }

    # Fallback: parse raw JSON text if structured parse returned nothing
    if response.text:
        import json
        raw_json = json.loads(response.text)
        return {
            "translated_text": raw_json.get("translated_text", ""),
            "summary": raw_json.get("summary", ""),
        }

    raise GeminiServiceError("Empty response received from Gemini API.")


def generate_translation_and_summary(
    text: str,
    source_lang: str,
    target_lang: str,
    api_key: Optional[str] = None,
    model_name: str = "gemini-3.6-flash",
) -> Dict[str, str]:
    """
    Executes real Gemini API translation and summarization using structured outputs.

    Retry & Fallback behaviour:
    - Primary model (e.g. gemini-3.6-flash):
      * 429 RESOURCE_EXHAUSTED / quota limit: immediately switches to fallback model
        (gemini-3.5-flash-lite) without wasting time on futile retries.
      * 503 / UNAVAILABLE / high-demand: retries up to 3 total attempts with exponential
        backoff (2s, 4s), and if all 3 fail, falls back to gemini-3.5-flash-lite.
    - Fallback model (gemini-3.5-flash-lite):
      * Uses exact same prompt, text, source/target languages, and structured schema.
      * If fallback also fails (429, 503, or other), raises GeminiServiceError cleanly.
    - Non-transient errors (400/401/403/404/…): fail immediately without retry or fallback.

    Strict constraints:
    - Never uses mock/simulated dictionary responses.
    - Part of the same paid service execution; does not trigger new payments or quotes.
    - Raises GeminiServiceError if api_key is missing or all attempts fail.
    """
    if not api_key or not api_key.strip():
        raise GeminiServiceError(
            "GEMINI_API_KEY is not configured on the backend. "
            "Real Gemini service execution requires a valid API key."
        )

    if not text or not text.strip():
        raise GeminiServiceError("Input text cannot be empty for translation and summarization.")

    prompt = (
        f"You are a professional translator and text analyst.\n\n"
        f"Task:\n"
        f"1. Translate the following text from {source_lang} to {target_lang}.\n"
        f"2. Provide a concise summary of the original text.\n\n"
        f"Input Text:\n\"\"\"{text.strip()}\"\"\""
    )

    client = genai.Client(api_key=api_key)

    last_exc: Optional[Exception] = None

    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            return _invoke_gemini_content(client, model_name, prompt)

        except GeminiServiceError:
            # Already a clean error (e.g. empty response) — do not retry or fallback, propagate immediately.
            raise

        except Exception as exc:
            # Check 1: 429 RESOURCE_EXHAUSTED / Quota limit
            # Do NOT blindly retry a daily quota exhaustion 3 times; immediately try fallback model.
            if _is_quota_exhausted(exc):
                logger.warning(
                    f"Gemini primary model {model_name} exhausted quota (429 RESOURCE_EXHAUSTED): {exc}"
                )
                if model_name != FALLBACK_MODEL:
                    logger.warning(
                        f"Immediately using fallback model {FALLBACK_MODEL} due to primary {model_name} quota exhaustion"
                    )
                    try:
                        fallback_result = _invoke_gemini_content(client, FALLBACK_MODEL, prompt)
                        logger.info(f"Gemini fallback model {FALLBACK_MODEL} succeeded after primary quota exhaustion.")
                        return fallback_result
                    except Exception as fallback_exc:
                        logger.error(f"Gemini fallback model {FALLBACK_MODEL} also failed: {fallback_exc}")
                        raise GeminiServiceError(
                            f"Gemini translation service failed: primary model {model_name} quota exhausted (429) "
                            f"and fallback {FALLBACK_MODEL} failed: {str(fallback_exc)}"
                        ) from fallback_exc

                # Primary was already the fallback model
                raise GeminiServiceError(
                    f"Gemini translation service failed: quota exhausted (429 RESOURCE_EXHAUSTED): {str(exc)}"
                ) from exc

            # Check 2: Transient 503 / high demand server error -> retry with exponential backoff
            if _is_transient_503(exc):
                last_exc = exc
                if attempt < _MAX_ATTEMPTS:
                    delay = _BACKOFF_DELAYS[attempt - 1]
                    logger.warning(
                        f"Gemini transient 503 error on attempt {attempt}/{_MAX_ATTEMPTS} "
                        f"(retrying in {delay}s): {exc}"
                    )
                    time.sleep(delay)
                    continue
                else:
                    logger.error(
                        f"Gemini transient 503 error on attempt {attempt}/{_MAX_ATTEMPTS} "
                        f"(all primary attempts exhausted): {exc}"
                    )
                    break

            # Check 3: Non-transient errors (400/401/403/404/…) -> fail immediately, no retry, no fallback.
            logger.error(f"Gemini API non-transient error (attempt {attempt}/{_MAX_ATTEMPTS}): {exc}")
            raise GeminiServiceError(f"Gemini translation service failed: {str(exc)}") from exc

    # All _MAX_ATTEMPTS failed with transient 503 errors on the primary model.
    # Automatically try fallback model (gemini-3.5-flash-lite) if primary model was different.
    if model_name != FALLBACK_MODEL:
        logger.warning(
            f"Gemini primary model {model_name} unavailable after {_MAX_ATTEMPTS} attempts; "
            f"using fallback {FALLBACK_MODEL}"
        )
        try:
            fallback_result = _invoke_gemini_content(client, FALLBACK_MODEL, prompt)
            logger.info(f"Gemini fallback model {FALLBACK_MODEL} succeeded after 503 retry exhaustion.")
            return fallback_result
        except Exception as fallback_exc:
            logger.error(f"Gemini fallback model {FALLBACK_MODEL} also failed: {fallback_exc}")
            raise GeminiServiceError(
                f"Gemini translation service failed: primary model {model_name} exhausted {_MAX_ATTEMPTS} attempts "
                f"and fallback {FALLBACK_MODEL} failed: {str(fallback_exc)}"
            ) from fallback_exc

    raise GeminiServiceError(
        f"Gemini translation service failed after {_MAX_ATTEMPTS} attempts: {str(last_exc)}"
    ) from last_exc


