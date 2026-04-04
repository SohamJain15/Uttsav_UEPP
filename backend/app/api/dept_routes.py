import base64
import os
import uuid
from io import BytesIO
from datetime import UTC, datetime, timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.graphics.barcode import createBarcodeDrawing
from supabase import create_client

from app.core.auth import fetch_user_profile, first_row, get_current_user
from app.core.database import SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, db
from app.models.schemas import DepartmentActionRequest, RaiseQueryRequest

router = APIRouter()

DOCUMENT_BUCKET = "application_documents"
BACKEND_PUBLIC_BASE_URL = os.getenv("BACKEND_PUBLIC_BASE_URL", "http://127.0.0.1:8001").rstrip("/")
FINAL_NOC_VALIDITY_TEXT = "Valid only for the approved event window and listed departmental conditions."
DEFAULT_DEPARTMENT_REMARK = "Department clearance issued after compliance verification."
DEPARTMENT_CLEARANCE_CONDITIONS: Dict[str, List[str]] = {
    "Police": [
        "Maintain approved crowd-control barricading and entry screening.",
        "Keep emergency lanes clear throughout the event duration.",
    ],
    "Fire": [
        "Keep certified extinguishers and fire tender access ready on-site.",
        "Ensure all emergency exits and evacuation paths remain unobstructed.",
    ],
    "Traffic": [
        "Implement the approved diversion and parking management plan.",
        "Deploy traffic marshals at designated ingress and egress points.",
    ],
    "Municipality": [
        "Follow approved sanitation and waste-management schedule.",
        "Operate food stalls only as per municipal hygiene compliance.",
    ],
}


def _error_detail(exc: Exception, fallback: str) -> str:
    return str(getattr(exc, "message", None) or exc or fallback)


def _service_db():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


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


def _coerce_int(value: Any, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _risk_score_from_level(level: str) -> int:
    normalized = _normalize_risk_level(level)
    if normalized == "High":
        return 80
    if normalized == "Low":
        return 30
    return 55


def _exit_safety_from_level(level: str) -> str:
    normalized = _normalize_risk_level(level)
    if normalized == "High":
        return "Needs Review"
    if normalized == "Low":
        return "Strong"
    return "Moderate"


def _capacity_utilization_from_crowd(crowd_size: int) -> int:
    crowd = max(_coerce_int(crowd_size, 0), 0)
    if crowd <= 0:
        return 0
    assumed_capacity = max(int(round(crowd * 1.25)), 1)
    utilization = int(round((crowd / assumed_capacity) * 100))
    return max(1, min(100, utilization))


def _build_ai_risk_context(ai_logs: Dict[str, Any], crowd_size: int) -> Dict[str, Any]:
    logs = ai_logs or {}
    risk_level = _normalize_risk_level(
        logs.get("base_risk_score")
        or logs.get("exit_safety_rating")
        or _derive_risk_level(crowd_size)
    )

    risk_score = _coerce_int(logs.get("numerical_risk_score"), _risk_score_from_level(risk_level))
    risk_score = max(0, min(100, risk_score))

    capacity_utilization = _coerce_int(
        logs.get("capacity_utilization"),
        _capacity_utilization_from_crowd(crowd_size),
    )
    capacity_utilization = max(0, min(100, capacity_utilization))

    recommendation = str(logs.get("ollama_recommendation") or "").strip()
    if not recommendation:
        recommendation = (
            "Prioritize route, crowd, and emergency checks before final approval."
            if risk_level == "High"
            else "Proceed with standard departmental verification checklist."
        )

    return {
        "risk_level": risk_level,
        "breakdown": {
            "capacityUtilization": capacity_utilization,
            "exitSafetyRating": str(logs.get("exit_safety_rating") or "").strip() or _exit_safety_from_level(risk_level),
            "riskScore": risk_score,
            "recommendation": recommendation,
        },
    }


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


def _derive_due_at(
    submitted_at: Optional[str],
    created_at: Optional[str] = None,
    default_hours: int = 72,
) -> str:
    now = datetime.now(UTC).replace(tzinfo=None)
    for base_value in (submitted_at, created_at):
        if not base_value:
            continue
        try:
            base = datetime.fromisoformat(str(base_value).replace("Z", "+00:00")).replace(tzinfo=None)
            return (base + timedelta(hours=default_hours)).isoformat()
        except ValueError:
            continue
    return (now + timedelta(hours=default_hours)).isoformat()


def _coerce_storage_url(raw_url: Any) -> str:
    if isinstance(raw_url, str):
        return raw_url.strip()
    if isinstance(raw_url, dict):
        data = raw_url.get("data") if isinstance(raw_url.get("data"), dict) else {}
        nested = data.get("publicUrl") or data.get("publicURL") or data.get("url")
        return str(
            raw_url.get("publicURL")
            or raw_url.get("publicUrl")
            or raw_url.get("url")
            or nested
            or ""
        ).strip()
    if raw_url is None:
        return ""
    return str(raw_url).strip()


def _department_noc_doc_type(department: Any) -> str:
    normalized_department = _normalize_department_name(department) or str(department or "").strip()
    safe_department = normalized_department or "Department"
    return f"NOC_{safe_department}"


def _department_noc_access_url(app_id: str, department: Any) -> str:
    normalized_department = _normalize_department_name(department) or str(department or "").strip() or "Department"
    return (
        f"{BACKEND_PUBLIC_BASE_URL}/api/dept/noc/{app_id}/pdf"
        f"?department={quote(normalized_department)}"
    )


def _department_conditions(department: Any) -> List[str]:
    normalized_department = _normalize_department_name(department) or str(department or "").strip()
    if normalized_department in DEPARTMENT_CLEARANCE_CONDITIONS:
        return list(DEPARTMENT_CLEARANCE_CONDITIONS[normalized_department])
    return [
        f"Comply with all {normalized_department or 'department'} directives for this event clearance."
    ]


def _merge_department_conditions(departments: List[str]) -> List[str]:
    merged: List[str] = []
    seen = set()
    for department_name in departments:
        for condition in _department_conditions(department_name):
            key = str(condition).strip().lower()
            if not key or key in seen:
                continue
            seen.add(key)
            merged.append(condition)
    return merged


def _build_document_payload(documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    payload = []
    for item in documents:
        if not isinstance(item, dict):
            continue
        payload.append(
            {
                "id": item.get("id"),
                "appId": item.get("app_id"),
                "docType": item.get("doc_type") or "General",
                "fileName": item.get("file_name") or "document",
                "url": _coerce_storage_url(item.get("storage_url")),
                "uploadedAt": item.get("uploaded_at"),
            }
        )
    return payload


def _final_noc_access_url(app_id: str) -> str:
    return f"{BACKEND_PUBLIC_BASE_URL}/api/dept/noc/{app_id}/pdf"


def _extract_noc_payload(
    app_id: str,
    event_name: str,
    required_departments: List[str],
    status_by_department: Dict[str, str],
    document_payload: List[Dict[str, Any]],
    routing_rows: List[Dict[str, Any]],
) -> Dict[str, Any]:
    department_nocs = []
    final_noc = None

    latest_routing_by_department: Dict[str, Dict[str, Any]] = {}
    for row in routing_rows:
        department_name = _normalize_department_name(row.get("department"))
        if not department_name:
            continue
        existing = latest_routing_by_department.get(department_name)
        if not existing or str(row.get("updated_at") or "") >= str(existing.get("updated_at") or ""):
            latest_routing_by_department[department_name] = row

    department_docs: Dict[str, Dict[str, Any]] = {}
    final_document = None
    for document in document_payload:
        doc_type = str(document.get("docType") or "")
        if doc_type == "NOC_FINAL":
            final_document = document
            continue
        if not doc_type.startswith("NOC_"):
            continue
        department_name = _normalize_department_name(doc_type.replace("NOC_", ""))
        if not department_name:
            continue
        existing_doc = department_docs.get(department_name)
        if not existing_doc or str(document.get("uploadedAt") or "") >= str(existing_doc.get("uploadedAt") or ""):
            department_docs[department_name] = document

    approved_departments = [
        department_name
        for department_name in required_departments
        if status_by_department.get(department_name) == "Approved"
    ]

    for department_name in approved_departments:
        document = department_docs.get(department_name)
        if not document:
            continue
        routing_row = latest_routing_by_department.get(department_name) or {}
        remarks = str(routing_row.get("rejection_reason") or "").strip() or DEFAULT_DEPARTMENT_REMARK
        department_nocs.append(
            {
                "applicationId": app_id,
                "department": department_name,
                "approvedBy": routing_row.get("reviewed_by"),
                "timestamp": document.get("uploadedAt") or routing_row.get("updated_at"),
                "conditions": _department_conditions(department_name),
                "remarks": remarks,
                "fileName": document.get("fileName") or f"NOC-{department_name}-{app_id}.pdf",
                "url": _department_noc_access_url(app_id, department_name),
                "qrCode": _department_noc_access_url(app_id, department_name),
            }
        )

    if final_document:
        final_noc = {
            "permitId": f"UTTSAV-NOC-{app_id}",
            "applicationId": app_id,
            "eventName": event_name,
            "approvedDepartments": approved_departments,
            "issueDate": final_document.get("uploadedAt"),
            "validity": FINAL_NOC_VALIDITY_TEXT,
            "combinedConditions": _merge_department_conditions(approved_departments),
            "qrCode": _final_noc_access_url(app_id),
            "url": _final_noc_access_url(app_id),
            "fileName": final_document.get("fileName") or f"NOC-FINAL-{app_id}.pdf",
        }

    return {
        "departmentNOCs": department_nocs,
        "finalNOC": final_noc,
    }


def _serialize_department_application(bundle: Dict[str, Any], department: Optional[str]) -> Dict[str, Any]:
    application = bundle.get("application") or {}
    event = bundle.get("event") or {}
    ai_logs = bundle.get("ai_logs") or {}
    organizer_profile = bundle.get("organizer_profile") or {}
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
        raw_department = str(row.get("department") or "").strip()
        if not raw_department:
            continue
        department_name = _normalize_department_name(raw_department) or raw_department
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
    ai_risk_context = _build_ai_risk_context(ai_logs, crowd_size)
    risk_level = ai_risk_context["risk_level"]
    area = str(event.get("city") or "").strip() or "Unknown Area"
    pincode = str(event.get("pincode") or "").strip() or "000000"
    venue = str(event.get("raw_address") or "").strip() or "Venue details pending"
    organizer_name = (
        str(organizer_profile.get("full_name") or organizer_profile.get("name") or "").strip()
        or str(application.get("user_id") or "Organizer")
    )

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

    document_payload = _build_document_payload(documents)
    noc_payload = _extract_noc_payload(
        app_id=str(application.get("app_id") or ""),
        event_name=event.get("name") or "Unknown Event",
        required_departments=required_departments,
        status_by_department=status_by_department,
        document_payload=document_payload,
        routing_rows=routing_rows,
    )

    return {
        "id": application.get("app_id"),
        "eventName": event.get("name") or "Unknown Event",
        "eventType": event.get("category") or "General",
        "venue": venue,
        "date": str(event.get("start_time") or "")[:10],
        "submittedAt": application.get("submitted_at"),
        "updatedAt": max((row.get("updated_at") for row in routing_rows if row.get("updated_at")), default=None),
        "organizerName": organizer_name,
        "crowdSize": crowd_size,
        "area": area,
        "pincode": pincode,
        "latitude": float(event.get("latitude")) if event.get("latitude") is not None else None,
        "longitude": float(event.get("longitude")) if event.get("longitude") is not None else None,
        "riskLevel": risk_level,
        "requiredDepartments": required_departments,
        "statusByDepartment": status_by_department,
        "reviewedAtByDepartment": reviewed_at_by_department,
        "overallStatus": overall_status,
        "departmentStatus": current_department_status,
        "dueAt": _derive_due_at(
            application.get("submitted_at"),
            application.get("created_at"),
        ),
        "documents": document_payload,
        "aiRiskBreakdown": ai_risk_context["breakdown"],
        "focusData": focus_data,
        "queryByDepartment": query_by_department,
        "rejectionReasonByDepartment": rejection_reason_by_department,
        "decisionHistory": decision_history,
        "departmentNOCs": noc_payload["departmentNOCs"],
        "finalNOC": noc_payload["finalNOC"],
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

    ai_logs = None
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

    organizer_profile = None
    organizer_id = application.get("user_id") or ((event or {}).get("organizer_id") if isinstance(event, dict) else None)
    if organizer_id:
        try:
            organizer_profile = fetch_user_profile(str(organizer_id))
        except Exception:
            organizer_profile = None

    return {
        "application": application,
        "event": event,
        "department_routings": routing_response.data or [],
        "documents": docs_response.data or [],
        "ai_logs": ai_logs,
        "organizer_profile": organizer_profile,
    }


def _chunked(values: List[str], chunk_size: int = 200) -> List[List[str]]:
    return [values[idx : idx + chunk_size] for idx in range(0, len(values), chunk_size)]


def _fetch_rows_by_in(
    table_name: str,
    select_query: str,
    field_name: str,
    values: List[str],
    order_by: Optional[str] = None,
    desc: bool = False,
) -> List[Dict[str, Any]]:
    if not values:
        return []

    rows: List[Dict[str, Any]] = []
    for chunk in _chunked(values):
        query = db.table(table_name).select(select_query).in_(field_name, chunk)
        if order_by:
            query = query.order(order_by, desc=desc)
        response = query.execute()
        rows.extend(response.data or [])
    return rows


def _fetch_profiles_by_ids(user_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    if not user_ids:
        return {}

    rows = _fetch_rows_by_in("users", "*", "id", user_ids)
    profile_map: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        user_id = str(row.get("id") or "").strip()
        if not user_id:
            continue
        profile_map[user_id] = {
            **row,
            "full_name": row.get("full_name") or row.get("name"),
            "phone_number": row.get("phone_number") or row.get("phone"),
            "department": row.get("department") or row.get("role"),
            "organization": row.get("organization") or row.get("organization_type"),
            "username": row.get("username") or row.get("prefix") or row.get("email"),
        }
    return profile_map


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
    service_db = _service_db()
    file_path = f"NOC/{app_id}/{app_id}-{uuid.uuid4().hex}.pdf"
    try:
        try:
            service_db.storage.from_(DOCUMENT_BUCKET).upload(file_path, pdf_bytes)
        except TypeError:
            service_db.storage.from_(DOCUMENT_BUCKET).upload(
                path=file_path,
                file=pdf_bytes,
                file_options={"content-type": "application/pdf", "upsert": "true"},
            )

        public_url = service_db.storage.from_(DOCUMENT_BUCKET).get_public_url(file_path)
        if isinstance(public_url, dict):
            return (
                public_url.get("publicURL")
                or (public_url.get("data") or {}).get("publicUrl")
                or (public_url.get("data") or {}).get("publicURL")
                or str(public_url)
            )
        return str(public_url)
    except Exception:
        # Fallback when storage policy blocks writes.
        encoded_pdf = base64.b64encode(pdf_bytes).decode("ascii")
        return f"data:application/pdf;base64,{encoded_pdf}"


def _insert_noc_document_record(
    app_id: str,
    file_name: str,
    storage_url: str,
    doc_type: str = "NOC_FINAL",
) -> Optional[Any]:
    service_db = _service_db()
    response = (
        service_db.table("documents")
        .insert(
            {
                "app_id": app_id,
                "doc_type": doc_type,
                "file_name": file_name,
                "storage_url": _coerce_storage_url(storage_url),
            }
        )
        .execute()
    )
    row = first_row(response.data)
    return row.get("id") if row else None


def _fetch_latest_noc_document(app_id: str, doc_types: List[str]) -> Optional[Dict[str, Any]]:
    candidates = [str(doc_type).strip() for doc_type in doc_types if str(doc_type).strip()]
    if not candidates:
        return None

    response = (
        db.table("documents")
        .select("id, file_name, storage_url, doc_type, uploaded_at")
        .eq("app_id", app_id)
        .in_("doc_type", candidates)
        .order("uploaded_at", desc=True)
        .limit(1)
        .execute()
    )
    return first_row(response.data)


def _mark_application_noc_approved(app_id: str) -> None:
    service_db = _service_db()
    service_db.table("applications").update({"status": "Approved"}).eq("app_id", app_id).execute()


def _build_noc_pdf(
    bundle: Dict[str, Any],
    noc_title: str = "No Objection Certificate",
    permit_id: Optional[str] = None,
    qr_payload: Optional[str] = None,
    conditions: Optional[List[str]] = None,
    remarks: Optional[str] = None,
) -> BytesIO:
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
        Paragraph(f"<b>{noc_title}</b>", styles["Title"]),
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
            ["Permit ID", permit_id or f"UTTSAV-NOC-{app_id}"],
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
        ]
    )

    if conditions:
        story.append(Paragraph("<b>Applicable Conditions</b>", styles["Heading3"]))
        for condition in conditions:
            story.append(Paragraph(f"- {condition}", styles["BodyText"]))
        story.append(Spacer(1, 14))

    if remarks:
        story.append(Paragraph(f"<b>Remarks:</b> {remarks}", styles["BodyText"]))
        story.append(Spacer(1, 14))

    if qr_payload:
        story.append(Paragraph("<b>Verification QR</b>", styles["Heading3"]))
        qr_drawing = createBarcodeDrawing("QR", value=qr_payload, width=108, height=108)
        story.append(qr_drawing)
        story.append(Spacer(1, 10))
        story.append(Paragraph(f"Scan to verify/download: {qr_payload}", styles["BodyText"]))
        story.append(Spacer(1, 12))

    story.extend(
        [
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


def _cascade_rejection_to_other_departments(
    app_id: str,
    acted_department: str,
    actor_id: str,
    reason: str,
) -> None:
    acted_department_name = _normalize_department_name(acted_department) or str(acted_department or "").strip()
    try:
        response = db.table("department_routings").select("id, department, status").eq("app_id", app_id).execute()
        for row in response.data or []:
            row_department_name = _normalize_department_name(row.get("department")) or str(
                row.get("department") or ""
            ).strip()
            if row_department_name == acted_department_name:
                continue
            normalized_status = _normalize_routing_status(row.get("status"))
            if normalized_status in {"Rejected", "Approved"}:
                continue
            closed_reason = f"Closed after {acted_department_name} rejection: {reason}"
            for status_candidate in ("Rejected", "Denied"):
                try:
                    _update_department_routing_by_id(
                        routing_id=str(row.get("id")),
                        payload={
                            "status": status_candidate,
                            "rejection_reason": closed_reason,
                            "reviewed_by": actor_id,
                            "reviewed_at": datetime.now(UTC).isoformat(),
                        },
                    )
                    break
                except Exception:
                    continue
    except Exception:
        return


def _generate_final_noc_for_application(app_id: str) -> Dict[str, Any]:
    existing_row = _fetch_latest_noc_document(app_id, ["NOC_FINAL"])
    if existing_row:
        return {
            "permit_id": f"UTTSAV-NOC-{app_id}",
            "noc_url": _final_noc_access_url(app_id),
            "document_id": existing_row.get("id"),
            "qr_code": _final_noc_access_url(app_id),
        }

    routing_rows = (
        db.table("department_routings")
        .select("department, status")
        .eq("app_id", app_id)
        .execute()
        .data
        or []
    )
    if not routing_rows:
        raise HTTPException(status_code=400, detail="No department routing found for this application")
    if _derive_overall_status_from_routings(routing_rows) != "Approved":
        raise HTTPException(status_code=409, detail="Final NOC can be generated only after all department approvals")

    approved_departments = []
    for row in routing_rows:
        department_name = _normalize_department_name(row.get("department"))
        if not department_name:
            continue
        if _normalize_routing_status(row.get("status")) == "Approved" and department_name not in approved_departments:
            approved_departments.append(department_name)

    combined_conditions = _merge_department_conditions(approved_departments)
    bundle = _fetch_application_bundle(app_id, department=None)
    permit_id = f"UTTSAV-NOC-{app_id}"
    qr_payload = _final_noc_access_url(app_id)
    pdf_buffer = _build_noc_pdf(
        bundle=bundle,
        noc_title="Final Combined No Objection Certificate",
        permit_id=permit_id,
        qr_payload=qr_payload,
        conditions=combined_conditions,
    )
    pdf_bytes = pdf_buffer.getvalue()
    file_name = f"NOC-FINAL-{app_id}.pdf"
    noc_url = _upload_noc_pdf(app_id, pdf_bytes)
    document_id = _insert_noc_document_record(app_id, file_name, noc_url, doc_type="NOC_FINAL")
    _mark_application_noc_approved(app_id)
    return {
        "permit_id": permit_id,
        "noc_url": _final_noc_access_url(app_id),
        "document_id": document_id,
        "qr_code": qr_payload,
    }


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
        if not deduped_ids:
            return {
                "status": "success",
                "department": department,
                "applications": [],
            }

        application_rows = _fetch_rows_by_in("applications", "*", "app_id", deduped_ids)
        applications_by_id = {
            str(row.get("app_id")): row
            for row in application_rows
            if row.get("app_id")
        }

        event_ids = [
            str(row.get("event_id"))
            for row in application_rows
            if row.get("event_id")
        ]
        event_rows = _fetch_rows_by_in("events", "*", "id", event_ids)
        events_by_id = {
            str(row.get("id")): row
            for row in event_rows
            if row.get("id")
        }

        routing_rows = _fetch_rows_by_in(
            "department_routings",
            "*",
            "app_id",
            deduped_ids,
            order_by="updated_at",
            desc=True,
        )
        routing_by_app: Dict[str, List[Dict[str, Any]]] = {}
        for row in routing_rows:
            key = str(row.get("app_id") or "")
            if key:
                routing_by_app.setdefault(key, []).append(row)

        document_rows = _fetch_rows_by_in(
            "documents",
            "id, app_id, doc_type, file_name, storage_url, uploaded_at",
            "app_id",
            deduped_ids,
            order_by="uploaded_at",
            desc=True,
        )
        documents_by_app: Dict[str, List[Dict[str, Any]]] = {}
        for row in document_rows:
            key = str(row.get("app_id") or "")
            if key:
                documents_by_app.setdefault(key, []).append(row)

        ai_log_rows = _fetch_rows_by_in("ai_intelligence_logs", "*", "app_id", deduped_ids)
        ai_logs_by_app = {
            str(row.get("app_id")): row
            for row in ai_log_rows
            if row.get("app_id")
        }

        organizer_ids = set()
        for app_row in application_rows:
            if app_row.get("user_id"):
                organizer_ids.add(str(app_row.get("user_id")))
            event_row = events_by_id.get(str(app_row.get("event_id") or ""))
            if event_row and event_row.get("organizer_id"):
                organizer_ids.add(str(event_row.get("organizer_id")))
        organizer_profiles_by_id = _fetch_profiles_by_ids(list(organizer_ids))

        applications = []
        for app_id in deduped_ids:
            app_row = applications_by_id.get(str(app_id))
            if not app_row:
                continue
            event_row = events_by_id.get(str(app_row.get("event_id") or ""))
            organizer_id = (
                str(app_row.get("user_id") or "").strip()
                or str((event_row or {}).get("organizer_id") or "").strip()
            )
            bundle = {
                "application": app_row,
                "event": event_row or {},
                "department_routings": routing_by_app.get(str(app_id), []),
                "documents": documents_by_app.get(str(app_id), []),
                "ai_logs": ai_logs_by_app.get(str(app_id), {}),
                "organizer_profile": organizer_profiles_by_id.get(organizer_id, {}),
            }
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
    if normalized_action == "Rejected" and not reason:
        raise HTTPException(status_code=400, detail="Rejection reason is mandatory for rejected applications")
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
        noc = None

        if normalized_action == "Rejected":
            _cascade_rejection_to_other_departments(
                app_id=app_id,
                acted_department=target_department,
                actor_id=current["user"]["id"],
                reason=reason or "Rejected by department decision",
            )
            overall_status = _sync_application_status(app_id)

        if normalized_action == "Approved":
            department_doc_type = _department_noc_doc_type(target_department)
            existing_department_noc = _fetch_latest_noc_document(
                app_id,
                [department_doc_type, department_doc_type.upper()],
            )
            dept_noc_doc_id = existing_department_noc.get("id") if existing_department_noc else None
            dept_noc_timestamp = (
                existing_department_noc.get("uploaded_at")
                if existing_department_noc
                else datetime.now(UTC).isoformat()
            )

            department_conditions = _department_conditions(target_department)
            department_remarks = reason or DEFAULT_DEPARTMENT_REMARK

            if not existing_department_noc:
                department_noc_bundle = _fetch_application_bundle(app_id, department=None)
                department_qr = _department_noc_access_url(app_id, target_department)
                department_noc_pdf = _build_noc_pdf(
                    bundle=department_noc_bundle,
                    noc_title=f"{target_department} Department Clearance Certificate",
                    permit_id=f"UTTSAV-{target_department.upper()}-{app_id}",
                    qr_payload=department_qr,
                    remarks=department_remarks,
                    conditions=department_conditions,
                )
                dept_noc_storage_url = _upload_noc_pdf(app_id, department_noc_pdf.getvalue())
                dept_noc_doc_id = _insert_noc_document_record(
                    app_id=app_id,
                    file_name=f"NOC-{target_department}-{app_id}.pdf",
                    storage_url=dept_noc_storage_url,
                    doc_type=department_doc_type,
                )

            noc = {
                "departmentNOC": {
                    "department": target_department,
                    "url": _department_noc_access_url(app_id, target_department),
                    "document_id": dept_noc_doc_id,
                    "timestamp": dept_noc_timestamp,
                    "conditions": department_conditions,
                    "remarks": department_remarks,
                    "qr_code": _department_noc_access_url(app_id, target_department),
                }
            }

            if overall_status == "Approved":
                noc = {
                    **(noc or {}),
                    "finalNOC": _generate_final_noc_for_application(app_id),
                }

        return {
            "status": "success",
            "message": f"{department} marked application {app_id} as {normalized_action}",
            "overall_status": overall_status,
            "data": first_row(response.data),
            "noc": noc,
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
        result = _generate_final_noc_for_application(app_id)

        return {
            "status": "success",
            "message": "NOC generated successfully",
            "app_id": app_id,
            "department": department,
            "noc_url": result["noc_url"],
            "document_id": result["document_id"],
            "permit_id": result["permit_id"],
            "qr_code": result["qr_code"],
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


async def _build_pdf_response_from_storage_url(storage_url: str, file_name: str) -> Response:
    if storage_url.startswith("data:application/pdf;base64,"):
        encoded_pdf = storage_url.split(",", 1)[1]
        pdf_bytes = base64.b64decode(encoded_pdf)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="{file_name}"'},
        )

    async with httpx.AsyncClient(timeout=20.0) as client:
        upstream = await client.get(storage_url)
        upstream.raise_for_status()
        return Response(
            content=upstream.content,
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="{file_name}"'},
        )


@router.get("/api/dept/noc/{app_id}/pdf")
async def fetch_noc_pdf(app_id: str, department: Optional[str] = None):
    try:
        if department:
            normalized_department = _normalize_department_name(department) or str(department).strip()
            department_doc_type = _department_noc_doc_type(normalized_department)
            document = _fetch_latest_noc_document(
                app_id,
                [
                    department_doc_type,
                    department_doc_type.upper(),
                    f"NOC_{normalized_department}",
                ],
            )
        else:
            document = _fetch_latest_noc_document(app_id, ["NOC_FINAL", "NOC"])

        if not document:
            if department:
                raise HTTPException(status_code=404, detail="Department NOC document not found")
            raise HTTPException(status_code=404, detail="NOC document not found")

        file_name = document.get("file_name") or (
            f"NOC-{department}-{app_id}.pdf" if department else f"NOC-{app_id}.pdf"
        )
        storage_url = _coerce_storage_url(document.get("storage_url"))
        if not storage_url:
            raise HTTPException(status_code=404, detail="NOC document URL not found")

        return await _build_pdf_response_from_storage_url(storage_url, file_name)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=_error_detail(exc, "Failed to fetch NOC PDF")) from exc


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
