"""Initial BhoomiAI 12-table schema (SPEC Section 13)

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-11-19
"""

from alembic import op
import sqlalchemy as sa

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "land_cases",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("owner_user_id", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("case_code", sa.String(), nullable=False),
        sa.Column("case_name", sa.String(), nullable=False),
        sa.Column("village", sa.String(), nullable=False),
        sa.Column("hobli", sa.String(), nullable=False),
        sa.Column("taluk", sa.String(), nullable=False),
        sa.Column("district", sa.String(), nullable=False),
        sa.Column("survey_number", sa.String(), nullable=False),
        sa.Column("synthetic", sa.Boolean(), nullable=False),
        sa.Column("is_public_demo", sa.Boolean(), nullable=False),
        sa.Column("external_llm_consent", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_land_cases_case_code", "land_cases", ["case_code"], unique=True)
    op.create_index("ix_land_cases_owner_user_id", "land_cases", ["owner_user_id"])

    op.create_table(
        "documents",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("case_id", sa.String(), sa.ForeignKey("land_cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("stored_path", sa.String(), nullable=False),
        sa.Column("doc_type", sa.String(), nullable=False),
        sa.Column("mime_type", sa.String(), nullable=False),
        sa.Column("pages_count", sa.Integer(), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("file_hash", sa.String(), nullable=False),
        sa.Column("language", sa.String(), nullable=False),
        sa.Column("extraction_method", sa.String(), nullable=False),
        sa.Column("ocr_quality_score", sa.Float(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("quality_warning", sa.Text(), nullable=True),
        sa.Column("injection_warning", sa.Text(), nullable=True),
        sa.Column("raw_text", sa.Text(), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_documents_case_id", "documents", ["case_id"])
    op.create_index("ix_documents_file_hash", "documents", ["file_hash"])

    op.create_table(
        "extracted_fields",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("document_id", sa.String(), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("field_name", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("original_text", sa.Text(), nullable=False),
        sa.Column("normalized_value_json", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("method", sa.String(), nullable=False),
        sa.Column("page", sa.Integer(), nullable=False),
        sa.Column("bounding_box_json", sa.Text(), nullable=True),
        sa.Column("reviewer_value_json", sa.Text(), nullable=True),
        sa.Column("verification_status", sa.String(), nullable=False),
        sa.Column("reviewer_notes", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_extracted_fields_document_id", "extracted_fields", ["document_id"])

    op.create_table(
        "persons",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("case_id", sa.String(), sa.ForeignKey("land_cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("canonical_name", sa.String(), nullable=False),
        sa.Column("normalized_name", sa.String(), nullable=False),
        sa.Column("aliases_json", sa.Text(), nullable=False),
        sa.Column("is_deceased", sa.Boolean(), nullable=False),
        sa.Column("date_of_death", sa.String(), nullable=True),
        sa.Column("resolution_status", sa.String(), nullable=False),
        sa.Column("similarity_score", sa.Float(), nullable=False),
    )
    op.create_index("ix_persons_case_id", "persons", ["case_id"])

    op.create_table(
        "ownership_events",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("case_id", sa.String(), sa.ForeignKey("land_cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_date", sa.String(), nullable=True),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("parties_json", sa.Text(), nullable=False),
        sa.Column("extent_affected", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("evidence_doc_id", sa.String(), nullable=False),
        sa.Column("evidence_doc_name", sa.String(), nullable=False),
        sa.Column("evidence_page", sa.Integer(), nullable=False),
        sa.Column("evidence_text", sa.Text(), nullable=False),
        sa.Column("evidence_bbox_json", sa.Text(), nullable=True),
    )
    op.create_index("ix_ownership_events_case_id", "ownership_events", ["case_id"])

    op.create_table(
        "discrepancies",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("case_id", sa.String(), sa.ForeignKey("land_cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rule_id", sa.String(), nullable=False),
        sa.Column("rule_name", sa.String(), nullable=False),
        sa.Column("severity", sa.String(), nullable=False),
        sa.Column("severity_rationale", sa.Text(), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("suggested_next_step", sa.Text(), nullable=False),
        sa.Column("fields_compared_json", sa.Text(), nullable=False),
        sa.Column("evidence_refs_json", sa.Text(), nullable=False),
        sa.Column("review_status", sa.String(), nullable=False),
        sa.Column("reviewer_notes", sa.Text(), nullable=True),
        sa.Column("reviewed_by", sa.String(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_discrepancies_case_id", "discrepancies", ["case_id"])

    op.create_table(
        "review_decisions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("case_id", sa.String(), sa.ForeignKey("land_cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_type", sa.String(), nullable=False),
        sa.Column("target_id", sa.String(), nullable=False),
        sa.Column("decision", sa.String(), nullable=False),
        sa.Column("previous_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("actor_name", sa.String(), nullable=False),
        sa.Column("actor_role", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_review_decisions_case_id", "review_decisions", ["case_id"])

    op.create_table(
        "comparables",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("case_id", sa.String(), sa.ForeignKey("land_cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("location", sa.String(), nullable=False),
        sa.Column("sale_date", sa.String(), nullable=False),
        sa.Column("extent_str", sa.String(), nullable=False),
        sa.Column("extent_acres", sa.Float(), nullable=False),
        sa.Column("sale_price_inr", sa.Float(), nullable=False),
        sa.Column("source_ref", sa.String(), nullable=False),
        sa.Column("verified", sa.Boolean(), nullable=False),
        sa.Column("synthetic", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_comparables_case_id", "comparables", ["case_id"])

    op.create_table(
        "geojson_layers",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("case_id", sa.String(), sa.ForeignKey("land_cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("source_description", sa.String(), nullable=False),
        sa.Column("synthetic", sa.Boolean(), nullable=False),
        sa.Column("geojson_json", sa.Text(), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_geojson_layers_case_id", "geojson_layers", ["case_id"])

    op.create_table(
        "workflow_runs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("case_id", sa.String(), sa.ForeignKey("land_cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=False),
        sa.Column("trace_json", sa.Text(), nullable=False),
    )
    op.create_index("ix_workflow_runs_case_id", "workflow_runs", ["case_id"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("case_id", sa.String(), sa.ForeignKey("land_cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor_name", sa.String(), nullable=False),
        sa.Column("actor_role", sa.String(), nullable=False),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("details", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_audit_logs_case_id", "audit_logs", ["case_id"])


def downgrade() -> None:
    for tbl in (
        "audit_logs",
        "workflow_runs",
        "geojson_layers",
        "comparables",
        "review_decisions",
        "discrepancies",
        "ownership_events",
        "persons",
        "extracted_fields",
        "documents",
        "land_cases",
        "users",
    ):
        op.drop_table(tbl)
