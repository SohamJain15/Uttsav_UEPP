from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# We will create these routing files next
# from app.api.user_routes import router as user_router
# from app.api.dept_routes import router as dept_router

app = FastAPI(title="Uttsav Enterprise API", version="1.0.0")

# Strict CORS configuration to only allow your specific frontend ports
origins = [
    "http://localhost:5173", # Standard Vite port for User Portal
    "http://localhost:5174", # Standard Vite port for Dept Portal
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the isolated API routes (Commented out until we create the files)
# app.include_router(user_router, prefix="/api/user", tags=["User Portal"])
# app.include_router(dept_router, prefix="/api/dept", tags=["Department Portal"])

@app.get("/")
async def health_check():
    return {"status": "Uttsav Secure API is running."}