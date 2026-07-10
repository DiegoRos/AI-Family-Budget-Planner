"""One-time (idempotent) repair script: re-bucket transactions to the correct month.

For every Expense and Income row, compute the correct month from the row's own
`date` (via get_or_create_month_for_date) and update `month_id` ONLY where it
differs from the current value.

This script is strictly non-destructive: it NEVER deletes rows and only updates
the `month_id` foreign key. It is safe to re-run — a second run reports 0 changes.

Run as a module (from the backend/ directory):
    python -m scripts.rebucket_months

Or directly:
    python scripts/rebucket_months.py
"""
import os
import sys

# Allow running directly (python scripts/rebucket_months.py) by ensuring the
# backend dir (parent of this scripts/ dir) is importable, mirroring how the
# app imports `from database.db import ...`.
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from database.db import SessionLocal
from database import models
from routers.months import get_or_create_month_for_date


def rebucket_months():
    db = SessionLocal()
    changed = 0
    try:
        for model, label in ((models.Expense, "Expense"), (models.Income, "Income")):
            rows = db.query(model).all()
            for row in rows:
                correct_month = get_or_create_month_for_date(row.date, db)
                if row.month_id != correct_month.id:
                    print(
                        f"{label} id={row.id} date={row.date} "
                        f"month_id {row.month_id} -> {correct_month.id}"
                    )
                    row.month_id = correct_month.id
                    changed += 1

        if changed:
            db.commit()

        print(f"Total rows changed: {changed}")
        return changed
    finally:
        db.close()


if __name__ == "__main__":
    rebucket_months()
