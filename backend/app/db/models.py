"""SQLAlchemy 2.0 ORM models for BhoomiAI (SPEC Section 13)."""

from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from app.db.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserORM(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="farmer")  # farmer | reviewer
    created_at = Column(DateTime, default=utcnow, nullable=False)

    cases = relationship("LandCaseORM", back_populates="owner_user")


class LandCaseORM(Base):
    __tablename__ = "land_cases"

    id = Column(String, primary_key=True, index=True)
    owner_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    case_code = Column(String, unique=True, nullable=False, index=True)
    case_name = Column(String, nullable=False)
    village = Column(String, nullable=False, default="")
    hobli = Column(String, nullable=False, default="")
    taluk = Column(String, nullable=False, default="")
    district = Column(String, nullable=False, default="")
    survey_number = Column(String, nullable=False, default="")
    synthetic = Column(Boolean, nullable=False, default=False)
    is_public_demo = Column(Boolean, nullable=False, default=False)
    external_llm_consent = Column(Boolean, nullable=False, default=False)
    status = Column(String, nullable=False, default="created")
    created_at = Column(DateTime, default=utcnow, nullable=False)

    owner_user = relationship("UserORM", back_populates="cases")
    documents = relationship("DocumentORM", back_populates="land_case", cascade="all, delete-orphan")
    persons = relationship("PersonORM", back_populates="land_case", cascade="all, delete-orphan")
    ownership_events = relationship("OwnershipEventORM", back_populates="land_case", cascade="all, delete-orphan")
    discrepancies = relationship("DiscrepancyORM", back_populates="land_case", cascade="all, delete-orphan")
    review_decisions = relationship("ReviewDecisionORM", back_populates="land_case", cascade="all, delete-orphan")
    comparables = relationship("ComparableORM", back_populates="land_case", cascade="all, delete-orphan")
    geojson_layers = relationship("GeoJsonLayerORM", back_populates="land_case", cascade="all, delete-orphan")
    workflow_runs = relationship("WorkflowRunORM", back_populates="land_case", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLogORM", back_populates="land_case", cascade="all, delete-orphan")


class DocumentORM(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("land_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String, nullable=False)
    stored_path = Column(String, nullable=False)
    doc_type = Column(String, nullable=False, default="OTHER")
    mime_type = Column(String, nullable=False, default="application/pdf")
    pages_count = Column(Integer, nullable=False, default=1)
    file_size_bytes = Column(Integer, nullable=False, default=0)
    file_hash = Column(String, nullable=False, index=True)
    language = Column(String, nullable=False, default="English")
    extraction_method = Column(String, nullable=False, default="PyMuPDF Digital Layout")
    ocr_quality_score = Column(Float, nullable=False, default=0.0)
    status = Column(String, nullable=False, default="extracted")  # uploaded|extracted|needs_reupload|error
    quality_warning = Column(Text, nullable=True)
    injection_warning = Column(Text, nullable=True)
    raw_text = Column(Text, nullable=False, default="")
    uploaded_at = Column(DateTime, default=utcnow, nullable=False)

    land_case = relationship("LandCaseORM", back_populates="documents")
    extracted_fields = relationship("ExtractedFieldORM", back_populates="document", cascade="all, delete-orphan")


class ExtractedFieldORM(Base):
    __tablename__ = "extracted_fields"

    id = Column(String, primary_key=True, index=True)
    document_id = Column(String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    field_name = Column(String, nullable=False, index=True)
    label = Column(String, nullable=False)
    original_text = Column(Text, nullable=False)
    normalized_value_json = Column(Text, nullable=False)
    confidence = Column(Float, nullable=False, default=0.0)
    method = Column(String, nullable=False)
    page = Column(Integer, nullable=False, default=1)
    bounding_box_json = Column(Text, nullable=True)
    reviewer_value_json = Column(Text, nullable=True)
    verification_status = Column(String, nullable=False, default="unverified")
    reviewer_notes = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=utcnow, nullable=False)

    document = relationship("DocumentORM", back_populates="extracted_fields")


class PersonORM(Base):
    __tablename__ = "persons"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("land_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    canonical_name = Column(String, nullable=False)
    normalized_name = Column(String, nullable=False)
    aliases_json = Column(Text, nullable=False, default="[]")
    is_deceased = Column(Boolean, nullable=False, default=False)
    date_of_death = Column(String, nullable=True)
    resolution_status = Column(String, nullable=False, default="confirmed")  # confirmed|uncertain|reviewer_confirmed
    similarity_score = Column(Float, nullable=False, default=1.0)

    land_case = relationship("LandCaseORM", back_populates="persons")


class OwnershipEventORM(Base):
    __tablename__ = "ownership_events"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("land_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    event_date = Column(String, nullable=True)
    event_type = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    parties_json = Column(Text, nullable=False, default="[]")
    extent_affected = Column(String, nullable=True)
    status = Column(String, nullable=False, default="documented")
    evidence_doc_id = Column(String, nullable=False)
    evidence_doc_name = Column(String, nullable=False)
    evidence_page = Column(Integer, nullable=False, default=1)
    evidence_text = Column(Text, nullable=False)
    evidence_bbox_json = Column(Text, nullable=True)

    land_case = relationship("LandCaseORM", back_populates="ownership_events")


class DiscrepancyORM(Base):
    __tablename__ = "discrepancies"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("land_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    rule_id = Column(String, nullable=False, index=True)
    rule_name = Column(String, nullable=False)
    severity = Column(String, nullable=False)
    severity_rationale = Column(Text, nullable=False, default="")
    explanation = Column(Text, nullable=False)
    suggested_next_step = Column(Text, nullable=False)
    fields_compared_json = Column(Text, nullable=False, default="{}")
    evidence_refs_json = Column(Text, nullable=False, default="[]")
    review_status = Column(String, nullable=False, default="pending")
    reviewer_notes = Column(Text, nullable=True)
    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)

    land_case = relationship("LandCaseORM", back_populates="discrepancies")


class ReviewDecisionORM(Base):
    __tablename__ = "review_decisions"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("land_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    target_type = Column(String, nullable=False)  # field | discrepancy | person
    target_id = Column(String, nullable=False)
    decision = Column(String, nullable=False)
    previous_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    actor_name = Column(String, nullable=False)
    actor_role = Column(String, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    land_case = relationship("LandCaseORM", back_populates="review_decisions")


class ComparableORM(Base):
    __tablename__ = "comparables"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("land_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    label = Column(String, nullable=False)
    location = Column(String, nullable=False)
    sale_date = Column(String, nullable=False)
    extent_str = Column(String, nullable=False)
    extent_acres = Column(Float, nullable=False)
    sale_price_inr = Column(Float, nullable=False)
    source_ref = Column(String, nullable=False)
    verified = Column(Boolean, nullable=False, default=False)
    synthetic = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    land_case = relationship("LandCaseORM", back_populates="comparables")


class GeoJsonLayerORM(Base):
    __tablename__ = "geojson_layers"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("land_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String, nullable=False)
    source_description = Column(String, nullable=False)
    synthetic = Column(Boolean, nullable=False, default=False)
    geojson_json = Column(Text, nullable=False)
    uploaded_at = Column(DateTime, default=utcnow, nullable=False)

    land_case = relationship("LandCaseORM", back_populates="geojson_layers")


class WorkflowRunORM(Base):
    __tablename__ = "workflow_runs"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("land_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String, nullable=False, default="completed")
    started_at = Column(DateTime, default=utcnow, nullable=False)
    completed_at = Column(DateTime, default=utcnow, nullable=False)
    trace_json = Column(Text, nullable=False, default="[]")

    land_case = relationship("LandCaseORM", back_populates="workflow_runs")


class AuditLogORM(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("land_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_name = Column(String, nullable=False)
    actor_role = Column(String, nullable=False)
    action = Column(String, nullable=False)
    details = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    land_case = relationship("LandCaseORM", back_populates="audit_logs")
