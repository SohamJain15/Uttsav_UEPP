from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import fetch_user_profile, first_row, get_current_user
from app.core.database import db
from app.models.schemas import DepartmentActionRequest

router = APIRouter()


def _error_detail(exc: Exception, fallback: str) -> str:
    return str(getattr(exc, "message", None) or exc or fallback)


def _resolve_department(current: Dict[str, Any]) -> Optional[str]:
    user_data = current["user"]
    metadata = user_data.get("user_metadata") or {}
    department = metadata.get("department")
    if department:
        return department

    profile = fetch_user_profile(user_data["id"])
    if profile:
        return profile.get("department")
    return None


def _status_count(rows: List[Dict[str, Any]], expected_status: str) -> int:
    return sum(1 for row in rows if (row.get("status") or "").lower() == expected_status.lower())


def _fetch_application_bundle(app_id: str, department: Optional[str] = None) -> Dict[str, Any]:
    app_response = db.table("applications").select("*").eq("app_id", app_id).limit(1).execute()
    application = first_row(app_response.data)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    event = None
    if application.get("event_id"):
        event_response = (
            db.table("events")
            .select("*")
            .eq("id", application["event_id"])
            .limit(1)
            .execute()
        )
        event = first_row(event_response.data)

    routing_query = db.table("department_routings").select("*").eq("app_id", app_id)
    if department:
        routing_query = routing_query.eq("department", department)
    routing_response = routing_query.order("updated_at", desc=True).execute()

    docs_response = (
        db.table("documents")
        .select("*")
        .eq("app_id", app_id)
        .order("created_at", desc=True)
        .execute()
    )

    return {
        "application": application,
        "event": event,
        "department_routings": routing_response.data or [],
        "documents": docs_response.data or [],
    }


@router.get("/applications/{department_name}")
async def get_department_applications(department_name: str, current=Depends(get_current_user)):
    """
    Fetches applications specific to a department (e.g., 'Police', 'Fire').
    """
    current_department = _resolve_department(current)
    if current_department and current_department != department_name:
        raise HTTPException(status_code=403, detail="You are not allowed to access this department queue")

    try:
        routings = db.table("department_routings").select(
            "app_id, status, updated_at, applications(status, events(name, expected_crowd, raw_address))"
        ).eq("department", department_name).execute()

        formatted_data = []
        for route in routings.data:
            app_info = route.get("applications") or {}
            event_info = app_info.get("events") or {}
            formatted_data.append({
                "id": route["app_id"],
                "eventName": event_info.get("name", "Unknown"),
                "crowdSize": event_info.get("expected_crowd", 0),
                "location": event_info.get("raw_address", "Unknown"),
                "departmentStatus": route["status"],
                "overallStatus": app_info.get("status", "Pending"),
                "lastUpdated": route["updated_at"]
            })

        return {"status": "success", "data": formatted_data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch department data: {str(e)}")


@router.get("/api/dept/dashboard-stats")
async def get_dashboard_stats(current=Depends(get_current_user)):
    department = _resolve_department(current)
    if not department:
        raise HTTPException(status_code=400, detail="Unable to resolve department for current user")

    try:
        response = (
            db.table("department_routings")
            .select("app_id, status")
            .eq("department", department)
            .execute()
        )
        rows = response.data or []
        return {
            "status": "success",
            "department": department,
            "total_pending": _status_count(rows, "Pending"),
            "total_approved": _status_count(rows, "Approve") + _status_count(rows, "Approved"),
            "total_rejected": _status_count(rows, "Reject") + _status_count(rows, "Rejected"),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_error_detail(exc, "Failed to fetch dashboard stats"),
        ) from exc


@router.get("/api/dept/applications/detail/{app_id}")
async def get_department_application_detail(app_id: str, current=Depends(get_current_user)):
    department = _resolve_department(current)
    try:
        return {
            "status": "success",
            "department": department,
            "data": _fetch_application_bundle(app_id, department=department),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_error_detail(exc, "Failed to fetch application detail"),
        ) from exc


@router.post("/api/dept/applications/{app_id}/action")
async def update_department_action(
    app_id: str,
    payload: DepartmentActionRequest,
    current=Depends(get_current_user),
):
    department = _resolve_department(current)
    if not department:
        raise HTTPException(status_code=400, detail="Unable to resolve department for current user")

    normalized_action = payload.action.strip().title()
    if normalized_action not in {"Approve", "Reject", "Query"}:
        raise HTTPException(status_code=400, detail="Action must be one of: Approve, Reject, Query")

    try:
        update_payload = {
            "status": normalized_action,
            "rejection_reason": payload.rejection_reason,
        }
        response = (
            db.table("department_routings")
            .update(update_payload)
            .eq("app_id", app_id)
            .eq("department", department)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="No routing record found for this department")

        return {
            "status": "success",
            "message": f"{department} marked application {app_id} as {normalized_action}",
            "data": first_row(response.data),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_error_detail(exc, "Failed to update department action"),
        ) from exc


@router.get("/api/dept/queries")
async def get_department_queries(current=Depends(get_current_user)):
    department = _resolve_department(current)
    if not department:
        raise HTTPException(status_code=400, detail="Unable to resolve department for current user")

    try:
        response = (
            db.table("department_routings")
            .select("app_id, status, rejection_reason, updated_at, applications(status, events(name, raw_address))")
            .eq("department", department)
            .eq("status", "Query")
            .order("updated_at", desc=True)
            .execute()
        )

        queries = []
        for row in response.data or []:
            app_info = row.get("applications") or {}
            event_info = app_info.get("events") or {}
            queries.append(
                {
                    "app_id": row.get("app_id"),
                    "application_status": app_info.get("status"),
                    "event_name": event_info.get("name"),
                    "location": event_info.get("raw_address"),
                    "query_message": row.get("rejection_reason"),
                    "updated_at": row.get("updated_at"),
                }
            )

        return {
            "status": "success",
            "department": department,
            "queries": queries,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_error_detail(exc, "Failed to fetch department queries"),
        ) from exc
