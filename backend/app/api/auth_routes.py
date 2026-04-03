from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import fetch_user_profile, first_row, get_current_user
from app.core.database import db
from app.models.schemas import AuthRegisterRequest, UserCredentials, UserProfileUpdateRequest

router = APIRouter()


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


def _build_profile_payload(user_id: str, email: Optional[str], payload: Dict[str, Any]) -> Dict[str, Any]:
    profile_payload = {"id": user_id, "email": email}
    for key in ("full_name", "phone_number", "organization", "department"):
        value = payload.get(key)
        if value is not None:
            profile_payload[key] = value
    return profile_payload


@router.post("/api/auth/register")
async def register_user(payload: AuthRegisterRequest):
    try:
        auth_response = db.auth.admin.create_user(
            {
                "email": payload.email,
                "password": payload.password,
                "email_confirm": True,
                "user_metadata": {
                    "full_name": payload.full_name,
                    "phone_number": payload.phone_number,
                    "organization": payload.organization,
                    "department": payload.department,
                },
            }
        )
        created_user = _serialize_user(getattr(auth_response, "user", None))
        user_id = created_user.get("id")
        if not user_id:
            raise HTTPException(status_code=500, detail="Supabase did not return a created user id")

        profile_payload = _build_profile_payload(
            user_id=user_id,
            email=payload.email,
            payload=payload.model_dump(exclude={"password"}),
        )
        db.table("users").upsert(profile_payload).execute()
        profile = fetch_user_profile(user_id) or profile_payload

        return {
            "status": "success",
            "message": "User registered successfully",
            "user": created_user,
            "profile": profile,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=_error_detail(exc, "Registration failed")) from exc


@router.post("/api/auth/login")
async def login_user(credentials: UserCredentials):
    try:
        response = db.auth.sign_in_with_password(
            {"email": credentials.email, "password": credentials.password}
        )
        session = getattr(response, "session", None)
        token = getattr(session, "access_token", None)
        user_data = _serialize_user(getattr(response, "user", None))

        if not token:
            raise HTTPException(status_code=401, detail="Login failed: no access token returned")

        profile = fetch_user_profile(user_data.get("id")) if user_data.get("id") else None
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
        raise HTTPException(status_code=401, detail=_error_detail(exc, "Login failed")) from exc


@router.get("/api/user/profile")
async def get_profile(current=Depends(get_current_user)):
    user_data = current["user"]
    profile = fetch_user_profile(user_data["id"])
    return {
        "status": "success",
        "user": user_data,
        "profile": profile or {"id": user_data["id"], "email": user_data.get("email")},
    }


@router.put("/api/user/profile")
async def update_profile(payload: UserProfileUpdateRequest, current=Depends(get_current_user)):
    user_data = current["user"]
    update_data = payload.model_dump(exclude_unset=True, exclude_none=True)

    try:
        if not update_data:
            profile = fetch_user_profile(user_data["id"])
            return {
                "status": "success",
                "message": "No profile changes supplied",
                "profile": profile or {"id": user_data["id"], "email": user_data.get("email")},
            }

        update_data.update({"id": user_data["id"], "email": user_data.get("email")})
        response = db.table("users").upsert(update_data).execute()
        profile = first_row(response.data) or fetch_user_profile(user_data["id"]) or update_data

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
