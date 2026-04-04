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
    query_variants = [
        "id, prefix, name, email, phone, role, organization_type, is_active, created_at",
        "id, name, email, phone, role, created_at",
        "*",
    ]

    for query in query_variants:
        try:
            response = (
                db.table("users")
                .select(query)
                .eq("id", user_id)
                .limit(1)
                .execute()
            )
            row = first_row(response.data)
            if not row:
                continue
            return {
                **row,
                "full_name": row.get("full_name") or row.get("name"),
                "phone_number": row.get("phone_number") or row.get("phone"),
                "department": row.get("department") or row.get("role"),
                "organization": row.get("organization") or row.get("organization_type"),
                "username": row.get("username") or row.get("prefix") or row.get("email"),
            }
        except Exception:
            continue
    return None


def ensure_user_profile_exists(user_id: str, email: str, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
    """Ensure a user profile exists in users table"""
    existing_profile = fetch_user_profile(user_id)
    if existing_profile:
        return existing_profile

    metadata = metadata or {}
    role = str(metadata.get("department") or metadata.get("role") or "Organizer")
    role = role if role else "Organizer"
    prefix_map = {
        "Police": "P",
        "Fire": "FB",
        "Traffic": "T",
        "Municipality": "M",
        "Admin": "A",
        "Organizer": "U",
    }
    prefix_seed = str(user_id).replace("-", "").upper()[:6]
    generated_prefix = f"{prefix_map.get(role, 'U')}-{prefix_seed}"

    payload_candidates = [
        {
            "id": user_id,
            "email": email,
            "name": metadata.get("full_name", email.split("@")[0]),
            "phone": metadata.get("phone_number") or f"NA-{user_id[:12]}",
            "role": role,
            "prefix": metadata.get("username") or generated_prefix,
            "organization_type": metadata.get("organization"),
            "is_active": True,
        },
        {
            "id": user_id,
            "email": email,
            "name": metadata.get("full_name", email.split("@")[0]),
            "phone": metadata.get("phone_number") or f"NA-{user_id[:12]}",
            "role": role,
            "prefix": metadata.get("username") or generated_prefix,
            "organization_type": metadata.get("organization"),
        },
        {
            "id": user_id,
            "email": email,
            "name": metadata.get("full_name", email.split("@")[0]),
            "phone": metadata.get("phone_number") or f"NA-{user_id[:12]}",
            "role": role,
        },
    ]

    try:
        for profile_data in payload_candidates:
            try:
                response = db.table("users").upsert(profile_data).execute()
                row = first_row(response.data)
                if row:
                    return row
            except Exception:
                continue
    except Exception:
        pass

    # User profile might already exist, return what we can
    return {"id": user_id, "email": email, "name": email.split("@")[0], "role": role}
