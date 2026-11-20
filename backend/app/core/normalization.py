"""BhoomiAI Normalization Module
Handles extent conversions (acres/guntas/annas/ha/cents/sqft),
Kannada numeral conversion, and name transliteration & fuzzy matching.
"""

import re
from typing import Tuple, Optional, Dict, Any

# Kannada numerals mapping
KANNADA_DIGITS = {
    '೦': '0', '೧': '1', '೨': '2', '೩': '3', '೪': '4',
    '೫': '5', '೬': '6', '೭': '7', '೮': '8', '೯': '9'
}

def normalize_numerals(text: str) -> str:
    """Replaces Kannada numerals with ASCII Arabic numerals."""
    if not text:
        return ""
    result = text
    for kn_char, ar_char in KANNADA_DIGITS.items():
        result = result.replace(kn_char, ar_char)
    return result

# Extent conversion constants
# 1 Acre = 40 Guntas
# 1 Gunta = 16 Annas
# 1 Hectare = 2.47105 Acres
# 1 Acre = 100 Cents
# 1 Acre = 43560 Sq Ft
GUNTAS_PER_ACRE = 40.0
ANNAS_PER_GUNTA = 16.0
ANNAS_PER_ACRE = 640.0
HECTARES_TO_ACRES = 2.47105
CENTS_TO_ACRES = 0.01
SQFT_TO_ACRES = 1.0 / 43560.0

DEFAULT_EXTENT_TOLERANCE_ACRES = 0.01

def parse_extent_to_acres(extent_str: str) -> float:
    """Parses various land extent representations and returns decimal acres.
    
    Supported formats:
    - "2-15" or "2-15-0" (acres-guntas-annas)
    - "2 acres 15 guntas"
    - "2.375 acres"
    - "1.5 ha" / "1.5 hectares"
    - "150 cents"
    - "108900 sq ft" / "sqft"
    - Kannada versions: "೨-೧೫"
    """
    if not extent_str:
        return 0.0
    
    cleaned = normalize_numerals(str(extent_str).strip().lower())
    
    # Check for hectares
    ha_match = re.search(r'([\d\.]+)\s*(?:ha|hectares?|ಹೆಕ್ಟೇರ್)', cleaned)
    if ha_match:
        val = float(ha_match.group(1))
        return round(val * HECTARES_TO_ACRES, 4)
    
    # Check for cents
    cent_match = re.search(r'([\d\.]+)\s*(?:cents?|ಸೆಂಟ್)', cleaned)
    if cent_match:
        val = float(cent_match.group(1))
        return round(val * CENTS_TO_ACRES, 4)
    
    # Check for sq ft
    sqft_match = re.search(r'([\d\.]+)\s*(?:sq\s*ft|sqft|ಚದರಡಿ)', cleaned)
    if sqft_match:
        val = float(sqft_match.group(1))
        return round(val * SQFT_TO_ACRES, 4)
    
    # Check for "X acres Y guntas Z annas" or Kannada "X ಎಕರೆ Y ಗುಂಟೆ"
    word_pattern = re.search(
        r'(?:([\d\.]+)\s*(?:acres?|ac|ಎಕರೆ))?'
        r'\s*(?:([\d\.]+)\s*(?:guntas?|gunta|ಗುಂಟೆ))?'
        r'\s*(?:([\d\.]+)\s*(?:annas?|anna|ಆಣೆ))?',
        cleaned
    )
    if word_pattern and any(word_pattern.groups()):
        acres = float(word_pattern.group(1) or 0.0)
        guntas = float(word_pattern.group(2) or 0.0)
        annas = float(word_pattern.group(3) or 0.0)
        total_acres = acres + (guntas / GUNTAS_PER_ACRE) + (annas / ANNAS_PER_ACRE)
        return round(total_acres, 4)
    
    # Check for hyphen-separated format: X-Y or X-Y-Z (standard Karnataka Bhoomi format, supporting fractional guntas like 0-37.5)
    hyphen_pattern = re.search(r'(\d+(?:\.\d+)?)[\-\/:](\d+(?:\.\d+)?)(?:[\-\/:](\d+(?:\.\d+)?))?', cleaned)
    if hyphen_pattern:
        acres = float(hyphen_pattern.group(1))
        guntas = float(hyphen_pattern.group(2))
        annas = float(hyphen_pattern.group(3) or 0.0)
        total_acres = acres + (guntas / GUNTAS_PER_ACRE) + (annas / ANNAS_PER_ACRE)
        return round(total_acres, 4)
    
    # Fallback to plain float if possible
    try:
        match = re.search(r'[\d\.]+', cleaned)
        if match:
            return round(float(match.group(0)), 4)
    except Exception:
        pass
    
    return 0.0

def acres_to_karnataka_units(decimal_acres: float) -> Tuple[int, int, int]:
    """Converts decimal acres to (acres, guntas, annas)."""
    if decimal_acres < 0:
        return 0, 0, 0
    acres = int(decimal_acres)
    rem_guntas = (decimal_acres - acres) * GUNTAS_PER_ACRE
    guntas = int(rem_guntas)
    rem_annas = round((rem_guntas - guntas) * ANNAS_PER_GUNTA)
    if rem_annas >= 16:
        guntas += 1
        rem_annas = 0
    if guntas >= 40:
        acres += 1
        guntas = 0
    return acres, guntas, rem_annas

def format_extent(decimal_acres: float) -> str:
    """Formats decimal acres to canonical string 'X-Y-Z' and 'X acres Y guntas'."""
    a, g, an = acres_to_karnataka_units(decimal_acres)
    if an > 0:
        return f"{a}-{g}-{an} ({a} acres {g} guntas {an} annas)"
    return f"{a}-{g} ({a} acres {g} guntas)"

def extents_match(extent_a: float, extent_b: float, tolerance: float = DEFAULT_EXTENT_TOLERANCE_ACRES) -> bool:
    """Checks whether two extents match within documented tolerance (default 0.01 acre)."""
    return abs(extent_a - extent_b) <= tolerance

# Simple Kannada to English transliteration map for common land names
KANNADA_TRANSLIT = {
    'ರಾಮಯ್ಯ': 'ramaiah',
    'ರಾಮಚಂದ್ರಪ್ಪ': 'ramachandrappa',
    'ಸಾವಿತ್ರಮ್ಮ': 'savithramma',
    'ವೆಂಕಟೇಶ್': 'venkatesh',
    'ವೆಂಕಟೇಶ': 'venkatesh',
    'ಸುರೇಶ್': 'suresh',
    'ಸುರೇಶ': 'suresh',
    'ಲಕ್ಷ್ಮಿ': 'lakshmi',
    'ಕೃಷ್ಣಪ್ಪ': 'krishnappa',
    'ಮುನಿಯಪ್ಪ': 'muniyappa',
    'ನಾಗರಾಜು': 'nagaraju',
    'ನಾಗರಾಜ': 'nagaraju',
    'ಗೌಡ': 'gowda',
    'ಮಂಜುನಾಥ್': 'manjunath',
    'ಮಂಜುನಾಥ': 'manjunath',
    'ಬಸವರಾಜು': 'basavaraju',
    'ಬಸವರಾಜ': 'basavaraj',
    'ಶಿವಕುಮಾರ್': 'shivakumar',
    'ನಾರಾಯಣಪ್ಪ': 'narayanappa',
    'ರಂಗಪ್ಪ': 'rangappa',
    'ಹನುಮಂತಪ್ಪ': 'hanumanthappa',
    'ಕೆಂಪಯ್ಯ': 'kempaiah',
    'ಮಹೇಶ್': 'mahesh',
    'ಮಹೇಶ': 'mahesh',
    'ಸಿದ್ದಪ್ಪ': 'siddappa',
    'ರಮೇಶ್': 'ramesh',
    'ರಮೇಶ': 'ramesh',
}

HONORIFICS_REGEX = re.compile(
    r'(?:\b(?:sri|smt|shri|late|s/o|d/o|w/o|c/o|bin|kom)\b|(?:^|(?<=\s))(?:ಶ್ರೀಮತಿ|ಶ್ರೀ|ಲೇಟ್|ಬಿನ್|ಕೋಂ)(?=\s|$))',
    re.IGNORECASE
)

def normalize_name(name: str) -> str:
    """Cleans up name string by stripping honorifics, punctuation, and normalizing spaces."""
    if not name:
        return ""
    cleaned = name.strip()
    # Replace longer Kannada tokens first so virama suffixes don't leave trailing marks
    for kn, en in sorted(KANNADA_TRANSLIT.items(), key=lambda kv: len(kv[0]), reverse=True):
        if kn in cleaned:
            cleaned = cleaned.replace(kn, en)
    
    cleaned = HONORIFICS_REGEX.sub('', cleaned)
    cleaned = re.sub(r'[\.\,\-\_\(\)]', ' ', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip().lower()
    return cleaned

def jaro_winkler_similarity(s1: str, s2: str) -> float:
    """Computes Jaro-Winkler similarity between two strings."""
    if s1 == s2:
        return 1.0
    if not s1 or not s2:
        return 0.0
    
    len1, len2 = len(s1), len(s2)
    match_distance = (max(len1, len2) // 2) - 1
    
    s1_matches = [False] * len1
    s2_matches = [False] * len2
    matches = 0
    
    for i in range(len1):
        start = max(0, i - match_distance)
        end = min(i + match_distance + 1, len2)
        for j in range(start, end):
            if not s2_matches[j] and s1[i] == s2[j]:
                s1_matches[i] = True
                s2_matches[j] = True
                matches += 1
                break
                
    if matches == 0:
        return 0.0
        
    transpositions = 0
    k = 0
    for i in range(len1):
        if s1_matches[i]:
            while not s2_matches[k]:
                k += 1
            if s1[i] != s2[k]:
                transpositions += 1
            k += 1
            
    jaro = (
        (matches / len1) +
        (matches / len2) +
        ((matches - transpositions / 2) / matches)
    ) / 3.0
    
    # Winkler bonus for common prefix up to 4 characters
    prefix = 0
    for i in range(min(4, min(len1, len2))):
        if s1[i] == s2[i]:
            prefix += 1
        else:
            break
            
    # Gentle Winkler prefix weight (p=0.05) avoids false auto-merges on Karnataka
    # names sharing a 4-char root with distinct suffixes (e.g. Ramayya/Ramaiah, Kempaiah/Kemparaju).
    return round(jaro + prefix * 0.05 * (1.0 - jaro), 4)

def match_names(name1: str, name2: str) -> Tuple[bool, float, str]:
    """Compares two names and returns (is_match, similarity_score, status_message).
    Thresholds:
    - score >= 0.88 -> Strong match
    - 0.68 <= score < 0.88 -> Candidate / requires reviewer confirmation
    - score < 0.68 -> Different individuals
    """
    n1 = normalize_name(name1)
    n2 = normalize_name(name2)
    
    if n1 == n2 and len(n1) > 0:
        return True, 1.0, "Exact match"
        
    score = jaro_winkler_similarity(n1, n2)
    
    # Also check token set overlap
    tokens1 = set(n1.split())
    tokens2 = set(n2.split())
    if tokens1 and tokens2:
        overlap = len(tokens1.intersection(tokens2)) / max(len(tokens1), len(tokens2))
        score = max(score, overlap)
        
    if score >= 0.88:
        return True, score, "High confidence match"
    elif score >= 0.68:
        return False, score, "Uncertain candidate match - requires human confirmation"
    else:
        return False, score, "Distinct individuals"
