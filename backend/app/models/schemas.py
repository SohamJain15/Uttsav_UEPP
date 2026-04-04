from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class UserCredentials(BaseModel):
    email: str
    password: str


class AuthRegisterRequest(UserCredentials):
    full_name: str
    phone_number: Optional[str] = None
    organization: Optional[str] = None
    department: Optional[str] = None
    username: Optional[str] = None


class UserProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    organization: Optional[str] = None
    department: Optional[str] = None


class DepartmentActionRequest(BaseModel):
    action: str
    rejection_reason: Optional[str] = None


class ApplicationSubmitRequest(BaseModel):
    event_name: str
    event_type: str
    crowd_size: int
    start_date: str
    end_date: str

    venue_name: str = Field(..., min_length=1)
    venue_type: str = Field(..., min_length=1)
    venue_ownership: Optional[str] = None
    address: str = Field(..., min_length=1)
    city: str = Field(..., min_length=1)
    pincode: Optional[str] = "110001"
    map_latitude: Optional[float] = None
    map_longitude: Optional[float] = None

    has_fireworks: bool = False
    has_loudspeakers: bool = False
    is_moving_procession: bool = False
    food_stalls: bool = False


class RiskAnalysisRequest(BaseModel):
    # Frontend-friendly fields
    event_type: Optional[str] = None
    venue_type: Optional[str] = None
    crowd_size: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

    fireworks: Optional[bool] = None
    temporaryStructures: Optional[bool] = None
    stageRequired: Optional[bool] = None
    soundSystem: Optional[bool] = None
    roadClosureRequired: Optional[bool] = None
    is_moving_procession: Optional[bool] = None
    foodStalls: Optional[bool] = None
    liquorServed: Optional[bool] = None

    max_venue_capacity: Optional[int] = None
    venue_area_sq_meters: Optional[float] = None
    number_of_fire_exits: Optional[int] = None

    # Advanced model-ready fields
    Event_Category: Optional[str] = None
    Time_Of_Day: Optional[str] = None
    Environment_Type: Optional[str] = None
    Expected_Crowd: Optional[int] = None
    Max_Venue_Capacity: Optional[int] = None
    Venue_Area_Sq_Meters: Optional[float] = None
    Number_Of_Fire_Exits: Optional[int] = None
    Duration_Hours: Optional[int] = None
    Has_Fireworks: Optional[int] = None
    Has_Temp_Structures: Optional[int] = None
    VIP_Attendance: Optional[int] = None
    Loudspeaker_Used: Optional[int] = None
    Road_Closure_Required: Optional[int] = None
    Is_Moving_Procession: Optional[int] = None
    Food_Stalls_Present: Optional[int] = None
    Liquor_Served: Optional[int] = None

    class Config:
        extra = "allow"


class AssistantQueryRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=1200)
    current_step: Optional[int] = None
    step_name: Optional[str] = None
    form_context: Optional[Dict[str, Any]] = None


class ApprovalProbabilityRequest(BaseModel):
    # Frontend-compatible fields
    eventType: Optional[str] = None
    crowdSize: Optional[int] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    startTime: Optional[str] = None
    endTime: Optional[str] = None
    venueType: Optional[str] = None
    mapLatitude: Optional[float] = None
    mapLongitude: Optional[float] = None
    roadClosureRequired: Optional[bool] = None
    trafficImpact: Optional[str] = None
    isMovingProcession: Optional[bool] = None

    # API-style aliases
    event_type: Optional[str] = None
    crowd_size: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    venue_type: Optional[str] = None
    map_latitude: Optional[float] = None
    map_longitude: Optional[float] = None
    road_closure_required: Optional[bool] = None
    traffic_impact: Optional[str] = None
    is_moving_procession: Optional[bool] = None

    class Config:
        extra = "allow"


class RouteCollisionRequest(BaseModel):
    isMovingProcession: Optional[bool] = None
    is_moving_procession: Optional[bool] = None

    routeOrigin: Optional[str] = None
    routeDestination: Optional[str] = None
    route_origin: Optional[str] = None
    route_destination: Optional[str] = None

    startDate: Optional[str] = None
    endDate: Optional[str] = None
    startTime: Optional[str] = None
    endTime: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None

    eventName: Optional[str] = None
    eventType: Optional[str] = None
    crowdSize: Optional[int] = None
    event_name: Optional[str] = None
    event_type: Optional[str] = None
    crowd_size: Optional[int] = None

    mapLatitude: Optional[float] = None
    mapLongitude: Optional[float] = None
    map_latitude: Optional[float] = None
    map_longitude: Optional[float] = None

    preferredRouteId: Optional[str] = None
    preferred_route_id: Optional[str] = None
    mode: Optional[str] = None
    alternatives: Optional[bool] = None
    spatialThresholdMeters: Optional[float] = None
    temporalThresholdMinutes: Optional[int] = None
    spatial_threshold_meters: Optional[float] = None
    temporal_threshold_minutes: Optional[int] = None

    class Config:
        extra = "allow"
