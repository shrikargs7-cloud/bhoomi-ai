"""BhoomiAI GeoJSON Validation & Geometry QA Service (SPEC Section 11)
Displays ONLY supplied valid GeoJSON geometry; never invents polygons from survey numbers.
Performs real mathematical validation: ring closure, vertex count, WGS84 bounds,
self-intersection check, geodesic polygon area in acres, and variance vs RTC extent.
"""

import math
from typing import Dict, Any, List, Optional, Tuple
from app.models.schemas import GeoJsonQaCheck, GeoJsonResponse, DocumentItem
from app.core.normalization import DEFAULT_EXTENT_TOLERANCE_ACRES

SQ_METERS_PER_ACRE = 4046.8564224


def _polygon_area_sq_meters(coords: List[List[float]]) -> float:
    """Computes approximate geodesic surface area in square meters for a WGS84 [lon, lat] ring."""
    if len(coords) < 4:
        return 0.0
    earth_r = 6378137.0
    area = 0.0
    n = len(coords)
    for i in range(n - 1):
        lon1, lat1 = math.radians(coords[i][0]), math.radians(coords[i][1])
        lon2, lat2 = math.radians(coords[i + 1][0]), math.radians(coords[i + 1][1])
        area += (lon2 - lon1) * (2.0 + math.sin(lat1) + math.sin(lat2))
    area = abs(area * (earth_r ** 2) / 2.0)
    return area


def _segments_intersect(p1, p2, p3, p4) -> bool:
    def ccw(a, b, c):
        return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0])
    return ccw(p1, p3, p4) != ccw(p2, p3, p4) and ccw(p1, p2, p3) != ccw(p1, p2, p4)


def _has_self_intersection(ring: List[List[float]]) -> bool:
    n = len(ring) - 1
    if n < 4:
        return False
    for i in range(n):
        a1, a2 = ring[i], ring[i + 1]
        for j in range(i + 2, n):
            if i == 0 and j == n - 1:
                continue
            b1, b2 = ring[j], ring[j + 1]
            if _segments_intersect(a1, a2, b1, b2):
                return True
    return False


def _rtc_extent_from_docs(documents: List[DocumentItem]) -> Optional[float]:
    for d in documents:
        if d.doc_type == "RTC" and d.status == "extracted":
            for f in d.extracted_fields:
                if f.field_name == "total_extent":
                    val = f.reviewer_value if (f.reviewer_value is not None and f.verification_status == "corrected") else f.normalized_value
                    if isinstance(val, (int, float)):
                        return float(val)
    return None


def validate_and_run_gis_qa(
    case_id: str,
    geojson: Optional[Dict[str, Any]],
    source_description: Optional[str],
    synthetic: bool,
    documents: List[DocumentItem],
) -> GeoJsonResponse:
    rtc_acres = _rtc_extent_from_docs(documents)

    if not geojson:
        return GeoJsonResponse(
            case_id=case_id,
            has_geometry=False,
            source_description=None,
            synthetic=False,
            message="No GeoJSON supplied. Per SPEC Section 11, BhoomiAI never invents polygons from survey numbers — inspect the uploaded Tippani Survey Sketch or upload a valid GeoJSON.",
            geojson=None,
            rtc_extent_acres=rtc_acres,
            qa_checks=[],
        )

    qa_checks: List[GeoJsonQaCheck] = []

    # Check 1: Valid GeoJSON FeatureCollection / Feature structure
    gtype = geojson.get("type")
    features = []
    if gtype == "FeatureCollection":
        features = geojson.get("features") or []
    elif gtype == "Feature":
        features = [geojson]
    valid_struct = len(features) > 0
    qa_checks.append(
        GeoJsonQaCheck(
            check_id="QA-01",
            name="GeoJSON Schema Structure",
            passed=valid_struct,
            severity="Error",
            detail=f"Found {len(features)} GeoJSON feature(s) in {gtype}." if valid_struct else "GeoJSON contains no Features.",
        )
    )

    if not valid_struct:
        return GeoJsonResponse(
            case_id=case_id,
            has_geometry=False,
            source_description=source_description,
            synthetic=synthetic,
            message="Uploaded file is not a valid GeoJSON FeatureCollection with features.",
            geojson=None,
            rtc_extent_acres=rtc_acres,
            qa_checks=qa_checks,
        )

    # Locate primary parcel feature (marked is_subject or first polygon)
    primary_feat = next(
        (ft for ft in features if ft.get("properties", {}).get("is_subject")),
        features[0],
    )
    geom = primary_feat.get("geometry") or {}
    geom_type = geom.get("type")
    coords_outer = []
    if geom_type == "Polygon" and geom.get("coordinates"):
        coords_outer = geom["coordinates"][0]
    elif geom_type == "MultiPolygon" and geom.get("coordinates"):
        coords_outer = geom["coordinates"][0][0]

    # Check 2: Polygon Closure
    closed = len(coords_outer) >= 4 and coords_outer[0] == coords_outer[-1]
    qa_checks.append(
        GeoJsonQaCheck(
            check_id="QA-02",
            name="Polygon Ring Closure",
            passed=closed,
            severity="Error",
            detail="First and final vertex match exactly (closed boundary ring)." if closed else "Polygon ring is unclosed or has < 4 vertices.",
        )
    )

    # Check 3: WGS84 Coordinate Bounds
    in_bounds = bool(coords_outer) and all(
        -180.0 <= c[0] <= 180.0 and -90.0 <= c[1] <= 90.0 for c in coords_outer
    )
    qa_checks.append(
        GeoJsonQaCheck(
            check_id="QA-03",
            name="WGS84 CRS Bounds (-180..180, -90..90)",
            passed=in_bounds,
            severity="Error",
            detail="All boundary vertices fall within valid WGS84 geographic coordinates." if in_bounds else "Coordinates outside valid lon/lat bounds.",
        )
    )

    # Check 4: Minimum Edge & Self-Intersection Check
    self_intersect = _has_self_intersection(coords_outer) if len(coords_outer) >= 4 else True
    qa_checks.append(
        GeoJsonQaCheck(
            check_id="QA-04",
            name="Non-Self-Intersecting Boundary Topology",
            passed=not self_intersect,
            severity="Warning",
            detail="Clean simple polygon topology with zero crossing boundary segments." if not self_intersect else "Boundary segments cross / self-intersect.",
        )
    )

    # Check 5: Geodesic Area & Variance vs RTC Extent
    area_sqm = _polygon_area_sq_meters(coords_outer) if len(coords_outer) >= 4 else 0.0
    area_acres = round(area_sqm / SQ_METERS_PER_ACRE, 4)
    variance = round(abs(area_acres - rtc_acres), 4) if (rtc_acres is not None and area_acres > 0) else None
    area_ok = variance is None or variance <= 0.15  # 0.15 ac GPS survey tolerance
    qa_checks.append(
        GeoJsonQaCheck(
            check_id="QA-05",
            name="Polygon Area vs RTC Stated Extent",
            passed=area_ok,
            severity="Warning" if not area_ok else "Info",
            detail=(
                f"Computed GeoJSON area: {area_acres} ac vs RTC extent: {rtc_acres} ac (variance: {variance} ac)."
                if variance is not None
                else f"Computed GeoJSON area: {area_acres} ac."
            ),
        )
    )

    # Check 6: Attribute Completeness (Survey No / Parcel ID)
    has_props = all(bool(ft.get("properties", {}).get("survey_number")) for ft in features)
    qa_checks.append(
        GeoJsonQaCheck(
            check_id="QA-06",
            name="Survey Number Attribute Tagging",
            passed=has_props,
            severity="Warning",
            detail="All polygons carry a survey_number property." if has_props else "One or more polygons lack survey_number metadata.",
        )
    )

    return GeoJsonResponse(
        case_id=case_id,
        has_geometry=True,
        source_description=source_description,
        synthetic=synthetic,
        message=(
            "Supplied GeoJSON geometry validated."
            + (" (Synthetic Demo GeoJSON — NOT official cadastral survey geometry.)" if synthetic else "")
        ),
        geojson=geojson,
        computed_area_acres=area_acres,
        rtc_extent_acres=rtc_acres,
        area_variance_acres=variance,
        qa_checks=qa_checks,
    )


def get_synthetic_demo_geojson(survey_number: str = "84/1") -> Dict[str, Any]:
    """Explicitly labelled synthetic demo parcel GeoJSON near Ramanagara (~1.875 ac subject parcel + neighbors)."""
    # ~114.5m x 68.2m rectangle around (77.2810, 12.7190) -> ~7808 sqm (~1.92 ac)
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "survey_number": survey_number or "84/1",
                    "label": f"Sy {survey_number or '84/1'} (Subject Parcel)",
                    "owner": "Ramachandrappa (Dec.) & Venkatesh R",
                    "recorded_extent": "1-35 (1.875 ac)",
                    "is_subject": True,
                    "synthetic": True,
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [77.28100, 12.71960],
                        [77.28205, 12.71960],
                        [77.28205, 12.71898],
                        [77.28100, 12.71898],
                        [77.28100, 12.71960],
                    ]],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "survey_number": "84/2",
                    "label": "Sy 84/2 (Schedule B - Suresh R)",
                    "owner": "Suresh R",
                    "recorded_extent": "2-10 (2.25 ac)",
                    "is_subject": False,
                    "synthetic": True,
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [77.28205, 12.71960],
                        [77.28320, 12.71960],
                        [77.28320, 12.71898],
                        [77.28205, 12.71898],
                        [77.28205, 12.71960],
                    ]],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "survey_number": "83",
                    "label": "Sy 83 (Govt Halla / North)",
                    "owner": "Government Land",
                    "recorded_extent": "Buffer",
                    "is_subject": False,
                    "synthetic": True,
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [77.28100, 12.72005],
                        [77.28320, 12.72005],
                        [77.28320, 12.71960],
                        [77.28100, 12.71960],
                        [77.28100, 12.72005],
                    ]],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "survey_number": "85",
                    "label": "Sy 85 (Coconut Orchard / South)",
                    "owner": "Private Holding",
                    "recorded_extent": "3-00 (3.00 ac)",
                    "is_subject": False,
                    "synthetic": True,
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [77.28100, 12.71898],
                        [77.28320, 12.71898],
                        [77.28320, 12.71840],
                        [77.28100, 12.71840],
                        [77.28100, 12.71898],
                    ]],
                },
            },
        ],
    }
