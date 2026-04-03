from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from app.core.database import db
from app.services.risk_engine import RiskEngineError, analyze_risk


class ApprovalProbabilityError(Exception):
    """Raised when approval probability forecast cannot be computed."""


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
        parsed = max(parsed, minimum)
    return parsed


def _coerce_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _normalize_status(status: str) -> str:
    return (status or "").strip().lower()


def _is_approved_status(status: str) -> bool:
    normalized = _normalize_status(status)
    return "approved" in normalized


def _is_rejected_status(status: str) -> bool:
    normalized = _normalize_status(status)
    return "rejected" in normalized or "denied" in normalized


def _parse_datetime(date_value: str | None, time_value: str | None) -> Optional[datetime]:
    date_text = (date_value or "").strip()
    if not date_text:
        return None

    time_text = (time_value or "").strip()[:5] if time_value else "00:00"

    # Supports "YYYY-MM-DD", "YYYY-MM-DDTHH:MM:SS", and ISO strings with timezone.
    if "T" in date_text:
        try:
            parsed = datetime.fromisoformat(date_text.replace("Z", "+00:00"))
            return parsed.replace(tzinfo=None)
        except ValueError:
            pass

    for fmt in ("%Y-%m-%d %H:%M", "%Y/%m/%d %H:%M"):
        try:
            return datetime.strptime(f"{date_text} {time_text}", fmt)
        except ValueError:
            continue

    return None


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius_km * c


def _overlap_minutes(start_a: datetime, end_a: datetime, start_b: datetime, end_b: datetime) -> float:
    latest_start = max(start_a, start_b)
    earliest_end = min(end_a, end_b)
    delta = (earliest_end - latest_start).total_seconds() / 60.0
    return max(delta, 0.0)


def _parse_event_row(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    event = row.get("events") or {}
    if isinstance(event, list):
        event = event[0] if event else {}
    if not isinstance(event, dict):
        return None

    start_time = event.get("start_time")
    end_time = event.get("end_time")

    parsed_start = None
    parsed_end = None
    if start_time:
        parsed_start = _parse_datetime(str(start_time)[:10], str(start_time)[11:16] if "T" in str(start_time) else None)
        if parsed_start is None:
            try:
                parsed_start = datetime.fromisoformat(str(start_time).replace("Z", "+00:00")).replace(tzinfo=None)
            except ValueError:
                parsed_start = None

    if end_time:
        parsed_end = _parse_datetime(str(end_time)[:10], str(end_time)[11:16] if "T" in str(end_time) else None)
        if parsed_end is None:
            try:
                parsed_end = datetime.fromisoformat(str(end_time).replace("Z", "+00:00")).replace(tzinfo=None)
            except ValueError:
                parsed_end = None

    if parsed_start is None:
        return None
    if parsed_end is None:
        parsed_end = parsed_start + timedelta(hours=4)
    if parsed_end <= parsed_start:
        parsed_end = parsed_start + timedelta(hours=4)

    return {
        "status": row.get("status") or "",
        "category": str(event.get("category") or "").strip(),
        "expected_crowd": _coerce_int(event.get("expected_crowd"), default=0, minimum=0),
        "start_dt": parsed_start,
        "end_dt": parsed_end,
        "latitude": event.get("latitude"),
        "longitude": event.get("longitude"),
        "is_moving_procession": _coerce_bool(event.get("is_moving_procession")),
    }


def _fetch_historical_events(limit: int = 1200) -> Tuple[List[Dict[str, Any]], str]:
    try:
        response = (
            db.table("applications")
            .select(
                "status, submitted_at, events(category, expected_crowd, start_time, end_time, latitude, longitude, is_moving_procession)"
            )
            .order("submitted_at", desc=True)
            .limit(limit)
            .execute()
        )
        rows = response.data or []
        parsed = []
        for row in rows:
            parsed_row = _parse_event_row(row)
            if parsed_row:
                parsed.append(parsed_row)
        return parsed, "supabase_history"
    except Exception:
        return [], "fallback_no_history"


def _extract_candidate(payload: Dict[str, Any]) -> Dict[str, Any]:
    event_type = str(payload.get("event_type") or payload.get("eventType") or "").strip()
    crowd_size = _coerce_int(payload.get("crowd_size") or payload.get("crowdSize"), default=0, minimum=0)

    start_date = payload.get("start_date") or payload.get("startDate")
    end_date = payload.get("end_date") or payload.get("endDate") or start_date
    start_time = payload.get("start_time") or payload.get("startTime")
    end_time = payload.get("end_time") or payload.get("endTime")

    start_dt = _parse_datetime(str(start_date or ""), str(start_time or ""))
    end_dt = _parse_datetime(str(end_date or ""), str(end_time or ""))
    if start_dt is None:
        start_dt = datetime.utcnow() + timedelta(days=1)
    if end_dt is None or end_dt <= start_dt:
        end_dt = start_dt + timedelta(hours=4)

    latitude = payload.get("map_latitude") or payload.get("mapLatitude")
    longitude = payload.get("map_longitude") or payload.get("mapLongitude")
    lat_value = _coerce_float(latitude, default=float("nan"))
    lon_value = _coerce_float(longitude, default=float("nan"))
    has_coords = not (math.isnan(lat_value) or math.isnan(lon_value))

    moving = _coerce_bool(payload.get("is_moving_procession") or payload.get("isMovingProcession"))
    road_closure = _coerce_bool(payload.get("road_closure_required") or payload.get("roadClosureRequired"))
    traffic_impact = str(payload.get("trafficImpact") or payload.get("traffic_impact") or "").strip().lower()

    return {
        "event_type": event_type,
        "crowd_size": crowd_size,
        "start_dt": start_dt,
        "end_dt": end_dt,
        "latitude": lat_value,
        "longitude": lon_value,
        "has_coords": has_coords,
        "is_moving_procession": moving,
        "road_closure_required": road_closure,
        "traffic_impact": traffic_impact,
    }


def _base_approval_probability(candidate: Dict[str, Any], history: List[Dict[str, Any]]) -> Tuple[float, Dict[str, Any]]:
    if not history:
        return 0.62, {"source": "fallback_default", "global_total": 0, "type_total": 0}

    prior_mean = 0.62
    prior_strength = 6.0
    approved_total = sum(1 for item in history if _is_approved_status(item["status"]))
    global_rate = ((approved_total + (prior_mean * prior_strength)) / (len(history) + prior_strength))

    event_type = candidate["event_type"].lower()
    same_type = [item for item in history if item["category"].strip().lower() == event_type and event_type]
    if len(same_type) >= 6:
        same_type_approved = sum(1 for item in same_type if _is_approved_status(item["status"]))
        type_rate = ((same_type_approved + (prior_mean * prior_strength)) / (len(same_type) + prior_strength))
        # Smooth blend with global rate to avoid sharp swings.
        blended = (0.7 * type_rate) + (0.3 * global_rate)
        return blended, {"source": "type_blended", "global_total": len(history), "type_total": len(same_type)}

    return global_rate, {"source": "global_only", "global_total": len(history), "type_total": len(same_type)}


def _spatio_temporal_features(candidate: Dict[str, Any], history: List[Dict[str, Any]]) -> Dict[str, Any]:
    concurrent = []
    for item in history:
        overlap = _overlap_minutes(candidate["start_dt"], candidate["end_dt"], item["start_dt"], item["end_dt"])
        if overlap > 0:
            concurrent.append((item, overlap))

    nearby_count = 0
    nearby_moving = 0
    avg_distance_km = None
    distances = []
    spatial_radius_km = 8.0 if candidate["is_moving_procession"] else 5.0

    if candidate["has_coords"]:
        for item, _overlap in concurrent:
            item_lat = item.get("latitude")
            item_lon = item.get("longitude")
            if item_lat is None or item_lon is None:
                continue
            dist = _haversine_km(
                candidate["latitude"],
                candidate["longitude"],
                _coerce_float(item_lat),
                _coerce_float(item_lon),
            )
            distances.append(dist)
            if dist <= spatial_radius_km:
                nearby_count += 1
                if item.get("is_moving_procession"):
                    nearby_moving += 1

    if distances:
        avg_distance_km = round(sum(distances) / len(distances), 2)

    overlap_minutes_total = round(sum(overlap for _, overlap in concurrent), 2)

    return {
        "concurrent_events": len(concurrent),
        "nearby_events": nearby_count,
        "nearby_moving_events": nearby_moving,
        "total_overlap_minutes": overlap_minutes_total,
        "average_distance_km": avg_distance_km,
        "spatial_radius_km": spatial_radius_km,
    }


def _risk_penalty_from_model(payload: Dict[str, Any]) -> Tuple[float, str]:
    try:
        risk_output = analyze_risk(payload)
        risk_level = str(risk_output.get("risk_level") or "").strip().lower()
    except RiskEngineError:
        risk_level = ""
    except Exception:
        risk_level = ""

    if risk_level == "high":
        return 0.22, "high"
    if risk_level == "medium":
        return 0.12, "medium"
    if risk_level == "low":
        return 0.05, "low"
    return 0.1, "unknown"


def _build_recommendations(candidate: Dict[str, Any], features: Dict[str, Any], band: str) -> List[str]:
    recs = []
    if features["nearby_events"] >= 2:
        recs.append("Consider shifting event time-slot to reduce nearby concurrent crowd pressure.")
    if candidate["road_closure_required"] or candidate["traffic_impact"] in {"high", "medium"}:
        recs.append("Prepare a traffic diversion and parking management plan before submission.")
    if candidate["crowd_size"] > 1000:
        recs.append("Attach a detailed crowd management and emergency evacuation plan.")
    if candidate["is_moving_procession"]:
        recs.append("Share route details early with traffic/police for conflict checks.")
    if band == "LOW":
        recs.append("Reconsider date, route/venue, and crowd load before final submit.")

    if not recs:
        recs.append("Maintain complete documents and keep authority-specific permissions ready.")
    return recs[:4]


def forecast_approval_probability(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise ApprovalProbabilityError("Approval probability payload must be a JSON object.")

    candidate = _extract_candidate(payload)
    history, data_source = _fetch_historical_events()

    base_prob, base_meta = _base_approval_probability(candidate, history)
    features = _spatio_temporal_features(candidate, history)
    risk_penalty, risk_label = _risk_penalty_from_model(payload)

    crowd_penalty = 0.0
    if candidate["crowd_size"] >= 5000:
        crowd_penalty = 0.16
    elif candidate["crowd_size"] >= 1000:
        crowd_penalty = 0.1
    elif candidate["crowd_size"] >= 300:
        crowd_penalty = 0.05
    else:
        crowd_penalty = 0.02

    congestion_penalty = min(0.24, (features["nearby_events"] * 0.06) + (features["concurrent_events"] * 0.015))
    moving_penalty = 0.0
    if candidate["is_moving_procession"]:
        moving_penalty = 0.05 + min(0.12, features["nearby_moving_events"] * 0.04)

    traffic_penalty = 0.0
    if candidate["road_closure_required"]:
        traffic_penalty += 0.05
    if candidate["traffic_impact"] == "high":
        traffic_penalty += 0.06
    elif candidate["traffic_impact"] == "medium":
        traffic_penalty += 0.03

    lead_time_days = (candidate["start_dt"].date() - datetime.utcnow().date()).days
    lead_time_bonus = 0.0
    if lead_time_days >= 14:
        lead_time_bonus = 0.05
    elif lead_time_days >= 7:
        lead_time_bonus = 0.03
    elif lead_time_days <= 1:
        lead_time_bonus = -0.03

    probability = base_prob
    probability -= risk_penalty
    probability -= crowd_penalty
    probability -= congestion_penalty
    probability -= moving_penalty
    probability -= traffic_penalty
    probability += lead_time_bonus
    probability = max(0.05, min(0.95, probability))

    percent = round(probability * 100.0, 2)
    if percent >= 70:
        band = "HIGH"
        band_label = "High Likelihood"
    elif percent >= 45:
        band = "MEDIUM"
        band_label = "Moderate Likelihood"
    else:
        band = "LOW"
        band_label = "Low Likelihood"

    factors = [
        {"factor": "Historical approval baseline", "impact": round(base_prob * 100, 2), "direction": "positive"},
        {"factor": "Risk model influence", "impact": round(risk_penalty * 100, 2), "direction": "negative", "risk_level": risk_label},
        {"factor": "Crowd-size pressure", "impact": round(crowd_penalty * 100, 2), "direction": "negative"},
        {"factor": "Spatio-temporal congestion", "impact": round(congestion_penalty * 100, 2), "direction": "negative"},
        {"factor": "Procession/mobility complexity", "impact": round(moving_penalty * 100, 2), "direction": "negative"},
        {"factor": "Lead-time advantage", "impact": round(abs(lead_time_bonus) * 100, 2), "direction": "positive" if lead_time_bonus >= 0 else "negative"},
    ]

    return {
        "status": "success",
        "approval_probability": percent,
        "approval_band": band,
        "approval_band_label": band_label,
        "factors": factors,
        "spatial_temporal_summary": {
            **features,
            "history_events_considered": len(history),
            "history_source": data_source,
            "baseline_source": base_meta["source"],
            "baseline_type_samples": base_meta["type_total"],
            "baseline_global_samples": base_meta["global_total"],
        },
        "recommendations": _build_recommendations(candidate, features, band),
        "model_version": "approval-prob-v1",
    }
