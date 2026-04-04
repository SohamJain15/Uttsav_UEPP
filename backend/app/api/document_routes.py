import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.core.auth import first_row, get_current_user
from app.core.database import db

router = APIRouter()

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}
DOCUMENT_BUCKET = "application_documents"


def _error_detail(exc: Exception, fallback: str) -> str:
    return str(getattr(exc, "message", None) or exc or fallback)


def _safe_extension(filename: Optional[str]) -> str:
    if not filename or "." not in filename:
        return ""
    return f".{filename.rsplit('.', 1)[1].lower()}"


def _assert_application_owner(app_id: str, user_id: str) -> None:
    try:
        response = (
            db.table("applications")
            .select("app_id, user_id, event_id, events(organizer_id)")
            .eq("app_id", app_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_error_detail(exc, "Failed to verify application ownership"),
        ) from exc

    application = first_row(response.data)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    event = application.get("events") or {}
    if isinstance(event, list):
        event = event[0] if event else {}
    owner_id = application.get("user_id") or event.get("organizer_id")
    if owner_id and str(owner_id) != str(user_id):
        raise HTTPException(status_code=403, detail="You are not allowed to access this application's documents")


@router.post("/api/documents/upload")
async def upload_document(
    app_id: str = Form(...),
    doc_type: str = Form("General"),
    file: UploadFile = File(...),
    current=Depends(get_current_user),
):
    _assert_application_owner(app_id, current["user"]["id"])

    extension = _safe_extension(file.filename)
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Only PDF, PNG, JPG, JPEG, and WEBP files are allowed",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    user_id = current["user"]["id"]
    safe_doc_type = str(doc_type or "General").strip() or "General"
    storage_path = f"{app_id}/{safe_doc_type}/{user_id}/{uuid.uuid4()}{extension}"
    content_type = file.content_type or "application/octet-stream"

    try:
        try:
            db.storage.from_(DOCUMENT_BUCKET).upload(storage_path, content)
        except TypeError:
            db.storage.from_(DOCUMENT_BUCKET).upload(
                path=storage_path,
                file=content,
                file_options={"content-type": content_type, "upsert": "true"},
            )
        public_url = db.storage.from_(DOCUMENT_BUCKET).get_public_url(storage_path)

        payload_candidates = [
            {
                "app_id": app_id,
                "doc_type": safe_doc_type,
                "file_name": file.filename,
                "storage_url": public_url,
            }
        ]

        inserted = False
        document_row = None
        last_error: Optional[Exception] = None
        for document_payload in payload_candidates:
            try:
                insert_response = db.table("documents").insert(document_payload).execute()
                document_row = first_row(insert_response.data) or document_payload
                inserted = True
                break
            except Exception as exc:
                last_error = exc
                continue
        if not inserted:
            raise HTTPException(
                status_code=500,
                detail=_error_detail(last_error or Exception("Unknown documents insert error"), "Document metadata insert failed"),
            )

        return {
            "status": "success",
            "message": "Document uploaded successfully",
            "app_id": app_id,
            "document_id": (document_row or {}).get("id"),
            "doc_type": safe_doc_type,
            "public_url": public_url,
            "document_url": public_url,
            "storage_url": public_url,
            "storage_path": storage_path,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_error_detail(exc, "Document upload failed"),
        ) from exc


@router.get("/api/documents/{app_id}")
async def get_documents(app_id: str, current=Depends(get_current_user)):
    _assert_application_owner(app_id, current["user"]["id"])

    try:
        response = (
            db.table("documents")
            .select("id, app_id, doc_type, file_name, storage_url, uploaded_at")
            .eq("app_id", app_id)
            .order("uploaded_at", desc=True)
            .execute()
        )
        return {
            "status": "success",
            "app_id": app_id,
            "documents": response.data or [],
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_error_detail(exc, "Failed to fetch documents"),
        ) from exc
