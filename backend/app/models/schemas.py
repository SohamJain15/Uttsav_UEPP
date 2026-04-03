from pydantic import BaseModel
from typing import Optional

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
    
    # Booleans for routing logic
    has_fireworks: bool = False
    has_loudspeakers: bool = False
    is_moving_procession: bool = False
    food_stalls: bool = False