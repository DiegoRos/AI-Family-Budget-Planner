import os
import json
from fastapi import APIRouter

router = APIRouter(prefix="/config", tags=["config"])

def _load_budget_config():
    raw = os.getenv("BUDGET_CONFIG", "{}")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}

@router.get("/")
def get_config():
    budget_config = _load_budget_config()
    return {
        "expense_categories": list(budget_config.get("expense", {}).keys()),
        "income_categories": list(budget_config.get("income", {}).keys()),
        "base_budget": budget_config,
    }
