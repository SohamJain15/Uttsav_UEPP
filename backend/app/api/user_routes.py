from fastapi import APIRouter, HTTPException
from app.models.schemas import ApplicationSubmitRequest
from app.core.database import db
import uuid

router = APIRouter()

@router.post("/submit-application")
async def submit_application(payload: ApplicationSubmitRequest):
    """
    Receives the application from the User Portal, saves it to Supabase,
    and intelligently routes it to the required departments.
    """
    try:
        new_event_id = str(uuid.uuid4())
        custom_app_id = f"UEPP-{new_event_id[:8].upper()}"

        # 1. Insert Event
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
            "is_moving_procession": payload.is_moving_procession
        }
        db.table("events").insert(event_data).execute()

        # 2. Insert Application
        app_data = {
            "app_id": custom_app_id,
            "event_id": new_event_id,
            "status": "Submitted"
        }
        db.table("applications").insert(app_data).execute()

        # 3. Dynamic Department Routing Logic
        departments_needed = []
        if payload.crowd_size > 200 or payload.is_moving_procession or payload.has_loudspeakers:
            departments_needed.append("Police")
        if payload.has_fireworks:
            departments_needed.append("Fire")
        if payload.is_moving_procession or payload.crowd_size > 1000:
            departments_needed.append("Traffic")
        if payload.food_stalls or payload.venue_type == "Public Ground":
            departments_needed.append("Municipality")

        # Fallback: if small event, still needs Municipality for basic clearance
        if not departments_needed:
            departments_needed.append("Municipality")

        # 4. Insert Routings
        routing_inserts = []
        for dept in departments_needed:
            routing_inserts.append({
                "app_id": custom_app_id,
                "department": dept,
                "status": "Pending"
            })
        
        db.table("department_routings").insert(routing_inserts).execute()

        return {
            "status": "success",
            "message": "Application stored and routed successfully!",
            "application_id": custom_app_id,
            "routed_to": departments_needed
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database Insertion Failed: {str(e)}")


@router.get("/applications")
async def get_user_applications():
    """
    Fetches all applications to display on the User Portal Dashboard.
    """
    try:
        response = db.table("applications").select(
            "app_id, status, submitted_at, events(name, category, expected_crowd, start_time, raw_address)"
        ).execute()

        formatted_apps = []
        for app in response.data:
            event = app.get("events") or {}
            formatted_apps.append({
                "id": app["app_id"],
                "eventName": event.get("name", "Unknown Event"),
                "eventType": event.get("category", "Unknown"),
                "crowdSize": event.get("expected_crowd", 0),
                "venueType": "Public", 
                "status": app["status"],
                "submittedAt": app.get("submitted_at", "N/A"),
                "address": event.get("raw_address", "Unknown")
            })

        return {"status": "success", "data": formatted_apps}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch applications: {str(e)}")