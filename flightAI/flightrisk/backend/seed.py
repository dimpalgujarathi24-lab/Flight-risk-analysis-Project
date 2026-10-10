"""Seeds demo users and flights. Run once: python3 seed.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, timedelta, timezone
from app.database import SessionLocal, Base, engine
from app import models, auth
from app.geo import haversine_km
import import_data

Base.metadata.create_all(bind=engine)
import_data.import_airports()
import_data.import_airlines()
db = SessionLocal()


def airport_coords(iata):
    a = db.query(models.Airport).filter(models.Airport.iata == iata).first()
    return (a.latitude, a.longitude) if a else None


def distance_between(origin, destination):
    o, d = airport_coords(origin), airport_coords(destination)
    if o and d:
        return haversine_km(*o, *d)
    return None

if db.query(models.User).count() == 0:
    pilot = models.User(
        email="pilot@flightrisk.demo",
        full_name="Capt. Ananya Rao",
        hashed_password=auth.hash_password("demo1234"),
        role="PILOT",
    )
    ops = models.User(
        email="ops@flightrisk.demo",
        full_name="Vikram Shah",
        hashed_password=auth.hash_password("demo1234"),
        role="OPS",
    )
    db.add_all([pilot, ops])
    db.commit()
    db.refresh(pilot)
    db.refresh(ops)

    now = datetime.now(timezone.utc)
    flights_data = [
        dict(flight_number="6E-2301", origin="BOM", destination="DEL", departure_time=now + timedelta(hours=3),
             aircraft_type="A320neo", airline_name="IndiGo", fuel_reserve_pct=62, weather_severity=2.1, traffic_density=5.5,
             visibility_km=9.5, crew_duty_hours=2.5, aircraft_age_years=4, maintenance_score=94, runway_condition=1.2,
             owner_id=pilot.id),
        dict(flight_number="AI-441", origin="DEL", destination="BLR", departure_time=now + timedelta(hours=6),
             aircraft_type="B737-800", airline_name="Air India", fuel_reserve_pct=22, weather_severity=7.8, traffic_density=6.2,
             visibility_km=2.5, crew_duty_hours=9.5, aircraft_age_years=15, maintenance_score=71, runway_condition=5.5,
             owner_id=pilot.id),
        dict(flight_number="UK-955", origin="BLR", destination="HYD", departure_time=now + timedelta(hours=1),
             aircraft_type="A321", airline_name="Vistara", fuel_reserve_pct=45, weather_severity=4.0, traffic_density=4.0,
             visibility_km=7.0, crew_duty_hours=5.0, aircraft_age_years=8, maintenance_score=85, runway_condition=2.0,
             owner_id=ops.id),
        dict(flight_number="6E-812", origin="MAA", destination="CCU", departure_time=now + timedelta(hours=10),
             aircraft_type="A320", airline_name="IndiGo", fuel_reserve_pct=15, weather_severity=8.5, traffic_density=7.5,
             visibility_km=1.5, crew_duty_hours=11, aircraft_age_years=19, maintenance_score=64, runway_condition=7.2,
             owner_id=ops.id),
        dict(flight_number="AI-102", origin="DEL", destination="JFK", departure_time=now + timedelta(hours=14),
             aircraft_type="B777-300ER", airline_name="Air India", fuel_reserve_pct=70, weather_severity=3.2, traffic_density=3.8,
             visibility_km=10, crew_duty_hours=1.0, aircraft_age_years=6, maintenance_score=91, runway_condition=1.0,
             owner_id=ops.id),
        dict(flight_number="SG-411", origin="PNQ", destination="GOI", departure_time=now + timedelta(hours=4),
             aircraft_type="B737 MAX", airline_name="SpiceJet", fuel_reserve_pct=38, weather_severity=5.5, traffic_density=3.0,
             visibility_km=5.0, crew_duty_hours=6.5, aircraft_age_years=2, maintenance_score=97, runway_condition=3.0,
             owner_id=ops.id),
    ]
    for fd in flights_data:
        fd["distance_km"] = distance_between(fd["origin"], fd["destination"])
        db.add(models.Flight(**fd))
    db.commit()
    print("Seeded 2 users and 6 flights.")
    print("  pilot@flightrisk.demo / demo1234  (role: PILOT)")
    print("  ops@flightrisk.demo   / demo1234  (role: OPS)")
else:
    print("Users already exist, skipping seed.")

db.close()
