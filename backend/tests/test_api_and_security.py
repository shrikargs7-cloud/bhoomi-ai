import os
import json
import tempfile
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import Base, engine, SessionLocal
from app.db.repository import seed_demo_cases


def _ensure_seeded():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_demo_cases(db, force_reset=False)
    finally:
        db.close()


_ensure_seeded()
client = TestClient(app)


def test_auth_and_case_isolation():
    # Register two separate users
    r1 = client.post("/api/auth/register", json={
        "name": "Alice Farmer",
        "email": f"alice_{os.getpid()}@example.com",
        "password": "password123",
        "role": "farmer",
    })
    assert r1.status_code == 200
    tok_alice = r1.json()["access_token"]

    r2 = client.post("/api/auth/register", json={
        "name": "Bob Stranger",
        "email": f"bob_{os.getpid()}@example.com",
        "password": "password123",
        "role": "farmer",
    })
    assert r2.status_code == 200
    tok_bob = r2.json()["access_token"]

    # Alice creates a private case
    c_res = client.post(
        "/api/cases",
        headers={"Authorization": f"Bearer {tok_alice}"},
        json={
            "case_name": "Alice Private Case",
            "survey_number": "99/1",
            "village": "Bidadi",
            "district": "Ramanagara",
        },
    )
    assert c_res.status_code == 200
    case_id = c_res.json()["case_id"]

    # Unauthenticated request must fail (401)
    assert client.get(f"/api/cases/{case_id}").status_code == 401
    # Bob accessing Alice's private case must get 403 Forbidden
    assert client.get(f"/api/cases/{case_id}", headers={"Authorization": f"Bearer {tok_bob}"}).status_code == 403
    # Alice can access her own case
    assert client.get(f"/api/cases/{case_id}", headers={"Authorization": f"Bearer {tok_alice}"}).status_code == 200

    # Cleanup
    assert client.delete(f"/api/cases/{case_id}", headers={"Authorization": f"Bearer {tok_alice}"}).status_code == 200


def test_e2e_upload_correction_review_and_pdf():
    # Create temporary public demo case
    c_res = client.post("/api/cases", json={
        "case_name": "E2E Upload Test",
        "survey_number": "84/1",
        "village": "Ramanagara Rural",
        "district": "Ramanagara",
    })
    assert c_res.status_code == 200
    cid = c_res.json()["case_id"]

    try:
        # Upload RTC and Partition Deed
        for fn in ("RTC_Form16_2023.pdf", "Partition_Deed_2011_Registered.pdf"):
            with open(os.path.join("backend/data/documents", fn), "rb") as f:
                up = client.post(f"/api/cases/{cid}/documents/upload", files={"file": (fn, f, "application/pdf")})
                assert up.status_code == 200

        case_data = client.get(f"/api/cases/{cid}").json()
        assert len(case_data["documents"]) == 2
        assert any(d["rule_id"] == "R2" for d in case_data["discrepancies"])

        # Test real PDF page PNG rendering
        rtc_doc = next(d for d in case_data["documents"] if d["doc_type"] == "RTC")
        png_res = client.get(f"/api/documents/{rtc_doc['id']}/page/1")
        assert png_res.status_code == 200
        assert png_res.headers["content-type"] == "image/png"
        assert png_res.content[:4] == b"\x89PNG"

        # Reviewer corrects Partition Deed extent to 1-35 -> R2 should resolve!
        pd_doc = next(d for d in case_data["documents"] if d["doc_type"] == "PARTITION_DEED")
        corr = client.post(
            f"/api/documents/{pd_doc['id']}/correct",
            json={
                "document_id": pd_doc["id"],
                "field_name": "extent_allotted",
                "corrected_value": "1-35",
                "reviewer_notes": "Verified against Akarband phodi",
            },
        )
        assert corr.status_code == 200
        updated = corr.json()["case"]
        # Original text preserved per Rule 6
        pd_updated = next(d for d in updated["documents"] if d["id"] == pd_doc["id"])
        ext_fld = next(f for f in pd_updated["extracted_fields"] if f["field_name"] == "extent_allotted")
        assert "2-15" in ext_fld["original_text"]
        assert ext_fld["reviewer_value"] == 1.875
        # R2 mismatch disappears after correction!
        assert not any(d["rule_id"] == "R2" for d in updated["discrepancies"])

        # Review remaining finding (R5)
        r5 = next(d for d in updated["discrepancies"] if d["rule_id"] == "R5")
        rev_res = client.post(
            f"/api/discrepancies/{r5['id']}/review",
            json={"discrepancy_id": r5["id"], "decision": "approved", "reviewer_notes": "Bank NOC requested"},
        )
        assert rev_res.status_code == 200

        # Download generated PDF Land Readiness Report
        pdf_res = client.get(f"/api/cases/{cid}/reports/readiness-pdf")
        assert pdf_res.status_code == 200
        assert pdf_res.content[:4] == b"%PDF"
    finally:
        client.delete(f"/api/cases/{cid}")


def test_prompt_injection_immunity():
    c_res = client.post("/api/cases", json={"case_name": "Injection Test", "survey_number": "84/1"})
    cid = c_res.json()["case_id"]
    try:
        with open("backend/data/eval_suite/Adversarial_Injection_RTC.pdf", "rb") as f:
            up = client.post(
                f"/api/cases/{cid}/documents/upload",
                files={"file": ("Adversarial_Injection_RTC.pdf", f, "application/pdf")},
            )
        assert up.status_code == 200
        doc = up.json()["document"]
        assert doc["injection_warning"] is not None
        # Engine MUST NOT mark case clean; R5 mortgage check still triggers!
        assert any(d["rule_id"] == "R5" for d in up.json()["case"]["discrepancies"])
    finally:
        client.delete(f"/api/cases/{cid}")


def test_bad_scan_reupload_flag():
    from PIL import Image
    c_res = client.post("/api/cases", json={"case_name": "Bad Scan Test", "survey_number": "10/1"})
    cid = c_res.json()["case_id"]
    try:
        with tempfile.NamedTemporaryFile(suffix=".png") as tmp:
            Image.new("RGB", (60, 60), color=(200, 200, 200)).save(tmp.name)
            with open(tmp.name, "rb") as f:
                up = client.post(f"/api/cases/{cid}/documents/upload", files={"file": ("blurry.png", f, "image/png")})
        assert up.status_code == 200
        assert up.json()["document"]["status"] == "needs_reupload"
    finally:
        client.delete(f"/api/cases/{cid}")


def test_valuation_and_legal_abstention():
    # Golden demo has 0 comparables -> must abstain with exact SPEC Section 10 string
    val_res = client.get("/api/cases/BHOOMI-DEMO-001/valuation")
    assert val_res.status_code == 200
    assert val_res.json()["abstained"] is True
    assert val_res.json()["message"] == "Insufficient verified comparable evidence to produce a reliable valuation."

    # Legal RAG: valid query cites KLRA 1964; unrelated query abstains
    leg_ok = client.post("/api/legal/query", json={"query": "deceased owner pauti khata mutation"}).json()
    assert leg_ok["abstained"] is False
    assert "Karnataka Land Revenue Act" in leg_ok["source"]

    leg_abs = client.post("/api/legal/query", json={"query": "mars terraforming treaty"}).json()
    assert leg_abs["abstained"] is True


def test_signed_pdf_download_for_private_case():
    import uuid
    suffix = uuid.uuid4().hex[:6]
    r_alice = client.post("/api/auth/register", json={
        "name": "Alice Sign",
        "email": f"alice_sign_{suffix}@example.com",
        "password": "password123",
        "role": "farmer",
    })
    assert r_alice.status_code == 200
    tok_alice = r_alice.json()["access_token"]

    r_bob = client.post("/api/auth/register", json={
        "name": "Bob Sign",
        "email": f"bob_sign_{suffix}@example.com",
        "password": "password123",
        "role": "farmer",
    })
    assert r_bob.status_code == 200
    tok_bob = r_bob.json()["access_token"]

    c_res = client.post(
        "/api/cases",
        headers={"Authorization": f"Bearer {tok_alice}"},
        json={"case_name": "Alice Signed PDF Case", "survey_number": "77/2"},
    )
    assert c_res.status_code == 200
    cid = c_res.json()["case_id"]

    try:
        # Direct unauthenticated PDF download is rejected (401)
        assert client.get(f"/api/cases/{cid}/reports/readiness-pdf").status_code == 401
        # Bob cannot sign Alice's case (403)
        assert client.post(
            f"/api/cases/{cid}/reports/sign",
            headers={"Authorization": f"Bearer {tok_bob}"},
        ).status_code == 403

        # Alice signs download URL
        sign_res = client.post(
            f"/api/cases/{cid}/reports/sign",
            headers={"Authorization": f"Bearer {tok_alice}"},
        )
        assert sign_res.status_code == 200
        dl_url = sign_res.json()["download_url"]
        dl_token = sign_res.json()["token"]

        # Signed download works without Authorization header (browser download pattern)
        pdf_res = client.get(dl_url)
        assert pdf_res.status_code == 200
        assert pdf_res.content[:4] == b"%PDF"

        # Tampered token rejected (401); download token cannot be used as auth Bearer token (401)
        assert client.get("/api/reports/download?token=invalid.jwt.token").status_code == 401
        assert client.get(
            f"/api/cases/{cid}",
            headers={"Authorization": f"Bearer {dl_token}"},
        ).status_code == 401
    finally:
        client.delete(f"/api/cases/{cid}", headers={"Authorization": f"Bearer {tok_alice}"})


def test_magic_byte_spoof_rejected():
    # Plain text masquerading as .pdf or .png must be rejected with 400
    r_pdf = client.post(
        "/api/cases/BHOOMI-DEMO-001/documents/upload",
        files={"file": ("fake.pdf", b"This is not really a PDF file", "application/pdf")},
    )
    assert r_pdf.status_code == 400
    assert "magic bytes" in r_pdf.json()["detail"].lower()

    r_png = client.post(
        "/api/cases/BHOOMI-DEMO-001/documents/upload",
        files={"file": ("fake.png", b"%PDF-1.4 spoofed as png", "image/png")},
    )
    assert r_png.status_code == 400
    assert "magic bytes" in r_png.json()["detail"].lower()


def test_cors_explicit_origins():
    ok_res = client.get("/api/health", headers={"Origin": "http://127.0.0.1:5173"})
    assert ok_res.status_code == 200
    assert ok_res.headers.get("access-control-allow-origin") == "http://127.0.0.1:5173"

    bad_res = client.get("/api/health", headers={"Origin": "http://evil.example"})
    assert bad_res.status_code == 200
    assert bad_res.headers.get("access-control-allow-origin") is None


def test_rate_limiter_enforces_429():
    from app.core.security import SlidingWindowRateLimiter
    limiter = SlidingWindowRateLimiter(max_requests=3, window_seconds=10)
    assert limiter.check("1.2.3.4:/api/auth/login", now=100.0)[0] is True
    assert limiter.check("1.2.3.4:/api/auth/login", now=101.0)[0] is True
    assert limiter.check("1.2.3.4:/api/auth/login", now=102.0)[0] is True
    allowed, retry = limiter.check("1.2.3.4:/api/auth/login", now=103.0)
    assert allowed is False
    assert retry >= 1
    # After window slides past 100.0 + 10.0, request is allowed again
    assert limiter.check("1.2.3.4:/api/auth/login", now=111.0)[0] is True


def test_reviewer_queue_endpoint():
    import uuid
    client.post("/api/cases/reset-demo")

    # Public queue sees BHOOMI-DEMO-001's 4 pending discrepancies and 0 from BHOOMI-CLEAN-002
    q_res = client.get("/api/reviewer/queue")
    assert q_res.status_code == 200
    q_data = q_res.json()
    demo_discs = [d for d in q_data["pending_discrepancies"] if d["case_id"] == "BHOOMI-DEMO-001"]
    clean_discs = [d for d in q_data["pending_discrepancies"] if d["case_id"] == "BHOOMI-CLEAN-002"]
    assert len(demo_discs) == 4
    assert len(clean_discs) == 0

    # Private case created by Alice with a planted discrepancy must NOT leak into Bob's queue
    suffix = uuid.uuid4().hex[:6]
    tok_alice = client.post("/api/auth/register", json={
        "name": "Alice Queue",
        "email": f"aq_{suffix}@example.com",
        "password": "password123",
        "role": "reviewer",
    }).json()["access_token"]
    tok_bob = client.post("/api/auth/register", json={
        "name": "Bob Queue",
        "email": f"bq_{suffix}@example.com",
        "password": "password123",
        "role": "reviewer",
    }).json()["access_token"]

    cid = client.post(
        "/api/cases",
        headers={"Authorization": f"Bearer {tok_alice}"},
        json={"case_name": "Alice Secret Queue Case", "survey_number": "84/1"},
    ).json()["case_id"]

    try:
        with open("backend/data/documents/RTC_Form16_2023.pdf", "rb") as f:
            up = client.post(
                f"/api/cases/{cid}/documents/upload",
                headers={"Authorization": f"Bearer {tok_alice}"},
                files={"file": ("RTC_Form16_2023.pdf", f, "application/pdf")},
            )
            assert up.status_code == 200

        alice_q = client.get("/api/reviewer/queue", headers={"Authorization": f"Bearer {tok_alice}"}).json()
        assert any(d["case_id"] == cid for d in alice_q["pending_discrepancies"])

        bob_q = client.get("/api/reviewer/queue", headers={"Authorization": f"Bearer {tok_bob}"}).json()
        assert not any(d["case_id"] == cid for d in bob_q["pending_discrepancies"])

        anon_q = client.get("/api/reviewer/queue").json()
        assert not any(d["case_id"] == cid for d in anon_q["pending_discrepancies"])
    finally:
        client.delete(f"/api/cases/{cid}", headers={"Authorization": f"Bearer {tok_alice}"})
