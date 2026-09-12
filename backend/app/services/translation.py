import time
from typing import Dict, Any


def translate_text(text: str, source_lang: str, target_lang: str) -> Dict[str, Any]:
    """
    Simulates high-performance AI neural text translation.
    """
    start_time = time.time()
    
    # Mock translations for key hackathon demo phrases
    mock_dictionary = {
        "hello": {"es": "hola", "fr": "bonjour", "de": "hallo", "es_mx": "hola"},
        "payment received": {"es": "pago recibido", "fr": "paiement reçu", "de": "zahlung erhalten"},
        "agentpay": {"es": "AgentPay (Plataforma)", "fr": "AgentPay (Plateforme)", "de": "AgentPay (Plattform)"}
    }
    
    clean_text = text.strip().lower()
    if clean_text in mock_dictionary and target_lang in mock_dictionary[clean_text]:
        translated_text = mock_dictionary[clean_text][target_lang]
    else:
        # Fallback simulation prefix
        translated_text = f"[{target_lang.upper()}] {text}"
        
    char_count = len(text)
    word_count = len(text.split())
    tokens_used = max(1, int(word_count * 1.3))
    elapsed_ms = round((time.time() - start_time) * 1000 + 12, 2)
    
    return {
        "original_text": text,
        "translated_text": translated_text,
        "source_language": source_lang,
        "target_language": target_lang,
        "character_count": char_count,
        "tokens_processed": tokens_used,
        "confidence_score": 0.985,
        "latency_ms": elapsed_ms
    }
