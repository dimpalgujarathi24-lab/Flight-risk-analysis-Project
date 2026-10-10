from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from .. import models, auth
from ..database import get_db

router = APIRouter(prefix="/api/airlines", tags=["airlines"])


@router.get("/search")
def search_airlines(
    q: str = Query(..., min_length=1),
    limit: int = 8,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    q_like = f"%{q}%"
    results = (
        db.query(models.Airline)
        .filter(or_(models.Airline.name.ilike(q_like), models.Airline.iata.ilike(q_like)))
        .order_by(models.Airline.name)
        .limit(limit)
        .all()
    )
    return [{"name": a.name, "iata": a.iata, "icao": a.icao, "country": a.country} for a in results]
