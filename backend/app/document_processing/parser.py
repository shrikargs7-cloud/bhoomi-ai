"""BhoomiAI Real Text-Driven Document Parser & Field Extractor
Extracts text using the 4-step SPEC Section 4 ladder:
1. PyMuPDF digital vector text + exact bounding boxes (when readable digital text exists)
2. OpenCV preprocessing (denoise, Hough-line deskew, adaptive threshold) + Tesseract OCR
   (kan+eng when Kannada tessdata is installed, else eng) for image uploads & scanned PDFs
3. Multilingual English + Kannada-first deterministic field extraction & normalization
4. Unreadable/low-res flagging (`needs_reupload`) and Human Field Review fallback
"""

import hashlib
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import pymupdf
from PIL import Image

from app.core.normalization import normalize_numerals, parse_extent_to_acres
from app.document_processing.ocr import find_ocr_bbox, run_tesseract_ocr
from app.models.schemas import DocumentItem, ExtractedField

MAX_UPLOAD_BYTES = 15 * 1024 * 1024  # 15 MB
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}

INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(?:all\s+)?previous\s+instructions", re.IGNORECASE),
    re.compile(r"system\s+override", re.IGNORECASE),
    re.compile(r"mark\s+(?:this\s+case|all)\s+100%\s+clean", re.IGNORECASE),
    re.compile(r"bypass\s+(?:discrepancy|rules|verification)", re.IGNORECASE),
]

NUM = r"[0-9\u0CE6-\u0CEF]"


def compute_file_hash(file_bytes: bytes) -> str:
    return hashlib.sha256(file_bytes).hexdigest()


def detect_prompt_injection(raw_text: str) -> Optional[str]:
    matches = []
    for pat in INJECTION_PATTERNS:
        m = pat.search(raw_text)
        if m:
            matches.append(m.group(0))
    if matches:
        return (
            f"Untrusted text contained instruction-like phrase(s): {'; '.join(matches)}. "
            "Quarantined — deterministic rules ignored document directives."
        )
    return None


def _clean_pdf_text(raw_text: str) -> str:
    """Normalize PyMuPDF line breaks while rejoining split Kannada virama/vowel conjuncts."""
    text = re.sub(r"([\u0CCD])\n+(?=\S)", r"\1", raw_text)
    text = re.sub(r"\n+([\u0C82\u0C83\u0CBE-\u0CCD\u0CD5\u0CD6])", r"\1", text)
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    return "\n".join(lines)


def _find_bbox(page: pymupdf.Page, *candidates: str) -> Optional[Dict[str, float]]:
    """Finds real PDF bounding box percentages on the page for any matching anchor string."""
    rect = page.rect
    pw, ph = rect.width or 595.0, rect.height or 842.0
    for cand in candidates:
        if not cand:
            continue
        snippet = str(cand).strip()
        if len(snippet) < 2:
            continue
        for probe in (snippet, snippet[:32], snippet.split()[0] if snippet.split() else ""):
            if len(probe) < 2:
                continue
            rects = page.search_for(probe)
            if rects:
                r = rects[0]
                return {
                    "x": round(max(0.0, (r.x0 / pw) * 100.0 - 0.8), 2),
                    "y": round(max(0.0, (r.y0 / ph) * 100.0 - 0.6), 2),
                    "width": round(min(96.0, ((r.x1 - r.x0) / pw) * 100.0 + 3.0), 2),
                    "height": round(min(30.0, ((r.y1 - r.y0) / ph) * 100.0 + 1.4), 2),
                }
    return None


def _resolve_bbox(
    pages: List[pymupdf.Page],
    ocr_words: Optional[List[Dict[str, Any]]],
    has_vector_text: bool,
    *candidates: str,
) -> Optional[Dict[str, float]]:
    """Resolves a percentage bounding box via PyMuPDF vector coordinates or Tesseract OCR word boxes."""
    if pages and has_vector_text:
        bbox = _find_bbox(pages[0], *candidates)
        if bbox:
            return bbox
    if ocr_words:
        return find_ocr_bbox(ocr_words, *candidates)
    return None


def _build_field(
    name: str,
    label: str,
    orig: str,
    norm: Any,
    conf: float,
    method: str,
    pages: List[pymupdf.Page],
    ocr_words: Optional[List[Dict[str, Any]]],
    has_vector_text: bool,
    *anchors: str,
    page: int = 1,
    ocr_conf_scale: Optional[float] = None,
) -> ExtractedField:
    eff_conf = conf if ocr_conf_scale is None else round(min(conf, max(0.55, ocr_conf_scale)), 3)
    return ExtractedField(
        id=f"fld-{uuid.uuid4().hex[:8]}",
        field_name=name,
        label=label,
        original_text=orig or str(norm),
        normalized_value=norm,
        confidence=eff_conf,
        method=method,
        page=page,
        bounding_box=_resolve_bbox(pages, ocr_words, has_vector_text, *anchors, orig),
    )


def render_pdf_page_png(file_path: str, page_num: int = 1, dpi: int = 150) -> bytes:
    """Renders a PDF page (1-indexed) or returns image bytes as PNG."""
    ext = os.path.splitext(file_path)[1].lower()
    if ext in {".png", ".jpg", ".jpeg", ".webp"}:
        from io import BytesIO

        img = Image.open(file_path).convert("RGB")
        buf = BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()

    doc = pymupdf.open(file_path)
    idx = max(0, min(page_num - 1, len(doc) - 1))
    page = doc[idx]
    pix = page.get_pixmap(dpi=dpi)
    return pix.tobytes("png")


def classify_document(full_text: str, filename: str) -> str:
    """Deterministically classifies a land document from English or Kannada text and filename."""
    t = re.sub(r"\s+", " ", full_text).lower()
    kn_compact = re.sub(r"\s+", "", full_text)
    fn = filename.lower()

    if (
        "form no. 16" in t
        or "record of rights" in t
        or "pahani" in t
        or "ಪಹಣಿ" in kn_compact
        or "ಆರ್.ಟಿ.ಸಿ" in kn_compact
        or "ನಮೂನೆ16" in kn_compact
        or "ನಮೂನೆ೧೬" in kn_compact
        or "ಹಕ್ಕುಮತ್ತುಬೆಳೆ" in kn_compact
        or "ಹಕ್ಕುದಾಖಲೆ" in kn_compact
        or "rtc" in fn
    ):
        return "RTC"
    if (
        "mutation register" in t
        or "mutation number" in t
        or "ರೂಪಾಂತರ" in kn_compact
        or "ಮ್ಯುಟೇಶನ್" in kn_compact
        or "ಮ್ಯೂಟೇಶನ್" in kn_compact
        or "ಎಂ.ಆರ್" in kn_compact
        or ("ಪೌತಿಖಾತೆ" in kn_compact and "ಮರಣ" not in kn_compact and "ವಿಭಾಗ" not in kn_compact)
        or "mutation" in fn
    ):
        return "MUTATION_EXTRACT"
    if (
        "certificate of death" in t
        or "date of death" in t
        or "ಮರಣಪ್ರಮಾಣ" in kn_compact
        or "ಮರಣದಿನಾಂಕ" in kn_compact
        or "ಮೃತಪಟ್ಟ" in kn_compact
        or "death" in fn
    ):
        return "DEATH_CERTIFICATE"
    if (
        "partition deed" in t
        or "deed of partition" in t
        or "ವಿಭಾಗಪತ್ರ" in kn_compact
        or "ವಿಭಾಗ" in kn_compact
        or "partition" in fn
    ):
        return "PARTITION_DEED"
    if (
        "sale deed" in t
        or ("vendor" in t and "purchaser" in t)
        or "ಕ್ರಯಪತ್ರ" in kn_compact
        or "ಮಾರಾಟಪತ್ರ" in kn_compact
        or "sale_deed" in fn
        or "sale" in fn
    ):
        return "SALE_DEED"
    if (
        "survey sketch" in t
        or "tippani" in t
        or "adjoining survey" in t
        or "ಟಿಪ್ಪಣಿ" in kn_compact
        or "ಸರ್ವೆನಕ್ಷೆ" in kn_compact
        or "ನಕ್ಷೆ" in kn_compact
        or "ಚಕ್ಕುಬಂದಿ" in kn_compact
        or "sketch" in fn
    ):
        return "SURVEY_SKETCH"
    if (
        "mortgage deed" in t
        or "no objection certificate" in t
        or "discharge deed" in t
        or "ಅಡಮಾನ" in kn_compact
        or "ಋಣಭಾರ" in kn_compact
        or "ನಿರಾಕ್ಷೇಪಣಾ" in kn_compact
        or "noc" in fn
        or "mortgage" in fn
    ):
        return "MORTGAGE_DEED"
    return "OTHER"


def _regex_after(flat_text: str, *patterns: str, default: str = "") -> Tuple[str, str]:
    for pattern in patterns:
        m = re.search(pattern, flat_text, re.IGNORECASE)
        if m:
            return m.group(0).strip(), m.group(1).strip()
    return "", default


def _clean_owner_token(raw_owner: str) -> str:
    cleaned = re.sub(
        r"^(?:Sri|Smt\.?|Shri|Mr\.?|Mrs\.?|Late|ಶ್ರೀಮತಿ|ಶ್ರೀ|ಲೇಟ್)\s+",
        "",
        raw_owner.strip(),
        flags=re.IGNORECASE,
    ).strip()
    return cleaned


def _parse_rtc_fields(
    flat: str,
    pages: List[pymupdf.Page],
    method: str,
    ocr_words: Optional[List[Dict[str, Any]]] = None,
    has_vector_text: bool = True,
    ocr_conf_scale: Optional[float] = None,
) -> List[ExtractedField]:
    fields: List[ExtractedField] = []

    def add(name: str, label: str, orig: str, norm: Any, conf: float, *anchors: str):
        if not orig and (norm is None or norm == "" or norm == []):
            return
        fields.append(
            _build_field(
                name, label, orig, norm, conf, method, pages, ocr_words, has_vector_text, *anchors, ocr_conf_scale=ocr_conf_scale
            )
        )

    orig, val = _regex_after(
        flat,
        rf"Survey\s*No\.?\s*[:\-]?\s*({NUM}+(?:/[0-9\u0CE6-\u0CEFA-Za-z]+)?)",
        rf"(?:ಸರ್ವೆ\s*(?:ನಂ|ಸಂಖ್ಯೆ)|ಸ\.?\s*ನಂ\.?)\s*[:\-]?\s*({NUM}+(?:/[0-9\u0CE6-\u0CEFA-Za-z]+)?)",
    )
    add("survey_number", "Survey Number", orig, normalize_numerals(val), 0.98 if val else 0.4, orig, val)

    orig, val = _regex_after(
        flat,
        rf"Hissa\s*/\s*Sub-Div\s*[:\-]?\s*([A-Za-z0-9\u0CE6-\u0CEF\-]+)",
        r"ಹಿಸ್ಸಾ\s*(?:ನಂ|ಸಂಖ್ಯೆ)?\s*[:\-]?\s*([^\s,;]+)",
    )
    add("hissa", "Hissa / Sub-Division", orig, normalize_numerals(val), 0.96, orig, val)

    orig, val = _regex_after(
        flat,
        rf"Khata\s*No\.?\s*[:\-]?\s*({NUM}+)",
        rf"(?:ಖಾತಾ|ಖಾತೆ)\s*(?:ನಂ\.?|ಸಂಖ್ಯೆ)\s*[:\-]?\s*({NUM}+)",
    )
    add("khata_number", "Khata Number", orig, normalize_numerals(val), 0.97, orig, val)

    orig, val = _regex_after(
        flat,
        rf"Record\s*Date\s*[:\-]?\s*({NUM}{{2}}[/\-]{NUM}{{2}}[/\-]{NUM}{{4}})",
        rf"(?:ದಾಖಲೆ\s*ದಿನಾಂಕ|ದಿನಾಂಕ)\s*[:\-]?\s*({NUM}{{2}}[/\-]{NUM}{{2}}[/\-]{NUM}{{4}})",
    )
    add("record_date", "Record Date", orig, normalize_numerals(val).replace("-", "/"), 0.98, orig, val)

    orig, val = _regex_after(
        flat,
        r"District\s*[:\-]?\s*([A-Za-z]+)",
        r"ಜಿಲ್ಲೆ\s*[:\-]?\s*([^\s:;,]+(?:\s+[^\s:;,]+)?)(?=\s+(?:ತಾಲೂಕು|ಹೋಬಳಿ|ಗ್ರಾಮ|ಸರ್ವೆ|ಸ\.ನಂ)|$)",
    )
    if val:
        add("district", "District", orig, val.strip(), 0.96, orig, val.strip())

    orig, val = _regex_after(
        flat,
        r"Taluk\s*[:\-]?\s*([A-Za-z]+)",
        r"ತಾಲೂಕು\s*[:\-]?\s*([^\s:;,]+(?:\s+[^\s:;,]+)?)(?=\s+(?:ಹೋಬಳಿ|ಗ್ರಾಮ|ಸರ್ವೆ|ಸ\.ನಂ)|$)",
    )
    if val:
        add("taluk", "Taluk", orig, val.strip(), 0.96, orig, val.strip())

    orig, val = _regex_after(
        flat,
        r"Village\s*[:\-]?\s*([A-Za-z\s\(\)]+?)(?=\s+Survey\s*No|\s+Dry|\s*$)",
        r"ಗ್ರಾಮ\s*[:\-]?\s*([^\s:;,]+(?:\s+[^\s:;,]+)?)(?=\s+(?:ಸರ್ವೆ|ಸ\.ನಂ|ಒಟ್ಟು\s*ವಿಸ್ತೀರ್ಣ|ವಿಸ್ತೀರ್ಣ|ಖುಷ್ಕಿ|ತರಿ)|$)",
    )
    if val:
        add("village", "Village", orig, val.strip(), 0.95, orig, val.strip())

    ext_m = re.search(
        rf"(?:Dry\s*\([^\)]+\)|Dry\s+Kushki|Wet[^\d{NUM}]*|Garden[^\d{NUM}]*)\s+({NUM}+\-{NUM}+(?:\s*\([^\)]+\))?)",
        flat,
        re.IGNORECASE,
    )
    if not ext_m:
        ext_m = re.search(
            rf"(?:ಒಟ್ಟು\s*ವಿಸ್ತೀರ್ಣ|ವಿಸ್ತೀರ್ಣ|ಖುಷ್ಕಿ|ತರಿ|ಬಾಗಾಯ್ತು)\s*[:\-]?\s*({NUM}+(?:\.{NUM}+)?[\-/]{NUM}+(?:\.{NUM}+)?(?:\s*\([^\)]+\))?|{NUM}+(?:\.{NUM}+)?\s*(?:ಎಕರೆ|acres?)(?:\s*{NUM}+(?:\.{NUM}+)?\s*(?:ಗುಂಟೆ|guntas?))?)",
            flat,
            re.IGNORECASE,
        )
    if ext_m:
        ext_orig = ext_m.group(1).strip()
        ext_acres = parse_extent_to_acres(ext_orig)
        add("total_extent", "Total Extent", ext_orig, ext_acres, 0.99, ext_orig, ext_orig.split()[0])

    # Column 9 Owners: English block first
    col9_block_m = re.search(
        r"COLUMN\s*9.*?Mutation\s*/\s*Acq\.\s*Ref\s*(.*?)\s*COLUMN\s*11",
        flat,
        re.IGNORECASE,
    )
    owner_names: List[str] = []
    owner_orig_parts: List[str] = []
    if col9_block_m:
        block = col9_block_m.group(1)
        for om in re.finditer(
            r"\b\d+\s+((?:Sri|Smt\.?|Shri|Mr\.?|Mrs\.?|Late)?\s*[A-Z][A-Za-z]+(?:\s+[A-Z0-9][A-Za-z0-9]*){0,2}?)(?=\s+(?:S/o|W/o|D/o|C/o|[0-9]+\-[0-9]))",
            block,
        ):
            raw_owner = om.group(1).strip()
            clean_owner = _clean_owner_token(raw_owner)
            if clean_owner and clean_owner not in owner_names:
                owner_names.append(clean_owner)
                owner_orig_parts.append(raw_owner)

    # Kannada Column 9 fallback
    if not owner_names:
        kn_col9 = re.search(
            r"(?:ಕಾಲಂ\s*(?:9|೯)(?:\s*[\-–:]\s*(?:ಖಾತೆದಾರರ\s*ಹೆಸರು|ಮಾಲೀಕರ\s*ಹೆಸರು|ಹಕ್ಕುದಾರರ\s*ಹೆಸರು))?|ಖಾತೆದಾರರ\s*ಹೆಸರು|ಮಾಲೀಕರ\s*ಹೆಸರು|ಹಕ್ಕುದಾರರ\s*ಹೆಸರು)\s*[:\-]?\s*(.*?)(?=\s*(?:ಕಾಲಂ\s*(?:11|೧೧)|ಋಣಗಳು|ಬಾಧ್ಯತೆಗಳು|$))",
            flat,
            re.IGNORECASE,
        )
        if kn_col9:
            block = kn_col9.group(1).strip()
            for candidate in re.split(r"[,;\n]+", block):
                cand = candidate.strip()
                cand = re.sub(rf"^{NUM}+[\.\)]\s*|^{NUM}+\s+", "", cand).strip()
                cand = re.split(
                    rf"\s+(?:ಬಿನ್(?=\s|$)|ಕೋಂ(?=\s|$)|ಮೂಲ(?=\s|$)|ಖಾತೆ(?=\s|$)|(?:S/o|W/o|D/o|C/o)\b|{NUM}+\-{NUM}+)",
                    cand,
                    maxsplit=1,
                )[0].strip()
                if len(cand) >= 2:
                    clean_owner = _clean_owner_token(cand)
                    if clean_owner and clean_owner not in owner_names:
                        owner_names.append(clean_owner)
                        owner_orig_parts.append(cand)

    if owner_names:
        add(
            "recorded_owners",
            "Column 9 Recorded Owners",
            ", ".join(owner_orig_parts),
            owner_names,
            0.95,
            owner_orig_parts[0],
            owner_names[0],
        )

    # Column 11 Encumbrances
    col11_m = re.search(
        r"COLUMN\s*11\s*:\s*LIABILITIES\s*&?\s*ENCUMBRANCES\s*(.*?)(?=\s*Digitally\s*generated|\s*SYSTEM\s*OVERRIDE|\s*$)",
        flat,
        re.IGNORECASE,
    )
    if not col11_m:
        col11_m = re.search(
            r"(?:ಕಾಲಂ\s*(?:11|೧೧)(?:\s*[\-–:]\s*(?:ಋಣಗಳು(?:\s*ಮತ್ತು\s*ಬಾಧ್ಯತೆಗಳು)?|ಬಾಧ್ಯತೆಗಳು))?|ಋಣಗಳು\s*(?:ಮತ್ತು\s*ಬಾಧ್ಯತೆಗಳು)?|ಬಾಧ್ಯತೆಗಳು)\s*[:\-]?\s*(.*?)(?=\s*Digitally\s*generated|\s*SYSTEM\s*OVERRIDE|\s*ದೃಢೀಕರಣ|\s*$)",
            flat,
            re.IGNORECASE,
        )
    if col11_m:
        enc_text = col11_m.group(1).strip()
        for pat in INJECTION_PATTERNS:
            enc_text = pat.sub("", enc_text).strip()
        is_nil = "nil" in enc_text.lower() or "ಇಲ್ಲ" in enc_text or "ಶೂನ್ಯ" in enc_text
        add(
            "column_11_encumbrance",
            "Column 11 Liabilities & Encumbrances",
            enc_text,
            enc_text,
            0.97 if is_nil else 0.91,
            enc_text[:36],
        )

    return fields


def _parse_death_cert_fields(
    flat: str,
    pages: List[pymupdf.Page],
    method: str,
    ocr_words: Optional[List[Dict[str, Any]]] = None,
    has_vector_text: bool = True,
    ocr_conf_scale: Optional[float] = None,
) -> List[ExtractedField]:
    fields: List[ExtractedField] = []

    def add(name: str, label: str, orig: str, norm: Any, conf: float, *anchors: str):
        if not orig:
            return
        fields.append(
            _build_field(
                name, label, orig, norm, conf, method, pages, ocr_words, has_vector_text, *anchors, ocr_conf_scale=ocr_conf_scale
            )
        )

    orig, val = _regex_after(
        flat,
        rf"Registration\s*Number\s*[:\-]?\s*([A-Z0-9\u0CE6-\u0CEF\/\-]+)",
        rf"ನೋಂದಣಿ\s*ಸಂಖ್ಯೆ\s*[:\-]?\s*([A-Z0-9\u0CE6-\u0CEF\/\-]+)",
    )
    add("registration_number", "Death Registration No.", orig, normalize_numerals(val), 0.98, val)

    orig, val = _regex_after(
        flat,
        r"Name\s*of\s*Deceased\s*[:\-]?\s*([A-Za-z0-9\s]+?)(?=\s+Date\s*of\s*Death)",
        r"(?:ಮೃತರ\s*ಹೆಸರು|ಮೃತಪಟ್ಟವರ\s*ಹೆಸರು)\s*[:\-]?\s*(.+?)(?=\s+(?:ಮರಣ\s*ದಿನಾಂಕ|ಮೃತಪಟ್ಟ\s*ದಿನಾಂಕ|ಮರಣ\s*ಸ್ಥಳ|ತಂದೆ|ಗಂಡನ|$))",
    )
    if val:
        norm_dec = _clean_owner_token(val).title() if val.isascii() else _clean_owner_token(val)
        add("deceased_name", "Deceased Person Name", val, norm_dec, 0.99, val)

    orig, val = _regex_after(
        flat,
        rf"Date\s*of\s*Death\s*[:\-]?\s*({NUM}{{2}}[/\-]{NUM}{{2}}[/\-]{NUM}{{4}})",
        rf"(?:ಮರಣ\s*ದಿನಾಂಕ|ಮೃತಪಟ್ಟ\s*ದಿನಾಂಕ)\s*[:\-]?\s*({NUM}{{2}}[/\-]{NUM}{{2}}[/\-]{NUM}{{4}})",
    )
    add("date_of_death", "Date of Death", val, normalize_numerals(val).replace("-", "/"), 0.99, val)

    orig, val = _regex_after(
        flat,
        r"Place\s*of\s*Death\s*[:\-]?\s*([A-Za-z0-9,\.\s\-]+?)(?=\s+Father)",
        r"ಮರಣ\s*ಸ್ಥಳ\s*[:\-]?\s*(.+?)(?=\s+(?:ತಂದೆ|ಗಂಡನ|ಶಾಶ್ವತ|$))",
    )
    add("place_of_death", "Place of Death", val, val.strip(), 0.94, val[:28])

    orig, val = _regex_after(
        flat,
        r"Father's\s*/\s*Husband's\s*Name\s*[:\-]?\s*([A-Za-z0-9\s\.]+?)(?=\s+Permanent\s*Address)",
        r"(?:ತಂದೆ\s*/\s*ಗಂಡನ\s*ಹೆಸರು|ತಂದೆಯ\s*ಹೆಸರು)\s*[:\-]?\s*(.+?)(?=\s+(?:ಶಾಶ್ವತ\s*ವಿಳಾಸ|$))",
    )
    add("father_or_husband_name", "Father's / Husband's Name", val, val.strip(), 0.95, val)

    return fields


def _parse_deed_fields(
    flat: str,
    pages: List[pymupdf.Page],
    method: str,
    doc_type: str,
    ocr_words: Optional[List[Dict[str, Any]]] = None,
    has_vector_text: bool = True,
    ocr_conf_scale: Optional[float] = None,
) -> List[ExtractedField]:
    fields: List[ExtractedField] = []

    def add(name: str, label: str, orig: str, norm: Any, conf: float, *anchors: str):
        if not orig and norm is None:
            return
        fields.append(
            _build_field(
                name, label, orig, norm, conf, method, pages, ocr_words, has_vector_text, *anchors, ocr_conf_scale=ocr_conf_scale
            )
        )

    orig, val = _regex_after(
        flat,
        r"Registration\s*Number\s*[:\-]?\s*([A-Z0-9\u0CE6-\u0CEF\-\/]+)",
        r"(?:ನೋಂದಣಿ\s*ಸಂಖ್ಯೆ|ದಸ್ತಾವೇಜು\s*ಸಂಖ್ಯೆ)\s*[:\-]?\s*([A-Z0-9\u0CE6-\u0CEF\-\/]+)",
    )
    if val:
        add("registration_number", "Deed Registration Number", orig, normalize_numerals(val), 0.98, val)

    orig, val = _regex_after(
        flat,
        rf"Execution\s*Date\s*[:\-]?\s*({NUM}{{2}}[/\-]{NUM}{{2}}[/\-]{NUM}{{4}})",
        rf"(?:ನೋಂದಣಿ\s*ದಿನಾಂಕ|ಬರೆದುಕೊಟ್ಟ\s*ದಿನಾಂಕ|ದಿನಾಂಕ)\s*[:\-]?\s*({NUM}{{2}}[/\-]{NUM}{{2}}[/\-]{NUM}{{4}})",
    )
    if val:
        add("execution_date", "Deed Execution Date", val, normalize_numerals(val).replace("-", "/"), 0.98, val)

    sched_m = re.search(
        r"Schedule\s*'A'\s+(.+?)\s+([0-9]+(?:/[0-9A-Za-z]+)?)\s+([0-9]+\s*Acres?\s*[0-9]+\s*Guntas\s*\([0-9]+\-[0-9]+\)|[0-9]+\-[0-9]+)",
        flat,
        re.IGNORECASE,
    )
    if sched_m:
        allottee_raw = sched_m.group(1).strip()
        allottee_clean = _clean_owner_token(allottee_raw)
        survey_no = sched_m.group(2).strip()
        ext_orig = sched_m.group(3).strip()
        ext_acres = parse_extent_to_acres(ext_orig)

        add("allottee", "Schedule A Allottee / Purchaser", allottee_raw, allottee_clean, 0.96, allottee_raw)
        add("survey_number", "Schedule A Survey Number", f"Survey No. {survey_no}", survey_no, 0.98, survey_no)
        add("extent_allotted", "Schedule A Allotted Extent", ext_orig, ext_acres, 0.99, ext_orig, ext_orig.split("(")[0].strip())
    else:
        _, kn_allottee = _regex_after(
            flat,
            r"(?:ಖರೀದಿದಾರರು|ಪಡೆದವರು|ವಿಭಾಗ\s*ಪಡೆದವರು)\s*[:\-]?\s*(.+?)(?=\s+(?:ಸರ್ವೆ|ಸ\.ನಂ|ವಿಸ್ತೀರ್ಣ|$))",
        )
        if kn_allottee:
            add("allottee", "Schedule A Allottee / Purchaser", kn_allottee, _clean_owner_token(kn_allottee), 0.92, kn_allottee)

        sy_orig, sy_val = _regex_after(
            flat,
            rf"(?:Survey\s*No\.?|ಸರ್ವೆ\s*(?:ನಂ|ಸಂಖ್ಯೆ)|ಸ\.?\s*ನಂ\.?)\s*[:\-]?\s*({NUM}+(?:/[0-9\u0CE6-\u0CEFA-Za-z]+)?)",
        )
        if sy_val:
            add("survey_number", "Schedule A Survey Number", sy_orig, normalize_numerals(sy_val), 0.95, sy_val)

        _, ext_orig = _regex_after(
            flat,
            rf"(?:ಒಟ್ಟು\s*ವಿಸ್ತೀರ್ಣ|ವಿಸ್ತೀರ್ಣ|Extent)\s*[:\-]?\s*({NUM}+[\-/]{NUM}+(?:\s*\([^\)]+\))?)",
        )
        if ext_orig:
            add("extent_allotted", "Schedule A Allotted Extent", ext_orig, parse_extent_to_acres(ext_orig), 0.95, ext_orig.split()[0])

    return fields


def _parse_mutation_fields(
    flat: str,
    raw_full: str,
    pages: List[pymupdf.Page],
    method: str,
    ocr_words: Optional[List[Dict[str, Any]]] = None,
    has_vector_text: bool = True,
    ocr_conf_scale: Optional[float] = None,
) -> List[ExtractedField]:
    fields: List[ExtractedField] = []

    def add(name: str, label: str, orig: str, norm: Any, conf: float, *anchors: str):
        if not orig and norm is None:
            return
        fields.append(
            _build_field(
                name, label, orig, norm, conf, method, pages, ocr_words, has_vector_text, *anchors, ocr_conf_scale=ocr_conf_scale
            )
        )

    orig, val = _regex_after(
        flat,
        r"MUTATION\s*NUMBER\s*[:\-]?\s*([A-Z0-9\u0CE6-\u0CEF\/\-]+)",
        r"(?:ರೂಪಾಂತರ\s*ಸಂಖ್ಯೆ|ಎಂ\.?\s*ಆರ್\.?\s*(?:ನಂ\.?|ಸಂಖ್ಯೆ))\s*[:\-]?\s*([A-Z0-9\u0CE6-\u0CEF\/\-]+)",
    )
    add("mutation_number", "Mutation Number", orig, normalize_numerals(val), 0.98, val)

    orig, val = _regex_after(
        flat,
        rf"Date\s*[:\-]?\s*({NUM}{{2}}[/\-]{NUM}{{2}}[/\-]{NUM}{{4}})",
        rf"ದಿನಾಂಕ\s*[:\-]?\s*({NUM}{{2}}[/\-]{NUM}{{2}}[/\-]{NUM}{{4}})",
    )
    add("mutation_date", "Mutation Certification Date", val, normalize_numerals(val).replace("-", "/"), 0.97, val)

    orig, val = _regex_after(
        flat,
        rf"Survey\s*No\.?\s*[:\-]?\s*({NUM}+(?:/[0-9\u0CE6-\u0CEFA-Za-z]+)?)",
        rf"(?:ಸರ್ವೆ\s*(?:ನಂ|ಸಂಖ್ಯೆ)|ಸ\.?\s*ನಂ\.?)\s*[:\-]?\s*({NUM}+(?:/[0-9\u0CE6-\u0CEFA-Za-z]+)?)",
    )
    add("survey_number", "Survey Number", orig, normalize_numerals(val), 0.98, val)

    orig, val = _regex_after(
        flat,
        r"Mutation\s*Reason\s*/\s*Type\s*:\s*(.+?)(?=\s*ವಿಷಯ|\s*ನೋಂದಾಯಿತ|\s*Original\s*Khata)",
        r"(?:ರೂಪಾಂತರ\s*ಕಾರಣ|ವಿಷಯ)\s*[:\-]?\s*(.+?)(?=\s*(?:ನೋಂದಾಯಿತ|ಹಕ್ಕು|ಮೂಲ\s*ಖಾತೆ|$))",
    )
    if val:
        add("mutation_type", "Mutation Reason / Type", val, val.strip(), 0.94, val[:28])

    ext_m = re.search(
        r"([0-9]+\-[0-9]+(?:\.[0-9]+)?(?:\s*\([^\)]+\))?)\s+([0-9]+\-[0-9]+(?:\.[0-9]+)?(?:\s*\([^\)]+\))?)\s*(?:Certified|$)",
        flat,
        re.IGNORECASE,
    )
    if ext_m:
        tr_orig = ext_m.group(1).strip()
        bal_orig = ext_m.group(2).strip()
        add("transferred_extent", "Transferred Extent", tr_orig, parse_extent_to_acres(tr_orig), 0.95, tr_orig.split()[0])
        add("balance_remarks", "Balance / Mutation Remarks", bal_orig, bal_orig, 0.93, bal_orig[:20])

    kn_flat = re.sub(r"\s+", "", raw_full)
    has_negated_pauti = (
        "ಪೌತಿಖಾತೆದಾಖಲಾಗಿರುವುದಿಲ್ಲ" in kn_flat
        or "ಪೌತಿಖಾತೆಆಗಿರುವುದಿಲ್ಲ" in kn_flat
        or "ಪೌತಿಖಾತೆಇಲ್ಲ" in kn_flat
        or "no pauti khata" in flat.lower()
        or "unmutated" in flat.lower()
    )
    is_inheritance = (
        (
            "pauti" in flat.lower()
            or "inheritance" in flat.lower()
            or "ಪೌತಿ" in kn_flat
            or "ವಾರಸುದಾರ" in kn_flat
        )
        and not has_negated_pauti
    )
    add(
        "is_inheritance_mutation",
        "Inheritance (Pauti Khata) Recorded?",
        "No Pauti Khata entered" if has_negated_pauti else ("Yes" if is_inheritance else "Partition/Sale Mutation Only"),
        is_inheritance,
        0.93,
        "No Pauti Khata",
        val[:20] if val else "",
    )

    return fields


def _parse_sketch_fields(
    flat: str,
    pages: List[pymupdf.Page],
    method: str,
    ocr_words: Optional[List[Dict[str, Any]]] = None,
    has_vector_text: bool = True,
    ocr_conf_scale: Optional[float] = None,
) -> List[ExtractedField]:
    fields: List[ExtractedField] = []

    def add(name: str, label: str, orig: str, norm: Any, conf: float, *anchors: str):
        if not orig and norm is None:
            return
        fields.append(
            _build_field(
                name, label, orig, norm, conf, method, pages, ocr_words, has_vector_text, *anchors, ocr_conf_scale=ocr_conf_scale
            )
        )

    orig, val = _regex_after(
        flat,
        rf"Survey\s*No\.?\s*[:\-]?\s*({NUM}+(?:/[0-9\u0CE6-\u0CEFA-Za-z]+)?)",
        rf"(?:ಸರ್ವೆ\s*(?:ನಂ|ಸಂಖ್ಯೆ)|ಸ\.?\s*ನಂ\.?)\s*[:\-]?\s*({NUM}+(?:/[0-9\u0CE6-\u0CEFA-Za-z]+)?)",
    )
    add("survey_number", "Survey Number", orig, normalize_numerals(val), 0.99, orig, val)

    orig, val = _regex_after(
        flat,
        rf"Stated\s*Extent\s*[:\-]?\s*({NUM}+\s*Acres?\s*{NUM}+\s*Guntas\s*\({NUM}+\-{NUM}+\)|{NUM}+\-{NUM}+)",
        rf"(?:ಒಟ್ಟು\s*ವಿಸ್ತೀರ್ಣ|ವಿಸ್ತೀರ್ಣ)\s*[:\-]?\s*({NUM}+[\-/]{NUM}+(?:\s*\([^\)]+\))?)",
    )
    if val:
        add("stated_extent", "Stated Field Extent", val, parse_extent_to_acres(val), 0.98, val, val.split("(")[0].strip())

    orig, val = _regex_after(
        flat,
        rf"Sketch\s*Date\s*[:\-]?\s*({NUM}{{2}}[/\-]{NUM}{{2}}[/\-]{NUM}{{4}})",
        rf"ದಿನಾಂಕ\s*[:\-]?\s*({NUM}{{2}}[/\-]{NUM}{{2}}[/\-]{NUM}{{4}})",
    )
    if val:
        add("sketch_date", "Sketch Date", val, normalize_numerals(val).replace("-", "/"), 0.96, val)

    bounds: Dict[str, str] = {}
    for d, kn_d in (("North", "ಉತ್ತರ"), ("East", "ಪೂರ್ವ"), ("South", "ದಕ್ಷಿಣ"), ("West", "ಪಶ್ಚಿಮ")):
        bm = re.search(rf"{d}\s*(?:\([^\)]+\))?\s+(.+?)\s+[0-9\.]+\s*m\b", flat, re.IGNORECASE)
        if not bm:
            bm = re.search(
                rf"{kn_d}\s*[:\-]?\s*(.+?)(?=\s+(?:ಪೂರ್ವ|ದಕ್ಷಿಣ|ಪಶ್ಚಿಮ|ಉತ್ತರ|[0-9\.]+ಮೀ|$))",
                flat,
            )
        if bm:
            bounds[d] = bm.group(1).strip()
    if bounds:
        orig_str = "; ".join([f"{k}: {v}" for k, v in bounds.items()])
        add("boundaries", "Four Boundary Neighbors", orig_str, bounds, 0.94, "North", list(bounds.values())[0][:18])

    return fields


def _extract_structured_document(
    raw_full: str,
    filename: str,
    mime_type: str,
    resolved_id: str,
    pages_count: int,
    size_kb: int,
    now_str: str,
    file_hash: str,
    method: str,
    pages: List[pymupdf.Page],
    ocr_words: Optional[List[Dict[str, Any]]] = None,
    has_vector_text: bool = True,
    ocr_conf_scale: Optional[float] = None,
    quality_warning: Optional[str] = None,
) -> DocumentItem:
    cleaned_lines = _clean_pdf_text(raw_full)
    flat_text = re.sub(r"\s+", " ", cleaned_lines).strip()
    injection_warning = detect_prompt_injection(flat_text)
    doc_type = classify_document(raw_full, filename)

    has_kannada = bool(re.search(r"[\u0C80-\u0CFF]", raw_full))
    has_latin = bool(re.search(r"[A-Za-z]{2,}", raw_full))
    if has_kannada and has_latin:
        language = "Kannada / English"
    elif has_kannada:
        language = "Kannada"
    else:
        language = "English"

    if doc_type == "RTC":
        extracted_fields = _parse_rtc_fields(flat_text, pages, method, ocr_words, has_vector_text, ocr_conf_scale)
    elif doc_type == "DEATH_CERTIFICATE":
        extracted_fields = _parse_death_cert_fields(flat_text, pages, method, ocr_words, has_vector_text, ocr_conf_scale)
    elif doc_type in {"PARTITION_DEED", "SALE_DEED"}:
        extracted_fields = _parse_deed_fields(flat_text, pages, method, doc_type, ocr_words, has_vector_text, ocr_conf_scale)
    elif doc_type == "MUTATION_EXTRACT":
        extracted_fields = _parse_mutation_fields(flat_text, raw_full, pages, method, ocr_words, has_vector_text, ocr_conf_scale)
    elif doc_type == "SURVEY_SKETCH":
        extracted_fields = _parse_sketch_fields(flat_text, pages, method, ocr_words, has_vector_text, ocr_conf_scale)
    else:
        snippet = flat_text[:140]
        extracted_fields = [
            _build_field(
                "document_excerpt",
                "Extracted Document Text",
                snippet,
                snippet,
                0.82,
                method,
                pages,
                ocr_words,
                has_vector_text,
                snippet[:24],
                ocr_conf_scale=ocr_conf_scale,
            )
        ]

    if ocr_conf_scale is not None:
        overall_score = round(ocr_conf_scale, 3)
    elif extracted_fields:
        overall_score = round(sum(f.confidence for f in extracted_fields) / len(extracted_fields), 3)
    else:
        overall_score = 0.5

    return DocumentItem(
        id=resolved_id,
        filename=filename,
        doc_type=doc_type,
        mime_type=mime_type,
        pages_count=pages_count,
        file_size_kb=size_kb,
        upload_timestamp=now_str,
        file_hash=file_hash,
        language=language,
        extraction_method=method,
        extracted_fields=extracted_fields,
        ocr_quality_score=overall_score,
        status="extracted",
        quality_warning=quality_warning,
        injection_warning=injection_warning,
    )


def parse_and_extract_document(
    file_path: str,
    filename: str,
    mime_type: str = "application/pdf",
    doc_id: Optional[str] = None,
) -> DocumentItem:
    """Validates and extracts structured fields + bounding-box evidence from an uploaded document."""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file extension '{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    if len(file_bytes) == 0:
        raise ValueError("Uploaded file is empty (0 bytes).")
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise ValueError(f"File exceeds maximum size limit of {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.")

    file_hash = compute_file_hash(file_bytes)
    resolved_id = doc_id or f"doc-{uuid.uuid4().hex[:8]}"
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    size_kb = max(1, len(file_bytes) // 1024)

    # Image upload ladder: Step 3 OpenCV + Tesseract OCR -> Step 4 Manual Entry Fallback
    if ext in {".png", ".jpg", ".jpeg", ".webp"}:
        try:
            img = Image.open(file_path)
            w, h = img.size
        except Exception:
            return DocumentItem(
                id=resolved_id,
                filename=filename,
                doc_type="OTHER",
                mime_type=mime_type,
                pages_count=1,
                file_size_kb=size_kb,
                upload_timestamp=now_str,
                file_hash=file_hash,
                extraction_method="Image Validation Failed",
                ocr_quality_score=0.0,
                status="needs_reupload",
                quality_warning="Corrupt or unreadable image file. Please re-upload a clear PNG/JPG or digital PDF.",
            )

        if w < 200 or h < 200:
            return DocumentItem(
                id=resolved_id,
                filename=filename,
                doc_type="OTHER",
                mime_type=mime_type,
                pages_count=1,
                file_size_kb=size_kb,
                upload_timestamp=now_str,
                file_hash=file_hash,
                extraction_method="Image Quality Check",
                ocr_quality_score=0.2,
                status="needs_reupload",
                quality_warning=f"Image resolution too low ({w}x{h}px). Minimum 200x200px required; please re-upload a clearer scan.",
            )

        ocr_res = run_tesseract_ocr(img, page_num=1)
        ocr_text = ocr_res.get("text", "")
        if len(re.sub(r"\s+", "", ocr_text)) >= 15:
            avg_word_conf = float(ocr_res.get("avg_word_conf", 0.65))
            ocr_lang = str(ocr_res.get("ocr_lang", "eng"))
            q_warn = (
                f"Low OCR word confidence ({round(avg_word_conf * 100)}%). Extracted fields routed to Human Field Review Queue."
                if avg_word_conf < 0.70
                else None
            )
            return _extract_structured_document(
                raw_full=ocr_text,
                filename=filename,
                mime_type=mime_type,
                resolved_id=resolved_id,
                pages_count=1,
                size_kb=size_kb,
                now_str=now_str,
                file_hash=file_hash,
                method=f"OpenCV + Tesseract OCR ({ocr_lang})",
                pages=[],
                ocr_words=ocr_res.get("words", []),
                has_vector_text=False,
                ocr_conf_scale=avg_word_conf,
                quality_warning=q_warn,
            )

        doc_type = classify_document("", filename)
        fallback_fields = [
            ExtractedField(
                id=f"fld-{uuid.uuid4().hex[:8]}",
                field_name="survey_number",
                label="Survey Number (Manual Review Required)",
                original_text=f"Image scan ({w}x{h}px) — OCR text unreadable",
                normalized_value="",
                confidence=0.42,
                method="Manual-Entry Fallback (Ladder Step 4)",
                page=1,
                bounding_box={"x": 10.0, "y": 15.0, "width": 80.0, "height": 12.0},
                verification_status="unverified",
            )
        ]
        return DocumentItem(
            id=resolved_id,
            filename=filename,
            doc_type=doc_type,
            mime_type=mime_type,
            pages_count=1,
            file_size_kb=size_kb,
            upload_timestamp=now_str,
            file_hash=file_hash,
            language="Unknown (Scan)",
            extraction_method="Manual-Entry Fallback (Ladder Step 4)",
            extracted_fields=fallback_fields,
            ocr_quality_score=0.45,
            status="extracted",
            quality_warning="OCR could not extract readable text from image scan. Fields routed to Human Field Review Queue.",
        )

    # PDF path: Step 2 PyMuPDF Digital Layout -> Step 3 OpenCV + Tesseract OCR fallback
    try:
        pdf_doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    except Exception:
        return DocumentItem(
            id=resolved_id,
            filename=filename,
            doc_type="OTHER",
            mime_type=mime_type,
            pages_count=0,
            file_size_kb=size_kb,
            upload_timestamp=now_str,
            file_hash=file_hash,
            extraction_method="PyMuPDF Digital Layout",
            ocr_quality_score=0.0,
            status="needs_reupload",
            quality_warning="PDF file is corrupt or password-protected. Please re-upload an unlocked PDF.",
        )

    pages = [pdf_doc[i] for i in range(len(pdf_doc))]
    raw_pages_text = [p.get_text() for p in pages]
    raw_full = "\n".join(raw_pages_text)

    if len(re.sub(r"\s+", "", raw_full)) >= 20:
        return _extract_structured_document(
            raw_full=raw_full,
            filename=filename,
            mime_type=mime_type,
            resolved_id=resolved_id,
            pages_count=len(pages),
            size_kb=size_kb,
            now_str=now_str,
            file_hash=file_hash,
            method="PyMuPDF Digital Layout",
            pages=pages,
            ocr_words=None,
            has_vector_text=True,
            ocr_conf_scale=None,
            quality_warning=None,
        )

    # Scanned / image-only PDF: render pages at 220 DPI and run OpenCV + Tesseract OCR (capped at 5 pages)
    ocr_texts: List[str] = []
    ocr_words_all: List[Dict[str, Any]] = []
    page_confs: List[float] = []
    ocr_lang = "eng"

    for p_idx, page in enumerate(pages[:5], start=1):
        pix = page.get_pixmap(dpi=220)
        pil_page = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        page_ocr = run_tesseract_ocr(pil_page, page_num=p_idx)
        ocr_lang = str(page_ocr.get("ocr_lang", ocr_lang))
        if page_ocr.get("text"):
            ocr_texts.append(page_ocr["text"])
        ocr_words_all.extend(page_ocr.get("words", []))
        if page_ocr.get("avg_word_conf", 0.0) > 0:
            page_confs.append(float(page_ocr["avg_word_conf"]))

    agg_ocr_text = "\n".join(ocr_texts)
    if len(re.sub(r"\s+", "", agg_ocr_text)) >= 15:
        avg_conf = round(sum(page_confs) / len(page_confs), 3) if page_confs else 0.65
        q_warn = (
            f"Scanned PDF processed via OCR ({round(avg_conf * 100)}% word confidence); verify low-confidence fields."
            if avg_conf < 0.70
            else None
        )
        return _extract_structured_document(
            raw_full=agg_ocr_text,
            filename=filename,
            mime_type=mime_type,
            resolved_id=resolved_id,
            pages_count=len(pages),
            size_kb=size_kb,
            now_str=now_str,
            file_hash=file_hash,
            method=f"OpenCV + Tesseract OCR ({ocr_lang})",
            pages=pages,
            ocr_words=ocr_words_all,
            has_vector_text=False,
            ocr_conf_scale=avg_conf,
            quality_warning=q_warn,
        )

    return DocumentItem(
        id=resolved_id,
        filename=filename,
        doc_type="OTHER",
        mime_type=mime_type,
        pages_count=len(pages),
        file_size_kb=size_kb,
        upload_timestamp=now_str,
        file_hash=file_hash,
        extraction_method=f"OpenCV + Tesseract OCR ({ocr_lang})",
        ocr_quality_score=0.15,
        status="needs_reupload",
        quality_warning="Document has no readable digital text (<20 chars) and OCR found no readable text. Please re-upload a clearer scan or digital PDF.",
    )
