"""Authentication and Case-Level Authorization for BhoomiAI."""

import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import UserORM, LandCaseORM

JWT_SECRET = os.environ.get("BHOOMI_JWT_SECRET", "bhoomiai-local-dev-secret-change-in-prod")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=JWT_EXPIRY_HOURS)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("purpose") == "report_download":
            return None
        return payload
    except Exception:
        return None


def create_download_token(
    case_id: str,
    actor_id: str,
    actor_name: str,
    actor_role: str,
    ttl_seconds: int = 300,
) -> str:
    """Issues a short-lived HS256 JWT scoped strictly to downloading one case PDF report."""
    now = datetime.now(timezone.utc)
    payload = {
        "purpose": "report_download",
        "case_id": case_id,
        "sub": actor_id,
        "actor_name": actor_name,
        "actor_role": actor_role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=ttl_seconds)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_download_token(token: str) -> Optional[dict]:
    """Verifies a report download JWT and enforces purpose == 'report_download'."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("purpose") != "report_download" or not payload.get("case_id"):
            return None
        return payload
    except Exception:
        return None


def seed_default_user(db: Session) -> UserORM:
    demo_user = db.query(UserORM).filter(UserORM.email == "demo@bhoomiai.in").first()
    if not demo_user:
        demo_user = UserORM(
            id="user-demo-001",
            email="demo@bhoomiai.in",
            name="Bhoomi Demo Officer",
            password_hash=hash_password("bhoomi123"),
            role="reviewer",
        )
        db.add(demo_user)
        db.commit()
        db.refresh(demo_user)
    return demo_user


def get_optional_user(
    authorization: Optional[str] = Header(default=None),
    x_demo_role: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> dict:
    """Returns authenticated user info if Bearer token provided; otherwise demo context."""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        payload = decode_access_token(token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication token",
            )
        user = db.query(UserORM).filter(UserORM.id == payload["sub"]).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authenticated user no longer exists",
            )
        return {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": x_demo_role if x_demo_role in ("farmer", "reviewer") else user.role,
            "is_authenticated": True,
        }

    role = x_demo_role if x_demo_role in ("farmer", "reviewer") else "reviewer"
    return {
        "id": "user-demo-001",
        "email": "demo@bhoomiai.in",
        "name": "Demo Reviewer" if role == "reviewer" else "Demo Landowner",
        "role": role,
        "is_authenticated": False,
    }


def get_authorized_case(
    case_id: str,
    db: Session,
    actor: dict,
    require_write: bool = False,
) -> LandCaseORM:
    """Enforces case-level authorization.

    - Public synthetic demo cases (`is_public_demo=True`) are accessible in demo mode.
    - Private cases created by a registered user require matching `owner_user_id`
      when accessed by an authenticated user, or authentication when unauthenticated.
    """
    case = (
        db.query(LandCaseORM)
        .filter((LandCaseORM.case_code == case_id) | (LandCaseORM.id == case_id))
        .first()
    )
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")

    if case.is_public_demo:
        return case

    if not actor["is_authenticated"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to access private cases",
        )

    if case.owner_user_id and case.owner_user_id != actor["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this land case",
        )

    return case


def new_uuid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"
