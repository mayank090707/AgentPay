from backend.app.core.pricing import calculate_service_price, PRICING_CATALOG


def test_get_pricing_catalog(client):
    response = client.get("/services/pricing")
    assert response.status_code == 200
    data = response.json()
    assert "provider_address" in data
    assert "services" in data
    assert "translation" in data["services"]
    assert "compute" in data["services"]
    assert "storage" in data["services"]


def test_calculate_translation_pricing():
    # 50 chars -> 1 unit -> 0.00002
    price1 = calculate_service_price("translation", {"text": "Hello world"})
    assert price1 == 0.00002

    # 250 chars -> 3 units -> 0.00006
    price2 = calculate_service_price("translation", {"text": "a" * 250})
    assert price2 == 0.00006


def test_calculate_compute_pricing():
    # Matrix 100x100 -> 10 units -> 0.0012
    price_matrix = calculate_service_price("compute", {"operation": "matrix_multiply", "params": {"matrix_size": 100}})
    assert price_matrix == 0.0012

    # Embedding 128 dim -> 4 units -> 0.00048
    price_embed = calculate_service_price("compute", {"operation": "data_embedding", "params": {"dimension": 128}})
    assert price_embed == 0.00048


def test_calculate_storage_pricing():
    # Small string -> min rate 0.00005
    price_small = calculate_service_price("storage", {"value": "small payload"})
    assert price_small == 0.00005
