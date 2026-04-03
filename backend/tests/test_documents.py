from types import SimpleNamespace


def test_document_upload_success(client, mocked_db):
    mocked_db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
        SimpleNamespace(data=[{"app_id": "UEPP-TEST1234", "user_id": "test-user-id"}])
    )
    mocked_db.table.return_value.insert.return_value.execute.return_value = SimpleNamespace(
        data=[{"id": 1, "app_id": "UEPP-TEST1234"}]
    )
    mocked_db.storage.from_.return_value.upload.return_value = SimpleNamespace(path="uploaded")
    mocked_db.storage.from_.return_value.get_public_url.return_value = (
        "https://example.supabase.co/storage/v1/object/public/application_documents/UEPP-TEST1234/test.pdf"
    )

    response = client.post(
        "/api/documents/upload",
        data={"app_id": "UEPP-TEST1234"},
        files={"file": ("test.pdf", b"%PDF-1.4 test content", "application/pdf")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert body["app_id"] == "UEPP-TEST1234"
    assert "document_url" in body
    mocked_db.storage.from_.return_value.upload.assert_called_once()
