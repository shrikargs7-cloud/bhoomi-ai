"""BhoomiAI OpenCV Scan Preprocessing & Tesseract OCR Module (SPEC Section 4 Ladder Step 3)
Provides:
- Scan quality metrics (Laplacian blur variance, contrast std, skew angle, blank check)
- Non-local means denoising, Hough-line deskewing (no 90-degree portrait flip), adaptive binarization
- Tesseract OCR via pytesseract with normalized word bounding boxes and confidence scores
"""

import re
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
import pytesseract
from PIL import Image


def get_available_ocr_languages() -> List[str]:
    """Safely returns available Tesseract traineddata language codes."""
    try:
        langs = pytesseract.get_languages(config="")
        return [str(lang).strip() for lang in langs if str(lang).strip()]
    except Exception:
        return []


def select_ocr_language() -> Tuple[str, bool]:
    """Selects 'kan+eng' when Kannada tessdata is installed, else 'eng'."""
    langs = get_available_ocr_languages()
    has_kan = "kan" in langs
    return ("kan+eng" if has_kan else "eng"), has_kan


def estimate_skew_angle(binary_inv: np.ndarray) -> float:
    """Estimates page skew angle in degrees in [-15.0, 15.0] using near-horizontal Hough lines.

    Avoids cv2.minAreaRect on full-page bounding blobs, which can wrongly report +/-90 deg
    on portrait documents.
    """
    h, w = binary_inv.shape[:2]
    if h < 40 or w < 40:
        return 0.0

    # Slightly bridge characters horizontally to reveal text line orientations
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 2))
    dilated = cv2.dilate(binary_inv, kernel, iterations=1)
    min_len = max(40, w // 10)
    lines = cv2.HoughLinesP(
        dilated,
        rho=1,
        theta=np.pi / 180.0,
        threshold=60,
        minLineLength=min_len,
        maxLineGap=15,
    )
    if lines is None:
        return 0.0

    angles: List[float] = []
    for seg in np.reshape(lines, (-1, 4)):
        x1, y1, x2, y2 = int(seg[0]), int(seg[1]), int(seg[2]), int(seg[3])
        dx = x2 - x1
        dy = y2 - y1
        if dx == 0:
            continue
        if dx < 0:
            dx, dy = -dx, -dy
        deg = float(np.degrees(np.arctan2(dy, dx)))
        if -15.0 <= deg <= 15.0:
            angles.append(deg)

    if len(angles) < 3:
        return 0.0
    return round(float(np.median(angles)), 2)


def _preprocess_arrays(pil_img: Image.Image) -> Tuple[np.ndarray, np.ndarray, Dict[str, Any]]:
    """Internal helper returning (binarized_img, deskewed_gray_img, quality_metrics)."""
    rgb = np.array(pil_img.convert("RGB"))
    height, width = rgb.shape[:2]
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)

    blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    contrast_std = float(np.std(gray))
    is_blank = contrast_std < 8.0

    if is_blank:
        return (
            gray,
            gray,
            {
                "width": width,
                "height": height,
                "blur_score": round(blur_score, 2),
                "contrast_std": round(contrast_std, 2),
                "deskew_angle_deg": 0.0,
                "is_blank": True,
            },
        )

    # Upscale moderate-res scans lightly only if narrow, keeping memory bounded
    if width < 900:
        scale = 1.5
        gray = cv2.resize(gray, (int(width * scale), int(height * scale)), interpolation=cv2.INTER_CUBIC)
        height, width = gray.shape[:2]

    denoised = cv2.fastNlMeansDenoising(gray, None, h=10, templateWindowSize=7, searchWindowSize=21)
    _, otsu_inv = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    deskew_angle = estimate_skew_angle(otsu_inv)

    working = denoised
    if 0.5 <= abs(deskew_angle) <= 15.0:
        center = (width / 2.0, height / 2.0)
        rot_mat = cv2.getRotationMatrix2D(center, deskew_angle, 1.0)
        working = cv2.warpAffine(
            denoised,
            rot_mat,
            (width, height),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=255,
        )

    binarized = cv2.adaptiveThreshold(
        working,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        11,
    )

    metrics = {
        "width": width,
        "height": height,
        "blur_score": round(blur_score, 2),
        "contrast_std": round(contrast_std, 2),
        "deskew_angle_deg": deskew_angle,
        "is_blank": False,
    }
    return binarized, working, metrics


def preprocess_scan_image(pil_img: Image.Image) -> Tuple[Image.Image, Dict[str, Any]]:
    """Applies grayscale conversion, denoising, Hough deskewing, and adaptive thresholding."""
    binarized, _, metrics = _preprocess_arrays(pil_img)
    return Image.fromarray(binarized), metrics


def _extract_ocr_data(
    target_img: Image.Image,
    ocr_lang: str,
    page_num: int,
    img_w: int,
    img_h: int,
) -> Tuple[str, List[Dict[str, Any]], float]:
    """Runs pytesseract.image_to_data and builds ordered lines + normalized bbox words."""
    data = pytesseract.image_to_data(
        target_img,
        lang=ocr_lang,
        output_type=pytesseract.Output.DICT,
        config="--oem 3 --psm 6",
    )

    lines_map: Dict[Tuple[int, int, int], List[str]] = {}
    words: List[Dict[str, Any]] = []
    confs: List[float] = []

    n = len(data.get("text", []))
    for i in range(n):
        token = str(data["text"][i] or "").strip()
        if not token:
            continue

        try:
            raw_conf = float(data["conf"][i])
        except Exception:
            raw_conf = -1.0
        if raw_conf >= 0:
            confs.append(raw_conf / 100.0)

        key = (
            int(data["block_num"][i]),
            int(data["par_num"][i]),
            int(data["line_num"][i]),
        )
        lines_map.setdefault(key, []).append(token)

        left = float(data["left"][i])
        top = float(data["top"][i])
        bw = float(data["width"][i])
        bh = float(data["height"][i])
        x_pct = round(max(0.0, (left / max(1, img_w)) * 100.0), 2)
        y_pct = round(max(0.0, (top / max(1, img_h)) * 100.0), 2)
        w_pct = round(min(100.0 - x_pct, (bw / max(1, img_w)) * 100.0), 2)
        h_pct = round(min(100.0 - y_pct, (bh / max(1, img_h)) * 100.0), 2)

        words.append(
            {
                "text": token,
                "page": page_num,
                "x": x_pct,
                "y": y_pct,
                "width": w_pct,
                "height": h_pct,
                "conf": round(max(0.0, raw_conf / 100.0), 3) if raw_conf >= 0 else 0.0,
            }
        )

    ordered_lines = [" ".join(tokens) for _, tokens in sorted(lines_map.items())]
    full_text = "\n".join(ordered_lines)
    avg_conf = round(sum(confs) / len(confs), 3) if confs else 0.0
    return full_text, words, avg_conf


def run_tesseract_ocr(pil_img: Image.Image, page_num: int = 1) -> Dict[str, Any]:
    """Runs OpenCV preprocessing + Tesseract OCR and returns text, word bboxes, and quality stats."""
    binarized, working_gray, metrics = _preprocess_arrays(pil_img)
    ocr_lang, has_kan = select_ocr_language()

    if metrics.get("is_blank"):
        return {
            "text": "",
            "words": [],
            "avg_word_conf": 0.0,
            "ocr_lang": ocr_lang,
            "has_kannada_tessdata": has_kan,
            "metrics": metrics,
        }

    img_h, img_w = binarized.shape[:2]
    text, words, avg_conf = _extract_ocr_data(
        Image.fromarray(binarized),
        ocr_lang=ocr_lang,
        page_num=page_num,
        img_w=img_w,
        img_h=img_h,
    )

    # Fallback to denoised grayscale if adaptive thresholding over-eroded clean/light text
    if len(re.sub(r"\s+", "", text)) < 15:
        gray_text, gray_words, gray_conf = _extract_ocr_data(
            Image.fromarray(working_gray),
            ocr_lang=ocr_lang,
            page_num=page_num,
            img_w=img_w,
            img_h=img_h,
        )
        if len(re.sub(r"\s+", "", gray_text)) > len(re.sub(r"\s+", "", text)):
            text, words, avg_conf = gray_text, gray_words, gray_conf

    return {
        "text": text,
        "words": words,
        "avg_word_conf": avg_conf,
        "ocr_lang": ocr_lang,
        "has_kannada_tessdata": has_kan,
        "metrics": metrics,
    }


def _norm_tok(s: str) -> str:
    return re.sub(r"^[\W_]+|[\W_]+$", "", s.lower())


def find_ocr_bbox(ocr_words: List[Dict[str, Any]], *candidates: str) -> Optional[Dict[str, float]]:
    """Matches candidate phrases or anchor tokens against OCR word boxes and returns a union bbox."""
    if not ocr_words:
        return None

    norm_words = [(_norm_tok(str(w.get("text", ""))), w) for w in ocr_words]
    for cand in candidates:
        if not cand:
            continue
        tokens = [_norm_tok(tok) for tok in str(cand).split() if _norm_tok(tok)]
        if not tokens:
            continue

        # 1. Try contiguous multi-token phrase match
        if len(tokens) >= 2:
            k = len(tokens)
            for idx in range(0, len(norm_words) - k + 1):
                window = [norm_words[idx + j][0] for j in range(k)]
                if all(tokens[j] in window[j] or window[j] in tokens[j] for j in range(k) if window[j]):
                    matched = [norm_words[idx + j][1] for j in range(k)]
                    return _union_word_boxes(matched)

        # 2. Fallback to strongest anchor token (>= 2 chars, prefer longest specific token)
        sorted_toks = sorted(tokens, key=len, reverse=True)
        for tok in sorted_toks:
            if len(tok) < 2:
                continue
            for w_norm, w_obj in norm_words:
                if tok == w_norm or (len(tok) >= 3 and tok in w_norm):
                    return _union_word_boxes([w_obj])

    return None


def _union_word_boxes(matched_words: List[Dict[str, Any]]) -> Optional[Dict[str, float]]:
    if not matched_words:
        return None
    x0 = min(float(w["x"]) for w in matched_words)
    y0 = min(float(w["y"]) for w in matched_words)
    x1 = max(float(w["x"]) + float(w["width"]) for w in matched_words)
    y1 = max(float(w["y"]) + float(w["height"]) for w in matched_words)
    rx = round(max(0.0, x0 - 0.8), 2)
    ry = round(max(0.0, y0 - 0.6), 2)
    rw = round(min(100.0 - rx, (x1 - x0) + 2.4), 2)
    rh = round(min(100.0 - ry, (y1 - y0) + 1.4), 2)
    return {"x": rx, "y": ry, "width": max(1.0, rw), "height": max(1.0, rh)}
