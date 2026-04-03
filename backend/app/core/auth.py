from typing import Any, Dict, Optional

from fastapi import Header, HTTPException

from app.core.database import db


def _serialize_user(user: Any) -> Dict[str, Any]:
    if user is None:
        return {}
    if hasattr(user, "model_dump"):
        return user.model_dump(mode="json")
    return {
        "id": getattr(user, "id", None),
        "email": getattr(user, "email", None),
        "phone": getattr(user, "phone", None),
        "user_metadata": getattr(user, "user_metadata", None),
        "app_metadata": getattr(user, "app_metadata", None),
    }


def first_row(payload: Any) -> Optional[Dict[str, Any]]:
    if isinstance(payload, list) and payload:
        return payload[0]
    if isinstance(payload, dict):
        return payload
    return None


async def get_current_user(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization bearer token")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    try:
        response = db.auth.get_user(token)
        user_data = _serialize_user(getattr(response, "user", None))
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired authentication token") from exc

    if not user_data.get("id"):
        raise HTTPException(status_code=401, detail="Authenticated user not found")

    return {"token": token, "user": user_data}


def fetch_user_profile(user_id: str) -> Optional[Dict[str, Any]]:
    response = db.table("users").select("*").eq("id", user_id).limit(1).execute()
    return first_row(response.data)
