from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine
from app.database import settings, Base, engine
from app.routers import upload, analyze, dashboards, shared, auth
from app.models.user import User
from app.models.dashboard import Dashboard, DashboardShare

app = FastAPI(
    title="SubaDash API",
    description="Data-to-Dashboard Backend",
    version="0.1.0"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database tables on startup
@app.on_event("startup")
async def startup_event():
    """Create all database tables on startup"""
    # Create sync engine for table creation
    sync_engine = create_engine("sqlite:///./subadash.db")
    Base.metadata.create_all(bind=sync_engine)
    sync_engine.dispose()

# Register routers
app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(analyze.router)
app.include_router(dashboards.router)
app.include_router(shared.router)

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "message": "SubaDash API is running"}

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "SubaDash Data-to-Dashboard Backend", "version": "0.1.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
