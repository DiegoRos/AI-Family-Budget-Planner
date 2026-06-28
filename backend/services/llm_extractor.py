import re
import json
import difflib
from langchain_community.llms import Ollama
from typing import List, Dict, Any
import os


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

class LLMExtractor:
    def __init__(self, model_name: str = "deepseek-r1:14b"):
        base_url = os.getenv("OLLAMA_HOST", "http://localhost:11434")
        # Increase num_ctx for long documents and num_predict for long JSON outputs
        self.llm = Ollama(
            model=model_name, 
            base_url=base_url,
            num_ctx=16384,
            num_predict=8192,
            temperature=0.1,
            timeout=300 # 5 minutes
        )

    def _strip_think_blocks(self, text: str) -> str:
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

        Answer with a SINGLE word: YES or NO. No explanation.

        Page text (start):
        \"\"\"{snippet}\"\"\"
        """
        try:
            raw_output = self.llm.invoke(prompt)
            cleaned = self._strip_think_blocks(raw_output).upper()
            # Keep the page unless the model clearly says NO without a YES.
            if "YES" in cleaned:
                return True
            if "NO" in cleaned:
                return False
            return True  # ambiguous answer -> fail open, keep the page
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

        Return ONLY a JSON list of objects. No introductory text, no explanations, no markdown code blocks.
        Example format:
        [
            {{"date": "2024-01-15", "amount": 50.0, "description": "Grocery Store", "category": "Groceries", "person": "Ana"}},
            ...
        ]
        """

        cleaned_output = ""
        try:
            # We use invoke() which is stateless in Ollama by default.
            raw_output = self.llm.invoke(prompt)
            cleaned_output = self._strip_think_blocks(raw_output)
            
            # Use regex to find the JSON array in case the LLM adds markdown or chatter.
            # We look for the FIRST [ and the LAST ]
            start_idx = cleaned_output.find('[')
            end_idx = cleaned_output.rfind(']')
            
            if start_idx != -1 and end_idx != -1:
                json_str = cleaned_output[start_idx:end_idx+1]
                data = json.loads(json_str)
                
                if isinstance(data, list):
                    for item in data:
                        item['category'] = self._fuzzy_match_category(item.get('category', 'Miscellaneous'))
                        if item.get('person') not in PERSONS:
                            item['person'] = "Ana/Diego"
                    return data
        except Exception as e:
            print(f"Error during LLM extraction: {e}")
            # Log the first 100 chars of output to help debugging
            print(f"Raw output (truncated): {cleaned_output[:200]}...")
            return []
        
        return []
