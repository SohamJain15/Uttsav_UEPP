from __future__ import annotations

import html
import json
import math
import os
import re
from datetime import UTC, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlencode
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.core.database import db


class CollisionEngineError(Exception):
    """Raised when route collision analysis cannot be completed."""


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y", "on"}
    return bool(value)


def _coerce_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _coerce_int(value: Any, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _clean_html_text(raw: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", raw or "")).strip()


def _parse_datetime(date_value: str | None, time_value: str | None) -> Optional[datetime]:
    date_text = (date_value or "").strip()
    if not date_text:
        return None
    time_text = (time_value or "").strip()[:5] if time_value else "00:00"

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


def _haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius_km * c * 1000.0


def _google_maps_key() -> Optional[str]:
    """Get Google Maps API key from environment variables"""
    key = (
        os.getenv("GOOGLE_MAPS_API_KEY")
        or os.getenv("GOOGLE_DIRECTIONS_API_KEY")
        or os.getenv("VITE_GOOGLE_MAPS_API_KEY")
        or ""
    ).strip()
    return key if key else None


def _fetch_route_options(
    origin: str,
    destination: str,
    mode: str = "walking",
    alternatives: bool = True,
) -> List[Dict[str, Any]]:
    """Fetch route options from Google Maps."""
    api_key = _google_maps_key()

    # Treat missing key as an API failure so caller can use simulated fallback consistently.
    if not api_key:
        raise CollisionEngineError("Google Directions API key is not configured.")

    params = {
        "origin": origin,
        "destination": destination,
        "mode": mode,
        "alternatives": "true" if alternatives else "false",
        "key": api_key,
    }
    url = f"https://maps.googleapis.com/maps/api/directions/json?{urlencode(params)}"

    request = Request(url, method="GET")
    try:
        with urlopen(request, timeout=18) as response:
            raw = response.read().decode("utf-8")
    except HTTPError as exc:
        detail = ""
        try:
            detail = exc.read().decode("utf-8", errors="ignore")
        except Exception:
            detail = str(exc.reason or "")
        raise CollisionEngineError(f"Google Directions API HTTP {exc.code}: {detail or exc.reason}") from exc
    except URLError as exc:
        raise CollisionEngineError(f"Failed to connect to Google Directions API: {exc.reason}") from exc
    except Exception as exc:
        raise CollisionEngineError(f"Failed to connect to Google Directions API: {exc}") from exc

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise CollisionEngineError(f"Google Directions API returned invalid JSON: {exc}") from exc

    status = str(data.get("status") or "")
    if status != "OK":
        raise CollisionEngineError(f"Google Directions API error: {status}")

    route_items = []
    for index, route in enumerate(data.get("routes", []), start=1):
        legs = route.get("legs") or []
        if not legs:
            continue
        leg = legs[0]

        timeline = []
        cumulative_seconds = 0
        for step in leg.get("steps", []):
            duration_value = _coerce_int((step.get("duration") or {}).get("value"), default=0)
            cumulative_seconds += max(duration_value, 0)

            end_loc = step.get("end_location") or {}
            timeline.append(
                {
                    "time_offset_seconds": cumulative_seconds,
                    "end_location": {
                        "lat": _coerce_float(end_loc.get("lat")),
                        "lng": _coerce_float(end_loc.get("lng")),
                    },
                    "instructions": _clean_html_text(step.get("html_instructions") or ""),
                }
            )

        route_items.append(
            {
                "route_id": f"R{index}",
                "summary": route.get("summary") or f"Route {index}",
                "total_distance": (leg.get("distance") or {}).get("text") or "",
                "total_duration": (leg.get("duration") or {}).get("text") or "",
                "total_duration_seconds": _coerce_int((leg.get("duration") or {}).get("value"), default=0),
                "encoded_polyline": ((route.get("overview_polyline") or {}).get("points") or ""),
                "timeline": timeline,
            }
        )

    if not route_items:
        raise CollisionEngineError("No route alternatives received from Google Directions API.")
    return route_items


def _parse_timeline(raw_timeline: Any) -> List[Dict[str, Any]]:
    if raw_timeline is None:
        return []

    timeline_obj = raw_timeline
    if isinstance(raw_timeline, str):
        text = raw_timeline.strip()
        if not text:
            return []
        try:
            timeline_obj = json.loads(text)
        except json.JSONDecodeError:
            return []

    if not isinstance(timeline_obj, list):
        return []

    parsed = []
    for step in timeline_obj:
        if not isinstance(step, dict):
            continue
        end_location = step.get("end_location") or {}
        lat = end_location.get("lat")
        lng = end_location.get("lng")
        if lat is None or lng is None:
            continue
        parsed.append(
            {
                "time_offset_seconds": _coerce_int(step.get("time_offset_seconds"), default=0),
                "end_location": {"lat": _coerce_float(lat), "lng": _coerce_float(lng)},
                "instructions": str(step.get("instructions") or ""),
            }
        )
    return parsed


def _build_fallback_timeline(latitude: Any, longitude: Any) -> List[Dict[str, Any]]:
    if latitude is None or longitude is None:
        return []
    lat = _coerce_float(latitude, default=float("nan"))
    lng = _coerce_float(longitude, default=float("nan"))
    if math.isnan(lat) or math.isnan(lng):
        return []
    return [
        {
            "time_offset_seconds": 0,
            "end_location": {"lat": lat, "lng": lng},
            "instructions": "Event location",
        }
    ]


def _parse_event_datetime(raw_value: Any) -> Optional[datetime]:
    if not raw_value:
        return None
    try:
        return datetime.fromisoformat(str(raw_value).replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return _parse_datetime(str(raw_value)[:10], str(raw_value)[11:16] if "T" in str(raw_value) else None)


def _parse_route_geometry_points(raw_geometry: Any) -> List[Dict[str, float]]:
    if raw_geometry is None:
        return []

    geometry_obj = raw_geometry
    if isinstance(raw_geometry, str):
        text = raw_geometry.strip()
        if not text:
            return []
        if text.startswith("{"):
            try:
                geometry_obj = json.loads(text)
            except json.JSONDecodeError:
                geometry_obj = text
        else:
            geometry_obj = text

    # GeoJSON-like object.
    if isinstance(geometry_obj, dict):
        g_type = str(geometry_obj.get("type") or "").upper()
        coords = geometry_obj.get("coordinates") or []
        if g_type == "LINESTRING" and isinstance(coords, list):
            points = []
            for coord in coords:
                if not isinstance(coord, (list, tuple)) or len(coord) < 2:
                    continue
                lng = _coerce_float(coord[0], default=float("nan"))
                lat = _coerce_float(coord[1], default=float("nan"))
                if math.isnan(lat) or math.isnan(lng):
                    continue
                points.append({"lat": lat, "lng": lng})
            return points

    # WKT / EWKT support: LINESTRING or MULTILINESTRING.
    if isinstance(geometry_obj, str):
        text = geometry_obj.strip()
        if text.upper().startswith("SRID="):
            parts = text.split(";", 1)
            text = parts[1] if len(parts) > 1 else text
        upper_text = text.upper()
        if upper_text.startswith("MULTILINESTRING"):
            start = text.find("((")
            end = text.find("))", start + 2)
            if start != -1 and end != -1:
                text = f"LINESTRING({text[start + 2:end]})"
                upper_text = text.upper()
        if upper_text.startswith("LINESTRING"):
            start = text.find("(")
            end = text.rfind(")")
            if start == -1 or end == -1 or end <= start:
                return []
            coords_text = text[start + 1:end]
            points = []
            for pair in coords_text.split(","):
                raw_pair = pair.strip().split()
                if len(raw_pair) < 2:
                    continue
                lng = _coerce_float(raw_pair[0], default=float("nan"))
                lat = _coerce_float(raw_pair[1], default=float("nan"))
                if math.isnan(lat) or math.isnan(lng):
                    continue
                points.append({"lat": lat, "lng": lng})
            return points

    return []


def _timeline_from_route_points(
    points: List[Dict[str, float]],
    start_dt: datetime,
    end_dt: datetime,
    instruction_prefix: str,
) -> List[Dict[str, Any]]:
    if not points:
        return []
    duration_seconds = int(max((end_dt - start_dt).total_seconds(), 60))
    if len(points) == 1:
        offsets = [0]
    else:
        offsets = [int(round((duration_seconds * idx) / (len(points) - 1))) for idx in range(len(points))]
    timeline = []
    for idx, point in enumerate(points):
        timeline.append(
            {
                "time_offset_seconds": offsets[idx],
                "end_location": {"lat": point["lat"], "lng": point["lng"]},
                "instructions": f"{instruction_prefix} point {idx + 1}",
            }
        )
    return timeline


def _build_candidate_linestring_wkt(route: Dict[str, Any]) -> str:
    timeline = route.get("timeline") or []
    coords = []
    for step in timeline:
        loc = step.get("end_location") or {}
        lat = _coerce_float(loc.get("lat"), default=float("nan"))
        lng = _coerce_float(loc.get("lng"), default=float("nan"))
        if math.isnan(lat) or math.isnan(lng):
            continue
        coords.append(f"{lng} {lat}")
    if len(coords) < 2:
        return ""
    return f"LINESTRING({', '.join(coords)})"


def _build_simulated_route_options(
    origin: str,
    destination: str,
    payload: Dict[str, Any],
    start_dt: datetime,
    end_dt: datetime,
) -> List[Dict[str, Any]]:
    lat = payload.get("mapLatitude")
    if lat is None:
        lat = payload.get("map_latitude")
    lng = payload.get("mapLongitude")
    if lng is None:
        lng = payload.get("map_longitude")
    timeline = _build_fallback_timeline(lat, lng)
    return [
        {
            "route_id": "R1",
            "summary": f"Simulated route: {origin} to {destination}",
            "total_distance": "Unavailable",
            "total_duration": "Unavailable",
            "total_duration_seconds": int(max((end_dt - start_dt).total_seconds(), 3600)),
            "encoded_polyline": "",
            "timeline": timeline,
            "is_simulated": True,
        }
    ]


def _fetch_postgis_spatial_event_ids(
    candidate_start_dt: datetime,
    candidate_end_dt: datetime,
    candidate_linestring_wkt: str,
    spatial_threshold_m: float,
) -> Tuple[Optional[set[str]], str]:
    if not candidate_linestring_wkt:
        return None, "candidate_geometry_missing"

    start_iso = candidate_start_dt.isoformat()
    end_iso = candidate_end_dt.isoformat()
    # Variant expressions for PostgREST + PostGIS syntax differences.
    filter_values = [
        f"SRID=4326;{candidate_linestring_wkt},{spatial_threshold_m}",
        f"SRID=4326;{candidate_linestring_wkt},{spatial_threshold_m},true",
    ]

    last_error: Optional[Exception] = None
    for filter_value in filter_values:
        try:
            response = (
                db.table("events")
                .select("id")
                .not_.is_("route_geometry", "null")
                .lte("start_time", end_iso)
                .gte("end_time", start_iso)
                .filter("route_geometry", "st_dwithin", filter_value)
                .limit(500)
                .execute()
            )
            ids = {str(row.get("id")) for row in (response.data or []) if row.get("id")}
            return ids, "postgis_st_dwithin"
        except Exception as exc:
            last_error = exc
            continue

    if last_error:
        return None, f"postgis_unavailable:{last_error}"
    return None, "postgis_unavailable"


def _fetch_existing_events(
    candidate_start_dt: datetime,
    candidate_end_dt: datetime,
    limit: int = 500,
) -> Tuple[List[Dict[str, Any]], str]:
    rows = []
    start_iso = candidate_start_dt.isoformat()
    end_iso = candidate_end_dt.isoformat()
    query_variants = [
        "status, events!inner(id, name, category, start_time, end_time, latitude, longitude, is_moving_procession, route_timeline, route_geometry)",
        "status, events!inner(id, name, category, start_time, end_time, latitude, longitude, is_moving_procession, route_geometry)",
        "status, events!inner(id, name, category, start_time, end_time, latitude, longitude, is_moving_procession, route_timeline)",
        "status, events!inner(id, name, category, start_time, end_time, latitude, longitude, is_moving_procession)",
    ]

    source = "window_query_failed"
    for query in query_variants:
        try:
            response = (
                db.table("applications")
                .select(query)
                .lte("events.start_time", end_iso)
                .gte("events.end_time", start_iso)
                .limit(limit)
                .execute()
            )
            rows = response.data or []
            source = "applications_events_overlap_48h"
            break
        except Exception:
            rows = []
            continue

    events = []
    for row in rows:
        event = row.get("events") or {}
        if isinstance(event, list):
            event = event[0] if event else {}
        if not isinstance(event, dict):
            continue

        start_dt = _parse_event_datetime(event.get("start_time"))
        end_dt = _parse_event_datetime(event.get("end_time"))
        if start_dt is None:
            continue
        if end_dt is None or end_dt <= start_dt:
            end_dt = start_dt + timedelta(hours=4)
        if _event_overlap_minutes(candidate_start_dt, candidate_end_dt, start_dt, end_dt) <= 0:
            continue

        timeline = _parse_timeline(event.get("route_timeline"))
        timeline_source = "route_timeline"
        if not timeline:
            geometry_points = _parse_route_geometry_points(event.get("route_geometry"))
            timeline = _timeline_from_route_points(geometry_points, start_dt, end_dt, "Route geometry")
            if timeline:
                timeline_source = "route_geometry"
        if not timeline:
            timeline = _build_fallback_timeline(event.get("latitude"), event.get("longitude"))
            timeline_source = "point_fallback"
        if not timeline:
            continue

        events.append(
            {
                "id": str(event.get("id") or ""),
                "name": str(event.get("name") or "Existing Event"),
                "category": str(event.get("category") or ""),
                "status": str(row.get("status") or ""),
                "start_dt": start_dt,
                "end_dt": end_dt,
                "timeline": timeline,
                "timeline_source": timeline_source,
                "has_route_geometry": event.get("route_geometry") is not None,
                "is_moving_procession": _coerce_bool(event.get("is_moving_procession")),
            }
        )
    return events, source


def _event_overlap_minutes(start_a: datetime, end_a: datetime, start_b: datetime, end_b: datetime) -> float:
    latest_start = max(start_a, start_b)
    earliest_end = min(end_a, end_b)
    return max((earliest_end - latest_start).total_seconds() / 60.0, 0.0)


def _severity_from(
    distance_m: float,
    time_diff_min: float,
    spatial_threshold_m: float,
    temporal_threshold_min: int,
) -> str:
    # "SEVERE" is only valid when both spatial + temporal strict bounds are met.
    severe_distance = min(50.0, spatial_threshold_m)
    severe_time = min(15.0, float(temporal_threshold_min))

    if distance_m <= severe_distance and time_diff_min <= severe_time:
        return "SEVERE"
    if distance_m <= min(100.0, spatial_threshold_m) and time_diff_min <= min(30.0, float(temporal_threshold_min)):
        return "HIGH"
    if distance_m <= min(150.0, spatial_threshold_m) and time_diff_min <= min(45.0, float(temporal_threshold_min)):
        return "MEDIUM"
    return "LOW"


def _route_collision_profile(
    route: Dict[str, Any],
    candidate_start_dt: datetime,
    candidate_end_dt: datetime,
    existing_events: List[Dict[str, Any]],
    spatial_threshold_m: float,
    temporal_threshold_min: int,
) -> Dict[str, Any]:
    timeline = route.get("timeline") or []
    if not timeline:
        return {
            "route_id": route.get("route_id"),
            "collision_score": 0.0,
            "conflict_count": 0,
            "severe_conflict_count": 0,
            "warnings": [],
        }

    warnings = []
    severe_count = 0
    conflict_events = 0
    aggregate_score = 0.0

    for existing in existing_events:
        overlap = _event_overlap_minutes(
            candidate_start_dt,
            candidate_end_dt,
            existing["start_dt"],
            existing["end_dt"],
        )
        if overlap <= 0:
            continue

        event_best = None
        for step_a in timeline:
            loc_a = step_a.get("end_location") or {}
            lat_a = loc_a.get("lat")
            lng_a = loc_a.get("lng")
            if lat_a is None or lng_a is None:
                continue
            time_a = candidate_start_dt + timedelta(seconds=_coerce_int(step_a.get("time_offset_seconds"), default=0))

            for step_b in existing["timeline"]:
                loc_b = step_b.get("end_location") or {}
                lat_b = loc_b.get("lat")
                lng_b = loc_b.get("lng")
                if lat_b is None or lng_b is None:
                    continue
                time_b = existing["start_dt"] + timedelta(seconds=_coerce_int(step_b.get("time_offset_seconds"), default=0))

                time_diff = abs((time_a - time_b).total_seconds()) / 60.0
                if time_diff > temporal_threshold_min:
                    continue

                distance_m = _haversine_meters(_coerce_float(lat_a), _coerce_float(lng_a), _coerce_float(lat_b), _coerce_float(lng_b))
                if distance_m > spatial_threshold_m:
                    continue

                severity = _severity_from(
                    distance_m,
                    time_diff,
                    spatial_threshold_m=spatial_threshold_m,
                    temporal_threshold_min=temporal_threshold_min,
                )
                score = (
                    5.0 if severity == "SEVERE"
                    else 3.0 if severity == "HIGH"
                    else 1.5 if severity == "MEDIUM"
                    else 0.5
                )
                candidate_warning = {
                    "existing_event_id": existing["id"],
                    "existing_event_name": existing["name"],
                    "existing_event_category": existing["category"],
                    "existing_status": existing["status"],
                    "distance_meters": round(distance_m, 2),
                    "time_difference_minutes": round(time_diff, 2),
                    "overlap_window_minutes": round(overlap, 2),
                    "severity": severity,
                    "route_instruction": step_a.get("instructions") or "",
                    "existing_instruction": step_b.get("instructions") or "",
                    "collision_time_estimate": time_a.isoformat(),
                }
                if event_best is None or candidate_warning["distance_meters"] < event_best["distance_meters"]:
                    event_best = {**candidate_warning, "score": score}

        if event_best:
            conflict_events += 1
            aggregate_score += event_best["score"]
            if event_best["severity"] == "SEVERE":
                severe_count += 1
            warnings.append(event_best)

    warnings.sort(key=lambda item: (item["severity"] != "SEVERE", item["distance_meters"]))
    return {
        "route_id": route.get("route_id"),
        "collision_score": round(aggregate_score, 2),
        "conflict_count": conflict_events,
        "severe_conflict_count": severe_count,
        "warnings": warnings[:10],
    }


def _overall_status(best_profile: Dict[str, Any]) -> str:
    if best_profile["conflict_count"] <= 0:
        return "SAFE"
    if best_profile["severe_conflict_count"] > 0:
        return "SEVERE_WARNING"
    return "WARNING"


def analyze_route_collision(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise CollisionEngineError("Collision payload must be a JSON object.")

    is_moving = _coerce_bool(payload.get("isMovingProcession") or payload.get("is_moving_procession"))
    spatial_threshold_m = _coerce_float(
        payload.get("spatialThresholdMeters") if payload.get("spatialThresholdMeters") is not None else payload.get("spatial_threshold_meters"),
        default=100.0,
    )
    temporal_threshold_min = _coerce_int(
        payload.get("temporalThresholdMinutes") if payload.get("temporalThresholdMinutes") is not None else payload.get("temporal_threshold_minutes"),
        default=30,
    )
    spatial_threshold_m = max(spatial_threshold_m, 25.0)
    temporal_threshold_min = max(temporal_threshold_min, 5)

    if not is_moving:
        return {
            "status": "success",
            "collision_status": "NOT_APPLICABLE",
            "thresholds": {
                "spatial_threshold_meters": spatial_threshold_m,
                "temporal_threshold_minutes": temporal_threshold_min,
            },
            "selected_route": None,
            "route_options": [],
            "warnings": [],
            "summary": {
                "routes_evaluated": 0,
                "existing_events_compared": 0,
                "selected_route_conflicts": 0,
                "selected_route_severe_conflicts": 0,
            },
            "recommendations": ["Enable moving procession and provide route origin/destination for collision analysis."],
            "message": "4D collision checks apply to moving processions only.",
        }

    origin = str(payload.get("routeOrigin") or payload.get("route_origin") or "").strip()
    destination = str(payload.get("routeDestination") or payload.get("route_destination") or "").strip()
    if not origin or not destination:
        raise CollisionEngineError("Route origin and destination are required for moving procession analysis.")

    start_date = payload.get("startDate") or payload.get("start_date")
    end_date = payload.get("endDate") or payload.get("end_date") or start_date
    start_time = payload.get("startTime") or payload.get("start_time")
    end_time = payload.get("endTime") or payload.get("end_time")

    start_dt = _parse_datetime(str(start_date or ""), str(start_time or ""))
    end_dt = _parse_datetime(str(end_date or ""), str(end_time or ""))
    if start_dt is None:
        start_dt = datetime.now(UTC).replace(tzinfo=None) + timedelta(days=1)
    if end_dt is None or end_dt <= start_dt:
        end_dt = start_dt + timedelta(hours=4)

    mode = str(payload.get("mode") or "walking").strip().lower()
    alternatives = _coerce_bool(payload.get("alternatives") if payload.get("alternatives") is not None else True)

    route_fetch_error = ""
    route_source = "google_directions"
    try:
        route_options = _fetch_route_options(origin, destination, mode=mode, alternatives=alternatives)
    except CollisionEngineError as exc:
        route_fetch_error = str(exc)
        route_source = "simulated_fallback"
        route_options = _build_simulated_route_options(
            origin=origin,
            destination=destination,
            payload=payload,
            start_dt=start_dt,
            end_dt=end_dt,
        )

    existing_events, history_source = _fetch_existing_events(start_dt, end_dt)

    enriched_routes = []
    route_profiles = []
    postgis_modes: List[str] = []
    for route in route_options:
        candidate_wkt = _build_candidate_linestring_wkt(route)
        postgis_ids, postgis_mode = _fetch_postgis_spatial_event_ids(
            candidate_start_dt=start_dt,
            candidate_end_dt=end_dt,
            candidate_linestring_wkt=candidate_wkt,
            spatial_threshold_m=spatial_threshold_m,
        )
        postgis_modes.append(postgis_mode)
        scoped_existing_events = existing_events
        if postgis_ids is not None:
            scoped_existing_events = [event for event in existing_events if event["id"] in postgis_ids]

        profile = _route_collision_profile(
            route=route,
            candidate_start_dt=start_dt,
            candidate_end_dt=end_dt,
            existing_events=scoped_existing_events,
            spatial_threshold_m=spatial_threshold_m,
            temporal_threshold_min=temporal_threshold_min,
        )
        route_profiles.append(profile)
        enriched_routes.append(
            {
                **route,
                "collision": {
                    "score": profile["collision_score"],
                    "conflict_count": profile["conflict_count"],
                    "severe_conflict_count": profile["severe_conflict_count"],
                    "top_warning": profile["warnings"][0] if profile["warnings"] else None,
                },
                "postgis_prefilter_mode": postgis_mode,
            }
        )

    preferred_route_id = str(payload.get("preferredRouteId") or payload.get("preferred_route_id") or "").strip()
    if preferred_route_id:
        preferred_profile = next((p for p in route_profiles if p["route_id"] == preferred_route_id), None)
    else:
        preferred_profile = None

    # Select lowest collision score, then shortest duration.
    ranked = sorted(
        zip(route_profiles, enriched_routes),
        key=lambda item: (
            item[0]["collision_score"],
            _coerce_int(item[1].get("total_duration_seconds"), default=10**9),
        ),
    )
    best_profile, best_route = ranked[0]
    selected_profile = preferred_profile or best_profile
    selected_route = (
        next((r for r in enriched_routes if r["route_id"] == preferred_route_id), None) if preferred_profile else best_route
    ) or best_route

    collision_status = _overall_status(selected_profile)
    if route_fetch_error:
        collision_status = "UNKNOWN"
    all_warnings = selected_profile["warnings"]

    recommendations = []
    if collision_status == "SAFE":
        recommendations.append("No critical spatio-temporal clashes detected for the selected route.")
        recommendations.append("Share route and timings with traffic/police for operational confirmation.")
    elif collision_status == "UNKNOWN":
        recommendations.append("Route API is unavailable; collision status is provisional.")
        recommendations.append("Re-run route analysis once Google Directions is reachable and confirm with authorities.")
    elif collision_status == "SEVERE_WARNING":
        recommendations.append("High-risk route collision detected. Choose an alternate route or adjust schedule.")
        recommendations.append("Coordinate immediate route revision with traffic and police authorities.")
    else:
        recommendations.append("Potential overlaps detected. Consider route/schedule optimization before submission.")
        recommendations.append("Increase marshals and establish controlled barricading at predicted overlap points.")

    return {
        "status": "success",
        "collision_status": collision_status,
        "thresholds": {
            "spatial_threshold_meters": spatial_threshold_m,
            "temporal_threshold_minutes": temporal_threshold_min,
        },
        "selected_route": selected_route,
        "recommended_route_id": best_route.get("route_id"),
        "route_options": enriched_routes,
        "warnings": all_warnings,
        "summary": {
            "routes_evaluated": len(enriched_routes),
            "existing_events_compared": len(existing_events),
            "selected_route_conflicts": selected_profile["conflict_count"],
            "selected_route_severe_conflicts": selected_profile["severe_conflict_count"],
            "temporal_filter_source": history_source,
            "route_source": route_source,
            "route_fetch_error": route_fetch_error or None,
            "postgis_prefilter_modes": list(dict.fromkeys(postgis_modes)),
        },
        "recommendations": recommendations,
        "model_version": "collision-4d-v1",
    }
