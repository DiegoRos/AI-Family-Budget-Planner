from sqlalchemy import Column, Integer, String, Float, Boolean, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .db import Base

class Month(Base):
    __tablename__ = "months"

    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    is_frozen = Column(Boolean, default=False)
    start_balance = Column(Float, default=0.0)
    end_balance = Column(Float, default=0.0)
    notes = Column(String, nullable=True)

    expenses = relationship("Expense", back_populates="month")
    incomes = relationship("Income", back_populates="month")
    budgets = relationship("Budget", back_populates="month")

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    amount = Column(Float, nullable=False)
    description = Column(String, nullable=False)
    category = Column(String, nullable=False)
    person = Column(String, nullable=False) # "Ana", "Diego", "Ana/Diego"
    month_id = Column(Integer, ForeignKey("months.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    month = relationship("Month", back_populates="expenses")

class Income(Base):
    __tablename__ = "income"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    amount = Column(Float, nullable=False)
    description = Column(String, nullable=False)
    category = Column(String, nullable=False)
    person = Column(String, nullable=False) # "Ana", "Diego", "Ana/Diego"
    month_id = Column(Integer, ForeignKey("months.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    month = relationship("Month", back_populates="incomes")

class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    month_id = Column(Integer, ForeignKey("months.id"))
    category = Column(String, nullable=False)
    type = Column(String, nullable=False) # "expense" or "income"
    planned_amount = Column(Float, nullable=False)

    month = relationship("Month", back_populates="budgets")
