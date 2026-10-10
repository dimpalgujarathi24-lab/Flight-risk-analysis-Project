from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from .. import models, auth
from ..database import get_db

router = APIRouter(prefix="/api/airports", tags=["airports"])


@router.get("/search")
def search_airports(
    q: str = Query(..., min_length=1),
    limit: int = 8,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    q_like = f"%{q}%"
    results = (
        db.query(models.Airport)
        .filter(
            or_(
                models.Airport.iata.ilike(q_like),
                models.Airport.name.ilike(q_like),
                models.Airport.city.ilike(q_like),
            )
        )
        # exact IATA matches first, then alphabetical
        .order_by(models.Airport.iata != q.upper(), models.Airport.city)
        .limit(limit)
        .all()
    )
    return [
        {
            "iata": a.iata,
            "name": a.name,
            "city": a.city,
            "country": a.country,
            "latitude": a.latitude,
            "longitude": a.longitude,
        }
        for a in results
    ]


@router.get("/{iata}")
def get_airport(iata: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    a = db.query(models.Airport).filter(models.Airport.iata == iata.upper()).first()
    if not a:
        return None
    return {
        "iata": a.iata, "name": a.name, "city": a.city, "country": a.country,
        "latitude": a.latitude, "longitude": a.longitude,
    }
