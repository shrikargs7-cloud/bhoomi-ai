"""BhoomiAI API Router Aggregator
Composes domain-specific routers cleanly under the '/api' prefix.
"""

from fastapi import APIRouter

from app.api.routers.auth import router as auth_router
from app.api.routers.cases import router as cases_router
from app.api.routers.documents import router as documents_router
from app.api.routers.analysis import router as analysis_router
from app.api.routers.gis_valuation import router as gis_valuation_router
from app.api.routers.reports import router as reports_router

router = APIRouter(prefix="/api")

router.include_router(auth_router, tags=["Auth & Health"])
router.include_router(cases_router, tags=["Land Cases"])
router.include_router(documents_router, tags=["Documents & Field Corrections"])
router.include_router(analysis_router, tags=["Ownership, Discrepancies, Legal & Evaluation"])
router.include_router(gis_valuation_router, tags=["GIS QA, Valuation & Tools"])
router.include_router(reports_router, tags=["Reports"])
