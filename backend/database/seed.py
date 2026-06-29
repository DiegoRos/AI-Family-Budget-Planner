import os
import json
from sqlalchemy.orm import Session
from database.db import SessionLocal
from database import models
from datetime import datetime


# Canonical base budget targets. Used to auto-seed any new month (or any
# month with no budgets yet). Keep this as the single source of truth.
BASE_BUDGET_TARGETS = {
    "expense": {
        "Rent": 5750,
        "Utilities": 150,
        "Groceries": 800,
        "Transportation": 400,
        "Health/Medical": 405,
        "Mobile/Wifi": 235.43,
        "Laundry/Dry Cleaners": 300,
        "Subscriptions": 185,
        "Entertainment": 400,
        "Miscellaneous": 295,
        "Personal Ana": 500,
        "Personal Diego": 300,
        "Travel": 0,
    },
    "income": {
        "Paycheck Ana": 9300,
        "Paycheck Diego": 5100,
        "Passive Income": 3750,
    },
}


def _load_base_budget():
    raw = os.getenv("BUDGET_CONFIG")
    if raw:
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass
    return BASE_BUDGET_TARGETS


def seed_budgets_for_month(month_id: int, db: Session):
    existing_count = db.query(models.Budget).filter(
        models.Budget.month_id == month_id
    ).count()
    if existing_count > 0:
        return

    base_budget = _load_base_budget()
    for budget_type, categories in base_budget.items():
        for category, amount in categories.items():
            db.add(models.Budget(
                month_id=month_id,
                category=category,
                type=budget_type,
                planned_amount=amount,
            ))

    db.commit()


def seed_data():
    db = SessionLocal()
    try:
        now = datetime.now()
        db_month = db.query(models.Month).filter(
            models.Month.year == now.year,
            models.Month.month == now.month
        ).first()

        if not db_month:
            db_month = models.Month(
                year=now.year,
                month=now.month,
                is_frozen=False,
                start_balance=0.0,
                notes="Initial seeded month"
            )
            db.add(db_month)
            db.commit()
            db.refresh(db_month)
            print(f"Created month {now.month}/{now.year}")

        seed_budgets_for_month(db_month.id, db)
        print("Successfully seeded categories and initial month.")

    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
