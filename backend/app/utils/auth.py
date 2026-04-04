from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
from app.database import settings

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: str, expires_delta: timedelta | None = None) -> str:
    """Create JWT access token"""
    if expires_delta is None:
        expires_delta = timedelta(days=7)

    expire = datetime.utcnow() + expires_delta
    to_encode = {"sub": user_id, "exp": expire}

    encoded_jwt = jwt.encode(
        to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm
    )
    return encoded_jwt


def create_tokens(user_id: str) -> dict[str, str]:
    """Create access and refresh tokens"""
    access_token = create_access_token(user_id)
    refresh_token = create_access_token(user_id, expires_delta=timedelta(days=30))

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }
