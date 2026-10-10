"""
Answers questions about a specific flight's risk analysis, grounded in the
actual stored SHAP factors/probabilities for that analysis — never invented.

Two modes:
1. Rules engine (always available, zero setup): pattern-matches the question
   against the real factor data and composes an answer from it. Deterministic,
   no hallucination risk, works offline.
2. Claude API (optional): if the ANTHROPIC_API_KEY environment variable is
   set, open-ended questions are answered by a real Claude call whose system
   prompt is grounded with the flight's actual analysis JSON — so answers stay
   tied to real data even though the phrasing is generative. Falls back to the
   rules engine automatically on any error (missing key, network issue, etc).
"""
import os
import json

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")


def _format_factors(factors: list[dict]) -> str:
    lines = []
    for f in factors:
        direction = "increases" if f["direction"] == "increases_risk" else "decreases"
        lines.append(f"- {f['label']}: value {f['value']}, {direction} risk, {f['impact_pct']}% of total influence")
    return "\n".join(lines)


def _rules_engine(question: str, analysis: dict) -> str:
    q = question.lower().strip()
    factors = analysis["factors"]
    top = factors[0]
    risk = analysis["risk_level"]
    conf = analysis["confidence"]

    # confidence / certainty
    if any(w in q for w in ["confiden", "certain", "sure", "how sure"]):
        return (
            f"The model is {conf*100:.1f}% confident in the {risk} classification. "
            f"Full probability spread — " +
            ", ".join(f"{k}: {v*100:.1f}%" for k, v in analysis["probabilities"].items()) + "."
        )

    # "why" / top driver
    if any(w in q for w in ["why", "top", "biggest", "main", "driver", "cause"]):
        return (
            f"{top['label']} is the single biggest driver of this {risk} rating — it accounts for "
            f"{top['impact_pct']}% of the model's decision, with a value of {top['value']}. "
            f"The next largest factor is {factors[1]['label']} at {factors[1]['impact_pct']}%."
        )

    # what would reduce risk / improve / safest fix
    if any(w in q for w in ["reduce", "improve", "lower", "fix", "safer", "mitigat", "help most"]):
        increasing = [f for f in factors if f["direction"] == "increases_risk"]
        if not increasing:
            return "No factor is currently pushing risk upward — this flight's profile is already favorable."
        best = increasing[0]
        return (
            f"Addressing {best['label']} would help most — it's contributing {best['impact_pct']}% toward "
            f"this risk rating. Its current value is {best['value']}; improving it would reduce that "
            f"contribution more than any other single factor."
        )

    # recommendation
    if any(w in q for w in ["recommend", "should i", "dispatch", "proceed", "go ahead"]):
        return analysis["recommendation"]

    # ask about a specific named factor
    for f in factors:
        key_terms = f["label"].lower().split() + [f["feature"].replace("_", " ")]
        if any(term in q for term in key_terms if len(term) > 3):
            direction = "increasing" if f["direction"] == "increases_risk" else "decreasing"
            return (
                f"{f['label']} is currently {f['value']}, {direction} risk by {f['impact_pct']}% of the "
                f"total model decision — ranked #{factors.index(f)+1} of {len(factors)} factors."
            )

    # list all factors
    if any(w in q for w in ["all factor", "everything", "list", "breakdown", "full"]):
        return f"Full ranked breakdown for this {risk} assessment:\n{_format_factors(factors)}"

    # fallback — always grounded, never a generic non-answer
    return (
        f"This flight is rated {risk} ({conf*100:.1f}% confidence). The top factor is {top['label']} "
        f"({top['impact_pct']}%). Ask me about a specific factor (e.g. \"how does fuel affect this?\"), "
        f"the recommendation, or what would reduce the risk most."
    )


def _claude_engine(question: str, analysis: dict) -> str | None:
    if not ANTHROPIC_API_KEY:
        return None
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        system_prompt = (
            "You are a flight-risk analysis assistant embedded in an aviation dispatch tool. "
            "Answer the user's question ONLY using the risk analysis data provided below — never "
            "invent numbers or factors that aren't in this data. Be concise (2-4 sentences), factual, "
            "and operational in tone, as if briefing a pilot or dispatcher.\n\n"
            f"Risk analysis data:\n{json.dumps(analysis, indent=2)}"
        )
        resp = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=300,
            system=system_prompt,
            messages=[{"role": "user", "content": question}],
        )
        return "".join(block.text for block in resp.content if hasattr(block, "text")).strip() or None
    except Exception:
        return None


def answer_question(question: str, analysis: dict) -> tuple[str, str]:
    """Returns (answer_text, source) where source is 'claude' or 'rules_engine'."""
    claude_answer = _claude_engine(question, analysis)
    if claude_answer:
        return claude_answer, "claude"
    return _rules_engine(question, analysis), "rules_engine"
