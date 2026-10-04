import re
import json
import difflib
from langchain_ollama import ChatOllama
from typing import List, Dict, Any
import os

DEFAULT_MODEL = "gemma4:12b"


def _load_categories():
    raw = os.getenv("BUDGET_CONFIG", "{}")
    try:
        config = json.loads(raw)
    except json.JSONDecodeError:
        config = {}
    expense = list(config.get("expense", {}).keys())
    income = list(config.get("income", {}).keys())
    return (
        expense or ["Miscellaneous", "Other"],
        income or ["Other"],
    )


EXPENSE_CATEGORIES, INCOME_CATEGORIES = _load_categories()
ALL_CATEGORIES = EXPENSE_CATEGORIES + INCOME_CATEGORIES
PERSONS = ["Ana", "Diego", "Ana/Diego"]

# Max characters of document text per extraction call (~2 statement pages).
# Leaves most of num_ctx for the JSON reply, which is several times larger
# than the source text per transaction.
CHUNK_CHAR_BUDGET = 4500

# JSON schemas passed to Ollama's `format` option. Generation is constrained
# token-by-token to match, so the output is always syntactically valid JSON.
TRANSACTIONS_SCHEMA = {
    "type": "object",
    "properties": {
        "transactions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "date": {"type": "string"},
                    "amount": {"type": "number"},
                    "description": {"type": "string"},
                    "category": {"type": "string", "enum": list(dict.fromkeys(ALL_CATEGORIES))},
                    "person": {"type": "string", "enum": PERSONS},
                },
                "required": ["date", "amount", "description", "category", "person"],
            },
        }
    },
    "required": ["transactions"],
}

PAGE_CLASSIFIER_SCHEMA = {
    "type": "object",
    "properties": {"is_transaction_page": {"type": "boolean"}},
    "required": ["is_transaction_page"],
}


class ExtractionError(Exception):
    """The LLM call failed (Ollama down, model failed to load, bad output)."""


class LLMExtractor:
    def __init__(self, model_name: str = None):
        model_name = model_name or os.getenv("OLLAMA_MODEL", DEFAULT_MODEL)
        base_url = os.getenv("OLLAMA_HOST", "http://localhost:11434")
        common = dict(
            model=model_name,
            base_url=base_url,
            temperature=0.1,
            reasoning=False,  # Gemma 4 thinking off: faster, and keeps JSON in the reply
            client_kwargs={"timeout": 300},  # 5 minutes
        )
        # Increase num_ctx for long documents and num_predict for long JSON outputs
        self.llm = ChatOllama(**common, num_ctx=16384, num_predict=8192, format=TRANSACTIONS_SCHEMA)
        self.classifier_llm = ChatOllama(**common, num_ctx=4096, num_predict=32, format=PAGE_CLASSIFIER_SCHEMA)

    def _strip_think_blocks(self, text: str) -> str:
        # Safety net in case a reasoning model is configured via OLLAMA_MODEL.
        return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()

    def _fuzzy_match_category(self, category: str) -> str:
        matches = difflib.get_close_matches(category, ALL_CATEGORIES, n=1, cutoff=0.6)
        return matches[0] if matches else "Miscellaneous"

    def is_transaction_page(self, snippet: str, row_count: int) -> bool:
        """Lightweight yes/no classifier for ambiguous pages.

        Only meant to be called on pages the heuristic could not decide
        (some signal but no clear section marker). Reuses the same stateless
        Ollama model with a tiny prompt so it stays cheap. On any error we
        fail OPEN (return True) so we never silently drop a real page.
        """
        prompt = f"""
        You are inspecting one page of a financial statement.
        It has roughly {row_count} line(s) that look like dated money entries.

        Decide if this page contains a list/table of individual financial
        transactions (purchases, charges, payments, deposits) — as opposed to
        an account summary, marketing, fees schedule, or legal disclosure page.

        Respond with JSON: {{"is_transaction_page": true}} or {{"is_transaction_page": false}}.

        Page text (start):
        \"\"\"{snippet}\"\"\"
        """
        try:
            raw_output = self.classifier_llm.invoke(prompt).content
            data = json.loads(self._strip_think_blocks(raw_output))
            # Keep the page unless the model clearly says it is not one.
            return data.get("is_transaction_page") is not False
        except Exception as e:
            print(f"Error during page classification: {e}")
            return True

    def extract_transactions(self, text: str) -> List[Dict[str, Any]]:
        # This prompt reinforces that the LLM must treat every request as isolated.
        prompt = f"""
        TASK: Extract EVERY SINGLE financial transaction data from the provided text.

        CONTEXT: The text may come from a PDF OCR, a raw text file, or a CSV/Excel export.
        Column headers will vary (e.g., "Transaction Date" vs "Date", "Debit/Credit" vs "Amount").
        Your job is to intelligently map these varied fields to the target schema below.

        IMPORTANT:
        1. This is an independent task. Ignore any previous context.
        2. Do NOT omit any transactions. Extract all items listed in the document.
        3. If there are many transactions, list ALL of them. Do not summarize or truncate.

        For each transaction in the text, identify:
        - date (YYYY-MM-DD)
        - amount (positive float number. If the original has separate debit/credit columns, use the transaction value)
        - description (short string)
        - category (choose the BEST match from: {', '.join(ALL_CATEGORIES)})
        - person (choose from: {', '.join(PERSONS)}. If not clear, use 'Ana/Diego')

        Document Text:
        \"\"\"{text}\"\"\"

        Return a JSON object with a "transactions" list. Example format:
        {{"transactions": [
            {{"date": "2024-01-15", "amount": 50.0, "description": "Grocery Store", "category": "Groceries", "person": "Ana"}},
            ...
        ]}}
        """

        cleaned_output = ""
        try:
            # We use invoke() which is stateless in Ollama by default.
            response = self.llm.invoke(prompt)
            cleaned_output = self._strip_think_blocks(response.content)
            if response.response_metadata.get("done_reason") == "length":
                # Hit num_ctx/num_predict: the JSON is cut off mid-list.
                raise ExtractionError("model output was truncated (context limit reached)")
            data = json.loads(cleaned_output).get("transactions", [])

            if isinstance(data, list):
                for item in data:
                    item['category'] = self._fuzzy_match_category(item.get('category', 'Miscellaneous'))
                    if item.get('person') not in PERSONS:
                        item['person'] = "Ana/Diego"
                return data
        except Exception as e:
            print(f"Error during LLM extraction: {e}")
            # Log the first 200 chars of output to help debugging
            print(f"Raw output (truncated): {cleaned_output[:200]}...")
            # Surface the failure instead of returning [], which the UI would
            # show as a successful extraction with zero transactions.
            raise ExtractionError(str(e)) from e

        return []

    def extract_from_pages(self, pages: List[str]) -> List[Dict[str, Any]]:
        """Extract transactions from several pages, a few pages per LLM call.

        A long statement in a single call overflows num_ctx (prompt + JSON
        reply), and the reply gets cut off after the first few dozen rows.
        Chunks never split a page, so a single oversized page goes alone.
        """
        transactions: List[Dict[str, Any]] = []
        for chunk in _chunk_pages(pages, CHUNK_CHAR_BUDGET):
            transactions.extend(self.extract_transactions(chunk))
        return transactions


def _chunk_pages(pages: List[str], budget: int) -> List[str]:
    chunks: List[str] = []
    current: List[str] = []
    size = 0
    for page in pages:
        if current and size + len(page) > budget:
            chunks.append("\n".join(current))
            current, size = [], 0
        current.append(page)
        size += len(page)
    if current:
        chunks.append("\n".join(current))
    return chunks
