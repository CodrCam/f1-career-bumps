#!/usr/bin/env python3
"""Create a bounded JSON snapshot from the official F1 timing feed via FastF1."""

from __future__ import annotations

import argparse
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import fastf1
import numpy as np
import pandas as pd


RESULT_COLUMNS = [
    "DriverNumber",
    "BroadcastName",
    "Abbreviation",
    "DriverId",
    "TeamName",
    "TeamColor",
    "Position",
    "ClassifiedPosition",
    "GridPosition",
    "Q1",
    "Q2",
    "Q3",
    "Time",
    "Status",
    "Points",
]

LAP_COLUMNS = [
    "Driver",
    "DriverNumber",
    "LapNumber",
    "Stint",
    "LapTime",
    "Sector1Time",
    "Sector2Time",
    "Sector3Time",
    "Sector1SessionTime",
    "Sector2SessionTime",
    "Sector3SessionTime",
    "SpeedI1",
    "SpeedI2",
    "SpeedFL",
    "SpeedST",
    "IsPersonalBest",
    "Compound",
    "TyreLife",
    "FreshTyre",
    "Team",
    "LapStartTime",
    "LapStartDate",
    "TrackStatus",
    "Position",
    "Deleted",
    "DeletedReason",
    "FastF1Generated",
    "IsAccurate",
    "PitOutTime",
    "PitInTime",
]

WEATHER_COLUMNS = [
    "Time",
    "AirTemp",
    "Humidity",
    "Pressure",
    "Rainfall",
    "TrackTemp",
    "WindDirection",
    "WindSpeed",
]

TRACK_STATUS_COLUMNS = ["Time", "Status", "Message"]

RACE_CONTROL_COLUMNS = [
    "Time",
    "Category",
    "Message",
    "Status",
    "Flag",
    "Scope",
    "Sector",
    "RacingNumber",
    "Lap",
]

TELEMETRY_COLUMNS = [
    "Time",
    "Distance",
    "Speed",
    "RPM",
    "nGear",
    "Throttle",
    "Brake",
    "DRS",
]


def snake_case(value: str) -> str:
    return re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", value).lower()


def json_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, dict):
        return {str(key): json_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_value(item) for item in value]

    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass

    if isinstance(value, (pd.Timedelta,)):
        return value.total_seconds()
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.isoformat()
    if isinstance(value, np.generic):
        value = value.item()
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, (str, int, bool)):
        return value

    return str(value)


def dataframe_records(frame: pd.DataFrame | None, columns: list[str]) -> list[dict[str, Any]]:
    if frame is None or frame.empty:
        return []

    selected = [column for column in columns if column in frame.columns]
    if not selected:
        return []

    records = []
    for row in frame[selected].to_dict(orient="records"):
        records.append({snake_case(key): json_value(value) for key, value in row.items()})
    return records


def build_fastest_lap_telemetry(session: fastf1.core.Session) -> dict[str, list[dict[str, Any]]]:
    output: dict[str, list[dict[str, Any]]] = {}

    for driver in session.drivers:
        try:
            lap = session.laps.pick_drivers(driver).pick_fastest()
            if lap is None:
                continue

            telemetry = lap.get_car_data().add_distance()
            columns = [column for column in TELEMETRY_COLUMNS if column in telemetry.columns]
            if not columns:
                continue

            sample_step = max(1, len(telemetry.index) // 240)
            sampled = telemetry.iloc[::sample_step]
            driver_code = str(lap.get("Driver") or driver)
            output[driver_code] = dataframe_records(sampled, columns)
        except Exception:
            continue

    return output


def build_snapshot(
    year: int,
    round_number: int,
    session_name: str,
    cache_dir: Path,
    include_telemetry: bool,
) -> dict[str, Any]:
    cache_dir.mkdir(parents=True, exist_ok=True)
    fastf1.Cache.enable_cache(str(cache_dir))
    fastf1.set_log_level("WARNING")

    session = fastf1.get_session(year, round_number, session_name)
    session.load(
        laps=True,
        telemetry=include_telemetry,
        weather=True,
        messages=True,
    )

    results = dataframe_records(session.results, RESULT_COLUMNS)
    laps = dataframe_records(session.laps, LAP_COLUMNS)
    weather = dataframe_records(session.weather_data, WEATHER_COLUMNS)
    track_status = dataframe_records(session.track_status, TRACK_STATUS_COLUMNS)
    race_control = dataframe_records(session.race_control_messages, RACE_CONTROL_COLUMNS)
    fastest_lap_telemetry = (
        build_fastest_lap_telemetry(session) if include_telemetry else {}
    )

    capabilities = {
        "results": bool(results),
        "lap_timing": bool(laps),
        "sector_timing": any(
            row.get("sector1_time") is not None
            or row.get("sector2_time") is not None
            or row.get("sector3_time") is not None
            for row in laps
        ),
        "pit_markers": any(
            row.get("pit_in_time") is not None or row.get("pit_out_time") is not None
            for row in laps
        ),
        "tyres_and_stints": any(row.get("compound") for row in laps),
        "speed_traps": any(row.get("speed_st") is not None for row in laps),
        "weather": bool(weather),
        "track_status": bool(track_status),
        "race_control": bool(race_control),
        "fastest_lap_telemetry": bool(fastest_lap_telemetry),
    }

    event = session.event
    return {
        "schema_version": 1,
        "source": "FastF1 / Formula 1 live timing",
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "year": year,
        "round": round_number,
        "session": {
            "name": session.name,
            "event_name": json_value(event.get("EventName")),
            "official_event_name": json_value(event.get("OfficialEventName")),
            "country": json_value(event.get("Country")),
            "location": json_value(event.get("Location")),
            "date": json_value(session.date),
            "api_path": json_value(session.api_path),
            "f1_api_support": bool(session.f1_api_support),
        },
        "capabilities": capabilities,
        "results": results,
        "laps": laps,
        "weather": weather,
        "track_status": track_status,
        "race_control_messages": race_control,
        "fastest_lap_telemetry": fastest_lap_telemetry,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--round", dest="round_number", type=int, required=True)
    parser.add_argument("--session", default="R")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cache", type=Path, default=Path(".cache/fastf1"))
    parser.add_argument("--telemetry", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    snapshot = build_snapshot(
        year=args.year,
        round_number=args.round_number,
        session_name=args.session,
        cache_dir=args.cache,
        include_telemetry=args.telemetry,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(snapshot, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    main()
