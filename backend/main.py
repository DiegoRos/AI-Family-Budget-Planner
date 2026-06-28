from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from database.db import engine
from database.models import Base

from routers import transactions, months, extract, budgets, export

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Familia Budget API")

app.include_router(transactions.router, prefix="/api")
app.include_router(months.router, prefix="/api")
app.include_router(extract.router, prefix="/api")
app.include_router(budgets.router, prefix="/api")
app.include_router(export.router, prefix="/api")

# Configure CORS
origins = [
    os.getenv("FRONTEND_URL", "http://localhost:5173"),
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Familia Budget API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
