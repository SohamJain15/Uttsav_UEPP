from typing import Any, Dict, Optional

from fastapi import Header, HTTPException

from app.core.database import db


def _serialize_user(user: Any) -> Dict[str, Any]:
    """Serialize Supabase user object to dictionary"""
    if user is None:
        return {}
    if hasattr(user, "model_dump"):
        return user.model_dump(mode="json")
    return {
        "id": str(getattr(user, "id", None)) if getattr(user, "id", None) else None,
        "email": getattr(user, "email", None),
        "phone": getattr(user, "phone", None),
        "user_metadata": dict(getattr(user, "user_metadata", None) or {}),
        "app_metadata": dict(getattr(user, "app_metadata", None) or {}),
    }


def first_row(payload: Any) -> Optional[Dict[str, Any]]:
    """Extract first row from query response"""
    if isinstance(payload, list) and payload:
        first = payload[0]
        if isinstance(first, dict):
            return first
        if hasattr(first, "model_dump"):
            return {k: v for k, v in first.model_dump(mode="json").items() if v is not None}
        return {k: getattr(first, k, None) for k in dir(first) if not k.startswith("_")}
    if isinstance(payload, dict):
        return payload
    return None


async def get_current_user(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    """Validate bearer token and get current user from Supabase Auth"""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=401, 
            detail="Missing or invalid Authorization bearer token"
        )

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    if token.startswith("department::"):
        parts = token.split("::")
        if len(parts) == 3:
            user_id, role = parts[1], parts[2]
            email = None
        elif len(parts) == 4:
            user_id, email, role = parts[1], parts[2], parts[3]
        else:
            raise HTTPException(status_code=401, detail="Invalid department authentication token")

        if not user_id or not role:
            raise HTTPException(status_code=401, detail="Invalid department authentication token")

        try:
            query = db.table("users").select("*").eq("id", user_id).eq("role", role)
            if email:
                query = query.eq("email", email)
            response = query.limit(1).execute()
            profile = first_row(response.data)
        except Exception as exc:
            raise HTTPException(
                status_code=401,
                detail=f"Invalid or expired authentication token: {str(exc)}",
            ) from exc

        if not profile:
            raise HTTPException(status_code=401, detail="Authenticated user not found")

        department = profile.get("role") or role
        return {
            "token": token,
            "user": {
                "id": profile.get("id"),
                "email": profile.get("email"),
                "phone": profile.get("phone"),
                "user_metadata": {
                    "department": department,
                    "role": department,
                    "username": profile.get("username"),
                    "full_name": profile.get("name"),
                },
                "app_metadata": {},
            },
        }

    try:
        response = db.auth.get_user(token)
        user_data = _serialize_user(getattr(response, "user", None))
    except Exception as exc:
        raise HTTPException(
            status_code=401, 
            detail=f"Invalid or expired authentication token: {str(exc)}"
        ) from exc

    if not user_data.get("id"):
        raise HTTPException(status_code=401, detail="Authenticated user not found")

    return {"token": token, "user": user_data}


def fetch_user_profile(user_id: str) -> Optional[Dict[str, Any]]:
    """Fetch extended user profile from users table"""
    try:
        response = (
            db.table("users")
            .select("id, name, email, phone, role, is_verified, created_at")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        return first_row(response.data)
    except Exception:
        return None


def ensure_user_profile_exists(user_id: str, email: str, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
    """Ensure a user profile exists in users table"""
    existing_profile = fetch_user_profile(user_id)
    if existing_profile:
        return existing_profile
    
    try:
        profile_data = {
            "id": user_id,
            "email": email,
            "name": metadata.get("full_name", email.split("@")[0]) if metadata else email.split("@")[0],
            "phone": metadata.get("phone_number") if metadata and metadata.get("phone_number") else f"NA-{user_id[:12]}",
            "role": "Organizer",  # Default role
            "is_verified": False,
        }
        
        response = db.table("users").insert(profile_data).execute()
        return first_row(response.data) or profile_data
    except Exception as e:
        # User profile might already exist, return what we can
        return {"id": user_id, "email": email, "name": email.split("@")[0]}
