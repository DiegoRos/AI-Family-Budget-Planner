from pydantic import BaseModel
from datetime import date, datetime
from typing import List, Optional

class ExpenseBase(BaseModel):
    date: date
    amount: float
    description: str
    category: str
    person: str
    month_id: Optional[int] = None

class ExpenseCreate(ExpenseBase):
    pass

class Expense(ExpenseBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class IncomeBase(BaseModel):
    date: date
    amount: float
    description: str
    category: str
    person: str
    month_id: Optional[int] = None

class IncomeCreate(IncomeBase):
    pass

class Income(IncomeBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class BudgetBase(BaseModel):
    month_id: int
    category: str
    type: str
    planned_amount: float

class BudgetCreate(BudgetBase):
    pass

class Budget(BudgetBase):
    id: int

    class Config:
        from_attributes = True

class MonthBase(BaseModel):
    year: int
    month: int
    is_frozen: bool = False
    start_balance: float = 0.0
    end_balance: float = 0.0
    notes: Optional[str] = None

class MonthCreate(MonthBase):
    pass

class Month(MonthBase):
    id: int
    expenses: List[Expense] = []
    incomes: List[Income] = []
    budgets: List[Budget] = []

    class Config:
        from_attributes = True
