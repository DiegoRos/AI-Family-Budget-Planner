# Project Overview & Goals
Create a local, Dockerized React + Python webapp to track monthly budgets and automatically extract expenses from uploaded documents using a local LLM (Ollama + DeepSeek-R1). This replaces a manual Excel system, ensuring all sensitive data is processed locally.

# Tech Stack Rules
*   **Frontend:** React (Vite) with Tailwind CSS. Minimalistic design.
*   **Backend:** Python (FastAPI).
*   **Database:** SQLite.
*   **LLM Engine:** Ollama running `deepseek-r1:7b` (local only, no external APIs).
*   **Orchestration:** Docker & Docker Compose.

# Repository Structure
```text
familia-budget/
├── docker-compose.yml
├── .env.example
├── README.md
├── GEMINI.md                  ← this file
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                ← FastAPI entry point
│   ├── database/
│   │   ├── db.py              ← SQLAlchemy engine + session
│   │   ├── models.py          ← ORM models
│   │   └── seed.py            ← Optional: seed categories/budgets
│   ├── routers/
│   │   ├── transactions.py    ← CRUD for expenses & income
│   │   ├── budgets.py         ← Planned budget per category/month
│   │   ├── months.py          ← Frozen month snapshots
│   │   └── export.py          ← Excel/CSV download endpoints
│   ├── services/
│   │   └── llm_extractor.py   ← LangChain + DeepSeek-R1 pipeline
│   └── schemas/
│       └── schemas.py         ← Pydantic request/response models
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx            ← Router setup
│       ├── api/
│       │   └── client.js      ← Axios instance pointing to backend
│       ├── components/
│       │   ├── Layout.jsx     ← Sidebar nav + page wrapper
│       │   ├── StatCard.jsx   ← Reusable KPI card
│       │   ├── CategoryRow.jsx← Planned vs Actual row
│       │   └── MonthToggle.jsx← Previous month selector
│       └── pages/
│           ├── Dashboard.jsx  ← Current month overview
│           ├── History.jsx    ← Frozen previous months (toggled)
│           ├── Upload.jsx     ← Document upload + LLM extraction
│           ├── DataEditor.jsx ← DB editor (fix errors, change income)
│           └── Export.jsx     ← Download selected view or full year
│
└── ollama/
    └── Modelfile              ← DeepSeek-R1 pull config (optional)
```

# Database Schema (SQLite)

**Table: expenses**
*   `id`: INTEGER PK Auto-increment
*   `date`: DATE Transaction date
*   `amount`: REAL Positive number
*   `description`: TEXT Free-text
*   `category`: TEXT Must match known category
*   `person`: TEXT "Ana", "Diego", or "Ana/Diego"
*   `month_id`: INTEGER FK References months.id
*   `created_at`: DATETIME Auto-set on insert

**Table: income**
*   `id`: INTEGER PK Auto-increment
*   `date`: DATE Transaction date
*   `amount`: REAL Positive number
*   `description`: TEXT Free-text
*   `category`: TEXT Must match known income category
*   `person`: TEXT "Ana", "Diego", or "Ana/Diego"
*   `month_id`: INTEGER FK References months.id
*   `created_at`: DATETIME Auto-set on insert

**Table: months**
*   `id`: INTEGER PK Auto-increment
*   `year`: INTEGER e.g. 2024
*   `month`: INTEGER 1–12
*   `is_frozen`: BOOLEAN true = past month, read-only
*   `start_balance`: REAL Carried over from previous month
*   `end_balance`: REAL Computed
*   `notes`: TEXT Optional freeform notes

**Table: budgets**
*   `id`: INTEGER PK Auto-increment
*   `month_id`: INTEGER FK References months.id
*   `category`: TEXT Expense or income category name
*   `type`: TEXT "expense" or "income"
*   `planned_amount`: REAL Budget target

# Predefined Categories
```python
EXPENSE_CATEGORIES = [
    "Rent", "Utilities", "Groceries", "Transportation", "Health/Medical",
    "Mobile/Wifi", "Laundry/Dry Cleaners", "Subscriptions", "Entertainment",
    "House Cleaning", "Miscellaneous", "Personal Ana", "Personal Diego", "Travel", "Other"
]
INCOME_CATEGORIES = [
    "Paycheck Ana", "Paycheck Diego", "Passive Income",
    "Bonus Ana", "Bonus Diego", "Other"
]
PERSONS = ["Ana", "Diego", "Ana/Diego"]
```

# UI / Design Principles
*   **Minimalist:** white/off-white background, dark charcoal text (`#1a1a2e`), single accent color (`#334960`).
*   **No card shadows:** use subtle borders (`border-gray-100`).
*   **Typography:** Inter or system-ui, weights 400/500/600 only.
*   **Color semantics:** `green-600` (under budget), `red-500` (over budget), `gray-400` (neutral).
*   **Transitions:** 150ms ease. No modals for simple actions (use inline/slide-over).

# Application Pages
1.  **Dashboard (`/`):** Current month vs budget. Contains summary cards, category table (Planned vs Actual vs Diff), and charts.
2.  **History (`/history`):** Read-only view of frozen past months via a toggle selector.
3.  **Upload & Extract (`/upload`):** Drag-and-drop file upload. Sends to `POST /api/extract`. Shows an editable result table before committing.
4.  **Data Editor (`/editor`):** Tabbed view for editing raw transactions and planned budgets.
5.  **Export (`/export`):** Download views to Excel (mirroring original format) or CSV.

# Implementation Notes & Gotchas
*   **DeepSeek-R1 <think> blocks:** The reasoning model prepends `<think>...</think>`. **CRITICAL:** Strip these before JSON parsing: `re.sub(r"<think>.*?</think>", "", raw_output, flags=re.DOTALL).strip()`
*   The DeepSeek model should extract month of the transaction, the expected category (Miscellaneous should be a backfall), and person (if there is no clear name in the statement mark as "Ana/Diego").
*   **Frozen Months:** Backend must return `403 Forbidden` on PUT/DELETE to frozen month transactions. There should be an ability to toggle freezing and unfreezing months in the case an old month was missing a document or is wrong.
*   **SQLite Concurrency:** Use `check_same_thread=False` in SQLAlchemy.
*   **Fuzzy Matching:** Backend should use `difflib.get_close_matches` if the LLM hallucinated a category name.
*   **React Query:** Use `@tanstack/react-query` for all data fetching.

# Verification
*   The stack ensures 100% local processing (no external LLM APIs).
*   The SQLite schema natively supports the provided Excel category structure.
