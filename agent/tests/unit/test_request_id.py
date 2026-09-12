"""Unit tests for RequestId domain value object."""

from pydantic import BaseModel, ValidationError
import pytest

from agent.src.exceptions import InvalidRequestError
from agent.src.models import RequestId


class SampleModel(BaseModel):
    request_id: RequestId


def test_request_id_generation() -> None:
    """Verify that generated RequestId satisfies 0x + 64 hex characters (32 bytes)."""
    req_id = RequestId.generate()
    assert isinstance(req_id, RequestId)
    assert isinstance(req_id, str)
    assert req_id.startswith("0x")
    assert len(req_id) == 66
    # Hexadecimal validity
    int(req_id[2:], 16)


def test_request_id_normalization() -> None:
    """Verify that RequestId normalizes uppercase hex to lowercase."""
    raw = "0x" + "ABCD" * 16
    req_id = RequestId(raw)
    assert req_id == raw.lower()
    assert req_id.startswith("0x")


def test_request_id_is_valid() -> None:
    """Verify RequestId.is_valid helper method."""
    valid_id = "0x" + "1234567890abcdef" * 4
    assert RequestId.is_valid(valid_id)
    assert RequestId.is_valid(valid_id.upper())

    # Invalid cases
    assert not RequestId.is_valid("not_a_request_id")
    assert not RequestId.is_valid("1234567890abcdef" * 4)  # Missing 0x
    assert not RequestId.is_valid("0x" + "12" * 31)  # 64 chars total instead of 66
    assert not RequestId.is_valid("0x" + "12" * 33)  # 68 chars total
    assert not RequestId.is_valid("0x" + "z" * 64)  # Non-hex characters
    assert not RequestId.is_valid(None)  # Non-string
    assert not RequestId.is_valid(12345)


def test_invalid_request_id_raises_domain_exception() -> None:
    """Verify that invalid strings raise InvalidRequestError."""
    with pytest.raises(InvalidRequestError) as exc_info:
        RequestId("invalid_id")
    assert exc_info.value.code == "INVALID_REQUEST_ID"

    with pytest.raises(InvalidRequestError):
        RequestId("0x" + "a" * 63)  # Too short

    with pytest.raises(InvalidRequestError):
        RequestId("0x" + "a" * 65)  # Too long

    with pytest.raises(InvalidRequestError):
        RequestId(12345)  # type: ignore


def test_request_id_pydantic_integration() -> None:
    """Verify RequestId integrates with Pydantic models for validation and serialization."""
    valid_hex = "0x" + "fe" * 32
    model = SampleModel(request_id=valid_hex)
    assert isinstance(model.request_id, RequestId)
    assert model.request_id == valid_hex

    # Serialization
    dumped = model.model_dump()
    assert dumped["request_id"] == valid_hex
    json_dumped = model.model_dump_json()
    assert valid_hex in json_dumped

    # Invalid value via Pydantic
    with pytest.raises(ValidationError):
        SampleModel(request_id="invalid_value")


def test_request_id_as_dict_key() -> None:
    """Verify RequestId can be used cleanly as a dictionary key."""
    id1 = RequestId.generate()
    id2 = RequestId.generate()
    store = {id1: "first_request", id2: "second_request"}
    assert store[id1] == "first_request"
    assert store[id2] == "second_request"
