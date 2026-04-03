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
        response = db.table("applications").select("app_id, user_id").eq("app_id", app_id).limit(1).execute()
    except Exception:
        return

    application = first_row(response.data)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    owner_id = application.get("user_id")
    if owner_id and owner_id != user_id:
        raise HTTPException(status_code=403, detail="You are not allowed to access this application's documents")


@router.post("/api/documents/upload")
async def upload_document(
    app_id: str = Form(...),
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
    storage_path = f"{app_id}/{user_id}/{uuid.uuid4()}{extension}"
    content_type = file.content_type or "application/octet-stream"

    try:
        db.storage.from_(DOCUMENT_BUCKET).upload(
            path=storage_path,
            file=content,
            file_options={"content-type": content_type, "upsert": "true"},
        )
        public_url = db.storage.from_(DOCUMENT_BUCKET).get_public_url(storage_path)

        document_payload = {
            "app_id": app_id,
            "document_url": public_url,
            "file_name": file.filename,
            "storage_path": storage_path,
            "uploaded_by": user_id,
            "content_type": content_type,
        }
        db.table("documents").insert(document_payload).execute()

        return {
            "status": "success",
            "message": "Document uploaded successfully",
            "app_id": app_id,
            "document_url": public_url,
            "storage_path": storage_path,
        }
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
            .select("*")
            .eq("app_id", app_id)
            .order("created_at", desc=True)
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
