from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database.db import get_db
from database import models
from schemas import schemas

router = APIRouter(prefix="/transactions", tags=["transactions"])

def check_frozen(month_id: int, db: Session):
    db_month = db.query(models.Month).filter(models.Month.id == month_id).first()
    if db_month and db_month.is_frozen:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Cannot modify transactions in a frozen month"
        )

# Expenses
@router.post("/expenses/", response_model=schemas.Expense)
def create_expense(expense: schemas.ExpenseCreate, db: Session = Depends(get_db)):
    check_frozen(expense.month_id, db)
    db_expense = models.Expense(**expense.dict())
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense

@router.put("/expenses/{expense_id}", response_model=schemas.Expense)
def update_expense(expense_id: int, expense: schemas.ExpenseCreate, db: Session = Depends(get_db)):
    db_expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    check_frozen(db_expense.month_id, db)
    check_frozen(expense.month_id, db)
    for key, value in expense.dict().items():
        setattr(db_expense, key, value)
    db.commit()
    db.refresh(db_expense)
    return db_expense

@router.delete("/expenses/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    db_expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    check_frozen(db_expense.month_id, db)
    db.delete(db_expense)
    db.commit()
    return {"message": "Expense deleted"}

# Income
@router.post("/income/", response_model=schemas.Income)
def create_income(income: schemas.IncomeCreate, db: Session = Depends(get_db)):
    check_frozen(income.month_id, db)
    db_income = models.Income(**income.dict())
    db.add(db_income)
    db.commit()
    db.refresh(db_income)
    return db_income

@router.put("/income/{income_id}", response_model=schemas.Income)
def update_income(income_id: int, income: schemas.IncomeCreate, db: Session = Depends(get_db)):
    db_income = db.query(models.Income).filter(models.Income.id == income_id).first()
    if not db_income:
        raise HTTPException(status_code=404, detail="Income not found")
    check_frozen(db_income.month_id, db)
    check_frozen(income.month_id, db)
    for key, value in income.dict().items():
        setattr(db_income, key, value)
    db.commit()
    db.refresh(db_income)
    return db_income

@router.delete("/income/{income_id}")
def delete_income(income_id: int, db: Session = Depends(get_db)):
    db_income = db.query(models.Income).filter(models.Income.id == income_id).first()
    if not db_income:
        raise HTTPException(status_code=404, detail="Income not found")
    check_frozen(db_income.month_id, db)
    db.delete(db_income)
    db.commit()
    return {"message": "Income deleted"}
