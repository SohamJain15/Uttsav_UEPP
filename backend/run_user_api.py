import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth_routes import router as auth_router
from app.api.document_routes import router as document_router
from app.api.user_routes import router as user_router

app = FastAPI(title="Uttsav UEPP User API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, tags=["Auth"])
app.include_router(document_router, tags=["Documents"])
app.include_router(user_router, prefix="/api/user", tags=["User Portal"])


@app.get("/")
async def root():
    return {"service": "user-api", "status": "running", "port": 8000}


if __name__ == "__main__":
    uvicorn.run("run_user_api:app", host="0.0.0.0", port=8000, reload=True)
