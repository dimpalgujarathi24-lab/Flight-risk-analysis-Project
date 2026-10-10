from pydantic import BaseModel, EmailStr, ConfigDict
from datetime import datetime
from typing import Optional, List


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: str = "PILOT"
    invite_code: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    full_name: str
    role: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class FlightCreate(BaseModel):
    flight_number: str
    origin: str
    destination: str
    departure_time: datetime
    aircraft_type: str
    airline_name: Optional[str] = None
    fuel_reserve_pct: float = 50
    weather_severity: float = 2
    traffic_density: float = 3
    visibility_km: float = 10
    crew_duty_hours: float = 2
    aircraft_age_years: float = 5
    maintenance_score: float = 90
    runway_condition: float = 1


class FlightOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    flight_number: str
    origin: str
    destination: str
    departure_time: datetime
    aircraft_type: str
    airline_name: Optional[str] = None
    distance_km: Optional[float] = None
    fuel_reserve_pct: float
    weather_severity: float
    traffic_density: float
    visibility_km: float
    crew_duty_hours: float
    aircraft_age_years: float
    maintenance_score: float
    runway_condition: float
    created_at: datetime


class RiskFactor(BaseModel):
    feature: str
    label: str
    value: float
    contribution: float
    impact_pct: float
    direction: str


class AnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    flight_id: int
    risk_level: str
    confidence: float
    probabilities: dict
    factors: List[RiskFactor]
    recommendation: str
    decision: Optional[str] = None
    decision_note: Optional[str] = None
    created_at: datetime


class DecisionIn(BaseModel):
    decision: str  # ACCEPTED | MITIGATED | REJECTED
    note: Optional[str] = None


class AskQuestionIn(BaseModel):
    question: str


class AskQuestionOut(BaseModel):
    answer: str
    source: str  # "rules_engine" | "claude"


class LiveAircraft(BaseModel):
    icao24: str
    callsign: Optional[str] = None
    latitude: float
    longitude: float
    altitude_m: Optional[float] = None
    velocity_ms: Optional[float] = None
    heading: Optional[float] = None
    origin_country: Optional[str] = None
