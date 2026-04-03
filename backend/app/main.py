from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth_routes import router as auth_router
from app.api.dept_routes import router as dept_router
from app.api.document_routes import router as document_router
from app.api.user_routes import router as user_router

app = FastAPI(title="Uttsav UEPP API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, tags=["Auth & Profile"])
app.include_router(document_router, tags=["Documents"])
app.include_router(dept_router, tags=["Department Portal"])
app.include_router(user_router, prefix="/api/user", tags=["User Portal"])


@app.get("/")
async def root():
    return {"message": "Uttsav Backend is actively running in modular mode."}
