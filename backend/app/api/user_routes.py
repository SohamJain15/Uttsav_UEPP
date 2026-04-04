import uuid
import os
from datetime import UTC, datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.encoders import jsonable_encoder

from app.core.auth import ensure_user_profile_exists, fetch_user_profile, first_row, get_current_user
from app.core.database import db
from app.models.schemas import (
    ApplicationSubmitRequest,
    ApprovalProbabilityRequest,
    AssistantQueryRequest,
    RespondQueryRequest,
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
BACKEND_PUBLIC_BASE_URL = os.getenv("BACKEND_PUBLIC_BASE_URL", "http://127.0.0.1:8001").rstrip("/")


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


def _json_ready(payload: Any) -> Any:
    return jsonable_encoder(payload, exclude_none=True)


def _normalize_department_status(raw_status: Any) -> str:
    normalized = str(raw_status or "").strip().lower()
    if normalized in {"approve", "approved"}:
        return "Approved"
    if normalized in {"reject", "rejected", "deny", "denied"}:
        return "Rejected"
    if normalized in {"query", "query raised", "query_raised"}:
        return "Query Raised"
    if normalized in {"in review", "in_review", "review"}:
        return "In Review"
    if normalized in {"pending", "submitted", ""}:
        return "Pending"
    return str(raw_status or "Pending").strip() or "Pending"


def _derive_overall_status_from_departments(department_rows: List[Dict[str, Any]]) -> str:
    statuses = [_normalize_department_status(row.get("status")) for row in department_rows]
    if not statuses:
        return "Pending"
    if any(status == "Rejected" for status in statuses):
        return "Rejected"
    if any(status == "Query Raised" for status in statuses):
        return "Query Raised"
    if all(status == "Approved" for status in statuses):
        return "Approved"
    if any(status == "In Review" for status in statuses):
        return "In Review"
    return "Pending"


def _department_candidates(name: str) -> List[str]:
    base = str(name or "").strip()
    if not base:
        return []
    candidates = [base]
    if not base.lower().endswith("department"):
        candidates.append(f"{base} Department")
    return [item for item in dict.fromkeys(candidates) if item]


def _insert_event_with_schema_fallback(
    event_id: str,
    user_id: str,
    payload: ApplicationSubmitRequest,
) -> None:
    common = {
        "id": event_id,
        "organizer_id": user_id,
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
    payload_candidates = [
        {**common},
        {k: v for k, v in common.items() if k != "organizer_id"},
    ]

    last_error: Optional[Exception] = None
    for candidate in payload_candidates:
        try:
            db.table("events").insert(_json_ready(candidate)).execute()
            return
        except Exception as exc:
            last_error = exc
            continue
    raise HTTPException(
        status_code=500,
        detail=f"Events insertion failed: {_error_detail(last_error or Exception(), 'Unknown error')}",
    )


def _insert_application_with_schema_fallback(app_id: str, event_id: str, user_id: str) -> None:
    now_iso = datetime.now(UTC).isoformat()
    payload_candidates = [
        {
            "app_id": app_id,
            "event_id": event_id,
            "status": "Pending",
            "submitted_at": now_iso,
            "user_id": str(user_id),  # Ensure user_id is string UUID
        },
        {
            "app_id": app_id,
            "event_id": event_id,
            "status": "Submitted",
            "submitted_at": now_iso,
            "user_id": str(user_id),  # Ensure user_id is string UUID
            "user_id": user_id,
        },
        {
            "app_id": app_id,
            "event_id": event_id,
            "status": "Draft",
            "submitted_at": now_iso,
        },
        {
            "app_id": app_id,
            "event_id": event_id,
            "submitted_at": now_iso,
        },
    ]
    last_error: Optional[Exception] = None
    for candidate in payload_candidates:
        try:
            db.table("applications").insert(_json_ready(candidate)).execute()
            return
        except Exception as exc:
            last_error = exc
            continue
    raise HTTPException(
        status_code=500,
        detail=f"Applications insertion failed: {_error_detail(last_error or Exception(), 'Unknown error')}",
    )


def _insert_department_routings_with_fallback(app_id: str, departments: List[str]) -> None:
    # Fast path for schemas that accept canonical department values.
    try:
        db.table("department_routings").insert(
            _json_ready(
                [
                    {"app_id": app_id, "department": department, "status": "Pending"}
                    for department in departments
                ]
            )
        ).execute()
        return
    except Exception:
        pass

    for department in departments:
        inserted = False
        for department_candidate in _department_candidates(department):
            for candidate in (
                {"app_id": app_id, "department": department_candidate, "status": "Pending"},
                {"app_id": app_id, "department": department_candidate},
            ):
                try:
                    db.table("department_routings").insert(_json_ready(candidate)).execute()
                    inserted = True
                    break
                except Exception:
                    continue
            if inserted:
                break
        if not inserted:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to route application to department {department}",
            )


def _fetch_user_application_rows(user_id: str) -> List[Dict[str, Any]]:
    """Fetch applications for a user, handling multiple schema variations"""
    # Primary query: fetch applications directly owned by user
    try:
        response = (
            db.table("applications")
            .select(
                "app_id, status, submitted_at, events!inner(id, organizer_id, name, category, expected_crowd, start_time, raw_address)"
            )
            .eq("user_id", user_id)
            .order("submitted_at", desc=True)
            .execute()
        )
        if response.data:
            return response.data
    except Exception:
        pass
    
    # Fallback: fetch applications via event organizer (user created the event)
    try:
        response = (
            db.table("applications")
            .select(
                "app_id, status, submitted_at, events!inner(id, organizer_id, name, category, expected_crowd, start_time, raw_address)"
            )
            .execute()
        )
        # Filter client-side for events where organizer_id matches
        filtered = []
        for app in response.data or []:
            event = app.get("events") or {}
            if isinstance(event, list) and event:
                event = event[0]
            if event.get("organizer_id") == user_id:
                filtered.append(app)
        if filtered:
            return filtered
    except Exception:
        pass
    
    return []


def _application_with_event(app_id: str) -> Dict[str, Any]:
    """Fetch complete application with event and routing details"""
    try:
        application_response = (
            db.table("applications")
            .select("*")
            .eq("app_id", app_id)
            .limit(1)
            .execute()
        )
        application = first_row(application_response.data)
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")

        event = None
        event_id = application.get("event_id")
        if event_id:
            try:
                event_response = (
                    db.table("events")
                    .select("*")
                    .eq("id", event_id)
                    .limit(1)
                    .execute()
                )
                event = first_row(event_response.data)
            except Exception as e:
                print(f"Warning: Could not fetch event {event_id}: {e}")

        # Fetch department routings
        try:
            routing_response = (
                db.table("department_routings")
                .select("*")
                .eq("app_id", app_id)
                .order("updated_at", desc=True)
                .execute()
            )
            department_routings = routing_response.data or []
        except Exception as e:
            print(f"Warning: Could not fetch department routings: {e}")
            department_routings = []

        # Fetch documents
        try:
            documents_response = (
                db.table("documents")
                .select("*")
                .eq("app_id", app_id)
                .execute()
            )
            documents = documents_response.data or []
        except Exception as e:
            print(f"Warning: Could not fetch documents: {e}")
            documents = []

        # Fetch AI intelligence logs if exists
        try:
            ai_logs_response = (
                db.table("ai_intelligence_logs")
                .select("*")
                .eq("app_id", app_id)
                .limit(1)
                .execute()
            )
            ai_logs = first_row(ai_logs_response.data)
        except Exception:
            ai_logs = None

        query_rows = []
        routing_ids = [row.get("id") for row in department_routings if row.get("id")]
        if routing_ids:
            try:
                query_rows = (
                    db.table("official_queries")
                    .select("id, routing_id, query_text, organizer_response, is_resolved, created_at")
                    .in_("routing_id", routing_ids)
                    .order("created_at", desc=True)
                    .execute()
                    .data
                    or []
                )
            except Exception:
                query_rows = []

        return {
            "application": application,
            "event": event,
            "department_routings": department_routings,
            "documents": documents,
            "ai_logs": ai_logs,
            "official_queries": query_rows,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch application details: {str(exc)}"
        ) from exc


def _assert_application_owner(payload: Dict[str, Any], user_id: str) -> None:
    application = payload.get("application") or {}
    event = payload.get("event") or {}
    owner_id = application.get("user_id") or event.get("organizer_id")
    if owner_id and str(owner_id) != str(user_id):
        raise HTTPException(status_code=403, detail="You are not allowed to access this application")


def _normalize_department_name(value: Any) -> str:
    normalized = str(value or "").strip().lower()
    if "police" in normalized:
        return "Police"
    if "fire" in normalized:
        return "Fire"
    if "traffic" in normalized:
        return "Traffic"
    if "municip" in normalized:
        return "Municipality"
    if "admin" in normalized:
        return "Admin"
    return str(value or "").strip() or "Department"


def _build_user_document_payload(app_id: str, documents: List[Dict[str, Any]]) -> Dict[str, Any]:
    department_nocs = []
    final_noc = None
    normal_documents = []

    for row in documents or []:
        file_name = row.get("file_name") or "document"
        storage_url = row.get("storage_url")
        uploaded_at = row.get("uploaded_at")
        doc_type = str(row.get("doc_type") or "")
        document = {
            "id": row.get("id"),
            "doc_type": doc_type or "General",
            "file_name": file_name,
            "storage_url": storage_url,
            "uploaded_at": uploaded_at,
        }

        if doc_type == "NOC_FINAL":
            final_noc = {
                "permitId": f"UTTSAV-NOC-{app_id}",
                "applicationId": app_id,
                "url": storage_url,
                "fileName": file_name,
                "issueDate": uploaded_at,
                "qrCode": f"{BACKEND_PUBLIC_BASE_URL}/api/dept/noc/{app_id}/pdf",
            }
            continue

        if doc_type.startswith("NOC_"):
            department_nocs.append(
                {
                    "department": doc_type.replace("NOC_", ""),
                    "url": storage_url,
                    "fileName": file_name,
                    "timestamp": uploaded_at,
                }
            )
            continue

        normal_documents.append(document)

    return {
        "documents": normal_documents,
        "department_nocs": department_nocs,
        "final_noc": final_noc,
    }


def _fetch_single_application_row(app_id: str) -> Dict[str, Any]:
    response = (
        db.table("applications")
        .select("app_id, event_id, user_id, status, submitted_at, created_at")
        .eq("app_id", app_id)
        .limit(1)
        .execute()
    )
    row = first_row(response.data)
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")
    return row


def _calculate_weighted_risk_score(event: Dict[str, Any]) -> Dict[str, Any]:
    crowd_size = max(int(event.get("expected_crowd") or 0), 0)
    start_time = datetime.fromisoformat(str(event.get("start_time")).replace("Z", "+00:00"))
    end_time = datetime.fromisoformat(str(event.get("end_time")).replace("Z", "+00:00"))
    duration_hours = max((end_time - start_time).total_seconds() / 3600.0, 1.0)

    crowd_component = min((crowd_size / 20000.0) * 100.0, 100.0)
    exit_component = 70.0 if crowd_size >= 5000 else 45.0 if crowd_size >= 1000 else 20.0
    capacity_component = min((crowd_size / 5000.0) * 100.0, 100.0)
    duration_component = min((duration_hours / 12.0) * 100.0, 100.0)

    score = (
        0.35 * crowd_component
        + 0.30 * exit_component
        + 0.20 * capacity_component
        + 0.15 * duration_component
    )

    if crowd_size > 20000:
        score += 10
    if start_time.hour >= 20 or start_time.hour <= 5:
        score += 8
    if str(event.get("category") or "").strip().lower() in {"indoor", "temporary indoor"}:
        score += 7

    score = int(round(min(score, 100)))
    risk_level = "High" if score >= 70 else "Medium" if score >= 40 else "Low"
    return {
        "status": "success",
        "risk_score": score,
        "risk_level": risk_level,
        "weights": {
            "crowd_density": 35,
            "fire_exit_ratio": 30,
            "capacity": 20,
            "duration": 15,
        },
    }


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
        user = response.user
        user_dict = _user_public_dict(user)
        
        # Ensure user profile exists in users table
        if user and user.id:
            ensure_user_profile_exists(str(user.id), credentials.email, {})
        
        return {
            "status": "success",
            "message": "User created successfully",
            "user": user_dict,
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


@router.get("/risk-score/{app_id}")
async def get_application_risk_score(app_id: str, current=Depends(get_current_user)):
    application = _fetch_single_application_row(app_id)
    if str(application.get("user_id") or "") != str(current["user"]["id"]):
        raise HTTPException(status_code=403, detail="You are not allowed to access this application")

    if not application.get("event_id"):
        raise HTTPException(status_code=404, detail="Linked event not found for this application")

    event_response = (
        db.table("events")
        .select("id, name, category, expected_crowd, start_time, end_time, latitude, longitude, pincode")
        .eq("id", application["event_id"])
        .limit(1)
        .execute()
    )
    event = first_row(event_response.data)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    score_payload = _calculate_weighted_risk_score(event)
    try:
        db.table("ai_intelligence_logs").upsert(
            _json_ready(
                {
                    "app_id": app_id,
                    "numerical_risk_score": score_payload["risk_score"],
                    "capacity_utilization": min(int(event.get("expected_crowd") or 0), 100),
                    "exit_safety_rating": score_payload["risk_level"],
                }
            )
        ).execute()
    except Exception:
        pass

    return {
        **score_payload,
        "app_id": app_id,
        "event_name": event.get("name"),
    }


@router.get("/detect-collision")
async def detect_collision(event_id: str = Query(..., min_length=1), current=Depends(get_current_user)):
    event_response = (
        db.table("events")
        .select("id, organizer_id, name, start_time, end_time, latitude, longitude")
        .eq("id", event_id)
        .limit(1)
        .execute()
    )
    target_event = first_row(event_response.data)
    if not target_event:
        raise HTTPException(status_code=404, detail="Event not found")
    if str(target_event.get("organizer_id") or "") != str(current["user"]["id"]):
        raise HTTPException(status_code=403, detail="You are not allowed to access this event")

    all_events = (
        db.table("events")
        .select("id, name, start_time, end_time, latitude, longitude")
        .execute()
        .data
        or []
    )

    target_start = datetime.fromisoformat(str(target_event["start_time"]).replace("Z", "+00:00"))
    target_end = datetime.fromisoformat(str(target_event["end_time"]).replace("Z", "+00:00"))
    target_lat = float(target_event.get("latitude") or 0)
    target_lng = float(target_event.get("longitude") or 0)

    collisions = []
    for other_event in all_events:
        if str(other_event.get("id")) == str(event_id):
            continue
        try:
            other_start = datetime.fromisoformat(str(other_event["start_time"]).replace("Z", "+00:00"))
            other_end = datetime.fromisoformat(str(other_event["end_time"]).replace("Z", "+00:00"))
        except Exception:
            continue

        overlaps_in_time = target_start <= other_end and other_start <= target_end
        distance_metric = abs(target_lat - float(other_event.get("latitude") or 0)) + abs(
            target_lng - float(other_event.get("longitude") or 0)
        )
        if overlaps_in_time and distance_metric <= 0.02:
            collisions.append(
                {
                    "event_id": other_event.get("id"),
                    "event_name": other_event.get("name"),
                    "distance_metric": round(distance_metric, 6),
                }
            )

    return {
        "status": "success",
        "event_id": event_id,
        "collision_detected": bool(collisions),
        "collisions": collisions,
    }


@router.post("/submit-application")
async def submit_application(payload: ApplicationSubmitRequest, current=Depends(get_current_user)):
    try:
        new_event_id = str(uuid.uuid4())
        custom_app_id = f"UEPP-{new_event_id[:8].upper()}"
        user_id = current["user"]["id"]

        _insert_event_with_schema_fallback(
            event_id=new_event_id,
            user_id=user_id,
            payload=payload,
        )

        _insert_application_with_schema_fallback(
            app_id=custom_app_id,
            event_id=new_event_id,
            user_id=user_id,
        )

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

        _insert_department_routings_with_fallback(custom_app_id, ordered_departments)

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
        rows = _fetch_user_application_rows(user_id)

        app_ids = [app.get("app_id") for app in rows if app.get("app_id")]
        routing_map: Dict[str, List[Dict[str, Any]]] = {}
        if app_ids:
            try:
                routing_rows = (
                    db.table("department_routings")
                    .select("app_id, department, status, rejection_reason, updated_at")
                    .in_("app_id", app_ids)
                    .order("updated_at", desc=True)
                    .execute()
                    .data
                    or []
                )
                for row in routing_rows:
                    routing_map.setdefault(row.get("app_id"), []).append(row)
            except Exception:
                routing_map = {}

        formatted_apps = []
        for app in rows:
            event = app.get("events") or {}
            if isinstance(event, list):
                event = event[0] if event else {}
            department_rows = routing_map.get(app.get("app_id"), [])
            overall_status = _derive_overall_status_from_departments(department_rows)
            department_payload = [
                {
                    "name": row.get("department"),
                    "status": _normalize_department_status(row.get("status")),
                    "reason": row.get("rejection_reason"),
                    "updatedAt": row.get("updated_at"),
                }
                for row in department_rows
                if row.get("department")
            ]
            formatted_apps.append(
                {
                    "id": app.get("app_id"),
                    "eventName": event.get("name", "Unknown Event"),
                    "eventType": event.get("category", "Unknown"),
                    "crowdSize": event.get("expected_crowd", 0),
                    "venueType": "Public",
                    "status": overall_status or app.get("status", "Pending"),
                    "submittedAt": app.get("submitted_at"),
                    "address": event.get("raw_address", "Unknown"),
                    "departments": department_payload,
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
        _assert_application_owner(payload, current["user"]["id"])
        department_rows = payload.get("department_routings") or []
        query_rows = payload.get("official_queries") or []
        query_by_routing_id = {}
        for query_row in query_rows:
            routing_id = query_row.get("routing_id")
            if routing_id and routing_id not in query_by_routing_id:
                query_by_routing_id[routing_id] = query_row
        overall_status = _derive_overall_status_from_departments(department_rows)
        payload["application"]["status"] = overall_status
        payload["departments"] = [
            {
                "name": _normalize_department_name(row.get("department")),
                "status": _normalize_department_status(row.get("status")),
                "reason": row.get("rejection_reason"),
                "updatedAt": row.get("updated_at"),
                "query_id": (query_by_routing_id.get(row.get("id")) or {}).get("id"),
            }
            for row in department_rows
            if row.get("department")
        ]
        documents_payload = _build_user_document_payload(app_id, payload.get("documents") or [])
        payload["documents"] = documents_payload["documents"]
        payload["department_nocs"] = documents_payload["department_nocs"]
        payload["final_noc"] = documents_payload["final_noc"]
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
        app_rows = _fetch_user_application_rows(user_id)
        app_ids: List[str] = [row["app_id"] for row in app_rows if row.get("app_id")]

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
            normalized_status = _normalize_department_status(routing.get("status"))
            notifications.append(
                {
                    "app_id": routing.get("app_id"),
                    "department": routing.get("department"),
                    "status": normalized_status,
                    "message": routing.get("rejection_reason")
                    or f"{routing.get('department', 'Department')} updated status to {normalized_status}",
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


@router.post("/respond-query")
async def respond_query(payload: RespondQueryRequest, current=Depends(get_current_user)):
    try:
        query_response = (
            db.table("official_queries")
            .select("id, routing_id, query_text, organizer_response, is_resolved")
            .eq("id", payload.query_id)
            .limit(1)
            .execute()
        )
        query_row = first_row(query_response.data)
        if not query_row:
            raise HTTPException(status_code=404, detail="Query not found")

        routing_response = (
            db.table("department_routings")
            .select("id, app_id, department, status")
            .eq("id", query_row["routing_id"])
            .limit(1)
            .execute()
        )
        routing_row = first_row(routing_response.data)
        if not routing_row:
            raise HTTPException(status_code=404, detail="Routing record not found for query")

        application_bundle = _application_with_event(routing_row["app_id"])
        _assert_application_owner(application_bundle, current["user"]["id"])

        updated_query = (
            db.table("official_queries")
            .update(
                _json_ready(
                    {
                        "organizer_response": payload.organizer_response,
                        "is_resolved": True,
                    }
                )
            )
            .eq("id", payload.query_id)
            .execute()
        )

        db.table("department_routings").update(_json_ready({"status": "In Review"})).eq(
            "id", routing_row["id"]
        ).execute()

        return {
            "status": "success",
            "message": "Query response submitted successfully",
            "query": first_row(updated_query.data) or {
                "id": payload.query_id,
                "organizer_response": payload.organizer_response,
                "is_resolved": True,
            },
            "app_id": routing_row["app_id"],
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_error_detail(exc, "Failed to submit query response"),
        ) from exc
