"""
Utilization backend — FastAPI server that proxies Runn API calls and returns
pre-computed utilization data to the project-tracker frontend.

Run locally:
    cd server
    pip install -r requirements.txt
    cp .env.example .env   # then fill in RUNN_API_KEY
    uvicorn main:app --host 0.0.0.0 --port 8765 --reload

Then set Settings → Utilization API URL → http://localhost:8765

The Runn API key can be supplied two ways (first wins):
  1. Request header  X-Runn-Api-Key: <key>   (set via Settings in the frontend)
  2. Server .env     RUNN_API_KEY=<key>       (fallback / production default)
"""

import asyncio
import os
import time
from collections import defaultdict
from datetime import date

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

# ─── Config ───────────────────────────────────────────────────────────────────

_ENV_API_KEY:   str = os.getenv("RUNN_API_KEY", "")
RUNN_HOST:      str = os.getenv("RUNN_HOST",     "https://api.runn.io").rstrip("/")
RAINTOOL_HOST:  str = os.getenv("RAINTOOL_HOST", "https://hailstorm.frostdesigngroup.com").rstrip("/")


def _resolve_key(header_key: str | None) -> str:
    """Return the API key from the request header, falling back to .env."""
    key = header_key or _ENV_API_KEY
    if not key:
        raise HTTPException(
            status_code=503,
            detail="Runn API key is not configured. "
                   "Set it in Settings (Runn API Key) or add RUNN_API_KEY to server/.env.",
        )
    return key


def _headers(api_key: str) -> dict:
    return {
        "Authorization":  f"Bearer {api_key}",
        "accept-version": "1.0.0",
    }


# ─── In-memory cache ─────────────────────────────────────────────────────────

_UTIL_CACHE: dict = {}          # key → { "data": ..., "ts": float }
_UTIL_CACHE_TTL = 30 * 60       # 30 minutes


def _util_cache_key(startDate: str, endDate: str, projectId: int | None) -> str:
    return f"{startDate}|{endDate}|{projectId}"


# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(title="Project Tracker — Utilization API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)


# ─── Runn pagination helper ───────────────────────────────────────────────────

async def _fetch_all(
    client: httpx.AsyncClient,
    path: str,
    api_key: str,
    params: dict | None = None,
) -> list:
    """Fetch every page of a cursor-paginated Runn endpoint."""
    results: list = []
    p = {**(params or {}), "limit": 200}
    cursor: str | None = None

    while True:
        if cursor:
            p["cursor"] = cursor
        resp = await client.get(
            f"{RUNN_HOST}{path}",
            headers=_headers(api_key),
            params=p,
        )
        resp.raise_for_status()
        data = resp.json()
        results.extend(data.get("values", []))
        cursor = data.get("nextCursor")
        if not cursor:
            break

    return results


# ─── Working-days helper ──────────────────────────────────────────────────────

def _working_days(start: date, end: date) -> int:
    """Count Mon–Fri days between start and end, inclusive."""
    if end < start:
        return 0
    total_days = (end - start).days + 1
    full_weeks, rem = divmod(total_days, 7)
    count = full_weeks * 5
    start_wd = start.weekday()  # 0=Mon, 6=Sun
    for i in range(rem):
        if (start_wd + i) % 7 < 5:
            count += 1
    return count


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/api/runn/me")
async def runn_me(
    x_runn_api_key: str | None = Header(None, alias="X-Runn-Api-Key"),
):
    """Connectivity check — proxies Runn /me/ to verify the API key is valid."""
    api_key = _resolve_key(x_runn_api_key)
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{RUNN_HOST}/me/", headers=_headers(api_key))
        resp.raise_for_status()
        return resp.json()


@app.get("/api/runn/projects")
async def runn_projects(
    x_runn_api_key: str | None = Header(None, alias="X-Runn-Api-Key"),
):
    """Return all non-archived Runn projects for the project filter UI."""
    api_key = _resolve_key(x_runn_api_key)
    async with httpx.AsyncClient(timeout=15) as client:
        projects = await _fetch_all(
            client, "/projects/", api_key,
            {"sortBy": "id", "includeArchived": False},
        )
    return [{"id": p["id"], "name": p.get("name") or f"Project {p['id']}"} for p in projects]


@app.get("/api/runn/utilization")
async def runn_utilization(
    startDate:  str       = Query(..., description="YYYY-MM-DD"),
    endDate:    str       = Query(..., description="YYYY-MM-DD"),
    projectId:  int | None = Query(None, description="Filter to a single Runn project"),
    force:      bool      = Query(False, description="Bypass server-side cache"),
    x_runn_api_key: str | None = Header(None, alias="X-Runn-Api-Key"),
):
    """
    Pre-computed per-person utilization for the given date range.
    When projectId is provided the report is scoped to that project only.
    Results are cached server-side for 30 minutes. Pass force=true to bypass.

    Response shape — utilization-rebuild.md § 9:
    { people: [...], period: { start, end, working_days }, summary: { ... } }
    """
    api_key = _resolve_key(x_runn_api_key)

    try:
        start = date.fromisoformat(startDate)
        end   = date.fromisoformat(endDate)
    except ValueError:
        raise HTTPException(status_code=400, detail="startDate and endDate must be YYYY-MM-DD.")

    if end < start:
        raise HTTPException(status_code=400, detail="endDate must be >= startDate.")

    # ── Server-side cache check ───────────────────────────────────────────────
    ck = _util_cache_key(startDate, endDate, projectId)
    if not force:
        entry = _UTIL_CACHE.get(ck)
        if entry and (time.time() - entry["ts"]) < _UTIL_CACHE_TTL:
            return entry["data"]

    async with httpx.AsyncClient(timeout=30) as client:
        people, contracts, assignments, all_assignments, actuals, roles, projects = await asyncio.gather(
            _fetch_all(client, "/people/",                  api_key, {"sortBy": "id"}),
            _fetch_all(client, "/people/contracts/current", api_key),
            _fetch_all(client, "/assignments/",             api_key, {"startDate": startDate, "endDate": endDate}),
            _fetch_all(client, "/assignments/",             api_key, {"sortBy": "id"}),   # no date filter — full allocation
            _fetch_all(client, "/actuals/",                 api_key, {"minDate": startDate, "maxDate": endDate}),
            _fetch_all(client, "/roles/",                   api_key, {"sortBy": "id"}),
            _fetch_all(client, "/projects/",                api_key, {"sortBy": "id", "includeArchived": False}),
        )

    # ── Project filter ────────────────────────────────────────────────────────
    if projectId is not None:
        assignments     = [a   for a   in assignments     if a.get("projectId")   == projectId and not a.get("isPlaceholder")]
        all_assignments = [a   for a   in all_assignments if a.get("projectId")   == projectId and not a.get("isPlaceholder")]
        actuals         = [act for act in actuals         if act.get("projectId") == projectId]
        active_ids      = {a["personId"] for a in assignments} | {act["personId"] for act in actuals}
        people          = [p for p in people if p["id"] in active_ids]
    else:
        all_assignments = [a for a in all_assignments if not a.get("isPlaceholder")]

    wdays = _working_days(start, end)

    # ── Lookup maps ───────────────────────────────────────────────────────────

    role_map    = {r["id"]: r.get("name") or "Unknown"                  for r in roles}
    project_map = {p["id"]: p.get("name") or f"Project {p['id']}"      for p in projects}

    contract_map: dict = {}
    for c in contracts:
        pid = c["personId"]
        if pid not in contract_map:
            contract_map[pid] = {
                "minutes_per_day": c.get("minutesPerDay") or 480,
                "role_id":         c.get("roleId"),
            }

    person_assignments: dict = defaultdict(list)
    for a in assignments:
        if not a.get("isPlaceholder"):
            person_assignments[a["personId"]].append(a)

    person_all_assignments: dict = defaultdict(list)
    for a in all_assignments:
        person_all_assignments[a["personId"]].append(a)

    person_actual_min: dict = defaultdict(int)
    for act in actuals:
        person_actual_min[act["personId"]] += (
            (act.get("billableMinutes") or 0) + (act.get("nonbillableMinutes") or 0)
        )

    person_projects: dict = defaultdict(set)
    for a in assignments:
        if a.get("projectId") and not a.get("isPlaceholder"):
            person_projects[a["personId"]].add(a["projectId"])
    for act in actuals:
        if act.get("projectId"):
            person_projects[act["personId"]].add(act["projectId"])

    # ── Per-person computation ────────────────────────────────────────────────

    result_people = []

    for person in people:
        if person.get("isArchived"):
            continue

        pid      = person["id"]
        contract = contract_map.get(pid)
        mpd      = contract["minutes_per_day"] if contract else 480
        role_id  = contract["role_id"]          if contract else None

        capacity_min = mpd * wdays

        # Budget: assignment minutes clipped to the selected date range
        budget_min = 0
        for a in person_assignments[pid]:
            a_start  = date.fromisoformat(a["startDate"])
            a_end    = date.fromisoformat(a["endDate"])
            ov_start = max(a_start, start)
            ov_end   = min(a_end,   end)
            if ov_end >= ov_start:
                budget_min += (a.get("minutesPerDay") or 0) * _working_days(ov_start, ov_end)

        # Allocated: full assignment duration, no date clipping
        allocated_min = 0
        for a in person_all_assignments[pid]:
            a_start = date.fromisoformat(a["startDate"])
            a_end   = date.fromisoformat(a["endDate"])
            allocated_min += (a.get("minutesPerDay") or 0) * _working_days(a_start, a_end)

        actual_min = person_actual_min[pid]

        cap_h    = round(capacity_min  / 60, 1)
        budget_h = round(budget_min    / 60, 1)
        alloc_h  = round(allocated_min / 60, 1)
        act_h    = round(actual_min    / 60, 1)

        util_sched  = round(budget_min  / capacity_min * 100, 1) if capacity_min > 0 else 0.0
        util_actual = round(actual_min / capacity_min * 100, 1) if capacity_min > 0 else 0.0

        proj_names = sorted(
            project_map.get(pid2, f"Project {pid2}")
            for pid2 in person_projects[pid]
        )

        result_people.append({
            "id":                 pid,
            "name":               f"{person.get('firstName', '')} {person.get('lastName', '')}".strip() or f"Person {pid}",
            "role":               role_map.get(role_id, "—") if role_id else "—",
            "capacity_hours":     cap_h,
            "allocated_hours":    alloc_h,
            "budget_hours":       budget_h,
            "actual_hours":       act_h,
            "util_scheduled_pct": util_sched,
            "util_actual_pct":    util_actual,
            "projects":           proj_names,
            "has_actuals":        actual_min > 0,
        })

    result_people.sort(
        key=lambda p: (p["util_actual_pct"] or p["util_scheduled_pct"]),
        reverse=True,
    )

    # ── Summary ───────────────────────────────────────────────────────────────

    with_cap  = [p for p in result_people if p["capacity_hours"] > 0]
    headcount = len(with_cap)
    avg_sched  = round(sum(p["util_scheduled_pct"] for p in with_cap) / headcount, 1) if headcount else 0.0
    avg_actual = round(sum(p["util_actual_pct"]    for p in with_cap) / headcount, 1) if headcount else 0.0
    over_cap   = sum(
        1 for p in with_cap
        if p["util_actual_pct"] > 100
        or (p["util_actual_pct"] == 0 and p["util_scheduled_pct"] > 100)
    )

    payload = {
        "people": result_people,
        "period": {"start": startDate, "end": endDate, "working_days": wdays},
        "summary": {
            "headcount":           headcount,
            "avg_util_scheduled":  avg_sched,
            "avg_util_actual":     avg_actual,
            "over_capacity_count": over_cap,
        },
    }
    _UTIL_CACHE[ck] = {"data": payload, "ts": time.time()}
    return payload


# ─── Ares proxy ───────────────────────────────────────────────────────────────

ARES_HOST: str = os.getenv("ARES_HOST", "").rstrip("/")


@app.get("/api/ares/cycle-time")
async def ares_cycle_time(
    rtProjectId: int        = Query(...,    description="Raintool project ID"),
    dateFrom:    str        = Query(...,    description="YYYY-MM-DD"),
    dateTo:      str        = Query(...,    description="YYYY-MM-DD"),
    status:      str        = Query("all", description="all | active | done"),
    page:        int        = Query(1),
    pageSize:    int        = Query(200),
    x_ares_api_key: str | None = Header(None, alias="X-Ares-Api-Key"),
    x_ares_host:    str | None = Header(None, alias="X-Ares-Host"),
):
    """
    Proxy for Ares /api/v1/trello/cycle-time.
    Routes server-side to avoid CORS issues with the X-API-Key header.
    Credentials: X-Ares-Api-Key + X-Ares-Host headers (from frontend Settings),
    falling back to ARES_HOST / ARES_API_KEY env vars.
    """
    host    = (x_ares_host    or ARES_HOST).rstrip("/")
    api_key =  x_ares_api_key or os.getenv("ARES_API_KEY", "")

    if not host or not api_key:
        raise HTTPException(
            status_code=503,
            detail="Ares host/key not configured. Set them in Settings or add ARES_HOST/ARES_API_KEY to server/.env.",
        )

    url = f"{host}/api/v1/trello/cycle-time"
    params = {
        "rtProjectId": rtProjectId,
        "dateFrom":    dateFrom,
        "dateTo":      dateTo,
        "status":      status,
        "page":        page,
        "pageSize":    pageSize,
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, params=params, headers={"X-API-Key": api_key})
            resp.raise_for_status()
            return resp.json()
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach Ares: {exc}")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=exc.response.text[:500])


# ─── Raintool proxy ───────────────────────────────────────────────────────────

@app.get("/api/raintool/tasks")
async def raintool_tasks(
    projectId: int  = Query(..., description="Raintool project ID"),
    dateFrom:  str  = Query(..., description="YYYY-MM-DD"),
    dateTo:    str  = Query(..., description="YYYY-MM-DD"),
):
    """
    Proxy for Raintool report/generate/task/task-by-project.
    Called server-side to bypass the missing CORS headers on that endpoint.
    No API key required — Raintool's report endpoint is public within the network.
    """
    url = f"{RAINTOOL_HOST}/public/api/report/generate/task/task-by-project"
    params = {"projectId": projectId, "dateFrom": dateFrom, "dateTo": dateTo}
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.post(url, data=params)
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach Raintool: {exc}")

    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Raintool returned {resp.status_code}. Body: {resp.text[:300]}",
        )

    try:
        data = resp.json()
    except Exception:
        raise HTTPException(
            status_code=502,
            detail=f"Raintool returned non-JSON (status {resp.status_code}). Body: {resp.text[:300]}",
        )

    return data if isinstance(data, list) else []
