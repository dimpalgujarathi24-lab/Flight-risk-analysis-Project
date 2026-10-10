from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from .database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="PILOT")  # PILOT | OPS
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    flights = relationship("Flight", back_populates="owner")


class Airport(Base):
    __tablename__ = "airports"
    id = Column(Integer, primary_key=True)
    iata = Column(String, unique=True, index=True, nullable=False)
    icao = Column(String, index=True)
    name = Column(String, nullable=False)
    city = Column(String)
    country = Column(String)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    altitude_ft = Column(Float)
    timezone = Column(String)


class Airline(Base):
    __tablename__ = "airlines"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    iata = Column(String, index=True)
    icao = Column(String, index=True)
    callsign = Column(String)
    country = Column(String)
    active = Column(String)  # "Y" / "N"


class Flight(Base):
    __tablename__ = "flights"
    id = Column(Integer, primary_key=True, index=True)
    flight_number = Column(String, nullable=False)
    origin = Column(String, nullable=False)       # IATA code
    destination = Column(String, nullable=False)  # IATA code
    departure_time = Column(DateTime, nullable=False)
    aircraft_type = Column(String, nullable=False)
    airline_name = Column(String, nullable=True)
    distance_km = Column(Float, nullable=True)

    fuel_reserve_pct = Column(Float, default=50)
    weather_severity = Column(Float, default=2)
    traffic_density = Column(Float, default=3)
    visibility_km = Column(Float, default=10)
    crew_duty_hours = Column(Float, default=2)
    aircraft_age_years = Column(Float, default=5)
    maintenance_score = Column(Float, default=90)
    runway_condition = Column(Float, default=1)

    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="flights")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    analyses = relationship("Analysis", back_populates="flight", order_by="desc(Analysis.created_at)")


class Analysis(Base):
    __tablename__ = "analyses"
    id = Column(Integer, primary_key=True, index=True)
    flight_id = Column(Integer, ForeignKey("flights.id"))
    flight = relationship("Flight", back_populates="analyses")

    risk_level = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    probabilities_json = Column(Text, nullable=False)
    factors_json = Column(Text, nullable=False)
    recommendation = Column(Text, nullable=False)

    decision = Column(String, nullable=True)  # ACCEPTED | MITIGATED | REJECTED | None
    decision_note = Column(Text, nullable=True)
    decided_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    decided_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
