# FlightRisk — Pre-Flight Risk Intelligence

A full-stack aviation risk-assessment platform: a trained Random Forest model reads
fuel, weather, traffic, and crew-fatigue data for a flight and returns a risk level
with SHAP-ranked, human-readable reasons — displayed on an animated instrument-panel
dashboard where pilots and ops log accept/mitigate/reject decisions.

## Stack

- **Backend**: FastAPI, SQLAlchemy (SQLite), JWT auth, scikit-learn + SHAP
- **Frontend**: React + TypeScript + Vite, Tailwind CSS v4, Framer Motion, Recharts, React-Leaflet
- **Real-world data**: [OpenFlights](https://openflights.org/data.html) airports and airlines datasets — 6,072 real airports and 1,253 active airlines, imported into the database on first run

## Quick start

### 1. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

python3 app/ml/train.py         # trains the model, ~10 seconds
python3 seed.py                 # imports OpenFlights data + creates demo users/flights
uvicorn app.main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`. API docs (auto-generated) at
`http://localhost:8000/docs`. `seed.py` calls `import_data.py` automatically, so
you don't need to run it separately — but you can (`python3 import_data.py`) if
you ever wipe the database and just want the airport/airline data back without
re-seeding demo flights.

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

### 3. Log in

Use the "Pilot" or "Ops" quick-fill buttons on the login screen, or:

| Role  | Email                    | Password  |
|-------|--------------------------|-----------|
| Pilot | pilot@flightrisk.demo    | demo1234  |
| Ops   | ops@flightrisk.demo      | demo1234  |

Pilots see only their own flights; Ops sees the whole fleet. New accounts can
also self-register at `/register` — Pilot signup is open, Ops signup requires
the invite code `OPS-2026-INVITE` (change this via the `OPS_INVITE_CODE`
environment variable before deploying anywhere real).

### 4. Optional: enable real Claude-powered chat answers

By default, the "Ask about this analysis" chat on each flight's detail page
answers from a deterministic rules engine grounded in that flight's real SHAP
data — works with zero setup. If you want open-ended natural-language answers
from the actual Claude API instead, set an environment variable before
starting the backend:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
uvicorn app.main:app --reload --port 8000
```

The chat UI labels which engine actually answered each message. This is
optional — the app is fully functional without it, and this will incur real
API usage costs on your Anthropic account if enabled.

## What's real here (for your interview / write-up)

- **Real airport and airline data.** `backend/data/` contains the actual
  OpenFlights `airports.dat` and `airlines.dat` datasets. `import_data.py` parses
  and loads 6,072 airports (name, city, country, IATA/ICAO codes, real lat/lon)
  and 1,253 currently-active airlines into the database. The "New Flight" form's
  origin/destination fields are a live autocomplete against this real data
  (`GET /api/airports/search?q=...`), not a hardcoded dropdown.
- **Real computed distances.** When a flight is created, the backend looks up
  both airports' actual coordinates and computes the great-circle distance with
  the haversine formula (`app/geo.py`).
- **A live route map with real live air traffic.** Each flight's detail page
  renders a map (React-Leaflet + OpenStreetMap-based dark tiles) plotting the
  real coordinates of both airports, plus **actual live aircraft** currently
  airborne in that corridor, pulled from OpenSky Network's free public ADS-B
  API (`app/services/live_traffic.py`), refreshed every 20 seconds. Honesty
  note: this shows genuine real-time air traffic in the geographic corridor —
  it does not and cannot claim that any specific aircraft shown IS the flight
  in question, since these are demo/user-created flight records, not real
  bookings tied to a real transponder. The UI's live-status indicator reflects
  actual connectivity, including showing "unavailable" if OpenSky can't be
  reached.
- **Role-based access is enforced on every endpoint, not just hidden in the
  UI.** Pilots can only fetch, analyze, or make decisions on flights where
  `owner_id` matches their own user ID — verified server-side with a 403 on
  every flight-scoped route, not just filtered out of list views. Ops accounts
  can access any flight. Ops registration requires a server-checked invite
  code (`OPS_INVITE_CODE` env var, defaults to `OPS-2026-INVITE` for local use
  — change this before deploying anywhere real).
- **The AI chat is genuinely grounded, not a wrapper around invented text.**
  By default, questions are answered by a deterministic rules engine
  (`app/services/qa_engine.py`) that pattern-matches the question and composes
  an answer directly from that analysis's real stored SHAP factors and
  probabilities — verified in testing to return numbers that exactly match the
  displayed factor bars. If you set an `ANTHROPIC_API_KEY` environment
  variable, open-ended questions are instead answered by a real Claude API
  call whose system prompt is grounded with the same real analysis JSON —
  falls back to the rules engine automatically on any error. The chat UI
  labels which one actually answered each message.
- **The model is actually trained**, not hardcoded. `app/ml/train.py` generates
  a synthetic dataset with real interaction effects (e.g. low fuel + severe
  weather compounds faster than either alone) and trains a
  `RandomForestClassifier`. Metrics are logged honestly (~67% accuracy across 4
  classes, strongest on CRITICAL) — the training script and a sample of the
  generated data are in the repo, not just the `.pkl`. Note: the *risk model*
  itself is still trained on synthetic data — real historical incident data at
  this scale isn't publicly available — but the *airports, airlines, distances,
  and live traffic it operates on* are 100% real.
- **SHAP explainability is real**, not a fake progress bar. Every prediction
  returns per-feature contributions ranked by magnitude, which drive the factor
  bars on the analysis page and the chat's answers.
- **Auth is real JWT**, hashed passwords (bcrypt), self-registration for both
  roles with server-enforced invite-gating for Ops.
- **Everything is wired end-to-end**: the frontend calls the real FastAPI
  backend, which calls the real model in-process, queries the real airport
  database, and reaches out to a real external API for live traffic. No
  mocked responses anywhere in this repo.

## Project structure

```
backend/
  data/
    airports.dat            OpenFlights airport dataset (source data)
    airlines.dat             OpenFlights airline dataset (source data)
    routes.dat                 OpenFlights routes dataset (included, not yet used)
  app/
    main.py            FastAPI app + CORS
    models.py           SQLAlchemy models (User, Flight, Analysis, Airport, Airline)
    schemas.py           Pydantic request/response schemas
    auth.py               JWT + password hashing + Ops invite code check
    geo.py                 Haversine great-circle distance
    ml/
      train.py             Synthetic data generation + model training
      predict.py            Loads model, runs SHAP, formats output
    services/
      live_traffic.py       Real ADS-B data via OpenSky Network API
      qa_engine.py            Grounded Q&A: rules engine + optional Claude API
    routers/
      auth_router.py        /api/auth/* (register enforces Ops invite code)
      flight_router.py       /api/flights/* (route, live-traffic, ask, access control)
      stats_router.py         /api/stats/*
      airports_router.py       /api/airports/search, /api/airports/{iata}
      airlines_router.py       /api/airlines/search
  import_data.py         Loads airports.dat / airlines.dat into the database
  seed.py                Demo users + flights (calls import_data automatically)

frontend/
  src/
    components/
      RiskGauge.tsx              Animated SVG risk gauge (signature UI element)
      RouteMap.tsx                 Leaflet map: real airports + live ADS-B traffic
      RiskChat.tsx                  AI chat panel grounded in real SHAP data
      Avatar.tsx                     Deterministic initials avatar (no external service)
      AirportAutocomplete.tsx       Live search against the real airport dataset
      AirlineAutocomplete.tsx        Live search against the real airline dataset
    pages/          Landing, Login, Register, Dashboard, Flights, NewFlight, FlightDetail, Reports
    store/authStore.ts           Zustand auth state
    lib/api.ts                    Typed API client
```

## Data attribution

Airport and airline data from [OpenFlights](https://openflights.org/data.html),
used under their open data terms. This is the same dataset widely used in
aviation-adjacent side projects and demos — it's a static, periodically-updated
snapshot (not live), so brand-new airports/airlines or route changes won't be
reflected.

## A note on OpenSky Network (live traffic)

The anonymous, no-API-key tier of OpenSky's API is rate-limited (a handful of
requests per minute). The backend caches results per route for 20 seconds to
stay well within that. If you hit the limit or OpenSky has downtime, the map
shows "live traffic unavailable" rather than breaking — this is expected
behavior for a free public API, not a bug. For heavier use, OpenSky offers
free registered accounts with higher limits.

## Extending it further (natural next steps, not done here)

- Deploy: Render/Railway (backend) + Vercel/Netlify (frontend) free tiers
- Real-time weather: swap synthetic `weather_severity` for an OpenWeatherMap
  call keyed off the real airport coordinates you now have
- Use `routes.dat` (also OpenFlights, included in `backend/data/` but not yet
  imported) to auto-suggest which airlines actually fly a given route, or to
  flag when a user creates a flight on a route nobody currently operates
- PDF export of a flight's risk report
- A fleet-wide map on the Reports page plotting every flight's route at once
- Persist chat history per analysis (currently resets on page reload)


## Safer route suggestions (integrated into Flight Details)

After running a flight risk analysis, open that flight's detail page and use
**Find safer route** in the **Safer route suggestions** section. The planner
compares safest, shortest, and fewest-stop routes, plots the recommended route,
and lists lower-risk alternate airports within 600 km of the destination when
a viable route is found.

The route planner uses the pre-trained model in `backend/app/model/` and the
airport/airline route datasets in `backend/data/`. These are separate from the
main flight-analysis model, so their risk levels can differ. Live weather comes
from Open-Meteo; if it is unavailable, the planner uses neutral fallback values
and explicitly labels them as not live observations.

Run the backend from the `backend` directory:

```bash
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The frontend uses the existing Vite setup:

```bash
cd frontend
npm install
npm run dev
```

The route planner API is available under `/api/planner` (for example,
`POST /api/planner/route/find`). It is no longer a separate navigation page;
it is shown on a flight detail page after a risk analysis exists.
