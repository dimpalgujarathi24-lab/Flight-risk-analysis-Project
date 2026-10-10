"""
Trains a RandomForestClassifier on synthetic pre-flight risk data.

The synthetic generator encodes real aviation risk relationships (not
random noise): low fuel reserves, severe weather, high traffic density,
poor visibility, and pilot fatigue each push risk up, with interaction
effects (e.g. low fuel + bad weather compounds faster than either alone).
This is what makes SHAP explanations meaningful rather than decorative.
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import joblib
import os

RNG = np.random.default_rng(42)
N = 6000

FEATURES = [
    "fuel_reserve_pct",     # % fuel above minimum legal reserve
    "weather_severity",     # 0-10 composite (wind, precip, icing, turbulence)
    "traffic_density",      # 0-10 airspace/airport congestion
    "visibility_km",        # km
    "crew_duty_hours",      # hours into duty period (fatigue proxy)
    "aircraft_age_years",
    "maintenance_score",    # 0-100, higher = better maintained
    "runway_condition",     # 0-10, higher = worse (contamination, length margin)
]

def generate_dataset(n=N):
    fuel = np.clip(RNG.normal(35, 20, n), 0, 100)
    weather = np.clip(RNG.beta(2, 4, n) * 10, 0, 10)
    traffic = np.clip(RNG.beta(2, 3, n) * 10, 0, 10)
    visibility = np.clip(RNG.normal(8, 4, n), 0.2, 15)
    duty = np.clip(RNG.normal(6, 3, n), 0, 16)
    age = np.clip(RNG.exponential(8, n), 0, 35)
    maint = np.clip(RNG.normal(80, 15, n), 20, 100)
    runway = np.clip(RNG.beta(1.5, 4, n) * 10, 0, 10)

    # Composite risk score with realistic interaction effects
    risk = (
        (100 - fuel) * 0.032
        + weather * 1.15
        + traffic * 0.55
        + (15 - visibility) * 0.45
        + np.clip(duty - 8, 0, None) * 0.9
        + age * 0.06
        + (100 - maint) * 0.045
        + runway * 0.7
    )
    # compounding interaction: low fuel + severe weather is worse than additive
    risk += np.where((fuel < 25) & (weather > 6), 4.5, 0)
    risk += np.where((visibility < 2) & (runway > 6), 3.0, 0)
    risk += RNG.normal(0, 1.8, n)  # noise

    pct = 1 / (1 + np.exp(-(risk - 11) / 3.2))  # squash to 0-1

    def label(p):
        if p < 0.30:
            return "LOW"
        if p < 0.55:
            return "MODERATE"
        if p < 0.78:
            return "HIGH"
        return "CRITICAL"

    labels = [label(p) for p in pct]

    df = pd.DataFrame({
        "fuel_reserve_pct": fuel,
        "weather_severity": weather,
        "traffic_density": traffic,
        "visibility_km": visibility,
        "crew_duty_hours": duty,
        "aircraft_age_years": age,
        "maintenance_score": maint,
        "runway_condition": runway,
        "risk_label": labels,
    })
    return df


def train():
    df = generate_dataset()
    X = df[FEATURES]
    y = df["risk_label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    clf = RandomForestClassifier(
        n_estimators=300,
        max_depth=10,
        min_samples_leaf=4,
        random_state=42,
        class_weight="balanced",
    )
    clf.fit(X_train, y_train)

    preds = clf.predict(X_test)
    report = classification_report(y_test, preds, output_dict=True)
    print(classification_report(y_test, preds))

    out_dir = os.path.dirname(os.path.abspath(__file__))
    joblib.dump(clf, os.path.join(out_dir, "risk_model.pkl"))
    df.to_csv(os.path.join(out_dir, "training_data_sample.csv"), index=False)

    with open(os.path.join(out_dir, "metrics.txt"), "w") as f:
        f.write(f"Accuracy: {report['accuracy']:.4f}\n")
        f.write(f"Macro F1: {report['macro avg']['f1-score']:.4f}\n")
        f.write(f"Classes: {list(clf.classes_)}\n")

    print(f"\nModel saved. Accuracy: {report['accuracy']:.3f}")
    return clf


if __name__ == "__main__":
    train()
