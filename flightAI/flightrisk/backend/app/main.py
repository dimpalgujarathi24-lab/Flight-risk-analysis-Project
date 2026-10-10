from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import auth_router, flight_router, stats_router, airports_router, airlines_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="FlightRisk API", version="1.0.0")
from app.routing import router as routing_router
app.include_router(routing_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(flight_router.router)
app.include_router(stats_router.router)
app.include_router(airports_router.router)
app.include_router(airlines_router.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "flightrisk-api"}
