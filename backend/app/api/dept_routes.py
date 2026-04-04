import uuid
from io import BytesIO
from datetime import UTC, datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.core.auth import fetch_user_profile, first_row, get_current_user
from app.core.database import db
from app.models.schemas import DepartmentActionRequest, RaiseQueryRequest

router = APIRouter()

DOCUMENT_BUCKET = "application_documents"


def _error_detail(exc: Exception, fallback: str) -> str:
    return str(getattr(exc, "message", None) or exc or fallback)


def _normalize_department_name(raw_department: Any) -> Optional[str]:
    normalized = str(raw_department or "").strip().lower()
    if not normalized:
        return None
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
    return str(raw_department).strip() or None


def _resolve_department(current: Dict[str, Any]) -> Optional[str]:
    user_data = current["user"]
    metadata = user_data.get("user_metadata") or {}
    department = _normalize_department_name(metadata.get("department") or metadata.get("role"))
    if department:
        return department

    profile = fetch_user_profile(user_data["id"])
    if profile:
        profile_department = _normalize_department_name(
            profile.get("department") or profile.get("role")
        )
        if profile_department:
            return profile_department
    return None


def _status_count(rows: List[Dict[str, Any]], expected_status: str) -> int:
    return sum(1 for row in rows if (row.get("status") or "").lower() == expected_status.lower())


def _normalize_routing_status(raw_status: Any) -> str:
    normalized = str(raw_status or "").strip().lower()
    if normalized in {"approve", "approved"}:
        return "Approved"
    if normalized in {"reject", "rejected", "deny", "denied"}:
        return "Rejected"
    if normalized in {"query", "query raised", "query_raised"}:
        return "Query Raised"
    if normalized in {"in review", "in_review", "review"}:
        return "In Review"
    if normalized in {"pending", ""}:
        return "Pending"
    if normalized == "submitted":
        return "Pending"
    return str(raw_status or "Pending").strip() or "Pending"


def _normalize_risk_level(raw_level: Any) -> str:
    level = str(raw_level or "").strip().lower()
    if "high" in level:
        return "High"
    if "low" in level:
        return "Low"
    return "Medium"


def _derive_risk_level(crowd_size: int) -> str:
    if crowd_size >= 1000:
        return "High"
    if crowd_size >= 300:
        return "Medium"
    return "Low"


def _derive_overall_status_from_routings(routing_rows: List[Dict[str, Any]]) -> str:
    statuses = [_normalize_routing_status(row.get("status")) for row in routing_rows]
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


def _derive_due_at(submitted_at: Optional[str], default_hours: int = 72) -> str:
    now = datetime.now(UTC).replace(tzinfo=None)
    if submitted_at:
        try:
            base = datetime.fromisoformat(str(submitted_at).replace("Z", "+00:00")).replace(tzinfo=None)
            return (base + timedelta(hours=default_hours)).isoformat()
        except ValueError:
            pass
    return (now + timedelta(hours=default_hours)).isoformat()


def _serialize_department_application(bundle: Dict[str, Any], department: Optional[str]) -> Dict[str, Any]:
    application = bundle.get("application") or {}
    event = bundle.get("event") or {}
    routing_rows = list(bundle.get("department_routings") or [])
    documents = list(bundle.get("documents") or [])

    routing_rows.sort(key=lambda item: str(item.get("updated_at") or ""))

    status_by_department: Dict[str, str] = {}
    reviewed_at_by_department: Dict[str, Optional[str]] = {}
    rejection_reason_by_department: Dict[str, str] = {}
    query_by_department: Dict[str, Dict[str, str]] = {}
    decision_history: List[Dict[str, str]] = []
    required_departments: List[str] = []

    for row in routing_rows:
        department_name = str(row.get("department") or "").strip()
        if not department_name:
            continue
        if department_name not in required_departments:
            required_departments.append(department_name)

        normalized_status = _normalize_routing_status(row.get("status"))
        status_by_department[department_name] = normalized_status
        reviewed_at_by_department[department_name] = row.get("updated_at")

        reason = str(row.get("rejection_reason") or "").strip()
        if normalized_status == "Rejected" and reason:
            rejection_reason_by_department[department_name] = reason
        if normalized_status == "Query Raised" and reason:
            query_by_department[department_name] = {
                "message": reason,
                "raisedAt": str(row.get("updated_at") or ""),
            }

        if normalized_status not in {"Pending"}:
            decision_history.append(
                {
                    "department": department_name,
                    "action": normalized_status,
                    "comment": reason or "-",
                    "at": str(row.get("updated_at") or ""),
                }
            )

    overall_status = _derive_overall_status_from_routings(routing_rows)
    current_department_status = (
        status_by_department.get(department, "Pending")
        if department and department != "Admin"
        else overall_status
    )

    crowd_size = int(event.get("expected_crowd") or 0)
    risk_level = _derive_risk_level(crowd_size)
    risk_score = 75 if risk_level == "High" else 50 if risk_level == "Medium" else 30
    area = str(event.get("city") or "").strip() or "Unknown Area"
    pincode = str(event.get("pincode") or "").strip() or "000000"
    venue = str(event.get("raw_address") or "").strip() or "Venue details pending"

    focus_data = {
        "Police": {
            "crowdSize": f"{crowd_size}",
            "securityPlanning": "Review crowd-marshalling and on-ground police deployment plan.",
            "publicSafety": "Verify emergency response and barricading arrangements.",
            "vipMovement": "Check VIP movement requirement and secure route plan.",
        },
        "Fire": {
            "fireworks": "Confirm fireworks permit and on-site fire tender readiness.",
            "temporaryStructures": "Inspect temporary stage/tent safety compliance.",
            "exitSafety": "Ensure clear emergency exits and marked evacuation paths.",
            "electricalSafety": "Validate safe electrical load and cable management.",
        },
        "Traffic": {
            "roadClosure": "Confirm route closure/diversion approval requirements.",
            "parking": "Verify parking plan, overflow handling, and entry-exit control.",
            "trafficFlow": "Assess traffic impact and mitigation plan implementation status.",
        },
        "Municipality": {
            "wasteManagement": "Check waste disposal plan and sanitation support.",
            "publicSpaceUsage": "Validate public-space usage permissions and constraints.",
            "foodStalls": "Verify food stall hygiene/municipal compliance readiness.",
        },
    }

    return {
        "id": application.get("app_id"),
        "eventName": event.get("name") or "Unknown Event",
        "eventType": event.get("category") or "General",
        "venue": venue,
        "date": str(event.get("start_time") or "")[:10],
        "submittedAt": application.get("submitted_at"),
        "updatedAt": max((row.get("updated_at") for row in routing_rows if row.get("updated_at")), default=None),
        "organizerName": str(application.get("user_id") or "Organizer"),
        "crowdSize": crowd_size,
        "area": area,
        "pincode": pincode,
        "riskLevel": risk_level,
        "requiredDepartments": required_departments,
        "statusByDepartment": status_by_department,
        "reviewedAtByDepartment": reviewed_at_by_department,
        "overallStatus": overall_status,
        "departmentStatus": current_department_status,
        "dueAt": _derive_due_at(application.get("submitted_at")),
        "documents": [
            doc.get("file_name") or doc.get("document_url") or doc.get("storage_url")
            for doc in documents
        ],
        "aiRiskBreakdown": {
            "capacityUtilization": min(max(int(round((crowd_size / 2500) * 100)) if crowd_size else 20, 0), 100),
            "exitSafetyRating": "Needs Review" if risk_level == "High" else "Moderate" if risk_level == "Medium" else "Strong",
            "riskScore": risk_score,
            "recommendation": "Prioritize route, crowd, and emergency checks before final approval."
            if risk_level == "High"
            else "Proceed with standard departmental verification checklist.",
        },
        "focusData": focus_data,
        "queryByDepartment": query_by_department,
        "rejectionReasonByDepartment": rejection_reason_by_department,
        "decisionHistory": decision_history,
    }


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
        .select("id, app_id, doc_type, file_name, storage_url, uploaded_at")
        .eq("app_id", app_id)
        .order("uploaded_at", desc=True)
        .execute()
    )

    return {
        "application": application,
        "event": event,
        "department_routings": routing_response.data or [],
        "documents": docs_response.data or [],
    }


def _sync_application_status(app_id: str) -> str:
    routing_response = db.table("department_routings").select("status").eq("app_id", app_id).execute()
    routing_rows = routing_response.data or []
    overall_status = _derive_overall_status_from_routings(routing_rows)
    # Compatibility with enum-based schemas where "Pending"/"Query Raised" may be unsupported.
    status_candidates = {
        "Pending": ["Pending", "Submitted", "Draft"],
        "In Review": ["In Review", "Submitted", "Pending"],
        "Query Raised": ["Query", "In Review", "Submitted", "Pending"],
        "Approved": ["Approved"],
        "Rejected": ["Rejected"],
    }.get(overall_status, [overall_status, "Submitted"])

    for candidate in status_candidates:
        try:
            db.table("applications").update({"status": candidate}).eq("app_id", app_id).execute()
            break
        except Exception:
            continue
    return overall_status


def _upload_noc_pdf(app_id: str, pdf_bytes: bytes) -> str:
    file_path = f"NOC/{app_id}/{app_id}-{uuid.uuid4().hex}.pdf"
    try:
        db.storage.from_(DOCUMENT_BUCKET).upload(file_path, pdf_bytes)
    except TypeError:
        db.storage.from_(DOCUMENT_BUCKET).upload(
            path=file_path,
            file=pdf_bytes,
            file_options={"content-type": "application/pdf", "upsert": "true"},
        )
    return db.storage.from_(DOCUMENT_BUCKET).get_public_url(file_path)


def _insert_noc_document_record(app_id: str, file_name: str, storage_url: str) -> Optional[Any]:
    response = (
        db.table("documents")
        .insert(
            {
                "app_id": app_id,
                "doc_type": "NOC",
                "file_name": file_name,
                "storage_url": storage_url,
            }
        )
        .execute()
    )
    row = first_row(response.data)
    return row.get("id") if row else None


def _mark_application_noc_approved(app_id: str) -> None:
    db.table("applications").update({"status": "Approved"}).eq("app_id", app_id).execute()


def _build_noc_pdf(bundle: Dict[str, Any]) -> BytesIO:
    application = bundle.get("application") or {}
    event = bundle.get("event") or {}
    profile = fetch_user_profile(str(application.get("user_id") or "")) if application.get("user_id") else None

    app_id = str(application.get("app_id") or "Unknown Application")
    event_name = str(event.get("name") or "Unknown Event")
    organizer_name = str(
        (profile or {}).get("full_name")
        or (profile or {}).get("name")
        or application.get("user_id")
        or "Organizer"
    )
    organizer_email = str((profile or {}).get("email") or "N/A")
    venue = str(event.get("raw_address") or "N/A")
    start_date = str(event.get("start_time") or "N/A")
    end_date = str(event.get("end_time") or "N/A")
    issue_date = datetime.now(UTC).strftime("%d %b %Y")

    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=42,
        leftMargin=42,
        topMargin=48,
        bottomMargin=36,
    )
    styles = getSampleStyleSheet()

    story = [
        Paragraph("<b>UTTSAV UEPP</b>", styles["Title"]),
        Paragraph("<b>No Objection Certificate</b>", styles["Title"]),
        Spacer(1, 24),
        Paragraph(
            "Official No Objection Certificate Granted for Event.",
            styles["Heading2"],
        ),
        Spacer(1, 18),
        Paragraph(
            "This certificate confirms that the event application listed below has been reviewed "
            "and granted a No Objection Certificate by the concerned department authority.",
            styles["BodyText"],
        ),
        Spacer(1, 18),
    ]

    details_table = Table(
        [
            ["Application ID", app_id],
            ["Event Name", event_name],
            ["Organizer", organizer_name],
            ["Organizer Email", organizer_email],
            ["Venue", venue],
            ["Event Start", start_date],
            ["Event End", end_date],
            ["Issued On", issue_date],
        ],
        colWidths=[140, 340],
    )
    details_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F1F5F9")),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#0F172A")),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("GRID", (0, 0), (-1, -1), 0.8, colors.HexColor("#94A3B8")),
                ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.extend(
        [
            details_table,
            Spacer(1, 26),
            Paragraph(
                "Authorized electronically by Uttsav UEPP Department Portal.",
                styles["BodyText"],
            ),
        ]
    )

    document.build(story)
    buffer.seek(0)
    return buffer


def _get_department_routing(app_id: str, department: str) -> Dict[str, Any]:
    for department_candidate in _routing_department_candidates(department):
        for select_query in (
            "id, app_id, department, status, reviewed_by, reviewed_at, rejection_reason",
            "id, app_id, department, status, reviewed_at, rejection_reason",
            "id, app_id, department, status, rejection_reason",
            "*",
        ):
            try:
                response = (
                    db.table("department_routings")
                    .select(select_query)
                    .eq("app_id", app_id)
                    .eq("department", department_candidate)
                    .limit(1)
                    .execute()
                )
                row = first_row(response.data)
                if row:
                    return row
            except Exception:
                continue
    raise HTTPException(status_code=404, detail="No routing record found for this department")


def _routing_department_candidates(department: str) -> List[str]:
    base = _normalize_department_name(department) or str(department or "").strip()
    candidates = [base]
    if base and not base.lower().endswith("department"):
        candidates.append(f"{base} Department")
    return [item for item in dict.fromkeys(candidates) if item]


def _update_department_routing_by_app_dept(app_id: str, department: str, payload: Dict[str, Any]):
    variants = [payload]
    if "reviewed_by" in payload:
        variants.append({k: v for k, v in payload.items() if k != "reviewed_by"})

    last_error: Optional[Exception] = None
    for candidate in variants:
        try:
            return (
                db.table("department_routings")
                .update(candidate)
                .eq("app_id", app_id)
                .eq("department", department)
                .execute()
            )
        except Exception as exc:
            last_error = exc
            continue
    raise last_error or Exception("Failed to update department routing")


def _update_department_routing_by_id(routing_id: str, payload: Dict[str, Any]):
    variants = [payload]
    if "reviewed_by" in payload:
        variants.append({k: v for k, v in payload.items() if k != "reviewed_by"})

    last_error: Optional[Exception] = None
    for candidate in variants:
        try:
            return db.table("department_routings").update(candidate).eq("id", routing_id).execute()
        except Exception as exc:
            last_error = exc
            continue
    raise last_error or Exception("Failed to update department routing")


@router.get("/api/dept/applications")
async def get_current_department_applications(current=Depends(get_current_user)):
    department = _resolve_department(current)
    if not department:
        raise HTTPException(status_code=400, detail="Unable to resolve department for current user")

    try:
        if department == "Admin":
            app_rows = (
                db.table("applications")
                .select("app_id")
                .order("submitted_at", desc=True)
                .execute()
                .data
                or []
            )
            app_ids = [row.get("app_id") for row in app_rows if row.get("app_id")]
        else:
            routing_rows = []
            for department_candidate in _routing_department_candidates(department):
                try:
                    candidate_rows = (
                        db.table("department_routings")
                        .select("app_id")
                        .eq("department", department_candidate)
                        .order("updated_at", desc=True)
                        .execute()
                        .data
                        or []
                    )
                    if candidate_rows:
                        routing_rows = candidate_rows
                        break
                except Exception:
                    continue
            app_ids = [row.get("app_id") for row in routing_rows if row.get("app_id")]

        deduped_ids = list(dict.fromkeys(app_ids))
        applications = []
        for app_id in deduped_ids:
            bundle = _fetch_application_bundle(app_id, department=None)
            applications.append(_serialize_department_application(bundle, department=department))

        return {
            "status": "success",
            "department": department,
            "applications": applications,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_error_detail(exc, "Failed to fetch department applications"),
        ) from exc


@router.get("/applications/{department_name}")
async def get_department_applications(department_name: str, current=Depends(get_current_user)):
    """
    Backward-compatible endpoint with compact department queue payload.
    """
    current_department = _resolve_department(current)
    if current_department and current_department not in {"Admin", department_name}:
        raise HTTPException(status_code=403, detail="You are not allowed to access this department queue")

    try:
        routings = (
            db.table("department_routings")
            .select("app_id, status, updated_at, applications(status, events(name, expected_crowd, raw_address))")
            .eq("department", department_name)
            .execute()
        )

        formatted_data = []
        for route in routings.data or []:
            app_info = route.get("applications") or {}
            event_info = app_info.get("events") or {}
            if isinstance(event_info, list):
                event_info = event_info[0] if event_info else {}

            formatted_data.append(
                {
                    "id": route.get("app_id"),
                    "eventName": event_info.get("name", "Unknown"),
                    "crowdSize": event_info.get("expected_crowd", 0),
                    "location": event_info.get("raw_address", "Unknown"),
                    "departmentStatus": _normalize_routing_status(route.get("status")),
                    "overallStatus": app_info.get("status", "Pending"),
                    "lastUpdated": route.get("updated_at"),
                }
            )

        return {"status": "success", "data": formatted_data}

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch department data: {str(exc)}")


@router.get("/api/dept/dashboard-stats")
async def get_dashboard_stats(current=Depends(get_current_user)):
    department = _resolve_department(current)
    if not department:
        raise HTTPException(status_code=400, detail="Unable to resolve department for current user")

    try:
        if department == "Admin":
            rows = db.table("department_routings").select("app_id, status").execute().data or []
        else:
            rows = []
            for department_candidate in _routing_department_candidates(department):
                try:
                    candidate_rows = (
                        db.table("department_routings")
                        .select("app_id, status")
                        .eq("department", department_candidate)
                        .execute()
                        .data
                        or []
                    )
                    if candidate_rows:
                        rows = candidate_rows
                        break
                except Exception:
                    continue
        normalized_rows = [{"status": _normalize_routing_status(row.get("status"))} for row in rows]

        return {
            "status": "success",
            "department": department,
            "total_pending": _status_count(normalized_rows, "Pending") + _status_count(normalized_rows, "In Review"),
            "total_approved": _status_count(normalized_rows, "Approved"),
            "total_rejected": _status_count(normalized_rows, "Rejected"),
            "total_query_raised": _status_count(normalized_rows, "Query Raised"),
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
        bundle = _fetch_application_bundle(app_id, department=None)
        serialized = _serialize_department_application(bundle, department=department)
        return {
            "status": "success",
            "department": department,
            "application": serialized,
            "data": bundle,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_error_detail(exc, "Failed to fetch application detail"),
        ) from exc


@router.post("/api/dept/applications/{app_id}/mark-in-review")
async def mark_application_in_review(app_id: str, current=Depends(get_current_user)):
    department = _resolve_department(current)
    if not department or department == "Admin":
        raise HTTPException(status_code=400, detail="Only department users can mark in-review status")

    try:
        row = _get_department_routing(app_id, department)
        matched_department = row["department"]

        current_status = _normalize_routing_status(row.get("status"))
        if current_status in {"Approved", "Rejected"}:
            return {
                "status": "success",
                "message": f"Routing is already in final state: {current_status}",
                "data": row,
            }

        if current_status != "In Review":
            updated_row = None
            for status_candidate in ["In Review", "Review", "Pending"]:
                try:
                    updated = _update_department_routing_by_app_dept(
                        app_id=app_id,
                        department=matched_department,
                        payload={
                            "status": status_candidate,
                            "reviewed_by": current["user"]["id"],
                            "reviewed_at": datetime.now(UTC).isoformat(),
                        },
                    )
                    updated_row = first_row(updated.data)
                    if updated_row:
                        break
                except Exception:
                    continue
            row = updated_row or row
            _sync_application_status(app_id)

        return {
            "status": "success",
            "message": f"{department} marked application {app_id} as In Review",
            "data": row,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_error_detail(exc, "Failed to mark application in review"),
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
    if department == "Admin":
        raise HTTPException(status_code=403, detail="Admin role cannot issue department actions")

    action_value = str(payload.action or "").strip().lower()
    action_map = {
        "approve": "Approved",
        "approved": "Approved",
        "reject": "Rejected",
        "rejected": "Rejected",
        "query": "Query Raised",
        "query raised": "Query Raised",
    }
    normalized_action = action_map.get(action_value)
    if not normalized_action:
        raise HTTPException(status_code=400, detail="Action must be one of: approve, reject, query")

    reason = str(payload.rejection_reason or "").strip() or None
    try:
        action_status_candidates = {
            "Approved": ["Approved"],
            "Rejected": ["Rejected"],
            "Query Raised": ["Query", "Query Raised", "In Review"],
        }.get(normalized_action, [normalized_action])

        target_department = None
        target_department = _get_department_routing(app_id, department)["department"]

        update_payload = {}
        if normalized_action in {"Rejected", "Query Raised"}:
            update_payload["rejection_reason"] = reason
        else:
            update_payload["rejection_reason"] = None

        response = None
        for status_candidate in action_status_candidates:
            try:
                candidate_payload = {**update_payload, "status": status_candidate}
                candidate_payload["reviewed_by"] = current["user"]["id"]
                candidate_payload["reviewed_at"] = datetime.now(UTC).isoformat()
                response = _update_department_routing_by_app_dept(
                    app_id=app_id,
                    department=target_department,
                    payload=candidate_payload,
                )
                if response.data:
                    break
            except Exception:
                continue
        if not response or not response.data:
            raise HTTPException(status_code=500, detail="Failed to persist department action due to status mismatch")

        overall_status = _sync_application_status(app_id)

        return {
            "status": "success",
            "message": f"{department} marked application {app_id} as {normalized_action}",
            "overall_status": overall_status,
            "data": first_row(response.data),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_error_detail(exc, "Failed to update department action"),
        ) from exc


@router.post("/api/dept/raise-query")
async def raise_query(payload: RaiseQueryRequest, current=Depends(get_current_user)):
    department = _resolve_department(current)
    if not department or department == "Admin":
        raise HTTPException(status_code=400, detail="Only department users can raise organizer queries")

    try:
        routing_row = _get_department_routing(payload.app_id, department)
        insert_response = (
            db.table("official_queries")
            .insert(
                {
                    "routing_id": routing_row["id"],
                    "official_id": current["user"]["id"],
                    "query_text": payload.query_text,
                    "is_resolved": False,
                }
            )
            .execute()
        )
        updated = None
        for status_candidate in ("Query Raised", "Query", "In Review"):
            try:
                updated = _update_department_routing_by_id(
                    routing_id=str(routing_row["id"]),
                    payload={
                        "status": status_candidate,
                        "rejection_reason": payload.query_text,
                        "reviewed_by": current["user"]["id"],
                        "reviewed_at": datetime.now(UTC).isoformat(),
                    },
                )
                if updated.data:
                    break
            except Exception:
                continue
        if not updated:
            raise HTTPException(status_code=500, detail="Failed to update routing status for query raise")
        _sync_application_status(payload.app_id)

        return {
            "status": "success",
            "message": "Query raised successfully",
            "query": first_row(insert_response.data) or {
                "routing_id": routing_row["id"],
                "official_id": current["user"]["id"],
                "query_text": payload.query_text,
                "is_resolved": False,
            },
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_error_detail(exc, "Failed to raise query"),
        ) from exc


@router.post("/api/dept/applications/{app_id}/generate-noc")
async def generate_noc_certificate(app_id: str, current=Depends(get_current_user)):
    department = _resolve_department(current)
    if not department:
        raise HTTPException(status_code=400, detail="Unable to resolve department for current user")

    try:
        bundle = _fetch_application_bundle(app_id, department=None)
        pdf_buffer = _build_noc_pdf(bundle)
        pdf_bytes = pdf_buffer.getvalue()
        file_name = f"NOC-{app_id}.pdf"
        noc_url = _upload_noc_pdf(app_id, pdf_bytes)
        document_id = _insert_noc_document_record(app_id, file_name, noc_url)
        _mark_application_noc_approved(app_id)

        return {
            "status": "success",
            "message": "NOC generated successfully",
            "app_id": app_id,
            "department": department,
            "noc_url": noc_url,
            "document_id": document_id,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_error_detail(exc, "Failed to generate NOC certificate"),
        ) from exc


@router.post("/generate-noc/{app_id}")
async def generate_noc_certificate_alias(app_id: str, current=Depends(get_current_user)):
    return await generate_noc_certificate(app_id, current)


@router.get("/api/dept/queries")
async def get_department_queries(current=Depends(get_current_user)):
    department = _resolve_department(current)
    if not department:
        raise HTTPException(status_code=400, detail="Unable to resolve department for current user")
    if department == "Admin":
        raise HTTPException(status_code=400, detail="Admin role is not scoped to a single department query queue")

    try:
        queries_response = (
            db.table("official_queries")
            .select("id, routing_id, official_id, query_text, organizer_response, is_resolved, created_at")
            .eq("is_resolved", False)
            .order("created_at", desc=True)
            .execute()
        )

        queries = []
        for query_row in queries_response.data or []:
            routing_response = (
                db.table("department_routings")
                .select("id, app_id, department, status")
                .eq("id", query_row.get("routing_id"))
                .limit(1)
                .execute()
            )
            routing_row = first_row(routing_response.data)
            if not routing_row:
                continue
            if _normalize_department_name(routing_row.get("department")) != department:
                continue

            bundle = _fetch_application_bundle(str(routing_row.get("app_id")), department=None)
            event_info = bundle.get("event") or {}
            queries.append(
                {
                    "query_id": query_row.get("id"),
                    "app_id": routing_row.get("app_id"),
                    "application_status": _normalize_routing_status(routing_row.get("status")),
                    "event_name": event_info.get("name"),
                    "location": event_info.get("raw_address"),
                    "query_message": query_row.get("query_text"),
                    "organizer_response": query_row.get("organizer_response"),
                    "created_at": query_row.get("created_at"),
                    "is_resolved": query_row.get("is_resolved"),
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
