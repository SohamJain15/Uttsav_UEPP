from __future__ import annotations

import asyncio
import concurrent.futures
import json
import os
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import joblib
import numpy as np
import pandas as pd


class RiskEngineError(Exception):
    """Raised when the AI risk engine cannot process the request."""


@dataclass
class RiskAssets:
    preprocessor: Any
    model: Any
    shap_explainer: Any
    feature_names: List[str]


_CACHED_ASSETS: RiskAssets | None = None
_LOAD_ERROR: str | None = None

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = "tinyllama"
OLLAMA_TIMEOUT_SECONDS = 20
RECOMMENDATION_FALLBACK = "Deploy additional crowd marshals and maintain emergency access routes."


def _resolve_model_dir() -> Path:
    explicit_dir = os.getenv("UTTSAV_RISK_MODEL_DIR")
    if explicit_dir:
        return Path(explicit_dir)
    return Path(__file__).resolve().parents[2] / "ai_intelligence" / "models" / "risk_model"


def _load_assets() -> RiskAssets:
    global _CACHED_ASSETS, _LOAD_ERROR

    if _CACHED_ASSETS is not None:
        return _CACHED_ASSETS
    if _LOAD_ERROR:
        raise RiskEngineError(_LOAD_ERROR)

    model_dir = _resolve_model_dir()
    try:
        preprocessor = joblib.load(model_dir / "uttsav_preprocessor.pkl")
        model = joblib.load(model_dir / "uttsav_rf_model.pkl")
        shap_explainer = joblib.load(model_dir / "uttsav_shap_explainer.pkl")
        feature_names = joblib.load(model_dir / "uttsav_feature_names.pkl")

        if not isinstance(feature_names, list):
            feature_names = list(feature_names)

        _CACHED_ASSETS = RiskAssets(
            preprocessor=preprocessor,
            model=model,
            shap_explainer=shap_explainer,
            feature_names=feature_names,
        )
        return _CACHED_ASSETS
    except Exception as exc:
        _LOAD_ERROR = f"Risk model assets could not be loaded from {model_dir}: {exc}"
        raise RiskEngineError(_LOAD_ERROR) from exc


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y", "on"}
    return bool(value)


def _coerce_int(value: Any, default: int = 0, minimum: int | None = None) -> int:
    try:
        parsed = int(float(value))
    except (TypeError, ValueError):
        parsed = default
    if minimum is not None:
        return max(parsed, minimum)
    return parsed


def _coerce_float(value: Any, default: float = 0.0, minimum: float | None = None) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        parsed = default
    if minimum is not None:
        return max(parsed, minimum)
    return parsed


def _parse_time_of_day(start_time: str | None) -> str:
    if not start_time:
        return "Evening"

    try:
        hour = datetime.strptime(start_time[:5], "%H:%M").hour
    except ValueError:
        return "Evening"

    if 5 <= hour < 12:
        return "Morning"
    if 12 <= hour < 17:
        return "Afternoon"
    if 17 <= hour < 21:
        return "Evening"
    return "Night"


def _infer_duration_hours(payload: Dict[str, Any]) -> int:
    if payload.get("duration_hours") is not None:
        return _coerce_int(payload.get("duration_hours"), default=4, minimum=1)
    if payload.get("Duration_Hours") is not None:
        return _coerce_int(payload.get("Duration_Hours"), default=4, minimum=1)

    start_date = payload.get("start_date") or payload.get("startDate")
    end_date = payload.get("end_date") or payload.get("endDate")
    start_time = payload.get("start_time") or payload.get("startTime")
    end_time = payload.get("end_time") or payload.get("endTime")

    if not start_time or not end_time:
        return 4

    try:
        start_t = datetime.strptime(start_time[:5], "%H:%M")
        end_t = datetime.strptime(end_time[:5], "%H:%M")
        diff_seconds = (end_t - start_t).total_seconds()
        if start_date and end_date:
            start_dt = datetime.strptime(f"{start_date} {start_time[:5]}", "%Y-%m-%d %H:%M")
            end_dt = datetime.strptime(f"{end_date} {end_time[:5]}", "%Y-%m-%d %H:%M")
            diff_seconds = (end_dt - start_dt).total_seconds()
        if diff_seconds <= 0:
            diff_seconds += 24 * 60 * 60
        return max(int(round(diff_seconds / 3600)), 1)
    except ValueError:
        return 4


def _infer_environment(venue_type: str) -> str:
    normalized = (venue_type or "").strip().lower()
    indoor_markers = ("hall", "auditorium", "indoor", "banquet")
    if any(marker in normalized for marker in indoor_markers):
        return "Indoor"
    return "Outdoor"


def _normalize_event_category(raw_value: str) -> str:
    value = (raw_value or "").strip().lower()
    mapping = {
        "private event": "Private Function",
        "religious event": "Religious Festival",
        "public festival": "Public Festival",
        "concert": "Concert",
        "sports event": "Sports Event",
        "exhibition": "Exhibition",
    }
    if value in mapping:
        return mapping[value]
    if not value:
        return "General Event"
    return raw_value.strip()


def _safe_ratio(numerator: float, denominator: float, fallback: float) -> float:
    if denominator <= 0:
        return fallback
    return numerator / denominator


def _clean_feature_name(raw_feature_name: str) -> str:
    cleaned = (
        raw_feature_name.replace("num__", "")
        .replace("bool__", "")
        .replace("cat__", "")
        .replace("_", " ")
        .strip()
    )
    return " ".join(part.capitalize() for part in cleaned.split())


def _build_factors_string(top_factors: List[Dict[str, Any]]) -> str:
    if not top_factors:
        return "No dominant SHAP factors were identified."
    return ", ".join(
        [
            f"{factor.get('feature', 'Unknown factor')} (impact {factor.get('impact', 0)})"
            for factor in top_factors[:3]
        ]
    )


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
        raise RiskEngineError(f"Ollama HTTP {exc.code}: {detail or exc.reason}") from exc
    except URLError as exc:
        raise RiskEngineError(f"Ollama connection failed: {exc.reason}") from exc
    except Exception as exc:
        raise RiskEngineError(f"Ollama request failed: {exc}") from exc

    try:
        parsed = json.loads(raw or "{}")
    except Exception as exc:
        raise RiskEngineError(f"Ollama returned invalid JSON: {exc}") from exc

    if not isinstance(parsed, dict):
        raise RiskEngineError("Ollama response must be a JSON object.")
    return parsed


async def _generate_precaution_with_ollama(risk_level: str, top_factors: List[Dict[str, Any]]) -> str:
    factors_string = _build_factors_string(top_factors)
    prompt = (
        "You are an AI safety officer. "
        f"A predictive model flagged a public event with a {risk_level} risk level. "
        f"The top contributing factors are: {factors_string}. "
        "Write a strict, 2-sentence actionable recommendation for government officials to mitigate this risk. "
        "Do not use pleasantries."
    )
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
    }
    try:
        response = await asyncio.to_thread(
            _post_json_sync,
            f"{OLLAMA_BASE_URL}/api/generate",
            payload,
            OLLAMA_TIMEOUT_SECONDS,
        )
        recommendation = str(response.get("response") or "").strip()
        if recommendation:
            return " ".join(recommendation.split())
    except Exception:
        return RECOMMENDATION_FALLBACK
    return RECOMMENDATION_FALLBACK


def _run_async(coro: Any) -> Any:
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        return executor.submit(lambda: asyncio.run(coro)).result()


def _extract_top_factors(assets: RiskAssets, transformed_input: Any, predicted_class: str) -> List[Dict[str, Any]]:
    shap_values = assets.shap_explainer.shap_values(transformed_input)
    class_labels = list(getattr(assets.model, "classes_", []))
    class_index = class_labels.index(predicted_class) if predicted_class in class_labels else 0

    if isinstance(shap_values, list):
        row_values = np.array(shap_values[class_index][0])
    else:
        shap_array = np.array(shap_values)
        if shap_array.ndim == 3:
            row_values = shap_array[0, :, class_index]
        elif shap_array.ndim == 2:
            row_values = shap_array[0]
        else:
            raise RiskEngineError("Unsupported SHAP output shape from explainer.")

    if row_values.shape[0] != len(assets.feature_names):
        raise RiskEngineError("SHAP feature count does not match trained feature names.")

    pairs = list(zip(assets.feature_names, row_values))
    pairs.sort(key=lambda item: abs(item[1]), reverse=True)

    top_factors = []
    for feature_name, impact in pairs[:5]:
        top_factors.append(
            {
                "feature": _clean_feature_name(feature_name),
                "impact": round(float(impact), 5),
                "direction": "supports_predicted_class" if impact >= 0 else "opposes_predicted_class",
            }
        )
    return top_factors


def _build_model_frame(payload: Dict[str, Any]) -> pd.DataFrame:
    # Direct model-key payload support (if caller already sends model-ready fields)
    if payload.get("Event_Category"):
        event_category = str(payload.get("Event_Category", "General Event"))
        time_of_day = str(payload.get("Time_Of_Day", "Evening"))
        environment_type = str(payload.get("Environment_Type", "Outdoor"))
        expected_crowd = _coerce_int(payload.get("Expected_Crowd"), default=0, minimum=0)
        max_capacity = _coerce_int(payload.get("Max_Venue_Capacity"), default=max(expected_crowd, 1), minimum=1)
        venue_area = _coerce_float(payload.get("Venue_Area_Sq_Meters"), default=max(expected_crowd * 2.0, 500.0), minimum=1.0)
        fire_exits = _coerce_int(payload.get("Number_Of_Fire_Exits"), default=2, minimum=0)
        duration_hours = _coerce_int(payload.get("Duration_Hours"), default=4, minimum=1)
        has_fireworks = _coerce_int(payload.get("Has_Fireworks"), default=0, minimum=0)
        has_temp_structures = _coerce_int(payload.get("Has_Temp_Structures"), default=0, minimum=0)
        vip_attendance = _coerce_int(payload.get("VIP_Attendance"), default=0, minimum=0)
        loudspeaker = _coerce_int(payload.get("Loudspeaker_Used"), default=0, minimum=0)
        road_closure = _coerce_int(payload.get("Road_Closure_Required"), default=0, minimum=0)
        moving_procession = _coerce_int(payload.get("Is_Moving_Procession"), default=0, minimum=0)
        food_stalls = _coerce_int(payload.get("Food_Stalls_Present"), default=0, minimum=0)
        liquor = _coerce_int(payload.get("Liquor_Served"), default=0, minimum=0)
    else:
        event_type = str(payload.get("event_type") or payload.get("eventType") or "General Event")
        venue_type = str(payload.get("venue_type") or payload.get("venueType") or "")
        start_time = str(payload.get("start_time") or payload.get("startTime") or "")
        expected_crowd = _coerce_int(payload.get("crowd_size") or payload.get("crowdSize"), default=0, minimum=0)

        event_category = _normalize_event_category(event_type)
        time_of_day = _parse_time_of_day(start_time)
        environment_type = _infer_environment(venue_type)

        max_capacity = _coerce_int(
            payload.get("max_venue_capacity") or payload.get("maxVenueCapacity"),
            default=max(int(expected_crowd * 1.25), 1),
            minimum=1,
        )
        venue_area = _coerce_float(
            payload.get("venue_area_sq_meters") or payload.get("venueAreaSqMeters"),
            default=max(expected_crowd * (1.5 if environment_type == "Indoor" else 2.5), 500.0),
            minimum=1.0,
        )
        fire_exits = _coerce_int(
            payload.get("number_of_fire_exits") or payload.get("numberOfFireExits"),
            default=2 if expected_crowd <= 300 else 4 if expected_crowd <= 1000 else 8,
            minimum=0,
        )
        duration_hours = _infer_duration_hours(payload)
        has_fireworks = 1 if _coerce_bool(payload.get("has_fireworks") or payload.get("fireworks")) else 0
        has_temp_structures = (
            1 if _coerce_bool(payload.get("has_temp_structures") or payload.get("temporaryStructures") or payload.get("stageRequired")) else 0
        )
        vip_attendance = 1 if _coerce_bool(payload.get("vip_attendance") or payload.get("vipAttendance")) else 0
        loudspeaker = 1 if _coerce_bool(payload.get("loudspeaker_used") or payload.get("loudspeakerUsed") or payload.get("soundSystem")) else 0
        road_closure = 1 if _coerce_bool(payload.get("road_closure_required") or payload.get("roadClosureRequired")) else 0
        moving_procession = 1 if _coerce_bool(payload.get("is_moving_procession") or payload.get("isMovingProcession")) else 0
        food_stalls = 1 if _coerce_bool(payload.get("food_stalls_present") or payload.get("foodStalls")) else 0
        liquor = 1 if _coerce_bool(payload.get("liquor_served") or payload.get("liquorServed")) else 0

    base_payload = {
        "Event_Category": event_category,
        "Time_Of_Day": time_of_day,
        "Environment_Type": environment_type,
        "Expected_Crowd": expected_crowd,
        "Max_Venue_Capacity": max_capacity,
        "Venue_Area_Sq_Meters": venue_area,
        "Number_Of_Fire_Exits": fire_exits,
        "Duration_Hours": duration_hours,
        "Has_Fireworks": has_fireworks,
        "Has_Temp_Structures": has_temp_structures,
        "VIP_Attendance": vip_attendance,
        "Loudspeaker_Used": loudspeaker,
        "Road_Closure_Required": road_closure,
        "Is_Moving_Procession": moving_procession,
        "Food_Stalls_Present": food_stalls,
        "Liquor_Served": liquor,
    }

    frame = pd.DataFrame([base_payload])
    frame["Crowd_Density"] = frame["Expected_Crowd"] / frame["Venue_Area_Sq_Meters"]
    frame["Capacity_Utilization"] = frame["Expected_Crowd"] / frame["Max_Venue_Capacity"]
    frame["People_Per_Exit"] = np.where(
        frame["Number_Of_Fire_Exits"] > 0,
        frame["Expected_Crowd"] / frame["Number_Of_Fire_Exits"],
        frame["Expected_Crowd"],
    )

    # Hard safety guardrails against invalid numeric overflow/NaN.
    frame["Crowd_Density"] = frame["Crowd_Density"].replace([np.inf, -np.inf], np.nan).fillna(0.0)
    frame["Capacity_Utilization"] = frame["Capacity_Utilization"].replace([np.inf, -np.inf], np.nan).fillna(0.0)
    frame["People_Per_Exit"] = frame["People_Per_Exit"].replace([np.inf, -np.inf], np.nan).fillna(0.0)

    return frame


def analyze_risk(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise RiskEngineError("Risk analysis payload must be a JSON object.")

    assets = _load_assets()
    model_frame = _build_model_frame(payload)

    try:
        transformed_input = assets.preprocessor.transform(model_frame)
        predicted_class = str(assets.model.predict(transformed_input)[0])

        confidence = 0.0
        if hasattr(assets.model, "predict_proba"):
            probabilities = assets.model.predict_proba(transformed_input)[0]
            confidence = float(np.max(probabilities) * 100.0)

        top_factors = _extract_top_factors(assets, transformed_input, predicted_class)
        recommendation = _run_async(_generate_precaution_with_ollama(predicted_class, top_factors))

        return {
            "status": "success",
            "risk_level": predicted_class,
            "confidence": round(confidence, 2),
            "driving_factors": top_factors[:3],
            "ai_recommendation": recommendation,
        }
    except RiskEngineError:
        raise
    except Exception as exc:
        raise RiskEngineError(f"Risk analysis failed during inference: {exc}") from exc

