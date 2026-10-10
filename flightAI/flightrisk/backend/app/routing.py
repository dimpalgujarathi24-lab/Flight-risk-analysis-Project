"""
AeroPilot AI - Route planner (FastAPI version).
Airports = vertices, nonstop routes = edges.
BFS (fewest stops), Dijkstra (shortest km), Dijkstra with ML risk-weighted cost (safest).
"""
import heapq
import math
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import deque
from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import requests
import shap
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

BASE = Path(__file__).resolve().parent
# looks in app/data first, then backend/data
DATA_DIR = next((p for p in (BASE / "data", BASE.parent / "data") if (p / "routes.dat").exists()),
                BASE / "data")
MODEL_DIR = BASE / "model"

FEATURES = [
    "fuel_percent", "weather_severity", "traffic_density", "visibility_km",
    "wind_speed_kts", "distance_km", "altitude_ft", "temperature_c",
]
RISK_VALUE = {"LOW": 0, "MODERATE": 1, "HIGH": 2, "CRITICAL": 3}

FULL_TANK_RANGE_KM = 10000.0   # assumption: used to estimate fuel left at each airport
STOP_PENALTY_KM = 300.0        # each extra leg costs this many "virtual km"
MAX_CORRIDOR_NODES = 60
WEATHER_TTL = 600              # seconds to cache live weather per airport
OPEN_METEO = "https://api.open-meteo.com/v1/forecast"
VARS_FULL = "temperature_2m,wind_speed_10m,wind_gusts_10m,weather_code,visibility"
VARS_BASIC = "temperature_2m,wind_speed_10m,wind_gusts_10m,weather_code"

# WMO weather code -> severity on a 0-10 scale
WMO_SEVERITY = {
    0: 0, 1: 0.5, 2: 1, 3: 1.5, 45: 5, 48: 5.5, 51: 3, 53: 3.5, 55: 4, 56: 6, 57: 6.5,
    61: 4, 63: 5.5, 65: 7, 66: 7.5, 67: 8, 71: 5, 73: 6.5, 75: 8, 77: 5,
    80: 4.5, 81: 6, 82: 7.5, 85: 6, 86: 8, 95: 8.5, 96: 9.5, 99: 10,
}

router = APIRouter(prefix="/api/planner", tags=["Route planner"])
G = {}  # initialized at startup and guarded during first load
_LOAD_LOCK = threading.Lock()


def _s(x):
    return "" if pd.isna(x) else str(x)


# ---------------------------------------------------------------- loading
def _load_unlocked():
    if G:
        return

    ap_cols = ["id", "name", "city", "country", "iata", "icao", "lat", "lon",
               "alt_ft", "tz", "dst", "tzdb", "type", "source"]
    ap = pd.read_csv(DATA_DIR / "airports.dat", header=None, names=ap_cols,
                     na_values=["\\N"], keep_default_na=False)
    ap = ap[ap["iata"].astype(str).str.fullmatch(r"[A-Z0-9]{3}")].copy()
    if ap["type"].astype(str).eq("airport").any():
        ap = ap[ap["type"] == "airport"].copy()
    ap["lat"] = pd.to_numeric(ap["lat"], errors="coerce")
    ap["lon"] = pd.to_numeric(ap["lon"], errors="coerce")
    ap["alt_ft"] = pd.to_numeric(ap["alt_ft"], errors="coerce").fillna(0)
    ap = ap.dropna(subset=["lat", "lon"]).drop_duplicates("iata")
    airports = {
        r.iata: {"iata": r.iata, "name": _s(r.name), "city": _s(r.city), "country": _s(r.country),
                 "lat": float(r.lat), "lon": float(r.lon), "alt_ft": float(r.alt_ft)}
        for r in ap.itertuples(index=False)
    }

    airlines = {}
    try:
        al = pd.read_csv(DATA_DIR / "airlines.dat", header=None, na_values=["\\N"], keep_default_na=False,
                         names=["id", "name", "alias", "iata", "icao", "callsign", "country", "active"])
        for r in al[al["active"] == "Y"].itertuples(index=False):
            for code in (r.iata, r.icao):
                if isinstance(code, str) and len(code) in (2, 3) and code.isalnum() and code not in airlines:
                    airlines[code] = _s(r.name)
    except FileNotFoundError:
        pass

    rt = pd.read_csv(DATA_DIR / "routes.dat", header=None, dtype=str, na_values=["\\N"], keep_default_na=False,
                     names=["airline", "airline_id", "src", "src_id", "dst", "dst_id",
                            "codeshare", "stops", "equipment"])
    adj, radj = {}, {}
    for r in rt.itertuples(index=False):
        if r.stops != "0" or r.src == r.dst or r.src not in airports or r.dst not in airports:
            continue
        adj.setdefault(r.src, {}).setdefault(r.dst, set()).add(r.airline)
        radj.setdefault(r.dst, set()).add(r.src)

    deg = {i: len(adj.get(i, {})) + len(radj.get(i, ())) for i in airports}
    max_log = math.log1p(max(deg.values()))
    traffic = {i: round(10 * math.log1p(d) / max_log, 2) for i, d in deg.items()}

    model = joblib.load(MODEL_DIR / "model_v2.joblib")
    scaler = joblib.load(MODEL_DIR / "scaler_v2.joblib")

    G.update(airports=airports, airlines=airlines, adj=adj, radj=radj, deg=deg, traffic=traffic,
             model=model, scaler=scaler, explainer=shap.TreeExplainer(model), weather={})


def load():
    with _LOAD_LOCK:
        _load_unlocked()


def ensure_loaded():
    try:
        load()
    except FileNotFoundError as e:
        raise HTTPException(
            503,
            f"Missing file: {getattr(e, 'filename', None) or e}. Put airports.dat, routes.dat and "
            f"airlines.dat in backend/data (or backend/app/data) and run app/train_model_v2.py.",
        )


# ---------------------------------------------------------------- geometry
@lru_cache(maxsize=200_000)
def dist(u, v):
    a, b = G["airports"][u], G["airports"][v]
    p1, p2 = math.radians(a["lat"]), math.radians(b["lat"])
    dphi = p2 - p1
    dl = math.radians(b["lon"] - a["lon"])
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(h))


# ---------------------------------------------------------------- live weather
def _request_weather(chunk, variables):
    r = requests.get(OPEN_METEO, timeout=(3, 6), params={
        "latitude": ",".join(str(G["airports"][i]["lat"]) for i in chunk),
        "longitude": ",".join(str(G["airports"][i]["lon"]) for i in chunk),
        "current": variables,
        "wind_speed_unit": "kn",
    })
    r.raise_for_status()
    data = r.json()
    return data if isinstance(data, list) else [data]


def _fetch_weather_chunk(chunk, now):
    try:
        try:
            data = _request_weather(chunk, VARS_FULL)
        except requests.HTTPError:
            data = _request_weather(chunk, VARS_BASIC)
        out = {}
        for iata, d in zip(chunk, data):
            c = d.get("current", {})
            gust = c.get("wind_gusts_10m") or 0
            sev = min(10.0, WMO_SEVERITY.get(c.get("weather_code"), 2) + min(2.0, max(0.0, gust - 25) / 10))
            vis_m = c.get("visibility")
            vis = min(20.0, vis_m / 1000) if vis_m is not None else max(0.3, 20 - 1.6 * sev)
            temp = c.get("temperature_2m")
            out[iata] = {"ts": now, "live": True, "severity": round(sev, 2),
                         "visibilityKm": round(vis, 1),
                         "windKts": round(c.get("wind_speed_10m") or 0, 1),
                         "tempC": round(temp if temp is not None else 20.0, 1)}
        for iata in chunk:
            if iata not in out:
                raise ValueError("Weather response did not include every requested airport")
        return out
    except Exception:
        # Keep the planner responsive when the external weather service is unavailable.
        return {iata: {"ts": now - WEATHER_TTL + 60, "live": False, "severity": 2.0,
                       "visibilityKm": 10.0, "windKts": 8.0, "tempC": 20.0}
                for iata in chunk}


def fetch_weather(iatas):
    cache, now = G["weather"], time.time()
    need = [i for i in dict.fromkeys(iatas) if i not in cache or now - cache[i]["ts"] > WEATHER_TTL]
    chunks = [need[k:k + 50] for k in range(0, len(need), 50)]
    if chunks:
        # Fetch chunks concurrently so one slow weather request does not serialize the entire route.
        with ThreadPoolExecutor(max_workers=min(4, len(chunks))) as pool:
            futures = [pool.submit(_fetch_weather_chunk, chunk, now) for chunk in chunks]
            for future in as_completed(futures):
                cache.update(future.result())
    return {i: cache[i] for i in iatas}


# ---------------------------------------------------------------- graph algorithms
def bfs(src, dst):
    """Fewest legs. Neighbours are visited closest-to-destination first to break ties."""
    adj = G["adj"]
    prev = {src: None}
    q = deque([src])
    while q:
        u = q.popleft()
        if u == dst:
            break
        for v in sorted(adj.get(u, ()), key=lambda n: dist(n, dst)):
            if v not in prev:
                prev[v] = u
                q.append(v)
    if dst not in prev:
        return None
    path, n = [], dst
    while n is not None:
        path.append(n)
        n = prev[n]
    return path[::-1]


def dijkstra(src, dst, cost_fn, max_legs, allowed=None):
    """Lowest-cost path with at most max_legs legs. State = (airport, legs used)."""
    adj = G["adj"]
    best = {(src, 0): 0.0}
    pq = [(0.0, 0, src, (src,))]
    while pq:
        cost, legs, u, path = heapq.heappop(pq)
        if u == dst:
            return list(path), cost
        if cost > best.get((u, legs), math.inf) or legs == max_legs:
            continue
        for v in adj.get(u, ()):
            if v in path or (allowed is not None and v not in allowed):
                continue
            c = cost + cost_fn(u, v)
            if c < best.get((v, legs + 1), math.inf):
                best[(v, legs + 1)] = c
                heapq.heappush(pq, (c, legs + 1, v, path + (v,)))
    return None, math.inf


def corridor(src, dst, detour=1.35):
    """Candidate airports near the src->dst path: neighbours of both ends plus the busiest hubs."""
    adj, radj, deg = G["adj"], G["radj"], G["deg"]
    direct = dist(src, dst)
    limit = max(detour * direct, direct + 600)

    def inside(n):
        return dist(src, n) + dist(n, dst) <= limit

    out_n = sorted((n for n in adj.get(src, ()) if inside(n)), key=lambda n: -deg[n])[:20]
    in_n = sorted((n for n in radj.get(dst, ()) if inside(n)), key=lambda n: -deg[n])[:20]
    nodes = {src, dst, *out_n, *in_n}
    hubs = sorted((n for n in adj if inside(n)), key=lambda n: -deg[n])
    for n in hubs:
        if len(nodes) >= MAX_CORRIDOR_NODES:
            break
        nodes.add(n)
    return nodes


# ---------------------------------------------------------------- ML risk
def assess(nodes, src, dst, fuel):
    nodes = list(nodes)
    wx = fetch_weather(nodes)
    rows = []
    for n in nodes:
        w, a = wx[n], G["airports"][n]
        fuel_here = min(100.0, max(5.0, fuel - 100.0 * dist(src, n) / FULL_TANK_RANGE_KM))
        rows.append([fuel_here, w["severity"], G["traffic"][n], w["visibilityKm"],
                     w["windKts"], dist(n, dst), a["alt_ft"], w["tempC"]])
    Xs = G["scaler"].transform(pd.DataFrame(rows, columns=FEATURES))
    P = G["model"].predict_proba(Xs)
    classes = list(G["model"].classes_)
    risk = {}
    for i, n in enumerate(nodes):
        k = int(np.argmax(P[i]))
        risk[n] = {
            "level": classes[k], "k": k, "confidence": float(P[i][k]), "x": Xs[i],
            "score": float(sum(P[i][j] * RISK_VALUE[classes[j]] for j in range(len(classes))) / 3.0),
            "features": {f: round(float(v), 2) for f, v in zip(FEATURES, rows[i])},
            "weather": {key: wx[n][key] for key in ("severity", "visibilityKm", "windKts", "tempC", "live")},
        }
    return risk


def shap_top(risk, node_list):
    X = np.array([risk[n]["x"] for n in node_list])
    sv = G["explainer"].shap_values(X)
    n_classes = len(G["model"].classes_)
    arr = None if isinstance(sv, list) else np.asarray(sv)
    out = {}
    for i, n in enumerate(node_list):
        k = risk[n]["k"]
        if arr is None:
            contrib = sv[k][i]
        elif arr.ndim == 3 and arr.shape[-1] == n_classes:
            contrib = arr[i, :, k]
        else:
            contrib = arr[k][i]
        order = np.argsort(-np.abs(contrib))[:3]
        out[n] = [{"feature": FEATURES[j], "impact": round(float(contrib[j]), 3)} for j in order]
    return out


def safest_path(src, dst, nodes, risk, weight, avoid_critical, max_legs):
    allowed = {n for n in nodes
               if n in (src, dst) or not (avoid_critical and risk[n]["level"] == "CRITICAL")}

    def cost(u, v):
        return dist(u, v) * (1 + weight * risk[v]["score"]) + STOP_PENALTY_KM

    return dijkstra(src, dst, cost, max_legs, allowed)


# ---------------------------------------------------------------- response builders
def node_info(n, risk, tops):
    a, r = G["airports"][n], risk[n]
    return {"iata": n, "name": a["name"], "city": a["city"], "country": a["country"],
            "lat": a["lat"], "lon": a["lon"], "riskLevel": r["level"],
            "riskScore": round(r["score"], 3), "confidence": round(r["confidence"], 3),
            "weather": r["weather"], "features": r["features"], "topFactors": tops.get(n, [])}


def describe(label, path, risk, tops):
    legs, total = [], 0.0
    for u, v in zip(path, path[1:]):
        d = dist(u, v)
        total += d
        names = sorted({G["airlines"].get(c, c) for c in G["adj"][u][v]})[:3]
        legs.append({"from": u, "to": v, "distanceKm": round(d), "airlines": names})
    return {
        "label": label, "path": path, "legs": legs, "stops": len(path) - 2,
        "distanceKm": round(total),
        "avgRisk": round(sum(risk[n]["score"] for n in path) / len(path), 3),
        "worstLevel": max((risk[n]["level"] for n in path), key=lambda lv: RISK_VALUE[lv]),
        "nodes": [node_info(n, risk, tops) for n in path],
    }


def brief(n):
    a = G["airports"][n]
    return {k: a[k] for k in ("iata", "name", "city", "country", "lat", "lon")}


def nearby_alternate_candidates(dst, radius_km=600, limit=40):
    """Airports near the destination that participate in at least one scheduled route."""
    candidates = []
    for code in G["airports"]:
        if code == dst or (code not in G["adj"] and code not in G["radj"]):
            continue
        km = dist(dst, code)
        if km <= radius_km:
            candidates.append((km, code))
    candidates.sort()
    return [code for _, code in candidates[:limit]]


def find_alternates(src, dst, fuel, risk, radius_km=600, limit=3, max_legs=6):
    """Return lower-risk airports near the destination with a viable route from origin."""
    destination_level = RISK_VALUE[risk[dst]["level"]]
    destination_score = risk[dst]["score"]
    ranked = []
    for code in risk:
        if code in (src, dst):
            continue
        distance_to_destination = dist(dst, code)
        if distance_to_destination > radius_km:
            continue
        level = RISK_VALUE[risk[code]["level"]]
        if level > destination_level or (level == destination_level and risk[code]["score"] >= destination_score):
            continue
        ranked.append((level, risk[code]["score"], distance_to_destination, code))

    # Bound graph searches so alternate recommendations cannot dominate request time.
    ranked.sort()
    candidates = []
    for level, score, distance_to_destination, code in ranked[:12]:
        path, _ = dijkstra(src, code, dist, min(max_legs, 6))
        if not path:
            continue
        candidates.append({
            **node_info(code, risk, {}),
            "distanceFromDestinationKm": round(distance_to_destination),
            "path": path,
            "distanceKm": round(sum(dist(a, b) for a, b in zip(path, path[1:]))),
        })
        if len(candidates) >= limit:
            break
    return candidates


# ---------------------------------------------------------------- endpoints (FastAPI)
@router.on_event("startup")
def warm_route_graph():
    # Load the airport graph and model once, instead of making the first user wait.
    try:
        load()
    except Exception as exc:
        print(f"[route-planner] Startup warm-up skipped: {exc}")


class RouteRequest(BaseModel):
    origin: str
    destination: str
    fuelPercent: float = Field(80, ge=0, le=100)
    safetyWeight: float = Field(1.5, ge=0, le=5)
    maxLegs: int = Field(4, ge=1, le=6)
    avoidCritical: bool = True


@router.get("/airports/search")
def search_airports(q: str = Query("", max_length=40)):
    ensure_loaded()
    q = q.strip().lower()
    if len(q) < 2:
        return []
    hits = []
    for a in G["airports"].values():
        i = a["iata"]
        if i not in G["adj"] and i not in G["radj"]:
            continue
        if q in f'{i} {a["city"]} {a["name"]}'.lower():
            rank = 0 if i.lower() == q else 1 if i.lower().startswith(q) else 2 if a["city"].lower().startswith(q) else 3
            hits.append((rank, -G["deg"][i], a))
    hits.sort(key=lambda t: (t[0], t[1]))
    return [{k: a[k] for k in ("iata", "name", "city", "country")} for _, _, a in hits[:8]]


@router.post("/route/find")
def find_route(req: RouteRequest):
    ensure_loaded()
    src, dst = req.origin.upper().strip(), req.destination.upper().strip()
    fuel, weight, avoid = req.fuelPercent, req.safetyWeight, req.avoidCritical

    if src not in G["airports"] or dst not in G["airports"]:
        raise HTTPException(400, "Unknown airport code. Pick airports from the suggestions.")
    if src == dst:
        raise HTTPException(400, "Origin and destination must be different")

    fewest = bfs(src, dst)
    if not fewest:
        raise HTTPException(404, f"No route between {src} and {dst} exists in the dataset")
    limit = max(req.maxLegs, len(fewest) - 1)
    shortest, _ = dijkstra(src, dst, dist, limit)

    nodes = corridor(src, dst) | set(fewest) | set(shortest)
    nodes.update(nearby_alternate_candidates(dst))
    risk = assess(nodes, src, dst, fuel)

    notes = []
    safest, _ = safest_path(src, dst, nodes, risk, weight, avoid, limit)
    if safest is None and avoid:
        safest, _ = safest_path(src, dst, nodes, risk, weight, False, limit)
        notes.append("Every candidate route passes through a CRITICAL-risk airport, so the filter was relaxed.")
    safest = safest or shortest
    if risk[dst]["level"] == "CRITICAL":
        notes.append(f"Destination {dst} itself is currently rated CRITICAL. Consider an alternate destination.")

    uniq = list(dict.fromkeys(fewest + shortest + safest))
    tops = shap_top(risk, uniq)
    routes = {
        "fewest": describe("Fewest stops", fewest, risk, tops),
        "shortest": describe("Shortest distance", shortest, risk, tops),
        "safest": describe("Safest (risk-weighted)", safest, risk, tops),
    }
    s, f = routes["safest"], routes["shortest"]
    if s["path"] == f["path"]:
        summary = "The shortest route is also the safest option right now."
    else:
        summary = (f"Recommended: {' → '.join(s['path'])}. It adds {s['distanceKm'] - f['distanceKm']} km "
                   f"over the shortest path and changes average risk from {f['avgRisk']:.2f} to {s['avgRisk']:.2f}.")

    return {
        "origin": brief(src), "destination": brief(dst),
        "directDistanceKm": round(dist(src, dst)),
        "liveWeather": all(r["weather"]["live"] for r in risk.values()),
        "summary": summary, "notes": notes, "routes": routes,
        "alternates": find_alternates(src, dst, fuel, risk, max_legs=limit),
    }