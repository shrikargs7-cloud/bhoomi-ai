"""Health & Authentication Router."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import (
    create_access_token,
    get_optional_user,
    hash_password,
    new_uuid,
    verify_password,
)
from app.db.database import get_db
from app.db.models import LandCaseORM, UserORM
from app.models.schemas import AuthResponse, UserLoginRequest, UserRegisterRequest

router = APIRouter()


@router.get("/health")
def health(db: Session = Depends(get_db)):
    cases_count = db.query(LandCaseORM).count()
    return {
        "status": "ok",
        "app": "BhoomiAI Land Intelligence Engine",
        "version": "2.0.0",
        "cases_in_db": cases_count,
    }


@router.post("/auth/register", response_model=AuthResponse)
def register(payload: UserRegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(UserORM).filter(UserORM.email == payload.email.lower().strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email is already registered")
    role = payload.role if payload.role in ("farmer", "reviewer") else "farmer"
    user = UserORM(
        id=new_uuid("usr"),
        email=payload.email.lower().strip(),
        name=payload.name.strip() or "Bhoomi User",
        password_hash=hash_password(payload.password),
        role=role,
    )
    db.add(user)
    db.commit()
    token = create_access_token(user.id, user.email, user.role)
    return AuthResponse(
        access_token=token,
        user={"id": user.id, "email": user.email, "name": user.name, "role": user.role},
    )


@router.post("/auth/login", response_model=AuthResponse)
def login(payload: UserLoginRequest, db: Session = Depends(get_db)):
    user = db.query(UserORM).filter(UserORM.email == payload.email.lower().strip()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = create_access_token(user.id, user.email, user.role)
    return AuthResponse(
        access_token=token,
        user={"id": user.id, "email": user.email, "name": user.name, "role": user.role},
    )


@router.get("/auth/me")
def get_me(actor: dict = Depends(get_optional_user)):
    return actor
