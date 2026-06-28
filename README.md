# Familia Budget Tracker

A local, Dockerized web app for tracking monthly household budgets and automatically extracting expenses from uploaded bank statements using a local LLM.

## Stack

- **Frontend:** React (Vite) + Tailwind CSS + React Query
- **Backend:** Python (FastAPI) + SQLite
- **LLM:** Ollama running `deepseek-r1:14b` — fully local, no external APIs

## Features

- Upload PDFs or images of bank statements; the LLM extracts transactions automatically
- Dashboard with Planned vs Actual spending by category
- Freeze past months as read-only snapshots
- Export to Excel (mirroring the original family spreadsheet format)
- Multi-column sorting and inline editing in the Data Editor
- Interactive pie/bar charts with category drill-down

## Running the App

### Prerequisites

- Docker + Docker Compose
- Ollama with the model pre-pulled:
  ```bash
  ollama pull deepseek-r1:14b
  ```

### Start

```bash
cp .env.example .env
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

### Stop

```bash
docker-compose down
```
