"""Heuristic + LLM-assisted page filtering for statement documents.

Statements typically open with 1-2 account-summary pages, then a transaction
section flagged by markers like "Transaction Detail", "New Charges" or
"Detail Continued", possibly spanning several pages. Feeding the summary,
marketing and disclosure pages to the LLM adds noise and risks exceeding the
model context (silently truncating transactions).

This module selects only the pages that look like they contain transactions.
The decision is heuristic-first (fast, deterministic, zero LLM cost) with an
optional LLM classifier used ONLY for genuinely ambiguous pages.
"""

import re
from dataclasses import dataclass, field
from typing import Callable, List, Optional

# Section markers that introduce or continue a transaction listing.
# Case-insensitive; add new statement phrasings here as they show up.
SECTION_MARKERS = [
    r"transaction\s+detail",
    r"detail\s+continued",
    r"continued\s+detail",
    r"\bnew\s+charges\b",
    r"\btransactions\b",
    r"account\s+activity",
    r"purchases\s+and\s+adjustments",
    r"payments\s+and\s+credits",
    r"activity\s+detail",
]
_MARKER_RE = re.compile("|".join(SECTION_MARKERS), re.IGNORECASE)

# A date-like token: 01/15, 1/15/24, 01/15/2024, 2024-01-15, or "Jan 15".
_DATE_RE = re.compile(
    r"(\b\d{1,2}/\d{1,2}(?:/\d{2,4})?\b)"
    r"|(\b\d{4}-\d{2}-\d{2}\b)"
    r"|(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}\b)",
    re.IGNORECASE,
)
# An amount-like token: 1,234.56 / -45.00 / $9.99
_AMOUNT_RE = re.compile(r"-?\$?\d{1,3}(?:,\d{3})*\.\d{2}\b")

# A line counts as a transaction row only if it has BOTH a date and an amount.
DENSITY_KEEP_THRESHOLD = 3   # >= this many rows -> keep without asking the LLM
AMBIGUOUS_MIN_ROWS = 1       # 1..(threshold-1) rows + no marker -> ambiguous

# Type of the optional classifier: (snippet, row_count) -> bool
Classifier = Callable[[str, int], bool]


@dataclass
class PageDecision:
    index: int          # 0-based page index
    keep: bool
    row_count: int
    has_marker: bool
    reason: str         # "marker" | "density" | "llm" | "skip" | "fallback"


@dataclass
class SelectionResult:
    selected_indices: List[int] = field(default_factory=list)
    decisions: List[PageDecision] = field(default_factory=list)
    used_fallback: bool = False
    total_pages: int = 0

    @property
    def note(self) -> str:
        return _build_note(self)


def _count_transaction_rows(page_text: str) -> int:
    rows = 0
    for line in page_text.splitlines():
        if _DATE_RE.search(line) and _AMOUNT_RE.search(line):
            rows += 1
    return rows


def _classify_page(page_text: str, classifier: Optional[Classifier]) -> PageDecision:
    """Decide a single page (index filled in by the caller)."""
    has_marker = bool(_MARKER_RE.search(page_text))
    row_count = _count_transaction_rows(page_text)

    # Clear keeps.
    if has_marker:
        return PageDecision(-1, True, row_count, has_marker, "marker")
    if row_count >= DENSITY_KEEP_THRESHOLD:
        return PageDecision(-1, True, row_count, has_marker, "density")

    # Clear skip: no marker and no money rows at all.
    if row_count < AMBIGUOUS_MIN_ROWS:
        return PageDecision(-1, False, row_count, has_marker, "skip")

    # Ambiguous: a little signal, no marker. Ask the LLM if we have one.
    if classifier is not None:
        snippet = page_text[:300]
        keep = classifier(snippet, row_count)
        return PageDecision(-1, keep, row_count, has_marker, "llm")

    # No classifier available -> fail open, keep the ambiguous page.
    return PageDecision(-1, True, row_count, has_marker, "llm")


def select_transaction_pages(
    pages: List[str],
    classifier: Optional[Classifier] = None,
) -> SelectionResult:
    """Return which pages should be sent to the extractor.

    ``pages`` is the per-page text (one entry per page). ``classifier`` is an
    optional ``is_transaction_page(snippet, row_count) -> bool`` used only for
    ambiguous pages. If nothing is selected, fall back to ALL pages so we never
    return an empty document.
    """
    result = SelectionResult(total_pages=len(pages))

    for i, page_text in enumerate(pages):
        decision = _classify_page(page_text or "", classifier)
        decision.index = i
        result.decisions.append(decision)
        if decision.keep:
            result.selected_indices.append(i)

    # Safety net: never drop the whole document.
    if not result.selected_indices and pages:
        result.used_fallback = True
        result.selected_indices = list(range(len(pages)))
        for d in result.decisions:
            d.keep = True
            d.reason = "fallback"

    return result


def _format_ranges(indices: List[int]) -> str:
    """Turn [1,2,4] (0-based) into a human '2-3, 5' (1-based) string."""
    if not indices:
        return "none"
    ones = sorted(i + 1 for i in indices)
    ranges = []
    start = prev = ones[0]
    for n in ones[1:]:
        if n == prev + 1:
            prev = n
            continue
        ranges.append((start, prev))
        start = prev = n
    ranges.append((start, prev))
    return ", ".join(f"{a}-{b}" if a != b else f"{a}" for a, b in ranges)


def _build_note(result: SelectionResult) -> str:
    total = result.total_pages
    if total <= 1:
        return f"used {total} page" + ("" if total == 1 else "s")
    if result.used_fallback:
        return f"no transaction pages detected, used all {total} pages"
    return f"used pages {_format_ranges(result.selected_indices)} of {total}"
