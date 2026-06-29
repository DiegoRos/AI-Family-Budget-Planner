NEVER DELETE THE DATABASE

# Familia Budget Tracker

A local, Dockerized React + Python webapp to track monthly budgets and automatically extract expenses from uploaded documents using a local LLM (Ollama + DeepSeek-R1). This replaces a manual Excel system, ensuring all sensitive data is processed locally. 

## Tech Stack

- **Frontend:** React (Vite) with Tailwind CSS
- **Backend:** Python (FastAPI)
- **Database:** SQLite
- **LLM Engine:** Ollama running `deepseek-r1:14b` (local only, no external APIs)
- **Orchestration:** Docker & Docker Compose

## Repository Structure

```
familia-budget/
├── docker-compose.yml
├── .env.example
├── README.md
├── GEMINI.md
├── CLAUDE.md (this file)
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

## Database Schema (SQLite)

### expenses
- `id` (INTEGER PK): Auto-increment
- `date` (DATE): Transaction date
- `amount` (REAL): Positive number
- `description` (TEXT): Free-text
- `category` (TEXT): Must match known category
- `person` (TEXT): "Ana", "Diego", or "Ana/Diego"
- `month_id` (INTEGER FK): References months.id
- `created_at` (DATETIME): Auto-set on insert

### income
- `id` (INTEGER PK): Auto-increment
- `date` (DATE): Transaction date
- `amount` (REAL): Positive number
- `description` (TEXT): Free-text
- `category` (TEXT): Must match known income category
- `person` (TEXT): "Ana", "Diego", or "Ana/Diego"
- `month_id` (INTEGER FK): References months.id
- `created_at` (DATETIME): Auto-set on insert

### months
- `id` (INTEGER PK): Auto-increment
- `year` (INTEGER): e.g. 2024
- `month` (INTEGER): 1–12
- `is_frozen` (BOOLEAN): true = past month, read-only
- `start_balance` (REAL): Carried over from previous month
- `end_balance` (REAL): Computed
- `notes` (TEXT): Optional freeform notes

### budgets
- `id` (INTEGER PK): Auto-increment
- `month_id` (INTEGER FK): References months.id
- `category` (TEXT): Expense or income category name
- `type` (TEXT): "expense" or "income"
- `planned_amount` (REAL): Budget target

## Predefined Categories

**Expense Categories:**
Rent, Utilities, Groceries, Transportation, Health/Medical, Mobile/Wifi, Laundry/Dry Cleaners, Subscriptions, Entertainment, House Cleaning, Miscellaneous, Personal Ana, Personal Diego, Travel, Other

**Income Categories:**
Paycheck Ana, Paycheck Diego, Passive Income, Bonus Ana, Bonus Diego, Other

**Persons:** Ana, Diego, Ana/Diego

## UI Design Principles

- **Minimalist:** white/off-white background, dark charcoal text (`#1a1a2e`), single accent color (`#334960`)
- **No card shadows:** use subtle borders (`border-gray-100`)
- **Typography:** Inter or system-ui, weights 400/500/600 only
- **Color semantics:** `green-600` (under budget), `red-500` (over budget), `gray-400` (neutral)
- **Transitions:** 150ms ease. No modals for simple actions (use inline/slide-over)

## Application Pages

1. **Dashboard (`/`):** Current month vs budget. Contains summary cards, category table (Planned vs Actual vs Diff), and charts.
2. **History (`/history`):** Read-only view of frozen past months via a toggle selector.
3. **Upload & Extract (`/upload`):** Drag-and-drop file upload. Sends to `POST /api/extract`. Shows an editable result table before committing.
4. **Data Editor (`/editor`):** Tabbed view for editing raw transactions and planned budgets.
5. **Export (`/export`):** Download views to Excel (mirroring original format) or CSV.

## Implementation Notes & Gotchas

- **DeepSeek-R1 `<think>` blocks:** The reasoning model prepends `<think>...</think>`. **CRITICAL:** Strip these before JSON parsing: `re.sub(r"<think>.*?</think>", "", raw_output, flags=re.DOTALL).strip()`
- **LLM Extraction:** The model should extract month of the transaction, expected category (Miscellaneous as fallback), and person (mark as "Ana/Diego" if no clear name).
- **Frozen Months:** Backend returns `403 Forbidden` on PUT/DELETE to frozen month transactions. Support toggling freeze/unfreeze for corrections.
- **SQLite Concurrency:** Use `check_same_thread=False` in SQLAlchemy.
- **Fuzzy Matching:** Use `difflib.get_close_matches` if the LLM hallucinated a category name.
- **React Query:** Use `@tanstack/react-query` for all data fetching.

## Verification

- The stack ensures 100% local processing (no external LLM APIs).
- SQLite schema natively supports the provided Excel category structure.

## How to Run the App

### Prerequisites

Before running the app, ensure you have installed:
- **Docker** (with Docker Compose)
- **Ollama** with the `deepseek-r1:14b` model pre-pulled
  ```bash
  ollama pull deepseek-r1:14b
  ```

> **Note on Ollama:** The app expects Ollama to be running and accessible at `http://localhost:11434` (configurable via `OLLAMA_HOST`). If you run Ollama in Docker, the backend service will connect to it at `http://ollama:11434` (internal Docker network).

### Environment Setup

1. **Create a `.env` file** in the project root by copying `.env.example`:
   ```bash
   cp .env.example .env
   ```

2. **Review the default values:**
   ```env
   DATABASE_URL=sqlite:///./data/budget.db
   OLLAMA_HOST=http://localhost:11434
   VITE_API_URL=http://localhost:8000
   ```

   - `DATABASE_URL`: SQLite database path (auto-created in `backend/data/`)
   - `OLLAMA_HOST`: Ollama API endpoint (for local Ollama, use `http://localhost:11434`)
   - `VITE_API_URL`: Frontend's API base URL (for local dev, use `http://localhost:8000`)

### Starting the App with Docker Compose

1. **From the project root, start all services:**
   ```bash
   docker-compose up --build
   ```

   This command:
   - Builds the backend (Python/FastAPI) and frontend (React/Vite) Docker images
   - Starts the Ollama service (requires GPU via `nvidia-docker` or `--gpus all`)
   - Creates persistent volumes for the SQLite database and Ollama models
   - Sets up networking between services

2. **Wait for initialization:**
   - Ollama may take ~30 seconds to fully start
   - Backend will auto-create the SQLite schema and tables
   - Frontend will build and serve via Vite dev server

3. **Check service health:**
   - Backend API: http://localhost:8000 (returns `{"message": "Familia Budget API is running"}`)
   - Frontend: http://localhost:5173

### Accessing the Application

Once all services are running:

1. **Frontend:** Open your browser and navigate to:
   ```
   http://localhost:5173
   ```

2. **Backend API Docs:** View interactive API documentation at:
   ```
   http://localhost:8000/docs
   ```

3. **Expected pages:**
   - Dashboard (`/`) — Current month overview
   - History (`/history`) — Browse past frozen months
   - Upload & Extract (`/upload`) — Upload documents for LLM-powered expense extraction
   - Data Editor (`/editor`) — Manually edit transactions and budgets
   - Export (`/export`) — Download views as Excel or CSV

### Stopping the App

To stop all services and clean up containers:

```bash
docker-compose down
```

To stop services while preserving data volumes:

```bash
docker-compose stop
```

To remove all containers, networks, and volumes (destructive):

```bash
docker-compose down -v
```

### Optional: Local Development Without Docker

If you prefer running services locally without Docker:

#### Backend

1. Install Python 3.11+
2. Create a virtual environment:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Ensure Ollama is running:
   ```bash
   ollama serve
   ```
   In a separate terminal, pull the model:
   ```bash
   ollama pull deepseek-r1:14b
   ```

5. Start the backend:
   ```bash
   python main.py
   ```
   The API will be available at `http://localhost:8000`

#### Frontend

1. Install Node.js 20+
2. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the dev server:
   ```bash
   npm run dev
   ```
   The frontend will be available at `http://localhost:5173`

#### Notes

- Ensure `OLLAMA_HOST` in your `.env` is set to `http://localhost:11434` (or the correct Ollama endpoint)
- The backend will auto-create the SQLite database in `backend/data/budget.db`
- Both services support hot-reload during development
