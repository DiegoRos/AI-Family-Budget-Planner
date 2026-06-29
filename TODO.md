# Project Roadmap: Familia Budget

## 🟢 Phase 1: Foundation (COMPLETE)
- [x] Project structure & Docker orchestration setup.
- [x] Database schema & SQLAlchemy models.
- [x] Backend API boilerplate (FastAPI) with basic CRUD.
- [x] Frontend boilerplate (React + Tailwind v4 + React Query).
- [x] Environment configuration (.env.example).

## 🟢 Phase 2: Backend Intelligence (COMPLETE)
- [x] **LLM Extraction Service:**
    - [x] Implement LangChain service in `backend/services/llm_extractor.py`.
    - [x] Create system prompt for `deepseek-r1:14b`.
    - [x] Implement `<think>` block stripping and JSON parsing logic.
    - [x] Add `difflib` fuzzy matching for category hallucinations.
- [x] **File Processing:**
    - [x] Implement PDF/Image text extraction (using `PyMuPDF` or similar).
    - [x] Add `POST /api/extract` endpoint.
- [x] **Budget Management:**
    - [x] Implement `routers/budgets.py` for category-specific targets.
- [x] **Data Export:**
    - [x] Implement `routers/export.py` using `pandas/openpyxl` to mirror original Excel formatting.

## 🔵 Phase 3: Frontend Development (COMPLETE)
- [x] Navigation & Layout setup.
- [x] Dashboard with summary cards and charts.
- [x] Upload Center with LLM extraction preview.
- [x] History View with frozen month toggle.
- [x] Data Editor with transaction and budget tabs.
- [x] API Connectivity via React Query.

## 🟢 Phase 4: Validation & Polish (COMPLETE)
- [x] End-to-End Testing (Local processing verified).
- [x] Excel export formatting verified. Output includes financial totals and embedded charts.
- [x] UI/UX Refinement: Implemented multi-column sorting (Date, Amount, Category, etc.) in the Data Editor.
- [x] Budget History & Dashboard refinement: Improved current month detection, restricted selectors to available data, and unique colors for all categories.
- [x] Interactive Charts: Category wheel and legend labels are now clickable for filtered drill-down views.

## 🟢 Phase 5: Enhancements (COMPLETE)

### 1. Base Budget Auto-Seed
- [X] When a new month is created (or no budgets exist for a month), automatically seed budget targets from `Base_Budget_Targets.md`:
  - Expenses: Rent 5750, Utilities 150, Groceries 800, Transportation 400, Health/Medical 405, Mobile/Wifi 235.43, Laundry/Dry Cleaners 300, Subscriptions 185, Entertainment 400, Miscellaneous 295, Personal Ana 500, Personal Diego 300, Travel 0.
  - Income: Paycheck Ana 9300, Paycheck Diego 5100, Passive Income 3750.
- [X] Implement seeding logic in `backend/routers/budgets.py` or `backend/database/seed.py`.

### 2. Add "House Cleaning" Expense Category
- [X] Add `"House Cleaning"` to the predefined expense categories list (forward-looking only, no retroactive data changes):
  - `CLAUDE.md` — update docs
  - `backend/services/llm_extractor.py` — add to LLM prompt category list
  - `backend/schemas/schemas.py` — if categories are enumerated there
  - `frontend/src/` — any hardcoded category arrays

### 3. Dashboard Person Filter
- [X] Add a toggle/selector on the Dashboard to filter the expense category table and charts by person: Ana, Diego, Ana/Diego, or Combined (default).
- [X] Frontend only: filter already-fetched transaction data client-side by `person` field.

### 4. Pie Chart Text Readability
- [X] Add a text stroke / paint-order outline to pie chart labels so light-colored text is readable on light slice backgrounds.
- [X] Target: `recharts` `<Label>` or custom label renderer — apply `stroke="#000"` / `paintOrder: "stroke"` CSS technique. (Applied on Dashboard + History.)

### 5. Docker config consistency (follow-up)
- [X] Added `env_file: .env` to the backend service in `docker-compose.yml` so `BUDGET_CONFIG` reaches the container (otherwise category lists and auto-seed silently fell back to defaults inside Docker). Explicit `environment:` entries still override for Docker-network URLs.

