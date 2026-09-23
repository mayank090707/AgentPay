import time
from typing import Dict, Any

from backend.app.config import settings
from backend.app.services.gemini_client import generate_translation_and_summary, GeminiServiceError


def translate_text(text: str, source_lang: str, target_lang: str) -> Dict[str, Any]:
    """
    Executes real Gemini neural text translation and summarization.
    
    Returns structured data containing:
    - translated_text: translated content into target language
    - summary: concise summary of the original text
    
    Strict constraints:
    - Never uses mock or simulated dictionary translations.
    - Raises GeminiServiceError if GEMINI_API_KEY is not configured or if API call fails.
    """
    start_time = time.time()
    
    gemini_result = generate_translation_and_summary(
        text=text,
        source_lang=source_lang,
        target_lang=target_lang,
        api_key=settings.GEMINI_API_KEY,
        model_name=settings.GEMINI_MODEL,
    )
    
    elapsed_ms = round((time.time() - start_time) * 1000, 2)
    
    return {
        "original_text": text,
        "translated_text": gemini_result["translated_text"],
        "summary": gemini_result["summary"],
        "source_language": source_lang,
        "target_language": target_lang,
        "character_count": len(text),
        "word_count": len(text.split()),
        "model_used": settings.GEMINI_MODEL,
        "latency_ms": elapsed_ms,
    }
