from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.user_routes import router as user_router
from app.api.dept_routes import router as dept_router

app = FastAPI(title="Uttsav Enterprise API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user_router, prefix="/api/user", tags=["User Portal"])
app.include_router(dept_router, prefix="/api/dept", tags=["Department Portal"])

@app.get("/")
async def root():
    return {"message": "Uttsav Backend is actively running."}