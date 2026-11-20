"""BhoomiAI Dynamic PDF Land Readiness Report Generator (SPEC Section 17)
Generates case-specific Land Readiness Reports from live SQLite/Pydantic state
with evidence citations, human-review statuses, 6 readiness dimensions, and statutory disclaimers.
"""

from typing import Optional
from datetime import datetime, timezone
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas
from app.models.schemas import LandCase, ValuationResponse


def _make_canvas_cls(case_id: str, survey_no: str, synthetic: bool):
    class DynamicReportCanvas(canvas.Canvas):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.pages = []

        def showPage(self):
            self.pages.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            num_pages = len(self.pages)
            for page_idx, page in enumerate(self.pages):
                self.__dict__.update(page)
                self.draw_header_footer(page_idx + 1, num_pages)
                canvas.Canvas.showPage(self)
            canvas.Canvas.save(self)

        def draw_header_footer(self, page_num, total_pages):
            self.saveState()
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(colors.HexColor("#123D32"))
            self.drawString(36, 810, "BhoomiAI — Land Readiness Report (Decision Support)")
            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor("#64748B"))
            self.drawRightString(559, 810, f"Case: {case_id} | Survey No. {survey_no or 'N/A'}")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(36, 804, 559, 804)

            self.line(36, 40, 559, 40)
            self.setFont("Helvetica-Bold", 7.2)
            self.setFillColor(colors.HexColor("#991B1B"))
            footer_tag = (
                "SYNTHETIC DEMO DATA — DECISION SUPPORT ONLY. NOT A LEGAL TITLE CERTIFICATE."
                if synthetic
                else "DECISION SUPPORT ONLY — NOT A LEGAL CERTIFICATION OF TITLE OR BOUNDARIES."
            )
            self.drawString(36, 28, footer_tag)
            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor("#64748B"))
            self.drawRightString(559, 28, f"Page {page_num} of {total_pages}")
            self.restoreState()

    return DynamicReportCanvas


def generate_land_readiness_pdf(
    case: LandCase,
    output_path: str,
    valuation: Optional[ValuationResponse] = None,
):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=48,
        bottomMargin=48,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "RepTitle", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=17,
        alignment=1, textColor=colors.HexColor("#123D32"),
    )
    sub_style = ParagraphStyle(
        "RepSub", parent=styles["Normal"], fontName="Helvetica", fontSize=9.5,
        alignment=1, textColor=colors.HexColor("#475569"),
    )
    h1_style = ParagraphStyle(
        "RepH1", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=11,
        textColor=colors.HexColor("#164E49"), spaceBefore=8, spaceAfter=4,
    )
    body_style = ParagraphStyle(
        "RepBody", parent=styles["Normal"], fontName="Helvetica", fontSize=8,
        leading=10.5, textColor=colors.HexColor("#334155"),
    )
    body_bold = ParagraphStyle(
        "RepBodyBold", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8,
        leading=10.5, textColor=colors.HexColor("#0F172A"),
    )

    story = [
        Paragraph("BHOOMIAI LAND READINESS REPORT", title_style),
        Spacer(1, 3),
        Paragraph(f"{case.case_name} — Evidence-Backed Due Diligence Summary", sub_style),
        Spacer(1, 8),
        HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#123D32"), spaceAfter=10),
    ]

    # Case summary
    pending_cnt = sum(1 for d in case.discrepancies if d.review_status == "pending")
    summary_text = (
        "Clean — 0 Discrepancies Found"
        if not case.discrepancies
        else f"{len(case.discrepancies)} Discrepancy Finding(s) ({pending_cnt} pending review)"
    )
    summary_color = "#059669" if not case.discrepancies else "#B91C1C"
    gen_date = datetime.now(timezone.utc).strftime("%d %b %Y %H:%M UTC")

    summary_data = [
        [Paragraph("<b>Case ID:</b>", body_bold), Paragraph(case.case_id, body_style),
         Paragraph("<b>Survey Number:</b>", body_bold), Paragraph(case.survey_number or "N/A", body_bold)],
        [Paragraph("<b>Location:</b>", body_bold), Paragraph(f"{case.village}, {case.taluk}, {case.district}".strip(", "), body_style),
         Paragraph("<b>Generated:</b>", body_bold), Paragraph(gen_date, body_style)],
        [Paragraph("<b>Documents:</b>", body_bold), Paragraph(f"{len(case.documents)} uploaded", body_style),
         Paragraph("<b>Audit Outcome:</b>", body_bold), Paragraph(f"<font color='{summary_color}'><b>{summary_text}</b></font>", body_style)],
    ]
    st = Table(summary_data, colWidths=[90, 170, 95, 165])
    st.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.extend([st, Spacer(1, 10)])

    # 1. Six Readiness Dimensions (no averaged score per SPEC Section 9)
    story.append(Paragraph("1. LAND READINESS DIMENSIONS (NO AVERAGED SCORE — SPEC SECTION 9)", h1_style))
    dim_rows = [[
        Paragraph("<b>Dimension</b>", body_bold),
        Paragraph("<b>Status</b>", body_bold),
        Paragraph("<b>Checks</b>", body_bold),
        Paragraph("<b>Evidence &amp; Missing Items</b>", body_bold),
    ]]
    for dim in case.readiness_dimensions:
        c_hex = "#059669" if dim.status == "Pass" else ("#DC2626" if "Review" in dim.status else "#D97706")
        if dim.status == "Insufficient Evidence":
            c_hex = "#475569"
        dim_rows.append([
            Paragraph(dim.dimension_name, body_bold),
            Paragraph(f"<font color='{c_hex}'><b>{dim.status}</b></font>", body_style),
            Paragraph(f"{dim.checks_run} ({dim.issues_found} issues)", body_style),
            Paragraph(dim.summary, body_style),
        ])
    dt = Table(dim_rows, colWidths=[115, 105, 70, 230])
    dt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#164E49")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.extend([dt, Spacer(1, 10)])

    # 2. Document Inventory
    story.append(Paragraph("2. DOCUMENT INVENTORY &amp; EXTRACTION PROVENANCE", h1_style))
    doc_rows = [[
        Paragraph("<b>File Name</b>", body_bold),
        Paragraph("<b>Type</b>", body_bold),
        Paragraph("<b>Method</b>", body_bold),
        Paragraph("<b>Quality / Conf</b>", body_bold),
        Paragraph("<b>Status</b>", body_bold),
    ]]
    for d in case.documents:
        doc_rows.append([
            Paragraph(d.filename, body_style),
            Paragraph(d.doc_type, body_style),
            Paragraph(d.extraction_method, body_style),
            Paragraph(f"{round(d.ocr_quality_score * 100)}%", body_style),
            Paragraph(d.status, body_style),
        ])
    dot = Table(doc_rows, colWidths=[155, 95, 115, 75, 80])
    dot.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#334155")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.extend([dot, Spacer(1, 10)])

    # 3. Ownership Timeline
    story.append(Paragraph("3. RECONSTRUCTED OWNERSHIP EVENT TIMELINE", h1_style))
    if case.ownership_events:
        ev_rows = [[
            Paragraph("<b>Date</b>", body_bold),
            Paragraph("<b>Type / Status</b>", body_bold),
            Paragraph("<b>Event Description</b>", body_bold),
            Paragraph("<b>Evidence Citation</b>", body_bold),
        ]]
        for ev in case.ownership_events:
            ev_rows.append([
                Paragraph(ev.date or "Undated", body_bold),
                Paragraph(f"{ev.event_type}<br/>({ev.status})", body_style),
                Paragraph(ev.description, body_style),
                Paragraph(f"<b>{ev.evidence.document_name}</b> (p.{ev.evidence.page})", body_style),
            ])
        et = Table(ev_rows, colWidths=[65, 80, 235, 140])
        et.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E293B")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(et)
    else:
        story.append(Paragraph("Insufficient evidence — no ownership events reconstructed yet.", body_style))
    story.append(Spacer(1, 10))

    # 4. Discrepancy Register
    story.append(Paragraph("4. DETERMINISTIC DISCREPANCY REGISTER &amp; HUMAN REVIEW STATUS", h1_style))
    if case.discrepancies:
        disc_rows = [[
            Paragraph("<b>Rule &amp; Severity</b>", body_bold),
            Paragraph("<b>Finding (Requires Verification)</b>", body_bold),
            Paragraph("<b>Evidence Citations</b>", body_bold),
            Paragraph("<b>Review Status</b>", body_bold),
        ]]
        for disc in case.discrepancies:
            ev_text = "<br/>".join([f"• <b>{r.document_name}</b> (p.{r.page}): {r.original_text[:55]}" for r in disc.evidence_refs])
            rev_txt = f"<b>{disc.review_status.upper()}</b>" + (f"<br/>{disc.reviewer_notes}" if disc.reviewer_notes else "")
            disc_rows.append([
                Paragraph(f"<b>{disc.rule_id}: {disc.rule_name}</b><br/>[{disc.severity}]", body_style),
                Paragraph(f"{disc.explanation}<br/><i>Next: {disc.suggested_next_step}</i>", body_style),
                Paragraph(ev_text, body_style),
                Paragraph(rev_txt, body_style),
            ])
        dit = Table(disc_rows, colWidths=[110, 195, 130, 85])
        dit.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#7F1D1D")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(dit)
    else:
        story.append(Paragraph("No cross-document discrepancies detected across rules R1–R5 for the submitted records.", body_style))
    story.append(Spacer(1, 10))

    # 5. Valuation Baseline / Abstention
    story.append(Paragraph("5. VALUATION BASELINE (ADVISORY)", h1_style))
    if valuation and not valuation.abstained:
        story.append(Paragraph(
            f"Verified comparables: {valuation.verified_count}. Median rate: Rs. {valuation.median_price_per_acre_inr:,.0f}/acre. "
            f"{valuation.message} {valuation.limitations}",
            body_style,
        ))
    else:
        story.append(Paragraph(
            "Insufficient verified comparable evidence to produce a reliable valuation. "
            "(Comparable-based baseline only; minimum 3 verified comparables required; not a registered valuer report.)",
            body_style,
        ))
    story.append(Spacer(1, 12))

    # Disclaimer
    story.append(Paragraph(
        "<b>IMPORTANT STATUTORY DISCLAIMER:</b> BhoomiAI is an evidence-first decision-support tool. "
        "It is NOT legal certification of title, parcel boundaries, mutations, valuation, or loan eligibility. "
        "Every discrepancy requires independent verification by a licensed advocate and revenue surveyor.",
        ParagraphStyle("Disc", parent=styles["Normal"], fontName="Helvetica-Oblique", fontSize=7.5, leading=10, textColor=colors.HexColor("#64748B")),
    ))

    doc.build(story, canvasmaker=_make_canvas_cls(case.case_id, case.survey_number, case.synthetic))
