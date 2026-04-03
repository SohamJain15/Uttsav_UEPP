from typing import Optional

from pydantic import BaseModel


class UserCredentials(BaseModel):
    email: str
    password: str


class AuthRegisterRequest(UserCredentials):
    full_name: str
    phone_number: Optional[str] = None
    organization: Optional[str] = None
    department: Optional[str] = None


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

    venue_name: str
    venue_type: str
    address: str
    city: str
    pincode: Optional[str] = "110001"

    has_fireworks: bool = False
    has_loudspeakers: bool = False
    is_moving_procession: bool = False
    food_stalls: bool = False
