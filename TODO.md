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

### 5. Docker config consistency (follow-up)
- [X] Added `env_file: .env` to the backend service in `docker-compose.yml` so `BUDGET_CONFIG` reaches the container (otherwise category lists and auto-seed silently fell back to defaults inside Docker). Explicit `environment:` entries still override for Docker-network URLs.

## 🟢 Phase 6: History parity, filters & drill-down navigation (COMPLETE)

### 1. History Feature Parity with Dashboard
- [x] Add person filter (Combined/Ana/Diego/Ana/Diego) to History, mirroring Dashboard.
- [x] Apply the filter to the category table + pie chart only (summary cards stay combined).
- [x] Fix latent bug: import `Calendar` from lucide-react in History.jsx.

### 2. Data Editor Transaction Filters
- [x] Add a collapsible filter bar (toggle + active-count + Clear all) above the transactions table.
- [x] Filters: person, category, expense/income type, date range (from/to), amount min/max.
- [x] Apply client-side to the combined transactions before sort/render.
- [x] Restrict Select-All / bulk edit to the currently filtered rows.

### 3. Category Click-Through (Dashboard/History → Data Editor)
- [x] Add `useNavigate` handler that opens `/editor?month=&type=expense&category=&person=`.
- [x] Wire it to Planned-vs-Actual rows and pie slices/legend on both pages.
- [x] Add optional `onClick` to CategoryRow to make rows clickable.
- [x] Remove the in-page drill-down detail table + `selectedCategory` state from both pages.
- [x] In Data Editor, read query params on mount to set month, filters, transactions tab, open filter bar (param month overrides auto-select).

## 🔵 Phase 7: Bug Fixes (PLANNED)

> Deploy agents per the **Deployment strategy** below. Root causes verified against current code (line numbers as of this writing).

### Bugs
1. **Editing a transaction's date does not move it to the correct month** (e.g. a row wrongly dated May 2024, corrected to May 2026, stays in the old month).
2. **Edge-of-month dates land in the wrong month** (e.g. `01/07/2026` saved to June instead of July) — a UTC/local off-by-one.
3. **Category dropdown shows the wrong list after flipping Type** (e.g. an extracted paycheck reads Type=Income but the Category menu shows expense categories; user must toggle Type twice to fix it).

**Confirmed approach:** make the **backend authoritative** for `month_id` (derive it from the transaction `date`); the frontend stops sending `month_id`. Add a **one-time, non-destructive** repair script for existing rows. **Never delete DB entries** — the repair only reassigns `month_id`.

### Task A — Bugs 1 & 2: Backend-authoritative month assignment  *(backend + frontend)*

**Root cause (verified):** `month_id` is chosen on the client and stored verbatim by the backend.
- `backend/routers/transactions.py` — `create_expense`/`create_income` (`models.X(**payload.dict())`, lines 22/55) and `update_expense`/`update_income` (`for key,value in payload.dict().items(): setattr(...)`, lines 35-36/68-69) never derive `month_id` from `date`.
- `frontend/src/pages/DataEditor.jsx` — `handleSaveEdit` (line 237), `bulkUpdateMutation` (line 156), `createTransactionMutation` (line 183) all hardcode `month_id: selectedMonthId`.
- `frontend/src/pages/Upload.jsx` — `handleSaveAll` (lines 163-165) derives the month with `new Date(t.date).getFullYear()/.getMonth()` (UTC-parse + local-read = day shift).

**Fix — backend (single source of truth):**
1. Add helper `get_or_create_month_for_date(d: date, db) -> models.Month` in `backend/routers/months.py`, next to `create_month`. Compute `year=d.year, month=d.month`; return the existing `Month` for that (year, month) or, if absent, create it (`is_frozen=False, start_balance=0, end_balance=0`) and call the already-imported `seed_budgets_for_month(new_month.id, db)`. Unlike `create_month`, it must **not** raise on an existing month (get-or-create, not create-or-400).
2. In `backend/routers/transactions.py`, derive `month_id` from the payload `date` in all four write handlers:
   - Create: `m = get_or_create_month_for_date(payload.date, db); check_frozen(m.id, db); obj = models.X(**payload.dict(exclude={'month_id'}), month_id=m.id)`.
   - Update: `m = get_or_create_month_for_date(payload.date, db); check_frozen(db_obj.month_id, db); check_frozen(m.id, db)`; copy fields but force `month_id = m.id`. Because the date now drives the bucket, editing the date re-buckets the row → **fixes Bug 1**. Server parses `date` as a plain calendar date (Pydantic `date`), no timezone → **fixes Bug 2**.
3. `backend/schemas/schemas.py` — make `month_id` optional (`Optional[int] = None`) on `ExpenseBase`/`IncomeBase` so the frontend can omit it; the backend overrides it regardless (keeps old clients working).

**Fix — frontend (stop sending/deriving month_id):**
- `frontend/src/pages/DataEditor.jsx` — remove `month_id: selectedMonthId` from `handleSaveEdit` (237), `bulkUpdateMutation` (156), `createTransactionMutation` (183). In the update/create `onSuccess`, also `queryClient.invalidateQueries(['months'])` (in addition to `['month', selectedMonthId]`) so a row that moved to another month disappears from the current view and appears in its new month.
- `frontend/src/pages/Upload.jsx` — in `handleSaveAll`, delete the `new Date(t.date)` month derivation and the client-side month find/create (lines 162-184); POST each row with `{date, amount, description, category, person}` and **no** `month_id`, letting the backend create/assign the month. Pick the endpoint from the row's `type` (available after Task C) rather than `EXPENSE_CATEGORIES.includes(t.category)`. A frozen target month now surfaces as a backend 403 — show that error.
- Replace `new Date().toISOString().split('T')[0]` "today" defaults (`DataEditor.jsx:190`; `Upload.jsx` manual-row starters ~245/309) with a **local**-date helper (build `YYYY-MM-DD` from `getFullYear/getMonth/getDate`) so the default date isn't tomorrow in negative-UTC zones. Same class of bug as Bug 2.

**Files:** `backend/routers/months.py`, `backend/routers/transactions.py`, `backend/schemas/schemas.py`, `frontend/src/pages/DataEditor.jsx`, `frontend/src/pages/Upload.jsx`.

### Task B — One-time repair of existing mis-bucketed rows  *(backend, non-destructive)*

**Goal:** fix rows already stored with the wrong `month_id` but a correct `date` (existing Bug 2 rows). **Never delete data — only reassign `month_id`.**

- Add `backend/scripts/rebucket_months.py`: open a DB session, iterate all `Expense` and `Income` rows, compute the correct month via `get_or_create_month_for_date(row.date, db)` (Task A helper), and update `row.month_id` **only where it differs**. Print a per-row before/after summary and a total-changed count; make it idempotent (safe to re-run). Run once via the backend container/venv after Task A ships.
- Rows with a genuinely wrong **date** (Bug 1, e.g. May 2024 instead of 2026) can't be auto-corrected — after Task A, re-saving the corrected date routes them to the right month.

**Files:** `backend/scripts/rebucket_months.py` (new).

### Task C — Bug 3: Category dropdown matches Type  *(frontend)*

**Root cause (verified):** extracted rows have `type === undefined`; the Type select uses a category-based fallback while the Category list keys off raw `t.type`, so they diverge. Because the Type select already displays "Income", re-picking "Income" fires no `onChange` — hence the "toggle twice" symptom.

**Fix:**
- `frontend/src/pages/Upload.jsx` — at ingestion (`extractOne`, lines 56-59) set an explicit `type: EXPENSE_CATEGORIES.includes(t.category) ? 'expense' : 'income'` on each extracted row so `t.type` is always concrete.
- Define one shared resolver `const rowType = (t) => t.type || (EXPENSE_CATEGORIES.includes(t.category) ? 'expense' : 'income')` and use it in **both** the Type select value (437) and the Category option list (451/455) so they can never diverge even before `type` is written.
- On Type change (Upload `handleUpdateTransaction('type', …)` and `DataEditor.jsx` type `onChange` at line 713): if the current `category` isn't valid for the new type, reset it to the first category of the new type's list. Prevents an income category lingering under expense type (and in DataEditor, avoids a blank Category select since it has no fallback option — also add a fallback `<option>` there like Upload's lines 455-457).

**Files:** `frontend/src/pages/Upload.jsx`, `frontend/src/pages/DataEditor.jsx`.

### Deployment strategy

Task A and Task C **both edit `Upload.jsx` and `DataEditor.jsx`** (different regions), so running them in parallel risks conflicts. Recommended split:
- **Agent 1 (backend, parallel-safe):** Task A backend changes + Task B repair script. No frontend overlap.
- **Agent 2 (frontend, single owner of the two page files):** Task A frontend changes **and** Task C. Start after Agent 1 defines the contract (`month_id` optional; endpoint by `type`). Task C alone has no backend dependency.

### Verification

Run the stack (`docker-compose up --build`, or backend `python main.py` + frontend `npm run dev`), then:
- **Bug 1:** In Data Editor, edit a transaction's date to a different month/year and Save → it leaves the current month's list and appears under the correct month on Dashboard/History.
- **Bug 2:** Upload/commit a transaction dated the 1st or last of a month (e.g. `2026-07-01`) → it lands in July, not June. Confirm the stored `date` is unchanged.
- **Bug 2 backend check:** `POST /api/transactions/expenses/` with `date=2026-07-01` and no `month_id` → response `month_id` maps to the July 2026 month (auto-created + budget-seeded if new).
- **Task B:** run `rebucket_months.py` on a copy/backup, confirm it reports and reassigns only mismatched rows, deletes nothing, and is a no-op on a second run.
- **Bug 3:** Upload a document that yields a paycheck (income category) → the row shows Type=Income **and** the Category dropdown lists income categories immediately (no double-toggle). Flip Type expense↔income once → Category list switches and resets to a valid category.

