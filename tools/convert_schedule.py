"""Converts the raw schedule (mjwebmaster/world-cup-2026-schedule-data) into data/matches.json.

Kickoff is stored in UTC. All times in the source are US Eastern (EDT in June/July = UTC-4).
Re-run this script if the source schedule is updated (e.g. knockout brackets defined).
"""
import json
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "schedule-raw.json"
OUT = ROOT / "data" / "matches.json"

EDT_OFFSET = timedelta(hours=4)  # EDT -> UTC

raw = json.loads(RAW.read_text(encoding="utf-8"))

matches = []
for m in raw["matches"]:
    kickoff_local_et = datetime.fromisoformat(f"{m['date']}T{m['time_et']}:00")
    kickoff_utc = kickoff_local_et + EDT_OFFSET
    matches.append({
        "id": m["match_number"],
        "stage": m["stage"],
        "group": m.get("group"),
        "home": m["team_a"],
        "away": m["team_b"],
        "kickoff": kickoff_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "venue": m["venue"],
        "city": m["city"],
        "placeholder": m["status"] != "confirmed_group_fixture",
    })

matches.sort(key=lambda x: (x["kickoff"], x["id"]))
OUT.write_text(
    json.dumps({"updated": raw.get("last_updated"), "matches": matches},
               ensure_ascii=False, indent=1),
    encoding="utf-8",
)
print(f"wrote {len(matches)} matches -> {OUT}")
