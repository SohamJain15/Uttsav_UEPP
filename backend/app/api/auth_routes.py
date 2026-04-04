from supabase import create_client

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import fetch_user_profile, first_row, get_current_user
from app.core.database import SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, db
from app.models.schemas import AuthRegisterRequest, UserCredentials, UserProfileUpdateRequest

router = APIRouter()


def _new_auth_client():
    auth_key = SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY
    if not SUPABASE_URL or not auth_key:
        raise HTTPException(status_code=500, detail="Supabase auth client is not configured.")
    return create_client(SUPABASE_URL, auth_key)


def _error_detail(exc: Exception, fallback: str) -> str:
    return str(getattr(exc, "message", None) or exc or fallback)


def _serialize_user(user: Any) -> Dict[str, Any]:
    if user is None:
        return {}
    if hasattr(user, "model_dump"):
        return user.model_dump(mode="json")
    return {
        "id": getattr(user, "id", None),
        "email": getattr(user, "email", None),
        "phone": getattr(user, "phone", None),
    }


def _normalize_department(value: Any) -> str:
    normalized = str(value or "").strip().lower()
    if not normalized:
        return "Organizer"
    if normalized in {"admin", "superadmin"}:
        return "Admin"
    if "police" in normalized:
        return "Police"
    if "fire" in normalized:
        return "Fire"
    if "traffic" in normalized:
        return "Traffic"
    if "municip" in normalized:
        return "Municipality"
    if "organizer" in normalized or "applicant" in normalized or "user" in normalized:
        return "Organizer"
    return str(value).strip() or "Organizer"


def _prefix_for_department(department: str) -> Optional[str]:
    mapping = {
        "Police": "P",
        "Fire": "FB",
        "Traffic": "T",
        "Municipality": "M",
        "Admin": "A",
        "Organizer": "U",
    }
    return mapping.get(department)


def _department_from_username(username: str) -> Optional[str]:
    normalized = str(username or "").strip().upper()
    if not normalized:
        return None
    compact = normalized.replace("-", "")
    if compact.startswith("FB"):
        return "Fire"
    if compact.startswith("P"):
        return "Police"
    if compact.startswith("T"):
        return "Traffic"
    if compact.startswith("M"):
        return "Municipality"
    if compact.startswith("A"):
        return "Admin"
    if compact.startswith("U"):
        return "Organizer"
    return None


def get_role_from_username(username: str) -> str:
    normalized = str(username or "").strip().upper()
    if normalized.startswith("P-"):
        return "Police"
    if normalized.startswith("F-") or normalized.startswith("FB-"):
        return "Fire"
    if normalized.startswith("T-"):
        return "Traffic"
    if normalized.startswith("M-"):
        return "Municipality"
    if normalized.startswith("A-"):
        return "Admin"
    raise HTTPException(status_code=400, detail="Invalid department username")


def _normalize_username(username: Any) -> str:
    return str(username or "").strip().upper()


def _generate_username(user_id: str, department: str) -> str:
    prefix = _prefix_for_department(department) or "U"
    suffix = str(user_id).replace("-", "").upper()[:6]
    return f"{prefix}-{suffix}"


def _resolve_login_email(identifier: str) -> str:
    raw_identifier = str(identifier or "").strip()
    if not raw_identifier:
        raise HTTPException(status_code=400, detail="Email is required.")

    if "@" in raw_identifier:
        return raw_identifier

    raise HTTPException(
        status_code=400,
        detail="Please sign in with your registered email address.",
    )


def _enrich_profile(profile: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not profile:
        return profile
    enriched = dict(profile)
    if not enriched.get("department") and enriched.get("role"):
        enriched["department"] = _normalize_department(enriched.get("role"))
    if not enriched.get("full_name") and enriched.get("name"):
        enriched["full_name"] = enriched.get("name")
    if not enriched.get("phone_number") and enriched.get("phone"):
        enriched["phone_number"] = enriched.get("phone")
    if not enriched.get("organization") and enriched.get("organization_type"):
        enriched["organization"] = enriched.get("organization_type")
    if not enriched.get("organization"):
        enriched["organization"] = None
    if not enriched.get("username"):
        enriched["username"] = enriched.get("prefix") or enriched.get("email")
    return enriched


def _fetch_profile_by_user_or_email(user_id: Optional[str], email: Optional[str]) -> Optional[Dict[str, Any]]:
    if user_id:
        profile = fetch_user_profile(user_id)
        if profile:
            return _enrich_profile(profile)

    if email:
        try:
            by_email = db.table("users").select("*").eq("email", email).limit(1).execute()
            row = first_row(by_email.data)
            if row:
                return _enrich_profile(row)
        except Exception:
            return None
    return None


def _fetch_department_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    role = get_role_from_username(username)
    normalized_username = _normalize_username(username)
    response = (
        db.table("users")
        .select("*")
        .eq("prefix", normalized_username)
        .eq("role", role)
        .limit(1)
        .execute()
    )
    return first_row(response.data)


def _validate_department_login_password(user_row: Dict[str, Any], password: str) -> None:
    stored_password = user_row.get("password") or user_row.get("password_hash")

    if stored_password:
        if str(stored_password) != str(password):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        return

    # Demo fallback for seeded department users where auth.users has the real password
    # but public.users has no password hash column populated.
    if str(password) != "Admin@123":
        raise HTTPException(status_code=401, detail="Invalid credentials")


def _user_payload_candidates(user_id: str, email: str, payload: Dict[str, Any]) -> list[Dict[str, Any]]:
    department = _normalize_department(payload.get("department"))
    username = _normalize_username(payload.get("username")) or _generate_username(user_id, department)
    return [
        {
            "id": user_id,
            "email": email,
            "name": payload.get("full_name"),
            "phone": payload.get("phone_number"),
            "role": department,
            "prefix": username,
            "organization_type": payload.get("organization"),
            "is_active": True,
        },
        {
            "id": user_id,
            "email": email,
            "name": payload.get("full_name"),
            "phone": payload.get("phone_number"),
            "role": department,
            "prefix": username,
            "organization_type": payload.get("organization"),
        },
        {
            "id": user_id,
            "email": email,
            "name": payload.get("full_name"),
            "phone": payload.get("phone_number"),
            "role": department,
            "prefix": username,
        },
        {
            "id": user_id,
            "email": email,
            "name": payload.get("full_name"),
            "phone": payload.get("phone_number"),
            "role": department,
        },
    ]


def _upsert_user_profile(user_id: str, email: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    last_error: Optional[Exception] = None
    for candidate in _user_payload_candidates(user_id, email, payload):
        candidate_payload = {k: v for k, v in candidate.items() if v is not None}
        try:
            response = db.table("users").upsert(candidate_payload).execute()
            profile = first_row(response.data)
            if profile:
                return _enrich_profile(profile) or candidate_payload

            fetched = _fetch_profile_by_user_or_email(user_id=user_id, email=email)
            if fetched:
                return fetched
            return _enrich_profile(candidate_payload) or candidate_payload
        except Exception as exc:
            last_error = exc
            continue

    raise HTTPException(
        status_code=500,
        detail=_error_detail(last_error or Exception("Unknown users upsert error"), "Failed to sync user profile"),
    )


@router.post("/api/auth/register")
async def register_user(payload: AuthRegisterRequest):
    try:
        department = _normalize_department(payload.department)
        username = _normalize_username(payload.username)
        if username:
            username_department = _department_from_username(username)
            if username_department != department:
                raise HTTPException(
                    status_code=400,
                    detail=f"Username prefix does not match department {department}.",
                )
        else:
            username = ""
            
        # Use isolated auth client so global service-role DB session is not mutated.
        auth_client = _new_auth_client()
        auth_response = auth_client.auth.sign_up(
            {
                "email": payload.email,
                "password": payload.password,
                "options": {
                    "data": {
                        "full_name": payload.full_name,
                        "phone_number": payload.phone_number,
                        "organization": payload.organization,
                        "department": department,
                        "role": department,
                        "username": username or None,
                    }
                }
            }
        )
        
        created_user = _serialize_user(getattr(auth_response, "user", None))
        user_id = created_user.get("id")
        if not user_id:
            raise HTTPException(status_code=500, detail="Supabase did not return a created user id")

        profile = _upsert_user_profile(
            user_id=user_id,
            email=payload.email,
            payload={
                "full_name": payload.full_name,
                "phone_number": payload.phone_number,
                "department": department,
                "organization": payload.organization,
                "username": username,
            },
        )

        return {
            "status": "success",
            "message": "User registered successfully",
            "user": created_user,
            "profile": profile,
        }
    except HTTPException:
        raise
    except Exception as exc:
        # Improved error extraction so if Supabase rejects a bad password, the frontend sees exactly why
        error_msg = str(getattr(exc, "message", None) or exc)
        raise HTTPException(status_code=400, detail=f"Registration failed: {error_msg}") from exc


@router.post("/api/auth/login")
async def login_user(credentials: UserCredentials):
    try:
        login_identifier = str(credentials.email or "").strip()
        if not login_identifier:
            raise HTTPException(status_code=400, detail="Email or username is required.")

        login_email = login_identifier
        department_profile = None

        if "@" not in login_identifier:
            department_user = _fetch_department_user_by_username(login_identifier)
            if not department_user:
                raise HTTPException(status_code=401, detail="Invalid credentials")

            _validate_department_login_password(department_user, credentials.password)
            login_email = department_user.get("email")
            if not login_email:
                raise HTTPException(
                    status_code=500,
                    detail="Department profile does not have a linked email address.",
                )
            department_profile = _enrich_profile(
                {
                    **department_user,
                    "full_name": department_user.get("name"),
                    "phone_number": department_user.get("phone"),
                    "department": department_user.get("role"),
                    "organization": department_user.get("organization_type"),
                    "username": department_user.get("prefix"),
                }
            )

            local_token = f"department::{department_user.get('id')}::{department_user.get('role')}"
            return {
                "status": "success",
                "message": "Login successful",
                "access_token": local_token,
                "token_type": "bearer",
                "user": {
                    "id": department_user.get("id"),
                    "email": department_user.get("email"),
                    "phone": department_user.get("phone"),
                    "user_metadata": {
                        "role": department_user.get("role"),
                        "department": department_user.get("role"),
                        "username": department_user.get("prefix"),
                        "full_name": department_user.get("name"),
                    },
                },
                "profile": department_profile,
            }
        else:
            login_email = _resolve_login_email(login_identifier)

        auth_client = _new_auth_client()
        response = auth_client.auth.sign_in_with_password(
            {"email": login_email, "password": credentials.password}
        )
        session = getattr(response, "session", None)
        token = getattr(session, "access_token", None)
        user_data = _serialize_user(getattr(response, "user", None))

        if not token:
            raise HTTPException(status_code=401, detail="Login failed: no access token returned")

        metadata = (getattr(response.user, "user_metadata", None) or {}) if getattr(response, "user", None) else {}
        profile = department_profile or _fetch_profile_by_user_or_email(
            user_data.get("id"), user_data.get("email")
        )
        if profile is None:
            profile = {
                "id": user_data.get("id"),
                "email": user_data.get("email"),
                "full_name": metadata.get("full_name"),
                "phone_number": metadata.get("phone_number"),
                "organization": metadata.get("organization"),
                "department": _normalize_department(metadata.get("department") or metadata.get("role")),
            }
        profile = _enrich_profile(profile)

        return {
            "status": "success",
            "message": "Login successful",
            "access_token": token,
            "token_type": "bearer",
            "user": user_data,
            "profile": profile,
        }
    except HTTPException:
        raise
    except Exception as exc:
        detail = _error_detail(exc, "Login failed")
        if "Database error querying schema" in detail:
            detail = (
                "Authentication backend is misconfigured. Set SUPABASE_ANON_KEY in backend/.env "
                "to your Supabase project anon key and restart the backend."
            )
            raise HTTPException(status_code=500, detail=detail) from exc
        raise HTTPException(status_code=401, detail=detail) from exc


@router.get("/api/user/profile")
async def get_profile(current=Depends(get_current_user)):
    user_data = current["user"]
    profile = _fetch_profile_by_user_or_email(user_data.get("id"), user_data.get("email"))
    return {
        "status": "success",
        "user": user_data,
        "profile": profile or {"id": user_data.get("id"), "email": user_data.get("email")},
    }


@router.put("/api/user/profile")
async def update_profile(payload: UserProfileUpdateRequest, current=Depends(get_current_user)):
    user_data = current["user"]
    update_data = payload.model_dump(exclude_unset=True, exclude_none=True)

    try:
        if not update_data:
            profile = _fetch_profile_by_user_or_email(user_data.get("id"), user_data.get("email"))
            return {
                "status": "success",
                "message": "No profile changes supplied",
                "profile": profile or {"id": user_data.get("id"), "email": user_data.get("email")},
            }

        existing = _fetch_profile_by_user_or_email(user_data.get("id"), user_data.get("email")) or {}
        merged = {
            "full_name": update_data.get("full_name")
            or existing.get("full_name")
            or existing.get("name"),
            "phone_number": update_data.get("phone_number")
            or existing.get("phone_number")
            or existing.get("phone"),
            "department": update_data.get("department")
            or existing.get("department")
            or existing.get("role")
            or "Organizer",
        }

        profile = _upsert_user_profile(
            user_id=user_data["id"],
            email=user_data.get("email") or existing.get("email") or "",
            payload=merged,
        )

        return {
            "status": "success",
            "message": "Profile updated successfully",
            "profile": profile,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_error_detail(exc, "Failed to update profile"),
        ) from exc
