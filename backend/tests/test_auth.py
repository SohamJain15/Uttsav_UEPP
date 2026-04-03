from types import SimpleNamespace


def test_signup_success(client, mocked_db):
    mocked_db.auth.admin.create_user.return_value = SimpleNamespace(
        user=SimpleNamespace(
            id="user-123",
            email="newuser@example.com",
            phone=None,
        )
    )

    response = client.post(
        "/api/user/signup",
        json={
            "email": "newuser@example.com",
            "password": "StrongPassword123",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert body["user"]["email"] == "newuser@example.com"
    mocked_db.auth.admin.create_user.assert_called_once()


def test_login_success(client, mocked_db):
    mocked_db.auth.sign_in_with_password.return_value = SimpleNamespace(
        session=SimpleNamespace(access_token="fake-jwt-token"),
        user=SimpleNamespace(
            id="user-123",
            email="newuser@example.com",
            phone=None,
        ),
    )

    response = client.post(
        "/api/user/login",
        json={
            "email": "newuser@example.com",
            "password": "StrongPassword123",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert body["access_token"] == "fake-jwt-token"
    mocked_db.auth.sign_in_with_password.assert_called_once()


def test_login_failed_invalid_credentials(client, mocked_db):
    mocked_db.auth.sign_in_with_password.side_effect = Exception("Invalid login credentials")

    response = client.post(
        "/api/user/login",
        json={
            "email": "wrong@example.com",
            "password": "bad-password",
        },
    )

    assert response.status_code == 400
    assert "Invalid login credentials" in response.json()["detail"]
