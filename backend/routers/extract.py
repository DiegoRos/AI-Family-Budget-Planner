import asyncio
from fastapi import APIRouter, UploadFile, File, HTTPException
from services.llm_extractor import LLMExtractor
from services.page_filter import select_transaction_pages
import fitz  # PyMuPDF
import pytesseract
from PIL import Image
import io

router = APIRouter(prefix="/extract", tags=["extract"])
extractor = LLMExtractor()

import pandas as pd


def _extract_pages(filename: str, content: bytes) -> list[str]:
    """Return per-page text. Non-PDF inputs are treated as a single page."""
    if filename.endswith(".pdf"):
        pages: list[str] = []
        doc = fitz.open(stream=content, filetype="pdf")
        for page in doc:
            pages.append(page.get_text())
        doc.close()
        return pages
    elif filename.endswith((".png", ".jpg", ".jpeg")):
        image = Image.open(io.BytesIO(content))
        return [pytesseract.image_to_string(image)]
    elif filename.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(content))
        return [df.to_csv(index=False)]
    elif filename.endswith((".xls", ".xlsx")):
        df = pd.read_excel(io.BytesIO(content))
        return [df.to_csv(index=False)]
    elif filename.endswith(".txt"):
        return [content.decode("utf-8")]
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type")


@router.post("/")
async def extract_from_file(file: UploadFile = File(...)):
    content = await file.read()
    filename = file.filename.lower()

    try:
        pages = _extract_pages(filename, content)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

    if not any(p.strip() for p in pages):
        raise HTTPException(status_code=400, detail="Could not extract text from file")

    # Heuristic page selection; the LLM classifier only fires on ambiguous pages.
    # Run off the event loop so the web server stays responsive when several
    # documents are uploaded at once (Ollama still processes them serially).
    selection = await asyncio.to_thread(
        select_transaction_pages, pages, extractor.is_transaction_page
    )

    combined_text = "\n".join(pages[i] for i in selection.selected_indices)

    transactions = await asyncio.to_thread(
        extractor.extract_transactions, combined_text
    )

    return {
        "transactions": transactions,
        "filename": file.filename,
        "total_pages": selection.total_pages,
        "pages_used": [i + 1 for i in selection.selected_indices],
        "filter_note": selection.note,
    }
