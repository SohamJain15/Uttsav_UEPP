import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import fetch_user_profile, first_row, get_current_user
from app.core.database import db
from app.models.schemas import (
    ApplicationSubmitRequest,
    ApprovalProbabilityRequest,
    AssistantQueryRequest,
    RiskAnalysisRequest,
    RouteCollisionRequest,
    UserCredentials,
)
from app.services.approval_probability import (
    ApprovalProbabilityError,
    forecast_approval_probability,
)
from app.services.collision_engine import CollisionEngineError, analyze_route_collision
from app.services.rag_assistant import AssistantError, answer_assistant_query
from app.services.risk_engine import RiskEngineError, analyze_risk

router = APIRouter()


def _user_public_dict(user: Any) -> Optional[Dict[str, Any]]:
    if user is None:
        return None
    if hasattr(user, "model_dump"):
        return user.model_dump(mode="json")
    return {
        "id": getattr(user, "id", None),
        "email": getattr(user, "email", None),
        "phone": getattr(user, "phone", None),
    }


def _error_detail(exc: Exception, fallback: str) -> str:
    return str(getattr(exc, "message", None) or exc or fallback)


def _payload_to_dict(payload: Any) -> Dict[str, Any]:
    if hasattr(payload, "model_dump"):
        return payload.model_dump(exclude_none=True)
    return payload.dict(exclude_none=True)


def _application_with_event(app_id: str) -> Dict[str, Any]:
    application_response = (
        db.table("applications").select("*").eq("app_id", app_id).limit(1).execute()
    )
    application = first_row(application_response.data)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    event = None
    event_id = application.get("event_id")
    if event_id:
        event_response = db.table("events").select("*").eq("id", event_id).limit(1).execute()
        event = first_row(event_response.data)

    routing_response = (
        db.table("department_routings")
        .select("*")
        .eq("app_id", app_id)
        .order("updated_at", desc=True)
        .execute()
    )

    return {
        "application": application,
        "event": event,
        "department_routings": routing_response.data or [],
    }


def _assert_application_owner(application: Dict[str, Any], user_id: str) -> None:
    owner_id = application.get("user_id")
    if owner_id and owner_id != user_id:
        raise HTTPException(status_code=403, detail="You are not allowed to access this application")


@router.post("/signup")
async def signup(credentials: UserCredentials):
    try:
        response = db.auth.admin.create_user(
            {
                "email": credentials.email,
                "password": credentials.password,
                "email_confirm": True,
            }
        )
        return {
            "status": "success",
            "message": "User created successfully",
            "user": _user_public_dict(response.user),
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=_error_detail(exc, "Signup failed")) from exc


@router.post("/login")
async def login(credentials: UserCredentials):
    try:
        response = db.auth.sign_in_with_password(
            {
                "email": credentials.email,
                "password": credentials.password,
            }
        )
        session = response.session
        if not session or not session.access_token:
            raise HTTPException(
                status_code=401,
                detail="Login failed: no session returned",
            )
        return {
            "status": "success",
            "message": "Login successful",
            "access_token": session.access_token,
            "user": _user_public_dict(response.user),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=_error_detail(exc, "Login failed")) from exc


@router.post("/risk/calculate")
async def calculate_event_risk(payload: RiskAnalysisRequest):
    try:
        return analyze_risk(_payload_to_dict(payload))
    except RiskEngineError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Risk analysis failed: {exc}")


@router.post("/applications/analyze-risk")
async def analyze_application_risk(payload: RiskAnalysisRequest):
    return await calculate_event_risk(payload)


@router.post("/assistant/query")
async def query_assistant(payload: AssistantQueryRequest):
    try:
        return answer_assistant_query(_payload_to_dict(payload))
    except AssistantError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Assistant query failed: {exc}")


@router.post("/approval/probability")
async def get_approval_probability(payload: ApprovalProbabilityRequest):
    try:
        return forecast_approval_probability(_payload_to_dict(payload))
    except ApprovalProbabilityError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Approval forecast failed: {exc}")


@router.post("/applications/predict-approval")
async def predict_application_approval(payload: ApprovalProbabilityRequest):
    return await get_approval_probability(payload)


@router.post("/route-collision/check")
async def check_route_collision(payload: RouteCollisionRequest):
    try:
        return analyze_route_collision(_payload_to_dict(payload))
    except CollisionEngineError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Route collision analysis failed: {exc}")


@router.post("/applications/check-route-collision")
async def check_application_route_collision(payload: RouteCollisionRequest):
    return await check_route_collision(payload)


@router.post("/submit-application")
async def submit_application(payload: ApplicationSubmitRequest, current=Depends(get_current_user)):
    try:
        new_event_id = str(uuid.uuid4())
        custom_app_id = f"UEPP-{new_event_id[:8].upper()}"
        user_id = current["user"]["id"]

        event_data = {
            "id": new_event_id,
            "name": payload.event_name,
            "category": payload.event_type,
            "expected_crowd": payload.crowd_size,
            "start_time": payload.start_date,
            "end_time": payload.end_date,
            "raw_address": payload.address,
            "city": payload.city,
            "pincode": payload.pincode,
            "latitude": payload.map_latitude,
            "longitude": payload.map_longitude,
            "is_moving_procession": payload.is_moving_procession,
        }
        db.table("events").insert(event_data).execute()

        app_data = {
            "app_id": custom_app_id,
            "event_id": new_event_id,
            "status": "Submitted",
            "user_id": user_id,
        }
        try:
            db.table("applications").insert(app_data).execute()
        except Exception:
            app_data.pop("user_id", None)
            db.table("applications").insert(app_data).execute()

        departments_needed: List[str] = []
        if payload.crowd_size > 200 or payload.is_moving_procession or payload.has_loudspeakers:
            departments_needed.append("Police")
        if payload.has_fireworks:
            departments_needed.append("Fire")
        if payload.is_moving_procession or payload.crowd_size > 1000:
            departments_needed.append("Traffic")
        if payload.food_stalls or payload.venue_type == "Public Ground":
            departments_needed.append("Municipality")
        if not departments_needed:
            departments_needed.append("Municipality")

        # Keep insertion stable and idempotent if multiple conditions add the same department.
        seen = set()
        ordered_departments = []
        for department in departments_needed:
            if department in seen:
                continue
            seen.add(department)
            ordered_departments.append(department)

        routing_inserts = [
            {"app_id": custom_app_id, "department": department, "status": "Pending"}
            for department in ordered_departments
        ]
        db.table("department_routings").insert(routing_inserts).execute()

        return {
            "status": "success",
            "message": "Application stored and routed successfully!",
            "application_id": custom_app_id,
            "routed_to": ordered_departments,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Database insertion failed: {str(exc)}",
        ) from exc


@router.get("/applications")
async def get_user_applications(current=Depends(get_current_user)):
    user_id = current["user"]["id"]

    try:
        try:
            response = (
                db.table("applications")
                .select("app_id, status, submitted_at, user_id, events(name, category, expected_crowd, start_time, raw_address)")
                .eq("user_id", user_id)
                .order("submitted_at", desc=True)
                .execute()
            )
            rows = response.data or []
        except Exception:
            rows = []

        if not rows:
            # Backward compatibility for deployments where applications.user_id is absent.
            response = (
                db.table("applications")
                .select("app_id, status, submitted_at, events(name, category, expected_crowd, start_time, raw_address)")
                .order("submitted_at", desc=True)
                .execute()
            )
            rows = response.data or []

        formatted_apps = []
        for app in rows:
            event = app.get("events") or {}
            if isinstance(event, list):
                event = event[0] if event else {}
            formatted_apps.append(
                {
                    "id": app.get("app_id"),
                    "eventName": event.get("name", "Unknown Event"),
                    "eventType": event.get("category", "Unknown"),
                    "crowdSize": event.get("expected_crowd", 0),
                    "venueType": "Public",
                    "status": app.get("status", "Pending"),
                    "submittedAt": app.get("submitted_at"),
                    "address": event.get("raw_address", "Unknown"),
                }
            )

        return {"status": "success", "data": formatted_apps}
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_error_detail(exc, "Failed to fetch applications"),
        ) from exc


@router.get("/applications/{app_id}")
async def get_application_detail(app_id: str, current=Depends(get_current_user)):
    try:
        payload = _application_with_event(app_id)
        _assert_application_owner(payload["application"], current["user"]["id"])
        return {
            "status": "success",
            "data": payload,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_error_detail(exc, "Failed to fetch application details"),
        ) from exc


@router.get("/notifications")
async def get_notifications(current=Depends(get_current_user)):
    user_id = current["user"]["id"]

    try:
        try:
            apps_response = db.table("applications").select("app_id").eq("user_id", user_id).execute()
            app_ids: List[str] = [row["app_id"] for row in apps_response.data or [] if row.get("app_id")]
        except Exception:
            app_ids = []

        if app_ids:
            routings_response = (
                db.table("department_routings")
                .select("app_id, department, status, rejection_reason, updated_at")
                .in_("app_id", app_ids)
                .order("updated_at", desc=True)
                .execute()
            )
            routing_rows = routings_response.data or []
        else:
            routing_rows = []

        notifications = []
        for routing in routing_rows:
            notifications.append(
                {
                    "app_id": routing.get("app_id"),
                    "department": routing.get("department"),
                    "status": routing.get("status"),
                    "message": routing.get("rejection_reason")
                    or f"{routing.get('department', 'Department')} updated status to {routing.get('status', 'Pending')}",
                    "updated_at": routing.get("updated_at"),
                }
            )

        profile = fetch_user_profile(user_id)
        return {
            "status": "success",
            "profile": profile,
            "notifications": notifications,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_error_detail(exc, "Failed to fetch notifications"),
        ) from exc
