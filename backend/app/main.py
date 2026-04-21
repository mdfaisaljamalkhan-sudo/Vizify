from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import settings, Base, engine
from app.routers import upload, analyze, dashboards, shared, auth, chat, quality, joins
from app.models.user import User
from app.models.dashboard import Dashboard, DashboardShare
from app.models.dashboard_version import DashboardVersion
from app.models.dashboard_comment import DashboardComment

app = FastAPI(
    title="Vizify API",
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
    """Create all tables and ensure the shared anonymous user exists."""
    from app.database import AsyncSessionLocal
    from app.dependencies import DEMO_USER_ID
    from sqlalchemy import select
    import uuid

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == DEMO_USER_ID))
        if not result.scalars().first():
            db.add(User(
                id=DEMO_USER_ID,
                email="demo@vizify.app",
                hashed_password="no-auth",
                full_name="Vizify User",
                tier="pro",
            ))
            await db.commit()

# Register routers
app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(analyze.router)
app.include_router(dashboards.router)
app.include_router(shared.router)
app.include_router(chat.router)
app.include_router(quality.router)
app.include_router(joins.router)

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "message": "Vizify API is running"}

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Vizify Data-to-Dashboard Backend", "version": "0.1.0"}

if __name__ == "__main__":
    import os
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8002)), reload=True)
