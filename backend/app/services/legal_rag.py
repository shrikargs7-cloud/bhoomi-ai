"""BhoomiAI Curated Legal Reference Engine (SPEC Section 12)
Grounded strictly in verified statutory provisions for Karnataka land records.
Abstains whenever no curated authoritative provision supports the query.
"""

from typing import List
from app.models.schemas import LegalQueryResponse, LegalSourceItem
from app.workflows.verifier import verify_legal_response

CURATED_STATUTORY_CORPUS = [
    {
        "id": "LAW-KLRA-128",
        "title": "Karnataka Land Revenue Act, 1964 (and Rules, 1966)",
        "jurisdiction": "Karnataka State",
        "section": "Sections 128, 129 & 135; Rule 42–66",
        "retrieval_date": "2026-11-15 (Curated Offline Reference)",
        "keywords": ["rtc", "pahani", "mutation", "khata", "pauti", "inheritance", "succession", "deceased", "death", "report", "tahsildar", "acquisition", "discrepancy", "record"],
        "summary": (
            "Section 128 requires any person acquiring right by succession, survivorship, inheritance, partition, purchase, "
            "or mortgage to report acquisition to the prescribed officer (or via Sub-Registrar J-slip). Section 129 governs "
            "the Register of Mutations and certification after notice/objections. Under Section 133, RTC entries carry a "
            "presumption of correctness until lawfully amended or displaced by a civil court declaration."
        ),
    },
    {
        "id": "LAW-REG-17",
        "title": "Registration Act, 1908",
        "jurisdiction": "India (Central Act applicable in Karnataka)",
        "section": "Sections 17 & 49",
        "retrieval_date": "2026-11-15 (Curated Offline Reference)",
        "keywords": ["partition", "sale", "deed", "registration", "registered", "unregistered", "instrument", "sub-registrar", "sro", "immovable"],
        "summary": (
            "Section 17(1) mandates compulsory registration of non-testamentary instruments creating, declaring, assigning, "
            "limiting, or extinguishing right, title, or interest in immovable property valued at Rs. 100 or upwards "
            "(including sale deeds, partition deeds, and simple mortgages). Under Section 49, an unregistered document "
            "required to be registered under Section 17 cannot affect immovable property or be received as evidence of any transaction affecting it."
        ),
    },
    {
        "id": "LAW-TPA-54",
        "title": "Transfer of Property Act, 1882",
        "jurisdiction": "India (Central Act)",
        "section": "Sections 54, 58 & 60",
        "retrieval_date": "2026-11-15 (Curated Offline Reference)",
        "keywords": ["mortgage", "encumbrance", "charge", "bank", "loan", "noc", "discharge", "sale", "transfer", "redemption", "hypothecation"],
        "summary": (
            "Section 54 defines sale of immovable property and requires a registered instrument for transfers >= Rs. 100. "
            "Section 58 defines mortgages and charges; when a mortgage is recorded in revenue Column 11, Section 60 governs "
            "the mortgagor's right of redemption and discharge upon repayment via a registered receipt/reconveyance or bank NOC."
        ),
    },
    {
        "id": "LAW-HSA-6",
        "title": "Hindu Succession Act, 1956 (as amended 2005)",
        "jurisdiction": "India (Central Act)",
        "section": "Sections 6 & 8",
        "retrieval_date": "2026-11-15 (Curated Offline Reference)",
        "keywords": ["heir", "heirs", "coparcener", "daughter", "son", "ancestral", "family", "vamsha", "vruksha", "intestate", "partition", "share"],
        "summary": (
            "Section 6 confers coparcenary rights by birth equally on daughters and sons in joint family property. "
            "Section 8 prescribes the Class I legal heirs (widow, sons, daughters, mother) for devolution of separate "
            "property of a male Hindu dying intestate. A family tree alone demonstrates kinship; mutation requires formal application and notice."
        ),
    },
    {
        "id": "LAW-KLR-1974",
        "title": "Karnataka Land Reforms Act, 1961 (Act 10 of 1962 / amended 1974)",
        "jurisdiction": "Karnataka State",
        "section": "Sections 63, 79A/79B (omitted 2020) & Section 80",
        "retrieval_date": "2026-11-15 (Curated Offline Reference)",
        "keywords": ["agricultural", "ceiling", "reforms", "tenant", "grant", "ptcl", "79a", "79b", "80", "conversion", "extent"],
        "summary": (
            "Governs agricultural land ceiling limits (Section 63) and tenancy protections. Note that Karnataka Ordinance/Act "
            "2020 omitted Sections 79A, 79B, and 79C prospectively/retrospectively subject to pending proceedings, while "
            "SC/ST granted land restrictions under the Karnataka PTCL Act 1978 remain distinct and require verification."
        ),
    },
    {
        "id": "LAW-KSA-1957",
        "title": "Karnataka Stamp Act, 1957",
        "jurisdiction": "Karnataka State",
        "section": "Article 20 (Conveyance) & Article 39 (Partition)",
        "retrieval_date": "2026-11-15 (Curated Offline Reference)",
        "keywords": ["stamp", "duty", "guidance", "valuation", "partition", "fee", "undervaluation", "45a"],
        "summary": (
            "Specifies stamp duty rates on instruments executed in Karnataka, including concessional fixed/family rates "
            "for family partitions among family members under Article 39 and market-value-based duties under Section 45A."
        ),
    },
    {
        "id": "LAW-BHOOMI-PROC",
        "title": "Karnataka Revenue Dept — Bhoomi / Mojini Mutation & Phodi Procedure",
        "jurisdiction": "Karnataka State",
        "section": "Pauti Khata & 11E / Tatkal Phodi Guidelines",
        "retrieval_date": "2026-11-15 (Curated Offline Reference)",
        "keywords": ["bhoomi", "mojini", "11e", "phodi", "tippani", "sketch", "survey", "extent", "mismatch", "boundary", "akarband", "nadakacheri"],
        "summary": (
            "For extent mismatches between registered partition/sale deeds and RTC, Mojini 11E / Tatkal Phodi survey "
            "reconciles hissa boundaries against the village Akarband and Tippani. For deceased owners, Pauti Khata "
            "must be initiated at Nadakacheri (Atalji Janasnehi Kendra) with Death Certificate and Family Tree (Vamsha Vruksha)."
        ),
    },
    {
        "id": "LAW-DPDP-2023",
        "title": "Digital Personal Data Protection Act, 2023",
        "jurisdiction": "India",
        "section": "Sections 4, 6 & 8",
        "retrieval_date": "2026-11-15 (Curated Offline Reference)",
        "keywords": ["privacy", "consent", "data", "aadhaar", "personal", "dpdp", "security", "llm"],
        "summary": (
            "Requires clear, specific, informed consent (Section 6) before processing personal data such as owner Aadhaar/IDs "
            "or transmitting personal land records to third-party services, along with strict purpose limitation and safeguards."
        ),
    },
]


def list_curated_sources() -> List[LegalSourceItem]:
    return [
        LegalSourceItem(
            id=s["id"],
            title=s["title"],
            jurisdiction=s["jurisdiction"],
            section=s["section"],
            retrieval_date=s["retrieval_date"],
            summary=s["summary"],
        )
        for s in CURATED_STATUTORY_CORPUS
    ]


def query_legal_reference(query: str) -> LegalQueryResponse:
    q = (query or "").strip().lower()
    if not q or len(q) < 3:
        return LegalQueryResponse(
            abstained=True,
            explanation="Please enter a specific question about Karnataka land records, mutation, partition, encumbrance, or extent discrepancies.",
            jurisdiction="Karnataka / India",
            limitations="Query too short to match curated statutory sources.",
            referral="Consult a licensed Karnataka land advocate or Revenue Taluk Office for specific legal advice.",
            matched_sources=[],
        )

    tokens = set(w.strip("?,.;:()[]'\"") for w in q.split() if len(w) >= 2)
    scored = []
    for src in CURATED_STATUTORY_CORPUS:
        kw_hits = sum(1 for kw in src["keywords"] if kw in q or kw in tokens)
        title_hits = sum(1 for tok in tokens if len(tok) >= 4 and tok in src["title"].lower())
        score = kw_hits * 2 + title_hits
        if score > 0:
            scored.append((score, src))

    scored.sort(key=lambda x: x[0], reverse=True)

    if not scored:
        return LegalQueryResponse(
            abstained=True,
            explanation=(
                "The procedure or statutory answer for this specific query cannot be established from the "
                "curated BhoomiAI legal reference corpus (<=15 verified statutory documents). BhoomiAI abstains "
                "rather than fabricating sections or case law."
            ),
            jurisdiction="Karnataka / India",
            source=None,
            section_or_page=None,
            retrieval_date=None,
            limitations="Curated reference covers Karnataka Land Revenue Act 1964, Registration Act 1908, TPA 1882, HSA 1956, Stamp Act 1957, Bhoomi/Mojini procedures, and DPDP Act 2023 only.",
            referral="Refer this question to a qualified property advocate practicing before Karnataka Revenue Courts.",
            matched_sources=[],
        )

    top_sources = [s for _, s in scored[:2]]
    primary = top_sources[0]
    response = LegalQueryResponse(
        abstained=False,
        explanation=primary["summary"],
        jurisdiction=primary["jurisdiction"],
        source=primary["title"],
        section_or_page=primary["section"],
        retrieval_date=primary["retrieval_date"],
        limitations="Informational statutory summary only — NOT a legal title opinion or advocate search report.",
        referral="Verify applicability to your exact survey parcel with a licensed advocate or Jurisdictional Tahsildar.",
        matched_sources=[
            LegalSourceItem(
                id=s["id"],
                title=s["title"],
                jurisdiction=s["jurisdiction"],
                section=s["section"],
                retrieval_date=s["retrieval_date"],
                summary=s["summary"],
            )
            for s in top_sources
        ],
    )
    return verify_legal_response(response, CURATED_STATUTORY_CORPUS)
