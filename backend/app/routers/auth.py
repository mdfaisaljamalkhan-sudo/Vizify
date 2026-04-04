from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.database import get_db
from app.models import User
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse
from app.utils.auth import hash_password, verify_password, create_tokens

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user"""
    # Check if user exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    existing_user = result.scalars().first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create new user
    user = User(
        id=str(uuid.uuid4()),
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        full_name=user_data.full_name,
        tier="free",  # Default tier
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Create tokens
    tokens = create_tokens(user.id)

    return TokenResponse(
        access_token=tokens["access_token"],
        token_type=tokens["token_type"],
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            tier=user.tier,
            created_at=user.created_at,
        ),
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    user_data: UserLogin,
    db: AsyncSession = Depends(get_db),
):
    """Login user and return JWT token"""
    # Find user by email
    result = await db.execute(select(User).where(User.email == user_data.email))
    user = result.scalars().first()

    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    # Create tokens
    tokens = create_tokens(user.id)

    return TokenResponse(
        access_token=tokens["access_token"],
        token_type=tokens["token_type"],
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            tier=user.tier,
            created_at=user.created_at,
        ),
    )


@router.post("/demo", response_model=TokenResponse)
async def create_demo_account(
    db: AsyncSession = Depends(get_db),
):
    """Create or return demo account for testing (development only)"""
    demo_email = "demo@example.com"

    # Check if demo account exists
    result = await db.execute(select(User).where(User.email == demo_email))
    user = result.scalars().first()

    if not user:
        # Create demo account
        user = User(
            id=str(uuid.uuid4()),
            email=demo_email,
            hashed_password=hash_password("demo1234"),
            full_name="Demo User",
            tier="pro",  # Give demo account pro access
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    # Create tokens
    tokens = create_tokens(user.id)

    return TokenResponse(
        access_token=tokens["access_token"],
        token_type=tokens["token_type"],
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            tier=user.tier,
            created_at=user.created_at,
        ),
    )
