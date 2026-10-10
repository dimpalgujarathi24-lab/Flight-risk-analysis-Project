"""
Trains the 8-feature route-risk model.
Run from the ai-service folder:  python train_model_v2.py
Creates model/model_v2.joblib and model/scaler_v2.joblib
"""
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from pathlib import Path

SEED = 42
N_SAMPLES = 12000
FEATURES = [
    "fuel_percent", "weather_severity", "traffic_density", "visibility_km",
    "wind_speed_kts", "distance_km", "altitude_ft", "temperature_c",
]


def generate(n):
    rng = np.random.default_rng(SEED)
    fuel = rng.uniform(5, 100, n)
    weather = np.clip(rng.beta(1.5, 3.5, n) * 10, 0, 10)
    traffic = rng.uniform(0, 10, n)
    visibility = np.clip(20 - 1.6 * weather + rng.normal(0, 3, n), 0.3, 20)
    wind = np.clip(rng.gamma(2, 6, n), 0, 70)
    distance = rng.uniform(0, 12000, n)
    altitude = np.clip(rng.exponential(1500, n), 0, 12000)
    temp = rng.normal(18, 12, n)

    score = (
        (100 - fuel) * 0.40
        + weather * 5.5
        + traffic * 2.0
        + np.maximum(0, 10 - visibility) * 2.0
        + np.maximum(0, wind - 15) * 0.6
        + distance / 1000 * 1.0
        + np.maximum(0, altitude - 3000) / 1000 * 1.5
        + np.abs(temp - 15) * 0.1
        + rng.normal(0, 5, n)
    )
    labels = pd.cut(score, bins=[-np.inf, 35, 55, 75, np.inf],
                    labels=["LOW", "MODERATE", "HIGH", "CRITICAL"])
    df = pd.DataFrame(
        np.column_stack([fuel, weather, traffic, visibility, wind, distance, altitude, temp]),
        columns=FEATURES,
    )
    df["risk_level"] = labels.astype(str)
    return df


def main():
    df = generate(N_SAMPLES)
    print(df["risk_level"].value_counts())
    X, y = df[FEATURES], df["risk_level"]
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=SEED, stratify=y)

    scaler = StandardScaler().fit(X_tr)
    model = RandomForestClassifier(
        n_estimators=200, max_depth=10, min_samples_leaf=4,
        class_weight="balanced", random_state=SEED, n_jobs=-1,
    ).fit(scaler.transform(X_tr), y_tr)

    pred = model.predict(scaler.transform(X_te))
    print(f"\nTest accuracy: {accuracy_score(y_te, pred):.3f}\n")
    print(classification_report(y_te, pred))
    for f, imp in sorted(zip(FEATURES, model.feature_importances_), key=lambda t: -t[1]):
        print(f"{f:18s} {imp:.3f}")

        out_dir = Path(__file__).resolve().parent / "model"
    out_dir.mkdir(exist_ok=True)
    joblib.dump(model, out_dir / "model_v2.joblib")
    joblib.dump(scaler, out_dir / "scaler_v2.joblib")
    print(f"\nSaved model_v2.joblib and scaler_v2.joblib to {out_dir}")


if __name__ == "__main__":
    main()