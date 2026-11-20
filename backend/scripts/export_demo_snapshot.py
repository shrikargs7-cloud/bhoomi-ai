"""Export deterministic FastAPI backend demo snapshot into webapp/public/demo-snapshot/
so the hosted React frontend runs interactively on GitHub Pages without a Python server.
"""

import json
from pathlib import Path
from fastapi.testclient import TestClient

from app.main import app


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    out_dir = repo_root / "webapp" / "public" / "demo-snapshot"
    pages_dir = out_dir / "pages"
    reports_dir = out_dir / "reports"
    pages_dir.mkdir(parents=True, exist_ok=True)
    reports_dir.mkdir(parents=True, exist_ok=True)

    headers = {"X-Demo-Role": "reviewer"}

    with TestClient(app) as client:
        r = client.post("/api/cases/reset-demo", headers=headers)
        assert r.status_code == 200, r.text

        cases = client.get("/api/cases", headers=headers).json()
        write_json(out_dir / "cases.json", cases)

        for name, endpoint in [
            ("evaluation.json", "/api/evaluation/run"),
            ("reviewer_queue.json", "/api/reviewer/queue"),
            ("legal_sources.json", "/api/legal/sources"),
        ]:
            resp = client.get(endpoint, headers=headers)
            assert resp.status_code == 200, (endpoint, resp.text)
            write_json(out_dir / name, resp.json())

        for c in cases:
            cid = c["case_id"]
            case_data = client.get(f"/api/cases/{cid}", headers=headers).json()
            write_json(out_dir / f"case_{cid}.json", case_data)

            for fname, ep in [
                (f"valuation_{cid}.json", f"/api/cases/{cid}/valuation"),
                (f"ownership_{cid}.json", f"/api/cases/{cid}/ownership/graph"),
                (f"gis_{cid}.json", f"/api/cases/{cid}/gis"),
            ]:
                resp = client.get(ep, headers=headers)
                assert resp.status_code == 200, (ep, resp.text)
                write_json(out_dir / fname, resp.json())

            # Document PNG previews for every page
            for doc in case_data.get("documents", []):
                doc_id = doc["id"]
                page_count = max(1, int(doc.get("pages_count") or 1))
                for p in range(1, page_count + 1):
                    pg = client.get(f"/api/documents/{doc_id}/page/{p}", headers=headers)
                    if pg.status_code == 200:
                        (pages_dir / f"{doc_id}_p{p}.png").write_bytes(pg.content)

            # Signed ReportLab PDF dossier
            sig = client.post(f"/api/cases/{cid}/reports/sign", headers=headers)
            assert sig.status_code == 200, (cid, sig.text)
            pdf_res = client.get(sig.json()["download_url"], headers=headers)
            assert pdf_res.status_code == 200, (cid, pdf_res.status_code)
            (reports_dir / f"{cid}.pdf").write_bytes(pdf_res.content)

            # Interactive demo loaders (comparables & GIS polygon)
            val_demo = client.post(f"/api/cases/{cid}/comparables/load-demo", headers=headers)
            assert val_demo.status_code == 200, (cid, val_demo.text)
            write_json(out_dir / f"valuation_demo_{cid}.json", val_demo.json())

            gis_demo = client.post(f"/api/cases/{cid}/gis/load-demo", headers=headers)
            assert gis_demo.status_code == 200, (cid, gis_demo.text)
            write_json(out_dir / f"gis_demo_{cid}.json", gis_demo.json())

        # Restore clean demo database state locally
        r2 = client.post("/api/cases/reset-demo", headers=headers)
        assert r2.status_code == 200, r2.text

    png_count = len(list(pages_dir.glob("*.png")))
    pdf_count = len(list(reports_dir.glob("*.pdf")))
    print(f"Exported demo snapshot to {out_dir}: {len(cases)} cases, {png_count} PNG pages, {pdf_count} PDFs")


if __name__ == "__main__":
    main()
