from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from database.db import get_db
from database import models
from schemas import schemas
from database.seed import seed_budgets_for_month

router = APIRouter(prefix="/months", tags=["months"])

def get_or_create_month_for_date(d: date, db: Session) -> models.Month:
    """Return the Month for (d.year, d.month), creating it if it doesn't exist.

    Unlike create_month, this never raises on an existing month — it is a
    get-or-create. Newly created months are unfrozen with zero balances and
    are auto-seeded with the base budget rows.
    """
    db_month = db.query(models.Month).filter(
        models.Month.year == d.year,
        models.Month.month == d.month
    ).first()
    if db_month:
        return db_month

    new_month = models.Month(
        year=d.year,
        month=d.month,
        is_frozen=False,
        start_balance=0,
        end_balance=0,
    )
    db.add(new_month)
    db.commit()
    db.refresh(new_month)
    seed_budgets_for_month(new_month.id, db)
    return new_month

@router.post("/", response_model=schemas.Month)
def create_month(month: schemas.MonthCreate, db: Session = Depends(get_db)):
    db_month = db.query(models.Month).filter(
        models.Month.year == month.year, 
        models.Month.month == month.month
    ).first()
    if db_month:
        raise HTTPException(status_code=400, detail="Month already exists")
    
    new_month = models.Month(**month.dict())
    db.add(new_month)
    db.commit()
    db.refresh(new_month)
    seed_budgets_for_month(new_month.id, db)
    return new_month

@router.get("/", response_model=List[schemas.Month])
def read_months(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Month).offset(skip).limit(limit).all()

@router.get("/{month_id}", response_model=schemas.Month)
def read_month(month_id: int, db: Session = Depends(get_db)):
    db_month = db.query(models.Month).filter(models.Month.id == month_id).first()
    if db_month is None:
        raise HTTPException(status_code=404, detail="Month not found")
    return db_month

@router.patch("/{month_id}/freeze", response_model=schemas.Month)
def toggle_freeze(month_id: int, freeze: bool, db: Session = Depends(get_db)):
    db_month = db.query(models.Month).filter(models.Month.id == month_id).first()
    if db_month is None:
        raise HTTPException(status_code=404, detail="Month not found")
    
    db_month.is_frozen = freeze
    db.commit()
    db.refresh(db_month)
    return db_month
