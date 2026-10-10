import os
import joblib
import numpy as np
import pandas as pd
import shap
from .train import FEATURES

_MODEL = None
_EXPLAINER = None

FEATURE_LABELS = {
    "fuel_reserve_pct": "Fuel Reserve",
    "weather_severity": "Weather Severity",
    "traffic_density": "Traffic Density",
    "visibility_km": "Visibility",
    "crew_duty_hours": "Crew Duty Hours",
    "aircraft_age_years": "Aircraft Age",
    "maintenance_score": "Maintenance Score",
    "runway_condition": "Runway Condition",
}

RECOMMENDATIONS = {
    "LOW": "Conditions support normal dispatch. Proceed with standard pre-flight checks.",
    "MODERATE": "Elevated risk factors present. Review contributing factors below and brief crew accordingly before dispatch.",
    "HIGH": "Significant risk factors identified. Recommend mitigation (delay, reroute, or crew swap) before dispatch, or document commander's acceptance of risk.",
    "CRITICAL": "Dispatch not recommended under current conditions. Escalate to duty manager and reassess before proceeding.",
}


def _load():
    global _MODEL, _EXPLAINER
    if _MODEL is None:
        model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "risk_model.pkl")
        _MODEL = joblib.load(model_path)
        _EXPLAINER = shap.TreeExplainer(_MODEL)
    return _MODEL, _EXPLAINER


def predict_risk(features: dict) -> dict:
    """
    features: dict with keys matching FEATURES
    returns: dict with predicted class, probabilities, and ranked SHAP contributions
    """
    model, explainer = _load()
    row = pd.DataFrame([[features[f] for f in FEATURES]], columns=FEATURES)

    pred_class = model.predict(row)[0]
    proba = model.predict_proba(row)[0]
    classes = list(model.classes_)
    probabilities = {cls: float(round(p, 4)) for cls, p in zip(classes, proba)}
    confidence = float(round(max(proba), 4))

    shap_values = explainer.shap_values(row, check_additivity=False)
    class_idx = classes.index(pred_class)

    # shap_values shape: (n_classes, n_samples, n_features) for multiclass in recent shap,
    # or (n_samples, n_features, n_classes) depending on version — normalize
    sv = np.array(shap_values)
    if sv.ndim == 3 and sv.shape[0] == len(classes):
        contribs = sv[class_idx, 0, :]
    elif sv.ndim == 3:
        contribs = sv[0, :, class_idx]
    else:
        contribs = sv[0]

    factors = []
    for i, f in enumerate(FEATURES):
        factors.append({
            "feature": f,
            "label": FEATURE_LABELS[f],
            "value": round(float(features[f]), 1),
            "contribution": round(float(contribs[i]), 4),
        })
    factors.sort(key=lambda x: abs(x["contribution"]), reverse=True)

    total_abs = sum(abs(f["contribution"]) for f in factors) or 1.0
    for f in factors:
        f["impact_pct"] = round(abs(f["contribution"]) / total_abs * 100, 1)
        f["direction"] = "increases_risk" if f["contribution"] > 0 else "decreases_risk"

    return {
        "risk_level": pred_class,
        "confidence": confidence,
        "probabilities": probabilities,
        "factors": factors,
        "recommendation": RECOMMENDATIONS[pred_class],
    }


if __name__ == "__main__":
    test = {
        "fuel_reserve_pct": 18,
        "weather_severity": 7.5,
        "traffic_density": 6,
        "visibility_km": 3,
        "crew_duty_hours": 10,
        "aircraft_age_years": 12,
        "maintenance_score": 75,
        "runway_condition": 4,
    }
    import json
    print(json.dumps(predict_risk(test), indent=2))
