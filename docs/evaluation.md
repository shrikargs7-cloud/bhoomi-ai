# BhoomiAI Evaluation & Stress-Test Report

> **Important Notice**: Every metric reported below was directly measured on synthetic land-record documents and benchmark suites generated in [`backend/scripts/create_demo_documents.py`](../backend/scripts/create_demo_documents.py) and [`backend/scripts/evaluate_stress_benchmarks.py`](../backend/scripts/evaluate_stress_benchmarks.py). Zero figures were fabricated or extrapolated beyond observed outputs.

---

## 1. Evaluation Methodology

1. **Golden Synthetic Case (`BHOOMI-DEMO-001`)**: 5 PDFs (`RTC_Form16_2023.pdf`, `Death_Certificate_Ramachandrappa.pdf`, `Partition_Deed_2011_Registered.pdf`, `Mutation_Extract_MR_2018_09.pdf` in Kannada + English, and `Survey_Sketch_Tippani_84_1.pdf`) with 4 planted discrepancies (`R1`, `R2`, `R3`, `R5`) and zero debug hints inside document text.
2. **Clean Synthetic Case (`BHOOMI-CLEAN-002`)**: 3 consistent Mandya records (`RTC_Mandya_112_3_2024.pdf`, `Sale_Deed_Mandya_2019.pdf`, `Mutation_Mandya_MR_2020_14.pdf`) expecting 0 discrepancies.
3. **20-Case Synthetic Benchmark (`benchmark_20_cases.json`)**: 52 generated PDFs across 20 cases covering clean sets (`SYNTH-01`..`04`), deceased-owner + missing inheritance (`SYNTH-05`..`08`), extent mismatches (`SYNTH-09`..`12`), survey-number mismatches (`SYNTH-13`..`16`), and missing supporting mortgage documents (`SYNTH-17`..`20`).
4. **Degraded-Scan OCR Stress Suite (`evaluate_stress_benchmarks.py` Suite A)**: 8 raster PNG & image-only PDF stress scenarios passing through OpenCV preprocessing (`preprocess_scan_image` — Laplacian blur check, `fastNlMeansDenoising`, Hough-line deskewing, adaptive thresholding) + `pytesseract` OCR.
5. **Kannada & Cross-Lingual Name-Variant Suite (`evaluate_stress_benchmarks.py` Suite B)**: 14 English/Kannada name pairs evaluating calibrated Jaro-Winkler (`p=0.05`, strong match `>= 0.88`, human-review candidate `[0.68, 0.88)`, distinct `< 0.68`) plus `resolve_person_entities()` cluster behavior.
6. **Adversarial, Unsupported-Claim Verifier & Legal RAG Suite (`evaluate_stress_benchmarks.py` Suite C)**: Prompt-injection isolation (`Adversarial_Injection_RTC.pdf`), V1–V4 unsupported-claim/accusatory blocker (`verify_case_claims`), and curated statutory lookup vs out-of-corpus abstention (`query_legal_reference`).

---

## 2. Field Extraction Results (`backend/scripts/evaluate_extraction.py`)

| Document | Type | Language | Fields Matched | Precision | Recall | BBox Coverage |
|---|---|---|---|---|---|---|
| `RTC_Form16_2023.pdf` | `RTC` | English | `6 / 6` | `100.0%` | `100.0%` | `100.0%` |
| `Death_Certificate_Ramachandrappa.pdf` | `DEATH_CERTIFICATE` | Kannada / English | `4 / 4` | `100.0%` | `100.0%` | `100.0%` |
| `Partition_Deed_2011_Registered.pdf` | `PARTITION_DEED` | English | `5 / 5` | `100.0%` | `100.0%` | `100.0%` |
| `Mutation_Extract_MR_2018_09.pdf` | `MUTATION_EXTRACT` | Kannada / English | `4 / 4` | `100.0%` | `100.0%` | `100.0%` |
| `Survey_Sketch_Tippani_84_1.pdf` | `SURVEY_SKETCH` | English | `3 / 3` | `100.0%` | `100.0%` | `100.0%` |

- **Golden Field Precision**: `100.0%` (`22 / 22`) | **Golden Field Recall**: `100.0%` (`22 / 22`)
- **20-Case Benchmark Docs Classified & Extracted**: `52 / 52` (`100.0%`)

---

## 3. Deterministic Discrepancy Results (`backend/scripts/evaluate_discrepancies.py`)

- **Golden Case (`BHOOMI-DEMO-001`)**: `TP=4, FP=0, FN=0` | Precision: `100.0%` | Recall: `100.0%` | Engine latency: `0.44 ms`
- **20-Case Benchmark (`20` cases)**: `TP=20, FP=0, FN=0` | Precision: `100.0%` | Recall: `100.0%` | False Positive Rate: `0.0%`
- **Clean Cases Passed with 0 False Positives**: `4 / 4`
- **Unsupported-Claim Rate**: `0.0%`

---

## 4. Degraded-Scan OCR Stress Benchmark (`evaluate_stress_benchmarks.py` Suite A)

Result: **`8 / 8` passed** (`7 / 7` core scenarios passed).

| Scenario | Condition | Status | Survey (`84/1`) | Extent (`1.875 ac`) | OCR Confidence | Latency (ms) | Passed |
|---|---|---|---|---|---|---|---|
| `clean_scan_0deg` | `0°` rotation, no noise | `extracted` | Matched | Matched | `0.898` | `557.22` | Pass |
| `mild_skew_grain` | `-2.5°` rotation, Gaussian grain `std=5` | `extracted` | Matched | Matched | `0.894` | `545.39` | Pass |
| `moderate_skew_noise` | `+4.5°` rotation, grain `std=10` | `extracted` | Matched | Matched | `0.875` | `553.84` | Pass |
| `low_contrast_faded` | Faded contrast factor `0.45` on gray `215` | `extracted` | Matched | Matched | `0.903` | `632.45` | Pass |
| `blurred_camera_scan` | `-1.0°` + Gaussian defocus blur `radius=1.5` | `extracted` | Matched | Matched | `0.885` | `552.52` | Pass |
| `image_only_scanned_pdf` | `-2.0°` raster embedded in PDF (zero text layer) | `extracted` | Matched | Matched | `0.903` | `1524.40` | Pass |
| `ultra_low_res_120x90` | `120x90 px` low-resolution upload | `needs_reupload` | — | — | `0.200` | `0.39` | Pass |
| `blank_white_pdf` | Blank A4 white PDF page | `needs_reupload` | — | — | `0.150` | `118.66` | Pass |

---

## 5. Kannada & Cross-Lingual Name-Variant Benchmark (`evaluate_stress_benchmarks.py` Suite B)

Calibration note: Winkler prefix scaling was calibrated to `p=0.05` in [`normalization.py`](../backend/app/core/normalization.py) so Karnataka names sharing a 4-character stem (e.g., `Ramayya` vs `Ramaiah`) route to `uncertain` (`[0.68, 0.88)`) for human confirmation rather than auto-merging at `0.88+`.

Result: **`14 / 14` pairs passed (`100.0%` bucket accuracy) | False Merge Rate: `0.0%` (`0 / 14`) | End-to-End Entity Cluster Check: Passed** (`Ramaiah` + `ರಾಮಯ್ಯ` merged as `confirmed`, `Ramayya` preserved as `uncertain`, `Suresh Kumar` distinct).

| Name A | Name B | Expected Bucket | Measured Bucket | Similarity | Passed |
|---|---|---|---|---|---|
| `Sri Ramachandrappa` | `Late Ramachandrappa` | `match` | `match` | `1.0000` | Pass |
| `ರಾಮಚಂದ್ರಪ್ಪ` | `Ramachandrappa` | `match` | `match` | `1.0000` | Pass |
| `ಶ್ರೀ ರಾಮಚಂದ್ರಪ್ಪ` | `Sri Ramachandrappa` | `match` | `match` | `1.0000` | Pass |
| `ರಾಮಯ್ಯ` | `Ramaiah` | `match` | `match` | `1.0000` | Pass |
| `ಶ್ರೀಮತಿ ಸಾವಿತ್ರಮ್ಮ` | `Smt. Savithramma` | `match` | `match` | `1.0000` | Pass |
| `ವೆಂಕಟೇಶ್` | `Venkatesh` | `match` | `match` | `1.0000` | Pass |
| `ಮಂಜುನಾಥ್` | `Manjunath` | `match` | `match` | `1.0000` | Pass |
| `Ramayya` | `Ramaiah` | `uncertain` | `uncertain` | `0.8476` | Pass |
| `Ramayya` | `ರಾಮಯ್ಯ` | `uncertain` | `uncertain` | `0.8476` | Pass |
| `Kempaiah` | `Kemparaju` | `uncertain` | `uncertain` | `0.8444` | Pass |
| `Subbaiah` | `Subbanna` | `uncertain` | `uncertain` | `0.8667` | Pass |
| `Ramachandrappa` | `Suresh Kumar` | `distinct` | `distinct` | `0.5397` | Pass |
| `Ramaiah` | `Muniyappa` | `distinct` | `distinct` | `0.5886` | Pass |
| `Savithramma` | `Lakshmi` | `distinct` | `distinct` | `0.5563` | Pass |

---

## 6. Adversarial, Verifier Gate & Legal RAG Abstention (`evaluate_stress_benchmarks.py` Suite C)

- **Prompt-Injection Quarantine (`Adversarial_Injection_RTC.pdf`)**: Quarantined (`injection_warning` populated); deterministic Rule `R5` mortgage charge still detected (`100.0%`).
- **Unsupported-Claim Verifier Gate (`verify_case_claims`)**: **`6 / 6` (`100.0%`)** invalid findings & out-of-bounds ownership events blocked (missing citations, unknown `document_id`, out-of-range page, ungrounded text, prohibited `"fraudulent/forgery"` phrasing, bad event page).
- **Curated Legal RAG Citation & Abstention (`query_legal_reference`)**: **`3 / 3`** Karnataka statutory queries cited from corpus; **`3 / 3`** out-of-corpus queries abstained cleanly.

---

## 7. Automated Pytest Suite Summary

```bash
PYTHONPATH=backend pytest backend/tests/ -v
```
- **Result**: **`29 passed, 7 warnings in 23.27s`** (`0` failed, `0` skipped) across:
  - `test_api_and_security.py` (`10` tests: auth isolation, E2E upload/correction/PDF, signed PDF downloads, magic-byte check, CORS, 429 rate limiting, prompt injection, bad scan flag, valuation/legal abstention, reviewer triage queue)
  - `test_discrepancy.py` (`3` tests: golden rules R1/R2/R3/R5, clean 0 false-positives, R4 survey mismatch)
  - `test_normalization.py` (`5` tests: Kannada numerals, Karnataka units, formatting, extent match tolerance, name variants)
  - `test_phase3_ocr_langgraph_verifier.py` (`7` tests: rotated scan OCR, image-only PDF OCR, blank PDF flag, pure-Kannada PDF extraction/rules, compiled LangGraph branches, node retry + exhausted error recovery, Verifier V1–V4 & Legal RAG verification)
  - `test_phase4_stress_benchmarks.py` (`4` tests: degraded-scan stress suite, Kannada name-variant stress suite, adversarial/verifier stress suite, `GET /api/evaluation/stress` endpoint)

---

## 8. Limitations & Scope

1. **Local Tesseract Language Packs vs. Containerized Runtime**: The local macOS Tesseract installation provides `eng`, `osd`, and `snum`, so raster image OCR runs `eng` locally while `backend/Dockerfile` bundles `tesseract-ocr-kan` for `kan+eng` raster OCR. Digital Kannada PDFs execute natively via PyMuPDF across all environments.
2. **Extreme Camera Degradation & Handwritten Marginalia**: Severe motion blur, heavy perspective warp, folded creases, or handwritten Kannada endorsements exceed deterministic classical OpenCV/Tesseract thresholds and are intentionally routed to `needs_reupload` or Manual-Entry Human Field Review (`Ladder Step 4`) rather than hallucinated.
3. **Decision-Support Only**: All cases in `BHOOMI-DEMO-001`, `BHOOMI-CLEAN-002`, and `eval_suite/` are synthetic evaluation records. BhoomiAI never certifies legal title, physical survey boundaries, mutation validity, or market value.
