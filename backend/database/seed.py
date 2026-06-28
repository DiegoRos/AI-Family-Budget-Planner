from sqlalchemy.orm import Session
from database.db import SessionLocal, engine
from database import models
from datetime import datetime

EXPENSE_CATEGORIES = [
    "Rent", "Utilities", "Groceries", "Transportation", "Health/Medical",
    "Mobile/Wifi", "Laundry/Dry Cleaners", "Subscriptions", "Entertainment",
    "Miscellaneous", "Personal Ana", "Personal Diego", "Travel", "Other"
]

INCOME_CATEGORIES = [
    "Paycheck Ana", "Paycheck Diego", "Passive Income",
    "Bonus Ana", "Bonus Diego", "Other"
]

def seed_data():
    db = SessionLocal()
    try:
        # Create a default month if none exists (Current Month)
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

        # Seed Budgets for this month if they don't exist
        for cat in EXPENSE_CATEGORIES:
            existing = db.query(models.Budget).filter(
                models.Budget.month_id == db_month.id,
                models.Budget.category == cat,
                models.Budget.type == "expense"
            ).first()
            if not existing:
                db.add(models.Budget(
                    month_id=db_month.id,
                    category=cat,
                    type="expense",
                    planned_amount=0.0
                ))

        for cat in INCOME_CATEGORIES:
            existing = db.query(models.Budget).filter(
                models.Budget.month_id == db_month.id,
                models.Budget.category == cat,
                models.Budget.type == "income"
            ).first()
            if not existing:
                db.add(models.Budget(
                    month_id=db_month.id,
                    category=cat,
                    type="income",
                    planned_amount=0.0
                ))

        db.commit()
        print("Successfully seeded categories and initial month.")

    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
