from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database.db import get_db
from database import models
from schemas import schemas

router = APIRouter(prefix="/budgets", tags=["budgets"])

def check_month_not_frozen(month_id: int, db: Session):
    month = db.query(models.Month).filter(models.Month.id == month_id).first()
    if month and month.is_frozen:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify budgets for a frozen month"
        )

@router.post("/", response_model=schemas.Budget)
def create_or_update_budget(budget: schemas.BudgetCreate, db: Session = Depends(get_db)):
    check_month_not_frozen(budget.month_id, db)
    
    db_budget = db.query(models.Budget).filter(
        models.Budget.month_id == budget.month_id,
        models.Budget.category == budget.category
    ).first()
    
    if db_budget:
        db_budget.planned_amount = budget.planned_amount
        db_budget.type = budget.type
    else:
        db_budget = models.Budget(**budget.model_dump())
        db.add(db_budget)
    
    db.commit()
    db.refresh(db_budget)
    return db_budget

@router.get("/{month_id}", response_model=List[schemas.Budget])
def get_budgets_by_month(month_id: int, db: Session = Depends(get_db)):
    return db.query(models.Budget).filter(models.Budget.month_id == month_id).all()

@router.delete("/{budget_id}")
def delete_budget(budget_id: int, db: Session = Depends(get_db)):
    db_budget = db.query(models.Budget).filter(models.Budget.id == budget_id).first()
    if not db_budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    check_month_not_frozen(db_budget.month_id, db)

    db.delete(db_budget)
    db.commit()
    return {"message": "Budget deleted successfully"}

@router.post("/seed/{month_id}", response_model=List[schemas.Budget])
def seed_month_budgets(month_id: int, db: Session = Depends(get_db)):
    check_month_not_frozen(month_id, db)
    month = db.query(models.Month).filter(models.Month.id == month_id).first()
    if not month:
        raise HTTPException(status_code=404, detail="Month not found")
    from database.seed import seed_budgets_for_month
    seed_budgets_for_month(month_id, db)
    return db.query(models.Budget).filter(models.Budget.month_id == month_id).all()
