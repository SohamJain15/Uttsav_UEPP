from fastapi import APIRouter, HTTPException
from app.core.database import db

router = APIRouter()

@router.get("/applications/{department_name}")
async def get_department_applications(department_name: str):
    """
    Fetches applications specific to a department (e.g., 'Police', 'Fire').
    """
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