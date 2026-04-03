from contextlib import ExitStack
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.auth import get_current_user
from app.main import app


@pytest.fixture
def mocked_db():
    db_mock = MagicMock(name="supabase_db_mock")

    with ExitStack() as stack:
        stack.enter_context(patch("app.core.database.db", db_mock))
        stack.enter_context(patch("app.core.auth.db", db_mock))
        stack.enter_context(patch("app.api.user_routes.db", db_mock))
        stack.enter_context(patch("app.api.auth_routes.db", db_mock))
        stack.enter_context(patch("app.api.document_routes.db", db_mock))
        stack.enter_context(patch("app.api.dept_routes.db", db_mock))
        yield db_mock


@pytest.fixture
def client(mocked_db):
    app.dependency_overrides[get_current_user] = lambda: {
        "token": "fake-access-token",
        "user": {"id": "test-user-id", "email": "tester@example.com"},
    }

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
