from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer


class AssistantError(Exception):
    """Raised when the RAG assistant cannot process a query."""


@dataclass
class RuleDocument:
    id: str
    title: str
    type: str
    jurisdiction: str
    content: str
    keywords: List[str]
    source: Dict[str, Any]
    ui_steps: List[int]


@dataclass
class RulebookIndex:
    metadata: Dict[str, Any]
    documents: List[RuleDocument]
    vectorizer: TfidfVectorizer
    matrix: Any


_CACHED_INDEX: RulebookIndex | None = None
_LOAD_ERROR: str | None = None


STEP_HINTS = {
    0: "Event Details step: event name/type, crowd size, schedule.",
    1: "Venue Details step: venue ownership, address, map coordinates.",
    2: "Infrastructure step: stage, sound, temporary structures, fireworks, food stalls.",
    3: "Safety step: security, first-aid, ambulance, crowd management readiness.",
    4: "Traffic step: road closure, parking, traffic impact.",
    5: "Waste step: disposal plan, contractor, dustbins.",
    6: "Document Upload step: required supporting documents.",
    7: "Review and Submit step: final verification before submission.",
}

COMPLIANCE_MARKERS = (
    "permission",
    "permit",
    "noc",
    "license",
    "licence",
    "loudspeaker",
    "fireworks",
    "food",
    "fssai",
    "traffic",
    "road closure",
    "police",
    "magistrate",
    "compliance",
    "legal",
    "rule",
)


BLOCKED_INTENT_MARKERS = (
    "guarantee approval",
    "100% approval",
    "bypass permission",
    "without permission",
    "illegal workaround",
    "avoid police permission",
    "fake document",
    "bribe",
    "how to cheat",
)


def _resolve_rulebook_path() -> Path:
    custom_path = os.getenv("UTTSAV_RULEBOOK_PATH")
    if custom_path:
        return Path(custom_path)
    return Path(__file__).resolve().parents[2] / "ai_intelligence" / "knowledge" / "rulebook_documents.json"


def _load_documents() -> Tuple[Dict[str, Any], List[RuleDocument]]:
    path = _resolve_rulebook_path()
    if not path.exists():
        raise AssistantError(f"Rulebook file not found at {path}")

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise AssistantError(f"Rulebook file is invalid JSON: {exc}") from exc

    metadata = payload.get("metadata", {})
    raw_documents = payload.get("documents", [])
    if not isinstance(raw_documents, list) or not raw_documents:
        raise AssistantError("Rulebook has no documents configured.")

    docs: List[RuleDocument] = []
    for raw in raw_documents:
        docs.append(
            RuleDocument(
                id=str(raw.get("id", "")),
                title=str(raw.get("title", "")),
                type=str(raw.get("type", "")),
                jurisdiction=str(raw.get("jurisdiction", "")),
                content=str(raw.get("content", "")),
                keywords=list(raw.get("keywords", []) or []),
                source=dict(raw.get("source", {}) or {}),
                ui_steps=list(raw.get("ui_steps", []) or []),
            )
        )
    return metadata, docs


def _document_text(doc: RuleDocument) -> str:
    parts = [
        doc.title,
        doc.type,
        doc.jurisdiction,
        " ".join(doc.keywords),
        doc.content,
        " ".join(str(step) for step in doc.ui_steps),
    ]
    return " ".join(part for part in parts if part)


def _load_index() -> RulebookIndex:
    global _CACHED_INDEX, _LOAD_ERROR

    if _CACHED_INDEX is not None:
        return _CACHED_INDEX
    if _LOAD_ERROR:
        raise AssistantError(_LOAD_ERROR)

    metadata, docs = _load_documents()
    try:
        vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
        matrix = vectorizer.fit_transform([_document_text(doc) for doc in docs])
        _CACHED_INDEX = RulebookIndex(
            metadata=metadata,
            documents=docs,
            vectorizer=vectorizer,
            matrix=matrix,
        )
        return _CACHED_INDEX
    except Exception as exc:
        _LOAD_ERROR = f"Failed to build rulebook retrieval index: {exc}"
        raise AssistantError(_LOAD_ERROR) from exc


def _normalize_text(value: Any) -> str:
    return str(value or "").strip()


def _compact_form_context(form_context: Dict[str, Any], limit: int = 18) -> str:
    if not isinstance(form_context, dict):
        return ""

    priority_keys = [
        "eventType",
        "crowdSize",
        "venueType",
        "venueOwnership",
        "address",
        "city",
        "startDate",
        "startTime",
        "fireworks",
        "temporaryStructures",
        "soundSystem",
        "foodStalls",
        "roadClosureRequired",
        "trafficImpact",
        "wasteDisposalPlan",
    ]

    selected_pairs = []
    for key in priority_keys:
        value = form_context.get(key)
        if value in ("", None, False):
            continue
        selected_pairs.append(f"{key}:{value}")
        if len(selected_pairs) >= limit:
            break

    if len(selected_pairs) < limit:
        for key, value in form_context.items():
            if key in priority_keys or value in ("", None, False):
                continue
            selected_pairs.append(f"{key}:{value}")
            if len(selected_pairs) >= limit:
                break

    return " | ".join(selected_pairs)


def _build_query_text(question: str, current_step: int | None, step_name: str | None, form_context: Dict[str, Any]) -> str:
    parts = [question]
    if current_step is not None:
        parts.append(f"Current step index: {current_step}")
        if current_step in STEP_HINTS:
            parts.append(STEP_HINTS[current_step])
    if step_name:
        parts.append(f"Current step name: {step_name}")
    compact_context = _compact_form_context(form_context)
    if compact_context:
        parts.append(f"Current form context: {compact_context}")
    return " ".join(parts)


def _retrieve_documents(query_text: str, current_step: int | None, top_k: int = 5) -> Tuple[List[Tuple[RuleDocument, float]], float]:
    index = _load_index()
    query_vec = index.vectorizer.transform([query_text])
    similarities = (query_vec @ index.matrix.T).toarray()[0]

    # Step-aware boost for UI-flow guidance relevance.
    if current_step is not None:
        for i, doc in enumerate(index.documents):
            if doc.ui_steps and current_step in doc.ui_steps:
                similarities[i] += 0.08

    ranked_indices = np.argsort(similarities)[::-1]
    results: List[Tuple[RuleDocument, float]] = []

    for idx in ranked_indices:
        score = float(similarities[idx])
        if score <= 0:
            continue
        results.append((index.documents[int(idx)], score))
        if len(results) >= top_k:
            break

    top_score = float(results[0][1]) if results else 0.0
    return results, top_score


def _is_compliance_question(question: str) -> bool:
    lowered = question.lower()
    return any(marker in lowered for marker in COMPLIANCE_MARKERS)


def _keyword_overlap_boost(question_text: str, keywords: List[str]) -> float:
    lowered = question_text.lower()
    matches = 0
    for keyword in keywords:
        if keyword and keyword.lower() in lowered:
            matches += 1
    return min(matches * 0.08, 0.32)


def _top_government_docs(
    query_text: str,
    question_text: str,
    exclude_ids: set[str],
    limit: int = 2,
) -> List[Tuple[RuleDocument, float]]:
    index = _load_index()
    query_vec = index.vectorizer.transform([query_text])
    similarities = (query_vec @ index.matrix.T).toarray()[0]

    gov_items: List[Tuple[RuleDocument, float]] = []
    for i, doc in enumerate(index.documents):
        if doc.id in exclude_ids:
            continue
        if doc.type != "gov_rule":
            continue
        score = float(similarities[i]) + _keyword_overlap_boost(question_text, doc.keywords)
        if score <= 0:
            continue
        gov_items.append((doc, score))

    gov_items.sort(key=lambda item: item[1], reverse=True)
    return gov_items[:limit]


def _collect_citations(retrieved: List[Tuple[RuleDocument, float]]) -> List[Dict[str, str]]:
    seen = set()
    citations = []
    for doc, _ in retrieved:
        src = doc.source or {}
        url = _normalize_text(src.get("url"))
        label = _normalize_text(src.get("label"))
        verified_on = _normalize_text(src.get("verified_on"))
        if not url or url in seen:
            continue
        if not (url.startswith("http://") or url.startswith("https://")):
            continue
        seen.add(url)
        citations.append(
            {
                "label": label or doc.title,
                "url": url,
                "verified_on": verified_on,
            }
        )
    return citations


def _blocked_intent(question: str) -> bool:
    lowered = question.lower()
    return any(marker in lowered for marker in BLOCKED_INTENT_MARKERS)


def _step_action_tip(current_step: int | None) -> str:
    tips = {
        0: "Complete all event identity and schedule fields before moving ahead.",
        1: "Ensure venue ownership is accurate and map pin is set; booked venues require owner consent.",
        2: "If fireworks/temporary structures are enabled, keep fire-safety documents ready.",
        3: "Crowd >500 should include a clear crowd-management strategy and emergency readiness.",
        4: "Road closure or high traffic impact usually needs prior traffic authority coordination.",
        5: "Large events should include a concrete waste-disposal and post-event cleanup plan.",
        6: "Upload all required files before review to avoid submission failure.",
        7: "Double-check risk factors and document completeness before final submit.",
    }
    return tips.get(current_step, "Verify your current step fields and supporting documents before submission.")


def _compose_answer(
    question: str,
    retrieved: List[Tuple[RuleDocument, float]],
    current_step: int | None,
    top_score: float,
) -> str:
    if _blocked_intent(question):
        return (
            "I cannot help with bypassing permissions or non-compliant actions. "
            "I can help you follow the official route: identify required approvals, prepare documents, and submit through the correct authority."
        )

    if not retrieved or top_score < 0.08:
        return (
            "I do not have enough verified rulebook context to answer that confidently. "
            "Please share event type, location (city/state), crowd size, and whether you need loudspeaker, fireworks, food stalls, or road closure so I can map the right approvals."
        )

    ui_docs = [doc for doc, _ in retrieved if doc.type == "ui_flow"]
    gov_docs = [doc for doc, _ in retrieved if doc.type == "gov_rule"]

    selected_rules = gov_docs[:3] if gov_docs else [doc for doc, _ in retrieved[:3]]
    rule_lines = []
    for doc in selected_rules:
        text = doc.content.strip()
        if len(text) > 180:
            text = text[:177].rstrip() + "..."
        rule_lines.append(f"- {doc.title}: {text}")

    ui_line = ""
    if ui_docs:
        ui_line = f"Portal flow hint: {ui_docs[0].content}"
    else:
        ui_line = f"Portal flow hint: {_step_action_tip(current_step)}"

    answer_parts = [
        "Based on the rulebook and your current context, here are the key compliance points:",
        "\n".join(rule_lines) if rule_lines else "- No exact rule matched; provide more event details for precise guidance.",
        ui_line,
        "Compliance note: this assistant is guidance-only; final legal position and approvals are determined by the competent local authority (Police/DM/Fire/Traffic/Municipality/FSSAI as applicable).",
    ]
    return "\n\n".join(part for part in answer_parts if part)


def answer_assistant_query(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise AssistantError("Assistant payload must be a JSON object.")

    question = _normalize_text(payload.get("question"))
    if len(question) < 3:
        raise AssistantError("Question is too short.")

    current_step = payload.get("current_step")
    if current_step is not None:
        try:
            current_step = int(current_step)
        except (TypeError, ValueError):
            current_step = None

    step_name = _normalize_text(payload.get("step_name"))
    form_context = payload.get("form_context") or {}
    if not isinstance(form_context, dict):
        form_context = {}

    query_text = _build_query_text(question, current_step, step_name, form_context)
    retrieved, top_score = _retrieve_documents(query_text, current_step=current_step)
    if _is_compliance_question(question):
        existing_ids = {doc.id for doc, _ in retrieved}
        gov_docs = _top_government_docs(
            query_text,
            question_text=question,
            exclude_ids=existing_ids,
            limit=2,
        )
        retrieved = [*retrieved, *gov_docs]

    retrieved = sorted(retrieved, key=lambda item: item[1], reverse=True)[:6]
    citations = _collect_citations(retrieved)
    answer = _compose_answer(question, retrieved, current_step=current_step, top_score=top_score)

    return {
        "status": "success",
        "answer": answer,
        "confidence": round(float(min(max(top_score, 0.0), 1.0)), 3),
        "guardrail_triggered": _blocked_intent(question),
        "matched_rules": [
            {
                "id": doc.id,
                "title": doc.title,
                "type": doc.type,
                "score": round(float(score), 4),
            }
            for doc, score in retrieved
        ],
        "citations": citations,
        "rulebook_version": _load_index().metadata.get("version", "unknown"),
    }
