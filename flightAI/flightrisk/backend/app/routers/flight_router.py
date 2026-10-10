import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, auth
from ..database import get_db
from ..ml.predict import predict_risk
from ..geo import haversine_km
from ..services.live_traffic import get_live_traffic
from ..services.qa_engine import answer_question

router = APIRouter(prefix="/api/flights", tags=["flights"])


def _check_flight_access(flight: models.Flight, current_user: models.User):
    """Pilots may only access flights they own; Ops may access any flight."""
    if current_user.role != "OPS" and flight.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You don't have access to this flight")


def _analysis_to_out(a: models.Analysis) -> dict:
    return {
        "id": a.id,
        "flight_id": a.flight_id,
        "risk_level": a.risk_level,
        "confidence": a.confidence,
        "probabilities": json.loads(a.probabilities_json),
        "factors": json.loads(a.factors_json),
        "recommendation": a.recommendation,
        "decision": a.decision,
        "decision_note": a.decision_note,
        "created_at": a.created_at,
    }


@router.get("", response_model=list[schemas.FlightOut])
def list_flights(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role == "OPS":
        return db.query(models.Flight).order_by(models.Flight.departure_time).all()
    return db.query(models.Flight).filter(models.Flight.owner_id == current_user.id).order_by(models.Flight.departure_time).all()


@router.post("", response_model=schemas.FlightOut)
def create_flight(payload: schemas.FlightCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    data = payload.model_dump()

    origin_ap = db.query(models.Airport).filter(models.Airport.iata == data["origin"].upper()).first()
    dest_ap = db.query(models.Airport).filter(models.Airport.iata == data["destination"].upper()).first()
    distance_km = None
    if origin_ap and dest_ap:
        distance_km = haversine_km(origin_ap.latitude, origin_ap.longitude, dest_ap.latitude, dest_ap.longitude)
        data["origin"] = origin_ap.iata
        data["destination"] = dest_ap.iata

    flight = models.Flight(**data, distance_km=distance_km, owner_id=current_user.id)
    db.add(flight)
    db.commit()
    db.refresh(flight)
    return flight


@router.get("/{flight_id}/route")
def get_flight_route(flight_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Returns full airport geo details for both endpoints of a flight, for map rendering."""
    flight = db.query(models.Flight).filter(models.Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    _check_flight_access(flight, current_user)
    origin_ap = db.query(models.Airport).filter(models.Airport.iata == flight.origin).first()
    dest_ap = db.query(models.Airport).filter(models.Airport.iata == flight.destination).first()

    def ap_out(a):
        if not a:
            return None
        return {"iata": a.iata, "name": a.name, "city": a.city, "country": a.country,
                "latitude": a.latitude, "longitude": a.longitude}

    return {"origin": ap_out(origin_ap), "destination": ap_out(dest_ap), "distance_km": flight.distance_km}


@router.get("/{flight_id}/live-traffic")
def get_flight_live_traffic(flight_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Real live aircraft (via OpenSky Network ADS-B data) currently airborne in the
    corridor between this flight's origin and destination. Not a claim that any
    of these IS this flight — genuine live air traffic in the same airspace.
    """
    flight = db.query(models.Flight).filter(models.Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    _check_flight_access(flight, current_user)

    origin_ap = db.query(models.Airport).filter(models.Airport.iata == flight.origin).first()
    dest_ap = db.query(models.Airport).filter(models.Airport.iata == flight.destination).first()
    if not origin_ap or not dest_ap:
        return {"aircraft": [], "source": "opensky"}

    return get_live_traffic(origin_ap.latitude, origin_ap.longitude, dest_ap.latitude, dest_ap.longitude)


@router.get("/{flight_id}", response_model=schemas.FlightOut)
def get_flight(flight_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    flight = db.query(models.Flight).filter(models.Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    _check_flight_access(flight, current_user)
    return flight


@router.get("/{flight_id}/analyses", response_model=list[schemas.AnalysisOut])
def list_analyses(flight_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    flight = db.query(models.Flight).filter(models.Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    _check_flight_access(flight, current_user)
    analyses = db.query(models.Analysis).filter(models.Analysis.flight_id == flight_id).order_by(models.Analysis.created_at.desc()).all()
    return [_analysis_to_out(a) for a in analyses]


@router.post("/{flight_id}/analyze", response_model=schemas.AnalysisOut)
def analyze_flight(flight_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    flight = db.query(models.Flight).filter(models.Flight.id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    _check_flight_access(flight, current_user)

    features = {
        "fuel_reserve_pct": flight.fuel_reserve_pct,
        "weather_severity": flight.weather_severity,
        "traffic_density": flight.traffic_density,
        "visibility_km": flight.visibility_km,
        "crew_duty_hours": flight.crew_duty_hours,
        "aircraft_age_years": flight.aircraft_age_years,
        "maintenance_score": flight.maintenance_score,
        "runway_condition": flight.runway_condition,
    }
    result = predict_risk(features)

    analysis = models.Analysis(
        flight_id=flight.id,
        risk_level=result["risk_level"],
        confidence=result["confidence"],
        probabilities_json=json.dumps(result["probabilities"]),
        factors_json=json.dumps(result["factors"]),
        recommendation=result["recommendation"],
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return _analysis_to_out(analysis)


@router.post("/analyses/{analysis_id}/decision", response_model=schemas.AnalysisOut)
def record_decision(analysis_id: int, payload: schemas.DecisionIn, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    from datetime import datetime, timezone
    analysis = db.query(models.Analysis).filter(models.Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    flight = db.query(models.Flight).filter(models.Flight.id == analysis.flight_id).first()
    _check_flight_access(flight, current_user)
    if payload.decision not in ("ACCEPTED", "MITIGATED", "REJECTED"):
        raise HTTPException(status_code=400, detail="Invalid decision")

    analysis.decision = payload.decision
    analysis.decision_note = payload.note
    analysis.decided_by_id = current_user.id
    analysis.decided_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(analysis)
    return _analysis_to_out(analysis)


@router.post("/analyses/{analysis_id}/ask", response_model=schemas.AskQuestionOut)
def ask_about_analysis(analysis_id: int, payload: schemas.AskQuestionIn, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Answers a free-text question about a specific analysis, grounded in its real stored data."""
    analysis = db.query(models.Analysis).filter(models.Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    flight = db.query(models.Flight).filter(models.Flight.id == analysis.flight_id).first()
    _check_flight_access(flight, current_user)

    analysis_data = _analysis_to_out(analysis)
    analysis_data["created_at"] = str(analysis_data["created_at"])
    answer, source = answer_question(payload.question, analysis_data)
    return {"answer": answer, "source": source}
