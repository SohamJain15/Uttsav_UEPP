import asyncio
import json
import os
from pathlib import Path
from typing import Any, Dict, List

import httpx
from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env")

OLLAMA_EMBED_URL = os.getenv("OLLAMA_EMBED_URL", "http://localhost:11434/api/embeddings")
OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
EMBED_TIMEOUT_SECONDS = 15
EMBED_RETRIES = 2
ALLOWED_CATEGORIES = {"Police", "Fire", "Traffic", "Municipality", "General"}
RULEBOOK_PATH = Path(__file__).resolve().parent / "ai_intelligence" / "knowledge" / "rulebook_documents.json"


def _normalize_text(value: Any) -> str:
    return str(value or "").strip()


def _build_search_text(document: Dict[str, Any], jurisdiction: str) -> str:
    keywords = ", ".join([_normalize_text(item) for item in (document.get("keywords") or []) if _normalize_text(item)])
    title = _normalize_text(document.get("title"))
    category = _normalize_text(document.get("type")) or "General"
    content = _normalize_text(document.get("content"))
    source_label = _normalize_text(document.get("source_label"))
    source_url = _normalize_text(document.get("url"))
    verified_on = _normalize_text(document.get("verified_on"))

    return (
        f"TITLE: {title}\n"
        f"CATEGORY: {category}\n"
        f"JURISDICTION: {jurisdiction}\n"
        f"KEYWORDS: {keywords}\n"
        f"RULE_TEXT: {content}\n"
        f"SOURCE_LABEL: {source_label}\n"
        f"SOURCE_URL: {source_url}\n"
        f"VERIFIED_ON: {verified_on}"
    )


async def _get_embedding(client: httpx.AsyncClient, text: str) -> List[float]:
    last_error: Exception | None = None
    for attempt in range(EMBED_RETRIES + 1):
        try:
            response = await client.post(
                OLLAMA_EMBED_URL,
                json={"model": OLLAMA_EMBED_MODEL, "prompt": text},
                timeout=EMBED_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            payload = response.json()
            embedding = payload.get("embedding")
            if not isinstance(embedding, list) or not embedding:
                raise ValueError("Embedding response is missing a valid embedding list.")
            return [float(item) for item in embedding]
        except Exception as exc:
            last_error = exc
            if attempt < EMBED_RETRIES:
                await asyncio.sleep(0.5)
            continue
    raise RuntimeError(f"Embedding generation failed after retries: {last_error}")


def _validate_and_prepare_documents(raw_data: Dict[str, Any]) -> tuple[List[Dict[str, Any]], str]:
    metadata = raw_data.get("metadata") or {}
    default_jurisdiction = _normalize_text(metadata.get("jurisdiction")) or "India Generic"
    documents = raw_data.get("documents") or []
    if not isinstance(documents, list) or not documents:
        raise ValueError("No rule documents found in rulebook_documents.json")

    prepared: List[Dict[str, Any]] = []
    for index, document in enumerate(documents, start=1):
        if not isinstance(document, dict):
            raise ValueError(f"Document #{index} is not a valid object.")

        title = _normalize_text(document.get("title"))
        category = _normalize_text(document.get("type")) or "General"
        content = _normalize_text(document.get("content"))
        if not title:
            raise ValueError(f"Document #{index} is missing title.")
        if category not in ALLOWED_CATEGORIES:
            raise ValueError(f"Document '{title}' has invalid category '{category}'.")
        if not content:
            raise ValueError(f"Document '{title}' is missing content.")

        source_url = _normalize_text(document.get("url"))
        if source_url and not (source_url.startswith("http://") or source_url.startswith("https://")):
            raise ValueError(f"Document '{title}' has invalid URL: {source_url}")

        prepared.append(
            {
                **document,
                "title": title,
                "type": category,
                "content": content,
            }
        )
    return prepared, default_jurisdiction


def _clear_existing_rules(supabase: Client) -> None:
    # Supabase delete requires a filter; this removes all rows safely.
    supabase.table("rules_knowledge_base").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()


async def main() -> None:
    if not RULEBOOK_PATH.exists():
        raise FileNotFoundError(f"Rulebook file not found at: {RULEBOOK_PATH}")

    with RULEBOOK_PATH.open("r", encoding="utf-8") as rulebook_file:
        payload = json.load(rulebook_file)

    documents, default_jurisdiction = _validate_and_prepare_documents(payload)

    print(f"Initializing Supabase client for {SUPABASE_URL}...")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    print(f"Clearing existing rules from rules_knowledge_base...")
    _clear_existing_rules(supabase)

    inserted_count = 0
    failed: List[str] = []

    async with httpx.AsyncClient() as http_client:
        for index, document in enumerate(documents, start=1):
            title = document["title"]
            try:
                searchable_content = _build_search_text(document, default_jurisdiction)
                embedding = await _get_embedding(http_client, searchable_content)
                db_row = {
                    "rule_category": document["type"],
                    "content": searchable_content,
                    "embedding": embedding,
                }
                supabase.table("rules_knowledge_base").insert(db_row).execute()
                inserted_count += 1
                print(f"[{index}/{len(documents)}] Seeded: {title}")
            except Exception as exc:
                failed.append(f"{title}: {exc}")
                print(f"[{index}/{len(documents)}] Failed: {title} -> {exc}")

    print(f"\nSeed complete. Inserted={inserted_count}, Failed={len(failed)}")
    if failed:
        print("Failed documents:")
        for item in failed:
            print(f"- {item}")


if __name__ == "__main__":
    asyncio.run(main())
