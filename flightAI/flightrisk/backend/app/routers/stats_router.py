from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from .. import models, auth
from ..database import get_db

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/overview")
def overview(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    q = db.query(models.Flight)
    if current_user.role != "OPS":
        q = q.filter(models.Flight.owner_id == current_user.id)
    flights = q.all()
    flight_ids = [f.id for f in flights]

    latest_by_flight = {}
    if flight_ids:
        analyses = (
            db.query(models.Analysis)
            .filter(models.Analysis.flight_id.in_(flight_ids))
            .order_by(models.Analysis.created_at.desc())
            .all()
        )
        for a in analyses:
            if a.flight_id not in latest_by_flight:
                latest_by_flight[a.flight_id] = a

    counts = {"LOW": 0, "MODERATE": 0, "HIGH": 0, "CRITICAL": 0, "UNANALYZED": 0}
    for f in flights:
        a = latest_by_flight.get(f.id)
        if a:
            counts[a.risk_level] = counts.get(a.risk_level, 0) + 1
        else:
            counts["UNANALYZED"] += 1

    pending_decisions = sum(
        1 for a in latest_by_flight.values() if a.decision is None and a.risk_level in ("HIGH", "CRITICAL")
    )

    return {
        "total_flights": len(flights),
        "risk_counts": counts,
        "pending_decisions": pending_decisions,
        "total_analyses": db.query(func.count(models.Analysis.id)).scalar() if current_user.role == "OPS" else len(latest_by_flight),
    }
