from fastapi import APIRouter

from database.seed import _load_base_budget

router = APIRouter(prefix="/config", tags=["config"])


@router.get("/")
def get_config():
    # Single source of truth: prefer BUDGET_CONFIG env, otherwise fall back to
    # BASE_BUDGET_TARGETS (the same loader the monthly seed uses). This keeps the
    # Data Editor's category list in sync with the seeded budgets even when the
    # BUDGET_CONFIG env var isn't present in the container.
    budget_config = _load_base_budget()
    return {
        "expense_categories": list(budget_config.get("expense", {}).keys()),
        "income_categories": list(budget_config.get("income", {}).keys()),
        "base_budget": budget_config,
    }
