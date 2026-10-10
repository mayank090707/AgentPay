import json
from unittest.mock import MagicMock, patch, call
import pytest
from backend.app.services.gemini_client import (
    generate_translation_and_summary,
    GeminiServiceError,
    GeminiTranslationSummary,
    FALLBACK_MODEL,
    _MAX_ATTEMPTS,
    _BACKOFF_DELAYS,
)
from backend.app.config import settings


def test_402_to_payment_verification_to_gemini_delivery(client, monkeypatch):
    """
    Test complete lifecycle:
    1. Initial unpaid request -> HTTP 402 + Payment Quote
    2. Payment verification -> Call Gemini
    3. Structured output containing translated_text and summary
    4. Deterministic SHA-256 delivery hash and HMAC-signed receipt
    """
    call_count = {"count": 0}

    def mock_gemini(text, source_lang, target_lang, api_key, model_name="gemini-2.5-flash"):
        call_count["count"] += 1
        return {
            "translated_text": f"Traduction: {text}",
            "summary": f"Sommaire: {text[:20]}",
        }

    monkeypatch.setattr(
        "backend.app.services.translation.generate_translation_and_summary",
        mock_gemini
    )

    req_payload = {
        "text": "Artificial Intelligence is transforming autonomous decentralized agent payments.",
        "source_lang": "en",
        "target_lang": "fr"
    }

    # 1. POST request without payment proof -> 402 Payment Required
    res_402 = client.post("/services/translate", json=req_payload)
    assert res_402.status_code == 402
    assert res_402.headers.get("X-Payment-Required") == "true"
    quote_id = res_402.headers.get("X-Payment-Quote-Id")
    request_id = res_402.headers.get("X-Request-ID")
    assert quote_id is not None
    assert request_id is not None

    # Verify Gemini was NOT called during quote generation
    assert call_count["count"] == 0

    # 2. Resubmit with valid payment proof
    payment_proof = {
        "quote_id": quote_id,
        "tx_hash": "0xgemini_test_tx_hash_112233",
        "payer_address": "0xAgentClientAddress"
    }

    res_200 = client.post(
        "/services/translate",
        json=req_payload,
        headers={
            "X-Payment-Proof": json.dumps(payment_proof),
            "X-Request-ID": request_id
        }
    )

    assert res_200.status_code == 200
    data = res_200.json()
    assert data["status"] == "success"
    assert data["service_type"] == "translation"
    assert call_count["count"] == 1

    # Verify structured translation and summary returned in data
    service_data = data["data"]
    assert "translated_text" in service_data
    assert service_data["translated_text"] == f"Traduction: {req_payload['text']}"
    assert "summary" in service_data
    assert service_data["summary"].startswith("Sommaire:")

    # Verify delivery hash and receipt
    assert "content_hash" in data
    assert len(data["content_hash"]) == 64  # SHA-256 hex string
    assert "receipt" in data
    assert data["receipt"]["tx_hash"] == payment_proof["tx_hash"]
    assert data["receipt"]["content_hash"] == data["content_hash"]
    assert "signature" in data["receipt"]


def test_idempotent_replay_does_not_call_gemini_again(client, monkeypatch):
    """
    Test request-ID idempotency:
    Replaying the exact same request_id and payload returns the cached
    persisted delivery without executing another Gemini API call.
    """
    call_count = {"count": 0}

    def mock_gemini(text, source_lang, target_lang, api_key, model_name="gemini-2.5-flash"):
        call_count["count"] += 1
        return {
            "translated_text": f"Traducción de {text}",
            "summary": f"Resumen de {text}",
        }

    monkeypatch.setattr(
        "backend.app.services.translation.generate_translation_and_summary",
        mock_gemini
    )

    req_id = "req_idempotent_test_9999"
    payload = {"text": "Agentic workflows require idempotent delivery.", "source_lang": "en", "target_lang": "es"}

    # 1. 402 Quote
    res_402 = client.post("/services/translate", json=payload, headers={"X-Request-ID": req_id})
    quote_id = res_402.headers["X-Payment-Quote-Id"]

    # 2. First Paid Execution
    proof = {"quote_id": quote_id, "tx_hash": "0xidempotent_tx_001", "payer_address": "0xClient"}
    res_first = client.post(
        "/services/translate",
        json=payload,
        headers={"X-Payment-Proof": json.dumps(proof), "X-Request-ID": req_id}
    )
    assert res_first.status_code == 200
    assert call_count["count"] == 1
    first_data = res_first.json()

    # 3. Idempotent Replay (same request_id, same payload)
    res_replay = client.post(
        "/services/translate",
        json=payload,
        headers={"X-Payment-Proof": json.dumps(proof), "X-Request-ID": req_id}
    )
    assert res_replay.status_code == 200
    replay_data = res_replay.json()

    # Gemini must NOT be called a second time
    assert call_count["count"] == 1

    # Exact same content hash, data, and receipt returned
    assert replay_data["content_hash"] == first_data["content_hash"]
    assert replay_data["data"]["translated_text"] == first_data["data"]["translated_text"]
    assert replay_data["data"]["summary"] == first_data["data"]["summary"]
    assert replay_data["receipt"]["receipt_id"] == first_data["receipt"]["receipt_id"]


def test_request_id_reuse_with_different_payload_returns_conflict(client):
    """
    Test request-ID conflict protection:
    Reusing an existing request_id with different payload returns 409 REQUEST_ID_REUSE_CONFLICT.
    """
    req_id = "req_conflict_test_8888"
    payload_1 = {"text": "Original text payload 1", "source_lang": "en", "target_lang": "es"}
    payload_2 = {"text": "Tampered text payload 2", "source_lang": "en", "target_lang": "es"}

    # 1. Complete flow for payload_1
    res_402 = client.post("/services/translate", json=payload_1, headers={"X-Request-ID": req_id})
    quote_id = res_402.headers["X-Payment-Quote-Id"]
    proof = {"quote_id": quote_id, "tx_hash": "0xconflict_tx_002", "payer_address": "0xClient"}
    res_paid = client.post(
        "/services/translate",
        json=payload_1,
        headers={"X-Payment-Proof": json.dumps(proof), "X-Request-ID": req_id}
    )
    assert res_paid.status_code == 200

    # 2. Attempt to use same request_id with payload_2 -> HTTP 409 Conflict
    res_conflict = client.post(
        "/services/translate",
        json=payload_2,
        headers={"X-Payment-Proof": json.dumps(proof), "X-Request-ID": req_id}
    )
    assert res_conflict.status_code == 409
    assert res_conflict.json()["detail"] == "REQUEST_ID_REUSE_CONFLICT"


@pytest.mark.no_mock_gemini
def test_missing_gemini_api_key_does_not_produce_fake_translation(client, monkeypatch):
    """
    Test failure mode:
    When GEMINI_API_KEY is missing, the service raises a clear error and returns HTTP 502.
    It must NEVER return a successful fake or dictionary translation.
    """
    monkeypatch.setattr(settings, "GEMINI_API_KEY", None)

    req_payload = {"text": "hello", "source_lang": "en", "target_lang": "es"}

    # 1. 402 Quote is created normally
    res_402 = client.post("/services/translate", json=req_payload)
    assert res_402.status_code == 402
    quote_id = res_402.headers.get("X-Payment-Quote-Id")

    # 2. Resubmit with payment
    proof = {"quote_id": quote_id, "tx_hash": "0xmissing_key_tx_003", "payer_address": "0xClient"}
    res_paid = client.post(
        "/services/translate",
        json=req_payload,
        headers={"X-Payment-Proof": json.dumps(proof)}
    )

    # Must return 502 error with clear detail, NOT 200 with fake response
    assert res_paid.status_code == 502
    detail = res_paid.json()["detail"]
    assert "GEMINI_API_KEY is not configured" in detail


@pytest.mark.no_mock_gemini
def test_gemini_api_failure_does_not_produce_successful_response(client, monkeypatch):
    """
    Test failure mode:
    When the Gemini API fails/throws, the backend returns HTTP 502 Bad Gateway
    and does NOT produce a successful response or fallback.
    """
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "dummy_gemini_key")

    def mock_failing_gemini(*args, **kwargs):
        raise GeminiServiceError("Gemini rate limit exceeded (HTTP 429 quota exhausted)")

    monkeypatch.setattr(
        "backend.app.services.translation.generate_translation_and_summary",
        mock_failing_gemini
    )

    req_payload = {"text": "Important text to translate", "source_lang": "en", "target_lang": "es"}
    res_402 = client.post("/services/translate", json=req_payload)
    quote_id = res_402.headers.get("X-Payment-Quote-Id")

    proof = {"quote_id": quote_id, "tx_hash": "0xfailure_tx_004", "payer_address": "0xClient"}
    res_paid = client.post(
        "/services/translate",
        json=req_payload,
        headers={"X-Payment-Proof": json.dumps(proof)}
    )

    assert res_paid.status_code == 502
    detail = res_paid.json()["detail"]
    assert "Gemini rate limit exceeded" in detail


def test_existing_non_translation_services_still_work(client):
    """
    Ensure adding Gemini translation did not disrupt /services/compute or /services/storage.
    """
    # 1. Compute service
    compute_payload = {"operation": "matrix_multiply", "params": {"matrix_size": 100}}
    res_c_402 = client.post("/services/compute", json=compute_payload)
    assert res_c_402.status_code == 402
    c_quote_id = res_c_402.headers.get("X-Payment-Quote-Id")
    c_proof = {"quote_id": c_quote_id, "tx_hash": "0xcompute_ok_tx", "payer_address": "0xClient"}
    res_c_200 = client.post(
        "/services/compute",
        json=compute_payload,
        headers={"X-Payment-Proof": json.dumps(c_proof)}
    )
    assert res_c_200.status_code == 200
    assert res_c_200.json()["service_type"] == "compute"

    # 2. Storage service
    storage_payload = {"key": "agent_data_key", "value": "AgentPay decentralized data value"}
    res_s_402 = client.post("/services/storage", json=storage_payload)
    assert res_s_402.status_code == 402
    s_quote_id = res_s_402.headers.get("X-Payment-Quote-Id")
    s_proof = {"quote_id": s_quote_id, "tx_hash": "0xstorage_ok_tx", "payer_address": "0xClient"}
    res_s_200 = client.post(
        "/services/storage",
        json=storage_payload,
        headers={"X-Payment-Proof": json.dumps(s_proof)}
    )
    assert res_s_200.status_code == 200
    assert res_s_200.json()["service_type"] == "storage"


@pytest.mark.no_mock_gemini
def test_gemini_client_generate_translation_and_summary_unit(monkeypatch):
    """
    Unit test for generate_translation_and_summary helper verifying
    structured output parsing from the official google-genai SDK.
    """
    mock_response = MagicMock()
    mock_parsed = GeminiTranslationSummary(
        translated_text="Bonjour le monde",
        summary="Salutation brève."
    )
    mock_response.parsed = mock_parsed
    mock_response.text = '{"translated_text": "Bonjour le monde", "summary": "Salutation brève."}'

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    monkeypatch.setattr("google.genai.Client", lambda api_key: mock_client)

    result = generate_translation_and_summary(
        text="Hello world",
        source_lang="en",
        target_lang="fr",
        api_key="valid_test_key"
    )

    assert result["translated_text"] == "Bonjour le monde"
    assert result["summary"] == "Salutation brève."


# ---------------------------------------------------------------------------
# Retry and Fallback unit tests
# ---------------------------------------------------------------------------

@pytest.mark.no_mock_gemini
def test_primary_succeeds_fallback_never_called(monkeypatch):
    """
    When primary model succeeds on the first attempt, fallback model is never invoked.
    """
    mock_response = MagicMock()
    mock_response.parsed = GeminiTranslationSummary(
        translated_text="Bonjour le monde",
        summary="Salutation.",
    )
    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response
    monkeypatch.setattr("google.genai.Client", lambda api_key: mock_client)

    result = generate_translation_and_summary(
        text="Hello world",
        source_lang="en",
        target_lang="fr",
        api_key="valid_key",
        model_name="gemini-3.6-flash",
    )

    assert result["translated_text"] == "Bonjour le monde"
    assert result["summary"] == "Salutation."
    assert mock_client.models.generate_content.call_count == 1
    assert mock_client.models.generate_content.call_args.kwargs["model"] == "gemini-3.6-flash"


@pytest.mark.no_mock_gemini
def test_primary_gets_503_then_succeeds_fallback_never_called(monkeypatch):
    """
    A single transient 503 on the first attempt is retried on primary model;
    when attempt 2 succeeds on primary, fallback is never called.
    """
    transient_exc = Exception(
        "503 UNAVAILABLE: This model is currently experiencing high demand. Please try again later."
    )
    success_response = MagicMock()
    success_response.parsed = GeminiTranslationSummary(
        translated_text="Hola mundo",
        summary="Un saludo breve.",
    )

    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = [transient_exc, success_response]
    monkeypatch.setattr("google.genai.Client", lambda api_key: mock_client)

    with patch("backend.app.services.gemini_client.time.sleep") as mock_sleep:
        result = generate_translation_and_summary(
            text="Hello world",
            source_lang="en",
            target_lang="es",
            api_key="test_key",
            model_name="gemini-3.6-flash",
        )

    assert result["translated_text"] == "Hola mundo"
    assert result["summary"] == "Un saludo breve."
    assert mock_client.models.generate_content.call_count == 2
    # Both calls must have used the primary model, never the fallback
    for call_obj in mock_client.models.generate_content.call_args_list:
        assert call_obj.kwargs["model"] == "gemini-3.6-flash"
    mock_sleep.assert_called_once_with(_BACKOFF_DELAYS[0])


@pytest.mark.no_mock_gemini
def test_primary_three_503s_then_fallback_succeeds(monkeypatch):
    """
    When primary model fails 3 consecutive times with 503 UNAVAILABLE,
    fallback model (gemini-3.5-flash-lite) is automatically invoked with the
    exact same prompt and structured schema, and its result is returned.
    """
    transient_503 = Exception(
        "503 UNAVAILABLE: This model is currently experiencing high demand."
    )
    fallback_success = MagicMock()
    fallback_success.parsed = GeminiTranslationSummary(
        translated_text="नमस्ते दुनिया",
        summary="संक्षिप्त सारांश",
    )

    mock_client = MagicMock()
    # 3 failures on primary, then success on fallback
    mock_client.models.generate_content.side_effect = [
        transient_503,
        transient_503,
        transient_503,
        fallback_success,
    ]
    monkeypatch.setattr("google.genai.Client", lambda api_key: mock_client)

    with patch("backend.app.services.gemini_client.time.sleep") as mock_sleep:
        result = generate_translation_and_summary(
            text="Hello world",
            source_lang="en",
            target_lang="hi",
            api_key="test_key",
            model_name="gemini-3.6-flash",
        )

    assert result["translated_text"] == "नमस्ते दुनिया"
    assert result["summary"] == "संक्षिप्त सारांश"

    # Total 4 calls: 3 primary attempts + 1 fallback attempt
    assert mock_client.models.generate_content.call_count == 4
    call_args_list = mock_client.models.generate_content.call_args_list
    assert call_args_list[0].kwargs["model"] == "gemini-3.6-flash"
    assert call_args_list[1].kwargs["model"] == "gemini-3.6-flash"
    assert call_args_list[2].kwargs["model"] == "gemini-3.6-flash"
    assert call_args_list[3].kwargs["model"] == FALLBACK_MODEL  # gemini-3.5-flash-lite

    # Fallback used the exact same prompt and schema
    assert call_args_list[3].kwargs["contents"] == call_args_list[0].kwargs["contents"]
    assert call_args_list[3].kwargs["config"].response_schema == GeminiTranslationSummary

    # Backoff sleep was called for the 2 retries on primary
    assert mock_sleep.call_count == _MAX_ATTEMPTS - 1


@pytest.mark.no_mock_gemini
def test_primary_three_503s_and_fallback_fails_raises_gemini_service_error(monkeypatch):
    """
    When primary model fails 3 consecutive times with 503 UNAVAILABLE
    and fallback model also fails, GeminiServiceError is raised.
    """
    transient_503 = Exception("503 UNAVAILABLE: high demand.")
    fallback_exc = Exception("503 UNAVAILABLE: fallback also high demand.")

    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = [
        transient_503,
        transient_503,
        transient_503,
        fallback_exc,
    ]
    monkeypatch.setattr("google.genai.Client", lambda api_key: mock_client)

    with patch("backend.app.services.gemini_client.time.sleep") as mock_sleep:
        with pytest.raises(GeminiServiceError) as exc_info:
            generate_translation_and_summary(
                text="Some text",
                source_lang="en",
                target_lang="de",
                api_key="test_key",
                model_name="gemini-3.6-flash",
            )

    assert "exhausted 3 attempts" in str(exc_info.value)
    assert FALLBACK_MODEL in str(exc_info.value)
    assert mock_client.models.generate_content.call_count == 4
    assert mock_client.models.generate_content.call_args_list[3].kwargs["model"] == FALLBACK_MODEL


@pytest.mark.no_mock_gemini
def test_non_transient_error_does_not_trigger_fallback(monkeypatch):
    """
    A non-transient error (e.g. 404 NOT_FOUND or 400 Bad Request) must fail
    immediately on the first attempt without retry and without invoking fallback.
    """
    non_transient_exc = Exception(
        "404 NOT_FOUND: This model models/gemini-old is no longer available."
    )

    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = non_transient_exc
    monkeypatch.setattr("google.genai.Client", lambda api_key: mock_client)

    with patch("backend.app.services.gemini_client.time.sleep") as mock_sleep:
        with pytest.raises(GeminiServiceError) as exc_info:
            generate_translation_and_summary(
                text="Test text",
                source_lang="en",
                target_lang="fr",
                api_key="test_key",
                model_name="gemini-3.6-flash",
            )

    assert "404 NOT_FOUND" in str(exc_info.value)
    # Only 1 call — no retry, no fallback
    assert mock_client.models.generate_content.call_count == 1
    assert mock_client.models.generate_content.call_args.kwargs["model"] == "gemini-3.6-flash"
    mock_sleep.assert_not_called()


# ---------------------------------------------------------------------------
# 429 Quota exhaustion fallback tests
# ---------------------------------------------------------------------------

@pytest.mark.no_mock_gemini
def test_primary_429_quota_exhausted_fallback_succeeds(monkeypatch):
    """
    When primary model (gemini-3.6-flash) returns 429 RESOURCE_EXHAUSTED due to
    per-model free-tier quota, the fallback model (gemini-3.5-flash-lite) is called
    IMMEDIATELY — no wasteful retries on the primary model.
    Fallback succeeds and returns normal translation + summary.
    """
    quota_exc = Exception(
        "429 RESOURCE_EXHAUSTED: GenerateRequestsPerDayPerProjectPerModel-FreeTier "
        "model: gemini-3.6-flash quotaValue: 20"
    )
    fallback_success = MagicMock()
    fallback_success.parsed = GeminiTranslationSummary(
        translated_text="नमस्ते दुनिया",
        summary="एक संक्षिप्त अभिवादन।",
    )

    mock_client = MagicMock()
    # Attempt 1 on primary → 429; attempt 1 on fallback → success
    mock_client.models.generate_content.side_effect = [quota_exc, fallback_success]
    monkeypatch.setattr("google.genai.Client", lambda api_key: mock_client)

    with patch("backend.app.services.gemini_client.time.sleep") as mock_sleep:
        result = generate_translation_and_summary(
            text="Hello world",
            source_lang="en",
            target_lang="hi",
            api_key="test_key",
            model_name="gemini-3.6-flash",
        )

    assert result["translated_text"] == "नमस्ते दुनिया"
    assert result["summary"] == "एक संक्षिप्त अभिवादन।"

    # Exactly 2 calls: 1 on primary (429), 1 on fallback (success)
    assert mock_client.models.generate_content.call_count == 2
    call_args_list = mock_client.models.generate_content.call_args_list
    assert call_args_list[0].kwargs["model"] == "gemini-3.6-flash"
    assert call_args_list[1].kwargs["model"] == FALLBACK_MODEL  # gemini-3.5-flash-lite

    # No sleep — 429 must NOT trigger backoff retries on the primary model
    mock_sleep.assert_not_called()


@pytest.mark.no_mock_gemini
def test_primary_429_and_fallback_429_raises_gemini_service_error(monkeypatch):
    """
    When primary model returns 429 RESOURCE_EXHAUSTED and the fallback model
    also returns 429, GeminiServiceError is raised cleanly.
    No retry loops. Only 2 total API calls.
    """
    primary_quota_exc = Exception(
        "429 RESOURCE_EXHAUSTED: GenerateRequestsPerDayPerProjectPerModel-FreeTier "
        "model: gemini-3.6-flash quotaValue: 20"
    )
    fallback_quota_exc = Exception(
        "429 RESOURCE_EXHAUSTED: GenerateRequestsPerDayPerProjectPerModel-FreeTier "
        "model: gemini-3.5-flash-lite quotaValue: 50"
    )

    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = [primary_quota_exc, fallback_quota_exc]
    monkeypatch.setattr("google.genai.Client", lambda api_key: mock_client)

    with patch("backend.app.services.gemini_client.time.sleep") as mock_sleep:
        with pytest.raises(GeminiServiceError) as exc_info:
            generate_translation_and_summary(
                text="Hello world",
                source_lang="en",
                target_lang="hi",
                api_key="test_key",
                model_name="gemini-3.6-flash",
            )

    error_msg = str(exc_info.value)
    assert "quota exhausted" in error_msg.lower() or "429" in error_msg
    assert FALLBACK_MODEL in error_msg

    # Exactly 2 calls: 1 primary (429) + 1 fallback (429)
    assert mock_client.models.generate_content.call_count == 2
    call_args_list = mock_client.models.generate_content.call_args_list
    assert call_args_list[0].kwargs["model"] == "gemini-3.6-flash"
    assert call_args_list[1].kwargs["model"] == FALLBACK_MODEL

    # No sleep — quota exhaustion must not trigger backoff
    mock_sleep.assert_not_called()

