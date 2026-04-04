from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import settings, get_db
from app.models import User

security = HTTPBearer()


async def get_current_user(credentials = Depends(security)) -> str:
    """Extract and verify JWT token, return user_id"""
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
            )
        return user_id
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )


async def get_user_with_tier(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Get user object with tier information"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


def require_tier(required_tier: str):
    """Dependency factory for tier-based access control"""

    async def check_tier(user: User = Depends(get_user_with_tier)):
        tier_levels = {"free": 0, "pro": 1, "business": 2}
        user_level = tier_levels.get(user.tier, 0)
        required_level = tier_levels.get(required_tier, 0)

        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"This feature requires {required_tier} tier. Please upgrade.",
            )

        return user

    return check_tier
