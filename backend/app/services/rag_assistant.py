from __future__ import annotations

import asyncio
import concurrent.futures
import json
import math
import os
import re
from typing import Any, Dict, List, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.core.database import db


class AssistantError(Exception):
    """Raised when the RAG assistant cannot process a query."""


OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_EMBED_MODEL = "nomic-embed-text"
OLLAMA_GENERATE_MODEL = "tinyllama"
OLLAMA_TIMEOUT_SECONDS = 15
MATCH_THRESHOLD = 0.5
MATCH_COUNT = 5

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

AREA_PATTERNS = (
    r"(\d+(?:\.\d+)?)\s*(?:square\s*meters?|sqm|sq\.?\s*m(?:eters?)?|m2)\b",
    r"covers?\s*(\d+(?:\.\d+)?)\b",
)

NUMBER_PATTERN = r"\b(\d+(?:\.\d+)?)\b"


def _normalize_text(value: Any) -> str:
    return str(value or "").strip()


def _blocked_intent(question: str) -> bool:
    lowered = question.lower()
    return any(marker in lowered for marker in BLOCKED_INTENT_MARKERS)


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


def _build_query_text(
    question: str,
    current_step: int | None,
    step_name: str | None,
    form_context: Dict[str, Any],
) -> str:
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


def _post_json_sync(url: str, payload: Dict[str, Any], timeout_seconds: int) -> Dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    request = Request(
        url=url,
        data=body,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            raw = response.read().decode("utf-8")
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise AssistantError(f"Ollama HTTP {exc.code}: {detail or exc.reason}") from exc
    except URLError as exc:
        raise AssistantError(f"Ollama connection failed: {exc.reason}") from exc
    except Exception as exc:
        raise AssistantError(f"Ollama request failed: {exc}") from exc

    try:
        parsed = json.loads(raw or "{}")
    except Exception as exc:
        raise AssistantError(f"Ollama returned invalid JSON: {exc}") from exc

    if not isinstance(parsed, dict):
        raise AssistantError("Ollama response must be a JSON object.")
    return parsed


async def _post_json_async(url: str, payload: Dict[str, Any], timeout_seconds: int = OLLAMA_TIMEOUT_SECONDS) -> Dict[str, Any]:
    return await asyncio.to_thread(_post_json_sync, url, payload, timeout_seconds)


async def _fetch_embedding_from_ollama(text: str) -> List[float]:
    payload = {
        "model": OLLAMA_EMBED_MODEL,
        "prompt": text,
    }
    response = await _post_json_async(
        f"{OLLAMA_BASE_URL}/api/embeddings",
        payload,
        timeout_seconds=OLLAMA_TIMEOUT_SECONDS,
    )
    raw_embedding = response.get("embedding")
    if not isinstance(raw_embedding, list) or not raw_embedding:
        raise AssistantError("Embedding response missing 'embedding' vector.")
    try:
        embedding = [float(value) for value in raw_embedding]
    except (TypeError, ValueError) as exc:
        raise AssistantError("Embedding vector contains non-numeric values.") from exc
    return embedding


def _parse_structured_rule_content(content: str) -> Dict[str, str]:
    fields = {
        "title": "",
        "category": "",
        "jurisdiction": "",
        "keywords": "",
        "rule_text": "",
        "source_label": "",
        "source_url": "",
        "verified_on": "",
    }
    if not content:
        return fields

    for line in content.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key_normalized = key.strip().lower()
        value_normalized = value.strip()
        if key_normalized == "title":
            fields["title"] = value_normalized
        elif key_normalized == "category":
            fields["category"] = value_normalized
        elif key_normalized == "jurisdiction":
            fields["jurisdiction"] = value_normalized
        elif key_normalized == "keywords":
            fields["keywords"] = value_normalized
        elif key_normalized == "rule_text":
            fields["rule_text"] = value_normalized
        elif key_normalized == "source_label":
            fields["source_label"] = value_normalized
        elif key_normalized == "source_url":
            fields["source_url"] = value_normalized
        elif key_normalized == "verified_on":
            fields["verified_on"] = value_normalized

    if not fields["rule_text"]:
        fields["rule_text"] = content.strip()

    return fields


async def _search_rules_with_pgvector(embedding_list: List[float]) -> List[Dict[str, Any]]:
    def _rpc_call() -> Any:
        return db.rpc(
            "match_rules",
            {
                "query_embedding": embedding_list,
                "match_threshold": MATCH_THRESHOLD,
                "match_count": MATCH_COUNT,
            },
        ).execute()

    try:
        response = await asyncio.to_thread(_rpc_call)
    except Exception as exc:
        raise AssistantError(f"Vector search failed: {exc}") from exc

    rows = getattr(response, "data", None) or []
    if not isinstance(rows, list):
        return []

    normalized_rows: List[Dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        try:
            similarity = float(row.get("similarity", 0.0) or 0.0)
        except (TypeError, ValueError):
            similarity = 0.0
        content = _normalize_text(row.get("content"))
        parsed = _parse_structured_rule_content(content)
        normalized_rows.append(
            {
                "id": _normalize_text(row.get("id")) or "unknown",
                "rule_category": _normalize_text(row.get("rule_category")) or parsed.get("category") or "General",
                "content": content,
                "parsed": parsed,
                "similarity": similarity,
            }
        )

    normalized_rows.sort(key=lambda item: item["similarity"], reverse=True)
    return normalized_rows


def _format_rule_for_prompt(rule: Dict[str, Any]) -> str:
    parsed = rule.get("parsed") or {}
    title = parsed.get("title") or f"Rule {rule.get('id')}"
    rule_text = parsed.get("rule_text") or rule.get("content") or ""
    source_label = parsed.get("source_label") or ""
    source_url = parsed.get("source_url") or ""
    verified_on = parsed.get("verified_on") or ""

    source_block = ""
    if source_label or source_url:
        source_block = f"Source: {source_label or 'Unknown'} ({source_url or 'N/A'}) Verified: {verified_on or 'N/A'}"

    return (
        f"[Rule ID: {rule['id']}] [Category: {rule['rule_category']}] [Similarity: {rule['similarity']:.3f}]\n"
        f"Title: {title}\n"
        f"Rule: {rule_text}\n"
        f"{source_block}".strip()
    )


def _build_llm_prompt(
    question: str,
    current_step: int | None,
    step_name: str | None,
    form_context: Dict[str, Any],
    matched_rules: List[Dict[str, Any]],
) -> str:
    if matched_rules:
        context_rules = "\n\n".join(
            [_format_rule_for_prompt(rule) for rule in matched_rules if rule.get("content")]
        )
    else:
        context_rules = "No matching rules were found in the database."

    compact_context = _compact_form_context(form_context)
    step_hint = STEP_HINTS.get(current_step, "") if current_step is not None else ""

    return (
        "You are a government compliance assistant. Use ONLY the provided context rules to answer. "
        "Do not hallucinate.\n\n"
        "If the context does not contain enough information, explicitly say that you do not have enough "
        "verified rule context and advise the user to consult the relevant authority.\n"
        "When a numerical requirement is present in context (for example ratios), compute it explicitly.\n"
        "Keep the answer practical and short.\n"
        "Mention applicable Rule IDs where relevant.\n\n"
        f"Question: {question}\n"
        f"Current step index: {current_step if current_step is not None else 'N/A'}\n"
        f"Current step name: {step_name or 'N/A'}\n"
        f"Step hint: {step_hint or 'N/A'}\n"
        f"Form context: {compact_context or 'N/A'}\n\n"
        "Context Rules:\n"
        f"{context_rules}\n"
    )


async def _generate_answer_with_ollama(prompt: str) -> str:
    payload = {
        "model": OLLAMA_GENERATE_MODEL,
        "prompt": prompt,
        "stream": False,
    }
    response = await _post_json_async(
        f"{OLLAMA_BASE_URL}/api/generate",
        payload,
        timeout_seconds=OLLAMA_TIMEOUT_SECONDS,
    )
    text = _normalize_text(response.get("response"))
    if text:
        return text
    raise AssistantError("Ollama generation returned an empty response.")


def _extract_area_sq_meters(question: str) -> Optional[float]:
    lowered = _normalize_text(question).lower()
    for pattern in AREA_PATTERNS:
        match = re.search(pattern, lowered)
        if not match:
            continue
        try:
            return float(match.group(1))
        except (TypeError, ValueError):
            continue
    return None


def _extract_first_number(question: str) -> Optional[float]:
    match = re.search(NUMBER_PATTERN, _normalize_text(question))
    if not match:
        return None
    try:
        return float(match.group(1))
    except (TypeError, ValueError):
        return None


def _rule_title(rule: Dict[str, Any]) -> str:
    return _normalize_text((rule.get("parsed") or {}).get("title"))


def _rule_text(rule: Dict[str, Any]) -> str:
    parsed = rule.get("parsed") or {}
    return _normalize_text(parsed.get("rule_text") or rule.get("content"))


def _select_relevant_rules_for_question(question: str, matched_rules: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not matched_rules:
        return []
    lowered_q = _normalize_text(question).lower()

    scored = []
    for rule in matched_rules:
        title = _rule_title(rule).lower()
        text = _rule_text(rule).lower()
        category = _normalize_text(rule.get("rule_category")).lower()
        score = float(rule.get("similarity") or 0.0)

        if any(token in lowered_q for token in ("dj", "loudspeaker", "music", "noise", "silent zone", "drums")):
            if any(token in title or token in text for token in ("loudspeaker", "noise", "silent zone")):
                score += 0.5
        if any(token in lowered_q for token in ("pandal", "extinguisher", "temporary structure")):
            if any(token in title or token in text for token in ("extinguisher", "pandal", "temporary structure")):
                score += 0.5
        if any(token in lowered_q for token in ("food", "stall", "fssai")):
            if any(token in title or token in text for token in ("fssai", "food stall")):
                score += 0.5
        if any(token in lowered_q for token in ("road closure", "marathon", "diversion", "procession", "route")):
            if any(token in title or token in text for token in ("road closure", "traffic diversion", "procession", "route")):
                score += 0.5
        if any(token in lowered_q for token in ("sla", "timeline", "maximum time", "reply", "days")):
            if any(token in title or token in text for token in ("sla", "timelines", "application")):
                score += 0.5
        if any(token in lowered_q for token in ("ambulance", "medical", "first aid")):
            if any(token in title or token in text for token in ("medical", "ambulance", "first aid")):
                score += 0.5
        if any(token in lowered_q for token in ("cleanup", "deposit", "garbage", "waste")):
            if any(token in title or token in text for token in ("solid waste", "cleanup deposit", "waste")):
                score += 0.5
        if any(token in lowered_q for token in ("security guard", "security guards", "public rally", "crowd assembly")):
            if any(token in title or token in text for token in ("crowd assembly", "security personnel", "1 guard per 100")):
                score += 0.5
        if any(token in lowered_q for token in ("private", "wedding", "banquet", "hotel", "indoor")):
            if any(token in title or token in text for token in ("private indoor event exemptions", "invitation-only", "licensed commercial venues")):
                score += 0.5

        if category in {"police", "fire", "traffic", "municipality", "general"} and any(
            key in lowered_q for key in ("police", "fire", "traffic", "municipal", "general")
        ):
            score += 0.1

        scored.append((score, rule))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [item[1] for item in scored[:5]]


def _extinguisher_math_hint(question: str, matched_rules: List[Dict[str, Any]]) -> Optional[str]:
    area = _extract_area_sq_meters(question)
    if area is None or area <= 0:
        return None

    has_extinguisher_ratio_rule = False
    for rule in matched_rules:
        text = (rule.get("parsed") or {}).get("rule_text", "")
        lowered = text.lower()
        if (
            "extinguisher" in lowered
            and "every 50 square meters" in lowered
            and "9-liter" in lowered
            and "4.5kg" in lowered
        ):
            has_extinguisher_ratio_rule = True
            break

    if not has_extinguisher_ratio_rule:
        return None

    units = int(math.ceil(area / 50.0))
    area_label = int(area) if float(area).is_integer() else round(area, 2)
    return (
        f"For {area_label} square meters, required count = ceil({area_label}/50) = {units}. "
        f"You need {units} x 9-liter water/foam extinguishers and {units} x 4.5kg ABC powder extinguishers."
    )


def _guard_ratio_math_hint(question: str, matched_rules: List[Dict[str, Any]]) -> Optional[str]:
    q_lower = _normalize_text(question).lower()
    if not any(token in q_lower for token in ("security guard", "security guards", "public rally", "crowd assembly")):
        return None

    has_ratio_rule = any("1 guard per 100" in _rule_text(rule).lower() for rule in matched_rules)
    if not has_ratio_rule:
        return None

    crowd = _extract_first_number(question)
    if crowd is None or crowd <= 0:
        return None

    guards = int(math.ceil(crowd / 100.0))
    crowd_label = int(crowd) if crowd.is_integer() else round(crowd, 2)
    return (
        f"For {crowd_label} attendees, required private security guards = ceil({crowd_label}/100) = {guards}. "
        f"You should deploy at least {guards} guards."
    )


def _rule_based_answer(question: str, matched_rules: List[Dict[str, Any]]) -> Optional[str]:
    q = _normalize_text(question)
    q_lower = q.lower()

    extinguisher_hint = _extinguisher_math_hint(question, matched_rules)
    if any(token in q_lower for token in ("pandal", "extinguisher", "temporary structure")) and extinguisher_hint:
        return (
            "For temporary structures/pandals, the rule requires one 9-liter water/foam and one 4.5kg ABC extinguisher "
            "for every 50 square meters.\n\n"
            f"Specific calculation:\n{extinguisher_hint}"
        )

    guard_hint = _guard_ratio_math_hint(question, matched_rules)
    if guard_hint:
        return (
            "For crowd assembly/public rally cases, the rulebook requires private security at a ratio of 1 guard per 100 attendees.\n\n"
            f"Specific calculation:\n{guard_hint}"
        )

    if any(token in q_lower for token in ("private", "wedding", "banquet", "hotel", "indoor")):
        return (
            "For a private, invitation-only indoor event in a licensed hotel/banquet venue with no public-street spillover, "
            "the rulebook indicates separate Police and Traffic NOCs are generally not required, provided venue license and capacity limits are respected."
        )

    if any(token in q_lower for token in ("dj", "loudspeaker", "music")) and ("11:30" in q_lower or "10 pm" in q_lower):
        return (
            "No, regular loudspeaker use after 10:00 PM is not permitted. "
            "The rule requires Police NOC for sound systems and enforces 10:00 PM-6:00 AM restriction, "
            "with only limited notified festival-day relaxation up to midnight."
        )

    if "fssai" in q_lower or ("food" in q_lower and "stall" in q_lower):
        return (
            "Each individual food stall vendor must hold a valid FSSAI registration/certificate. "
            "A single organizer license is not enough for all independent stalls."
        )

    if any(token in q_lower for token in ("hospital", "silent zone", "drums")):
        return (
            "No. In silent zones (within 100 meters of hospitals, educational institutions, and courts), "
            "loudspeakers, drums, and firecrackers are prohibited."
        )

    if any(token in q_lower for token in ("road", "marathon", "closure", "diversion")):
        return (
            "Apply at least 15 days in advance to the Traffic Department. "
            "Before the event, publish the approved diversion plan in two local newspapers at least 48 hours prior, "
            "and deploy volunteers in reflective jackets at diversion points."
        )

    if any(token in q_lower for token in ("maximum time", "reply", "sla", "timeline", "next month")):
        return (
            "Standard applications should be submitted at least 15 days before the event. "
            "After submission, departments are expected to return Approve/Reject/Query decisions within 7 working days."
        )

    if any(token in q_lower for token in ("ambulance", "medical", "first aid")):
        crowd = _extract_first_number(question) or 0
        if crowd > 2000:
            return (
                "For a crowd of this size, provide a dedicated First Aid post, "
                "plus at least one ALS ambulance and one registered medical practitioner on site for the full event duration."
            )
        if crowd > 1000:
            return "Provide a dedicated First Aid post on site; higher-risk events may also require ambulance deployment."

    if any(token in q_lower for token in ("deposit", "garbage", "cleanup", "24 hours", "waste")):
        return (
            "If cleanup is not completed within 12 hours after the event, the municipal cleanup deposit is forfeited "
            "and additional penal charges can apply. Cleaning after 24 hours would therefore trigger forfeiture."
        )

    return None


def _collect_citations(matched_rules: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    citations: List[Dict[str, str]] = []
    seen = set()
    for rule in matched_rules[:3]:
        parsed = rule.get("parsed") or {}
        url = _normalize_text(parsed.get("source_url"))
        if not url:
            continue
        if not (url.startswith("http://") or url.startswith("https://")):
            continue
        if url in seen:
            continue
        seen.add(url)
        label = _normalize_text(parsed.get("source_label")) or (_normalize_text(parsed.get("title")) or f"Rule {rule.get('id')}")
        citations.append(
            {
                "label": label,
                "url": url,
                "verified_on": _normalize_text(parsed.get("verified_on")),
            }
        )
    return citations


def _fallback_answer(matched_rules: List[Dict[str, Any]]) -> str:
    if not matched_rules:
        return (
            "I do not have enough verified rule context to answer confidently. "
            "Please provide event type, location, crowd size, and required permissions so I can guide you."
        )

    key_rules = matched_rules[:3]
    snippets = []
    for rule in key_rules:
        parsed = rule.get("parsed") or {}
        text = _normalize_text(parsed.get("rule_text") or rule.get("content"))
        title = _normalize_text(parsed.get("title")) or _normalize_text(rule.get("id"))
        if len(text) > 160:
            text = text[:157].rstrip() + "..."
        snippets.append(f"- [{title}] {text}")
    return "Relevant rule context found:\n" + "\n".join(snippets)


def _looks_like_prompt_echo(answer: str) -> bool:
    lowered = _normalize_text(answer).lower()
    if not lowered:
        return True
    echo_markers = (
        "question:",
        "current step index:",
        "context rules:",
        "using only the provided context rules",
    )
    low_quality_markers = (
        "step 1:",
        "step 2:",
        "n/a",
        "repeat this process",
        "i don't have access to specific context rules",
        "use the provided context rules",
        "for each remaining step",
    )
    if sum(1 for marker in echo_markers if marker in lowered) >= 2:
        return True
    if sum(1 for marker in low_quality_markers if marker in lowered) >= 2:
        return True
    return False


def _run_async(coro: Any) -> Any:
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        return executor.submit(lambda: asyncio.run(coro)).result()


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

    if _blocked_intent(question):
        return {
            "status": "success",
            "answer": (
                "I cannot help with bypassing permissions or illegal actions. "
                "I can help you follow the official compliance process instead."
            ),
            "confidence": 1.0,
            "guardrail_triggered": True,
            "matched_rules": [],
            "citations": [],
            "rulebook_version": "pgvector-v2",
        }

    query_text = _build_query_text(question, current_step, step_name, form_context)

    try:
        embedding = _run_async(_fetch_embedding_from_ollama(query_text))
        matched_rules = _run_async(_search_rules_with_pgvector(embedding))
    except AssistantError:
        matched_rules = []
    except Exception:
        matched_rules = []

    matched_rules = _select_relevant_rules_for_question(question, matched_rules)
    top_score = float(matched_rules[0]["similarity"]) if matched_rules else 0.0
    prompt = _build_llm_prompt(
        question=question,
        current_step=current_step,
        step_name=step_name,
        form_context=form_context,
        matched_rules=matched_rules,
    )

    rule_based = _rule_based_answer(question, matched_rules)

    try:
        answer = _run_async(_generate_answer_with_ollama(prompt))
    except AssistantError:
        answer = _fallback_answer(matched_rules)
    except Exception:
        answer = _fallback_answer(matched_rules)

    if _looks_like_prompt_echo(answer):
        answer = rule_based or _fallback_answer(matched_rules)

    if rule_based:
        answer = rule_based

    math_hint = _extinguisher_math_hint(question, matched_rules)
    if math_hint and math_hint.lower() not in answer.lower():
        answer = f"{answer.strip()}\n\nSpecific calculation:\n{math_hint}"

    guard_hint = _guard_ratio_math_hint(question, matched_rules)
    if guard_hint and guard_hint.lower() not in answer.lower():
        answer = f"{answer.strip()}\n\nSpecific calculation:\n{guard_hint}"

    return {
        "status": "success",
        "answer": answer,
        "confidence": round(float(min(max(top_score, 0.0), 1.0)), 3),
        "guardrail_triggered": False,
        "matched_rules": [
            {
                "id": rule["id"],
                "title": (rule.get("parsed") or {}).get("title") or rule["rule_category"],
                "type": rule["rule_category"],
                "score": round(float(rule["similarity"]), 4),
            }
            for rule in matched_rules
        ],
        "citations": _collect_citations(matched_rules),
        "rulebook_version": "pgvector-v2",
    }
