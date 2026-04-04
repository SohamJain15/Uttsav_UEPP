import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth_routes import router as auth_router
from app.api.dept_routes import router as dept_router

app = FastAPI(title="Uttsav UEPP Department API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, tags=["Auth"])
app.include_router(dept_router, tags=["Department Portal"])


@app.get("/")
async def root():
    return {"service": "dept-api", "status": "running", "port": 8001}


if __name__ == "__main__":
    uvicorn.run("run_dept_api:app", host="0.0.0.0", port=8001, reload=True)
