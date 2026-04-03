from types import SimpleNamespace


def test_submit_application_success(client, mocked_db):
    mocked_db.table.return_value.insert.return_value.execute.return_value = SimpleNamespace(
        data=[{"ok": True}]
    )

    payload = {
        "event_name": "Ganesh Festival",
        "event_type": "Religious",
        "crowd_size": 500,
        "start_date": "2026-05-01T09:00:00",
        "end_date": "2026-05-01T21:00:00",
        "venue_name": "Central Ground",
        "venue_type": "Open Ground",
        "address": "MG Road",
        "city": "Pune",
        "pincode": "411001",
        "has_fireworks": True,
        "has_loudspeakers": True,
        "is_moving_procession": False,
        "food_stalls": True,
    }

    response = client.post("/api/user/submit-application", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert "application_id" in body
    assert body["application_id"].startswith("UEPP-")
    assert mocked_db.table.return_value.insert.return_value.execute.call_count == 3


def test_submit_application_validation_error(client):
    payload = {
        "event_type": "Religious",
        "crowd_size": 500,
        "start_date": "2026-05-01T09:00:00",
        "end_date": "2026-05-01T21:00:00",
        "venue_name": "Central Ground",
        "venue_type": "Open Ground",
        "address": "MG Road",
        "city": "Pune",
    }

    response = client.post("/api/user/submit-application", json=payload)

    assert response.status_code == 422
