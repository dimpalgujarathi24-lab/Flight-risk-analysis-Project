"""
Fetches real, live aircraft position data from OpenSky Network's free public
REST API (no API key required for anonymous, rate-limited use).

Important honesty note: we cannot verify that any specific real aircraft IS
"this" flight (our flights are demo/user-created records, not real bookings
tied to a real ICAO24 transponder). What we CAN honestly show is: real aircraft
that are actually airborne, right now, inside the geographic corridor between
the two airports. That's genuine live ADS-B data, just correctly scoped.
"""
import time
import requests

OPENSKY_URL = "https://opensky-network.org/api/states/all"

# Simple in-memory cache to avoid hammering the free anonymous API
# (OpenSky's anonymous tier is rate-limited to a handful of requests/minute).
_cache: dict[str, tuple[float, list]] = {}
CACHE_TTL_SECONDS = 20


def _bounding_box(lat1, lon1, lat2, lon2, margin_deg=2.0):
    lamin = min(lat1, lat2) - margin_deg
    lamax = max(lat1, lat2) + margin_deg
    lomin = min(lon1, lon2) - margin_deg
    lomax = max(lon1, lon2) + margin_deg
    return lamin, lomin, lamax, lomax


def get_live_traffic(lat1: float, lon1: float, lat2: float, lon2: float, limit: int = 25) -> dict:
    """
    Returns real live aircraft currently within the bounding box that
    contains the route's two airports (plus a margin), sourced from OpenSky.
    """
    cache_key = f"{round(lat1,1)},{round(lon1,1)},{round(lat2,1)},{round(lon2,1)}"
    now = time.time()
    if cache_key in _cache:
        ts, data = _cache[cache_key]
        if now - ts < CACHE_TTL_SECONDS:
            return {"aircraft": data, "cached": True, "source": "opensky"}

    lamin, lomin, lamax, lomax = _bounding_box(lat1, lon1, lat2, lon2)

    try:
        resp = requests.get(
            OPENSKY_URL,
            params={"lamin": lamin, "lomin": lomin, "lamax": lamax, "lomax": lomax},
            timeout=6,
        )
        resp.raise_for_status()
        payload = resp.json()
    except Exception as e:
        return {"aircraft": [], "cached": False, "source": "opensky", "error": str(e)}

    states = payload.get("states") or []
    aircraft = []
    for s in states[:limit * 3]:  # OpenSky state vector columns are positional
        # index: 0 icao24, 1 callsign, 2 origin_country, 5 lon, 6 lat, 7 baro_altitude,
        # 8 on_ground, 9 velocity, 10 true_track (heading)
        if s[5] is None or s[6] is None:
            continue
        if s[8]:  # on_ground
            continue
        aircraft.append({
            "icao24": s[0],
            "callsign": (s[1] or "").strip() or None,
            "latitude": s[6],
            "longitude": s[5],
            "altitude_m": s[7],
            "velocity_ms": s[9],
            "heading": s[10],
            "origin_country": s[2],
        })
        if len(aircraft) >= limit:
            break

    _cache[cache_key] = (now, aircraft)
    return {"aircraft": aircraft, "cached": False, "source": "opensky"}
