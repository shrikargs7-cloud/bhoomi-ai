import pytest
from app.core.normalization import (
    normalize_numerals,
    parse_extent_to_acres,
    acres_to_karnataka_units,
    format_extent,
    extents_match,
    normalize_name,
    match_names,
)

def test_kannada_numerals():
    assert normalize_numerals("೧೨೩೪೫") == "12345"
    assert normalize_numerals("ಸಮೀಕ್ಷೆ ೮೪/೧") == "ಸಮೀಕ್ಷೆ 84/1"
    assert normalize_numerals("೨-೧೫") == "2-15"

def test_karnataka_extent_parsing():
    # 2 acres 0 guntas
    assert parse_extent_to_acres("2-0") == 2.0
    # 2 acres 20 guntas = 2.5 acres
    assert parse_extent_to_acres("2-20") == 2.5
    # 1 acre 10 guntas = 1.25 acres
    assert parse_extent_to_acres("1-10") == 1.25
    # Kannada numerals
    assert parse_extent_to_acres("೨-೨೦") == 2.5
    # Word format
    assert parse_extent_to_acres("2 acres 15 guntas") == round(2.0 + 15/40.0, 4)
    # Hectares: 1 ha = 2.4711 acres
    assert abs(parse_extent_to_acres("1 ha") - 2.4711) < 0.01
    # Cents: 100 cents = 1.0 acre
    assert parse_extent_to_acres("100 cents") == 1.0
    # Sq ft: 43560 sq ft = 1.0 acre
    assert parse_extent_to_acres("43560 sqft") == 1.0

def test_extent_formatting():
    acres, guntas, annas = acres_to_karnataka_units(2.5)
    assert acres == 2
    assert guntas == 20
    assert annas == 0
    assert "2-20" in format_extent(2.5)

def test_extent_matching():
    # Extents within 0.01 tolerance
    assert extents_match(2.375, 2.376, tolerance=0.01) is True
    # Extent mismatch beyond tolerance
    assert extents_match(2.375, 1.875, tolerance=0.01) is False

def test_name_matching():
    # Exact match after honorific removal
    is_match, score, msg = match_names("Sri Ramachandrappa", "Late Ramachandrappa")
    assert is_match is True
    assert score >= 0.88

    # Transliterated Kannada match
    is_match, score, msg = match_names("ರಾಮಚಂದ್ರಪ್ಪ", "Ramachandrappa")
    assert is_match is True

    # Uncertain candidate
    is_match, score, msg = match_names("Ramayya", "Ramaiah")
    assert score >= 0.70

    # Distinct individuals
    is_match, score, msg = match_names("Ramachandrappa", "Suresh Kumar")
    assert is_match is False
    assert score < 0.60
