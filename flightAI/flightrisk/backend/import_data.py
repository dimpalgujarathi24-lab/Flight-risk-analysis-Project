"""
Imports the OpenFlights airports.dat and airlines.dat datasets into the
database. Run once: python3 import_data.py
Source: https://github.com/jpatokal/openflights (public domain-ish, ODbL-style attribution)
"""
import sys, os, csv
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, Base, engine
from app import models

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

Base.metadata.create_all(bind=engine)
db = SessionLocal()


def clean(v):
    v = v.strip()
    return None if v in ("", "\\N") else v


def import_airports():
    if db.query(models.Airport).count() > 0:
        print("Airports already imported, skipping.")
        return
    count = 0
    with open(os.path.join(DATA_DIR, "airports.dat"), newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        batch = []
        for row in reader:
            if len(row) < 8:
                continue
            iata = clean(row[4])
            if not iata or len(iata) != 3:
                continue
            try:
                lat, lon = float(row[6]), float(row[7])
            except ValueError:
                continue
            batch.append(models.Airport(
                iata=iata,
                icao=clean(row[5]),
                name=clean(row[1]) or iata,
                city=clean(row[2]),
                country=clean(row[3]),
                latitude=lat,
                longitude=lon,
                altitude_ft=float(row[8]) if clean(row[8]) else None,
                timezone=clean(row[11]),
            ))
            count += 1
        # de-dupe on IATA (dataset can have rare repeats) — keep first occurrence
        seen = set()
        unique_batch = []
        for a in batch:
            if a.iata not in seen:
                seen.add(a.iata)
                unique_batch.append(a)
        db.bulk_save_objects(unique_batch)
        db.commit()
    print(f"Imported {len(unique_batch)} airports.")


def import_airlines():
    if db.query(models.Airline).count() > 0:
        print("Airlines already imported, skipping.")
        return
    batch = []
    with open(os.path.join(DATA_DIR, "airlines.dat"), newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 8:
                continue
            name = clean(row[1])
            if not name or name in ("Unknown", "Private flight"):
                continue
            if row[7].strip() != '"Y"' and clean(row[7]) != "Y":
                continue  # active airlines only
            batch.append(models.Airline(
                name=name,
                iata=clean(row[3]),
                icao=clean(row[4]),
                callsign=clean(row[5]),
                country=clean(row[6]),
                active="Y",
            ))
    db.bulk_save_objects(batch)
    db.commit()
    print(f"Imported {len(batch)} active airlines.")


if __name__ == "__main__":
    import_airports()
    import_airlines()
    db.close()
