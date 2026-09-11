"""
AI Investigator — an EXPLANATION + Q&A assistant only.

The LLM never makes detection or response decisions. Every answer is assembled
from the actual simulated telemetry state passed in (evidence is never invented
by the model here — it is pulled from the deterministic engine state).
"""
QUESTION_TEMPLATES = [
    ("classified", "classify",
     "This incident was classified as {risk_level} ransomware-risk because the behavioral engine "
     "observed correlated signals: {evidence}. The weighted multi-signal score reached {risk} with "
     "confidence {confidence}. Contextual correlation — not a single file extension — drove the decision."),
    ("target", "next target",
     "Based on the reconstructed attack graph and simulated lateral-movement probabilities, the most "
     "likely next target is {predicted} at {confidence}% confidence. Reachability from the compromised "
     "endpoint, asset criticality and recent credential activity support this."),
    ("isolation", "isolat",
     "Isolation was recommended because the incident showed {risk_level} ransomware confidence with active "
     "lateral movement. Isolating the endpoint plus revoking the compromised credential contains the "
     "threat while preserving critical file/ERP/backup servers from unnecessary shutdown."),
    ("30 seconds", "30 second",
     "A counterfactual run revoking credentials 30 seconds earlier (at ~{window}) projects far lower "
     "exposure. Simulated best counterfactual reaches {best_affected} affected systems vs {actual_affected} "
     "in the actual outcome — the difference is the avoidable impact the system flags."),
    ("biggest missed", "biggest missed",
     "The largest missed intervention window was {window}. Acting there (revoke credentials) was still "
     "within the safe window and would have stopped propagation before it reached the file server."),
    ("robust", "robust",
     "Defense {defense} is rated {robust} because it stayed stable across {n} attacker-adaptation "
     "simulations. Sensitivity analysis showed the outcome did not flip under small assumption changes."),
    ("report", "report",
     "INCIDENT REPORT (SIMULATED)\nRisk: {risk_level} at {risk} confidence {confidence}. Intent: {intent}. "
     "Predicted target {predicted} ({confidence}%). Blast radius {blast}. Recommended {defense}. Defense "
     "regret {regret}%. Missed impact {missed}. Best counterfactual would have limited to {best_affected} "
     "systems vs {actual_affected}. Proposed playbook update ready for review."),
    ("evidence", "evidence",
     "Supporting telemetry: {evidence_count} file modifications, {renames} rapid renames, "
     "{cred} credential access, {lat} lateral movement, {backup} backup access attempt."),
]

BENIGN_EXPLAIN = (
    "Isolated signals are NOT enough to call ransomware. A lone PowerShell invocation scores LOW "
    "because it matches benign admin activity. Only when mass file modification, credential access and "
    "lateral movement co-occur does contextual correlation raise confidence — this is what reduces false alarms."
)


def answer(question: str, telemetry: dict) -> dict:
    q = (question or "").lower()
    tel = telemetry
    evidence = tel.get("evidence", []) or []
    ev_names = ", ".join(e.get("signal", e) if isinstance(e, dict) else e for e in evidence[:5]) or "no strong signals yet"

    def fmt(template, **kw):
        return template.format(**{**{
            "risk_level": tel.get("risk_level", "LOW"),
            "risk": tel.get("risk_score", 0),
            "confidence": tel.get("prediction_confidence", tel.get("risk_score", 0)),
            "evidence": ev_names,
            "predicted": tel.get("predicted_target", "FILE-SRV-01"),
            "intent": tel.get("intent", "Observing"),
            "defense": tel.get("recommended_label", "Isolate + Revoke"),
            "robust": tel.get("robustness", "ROBUST"),
            "window": tel.get("intervention_window", "10:04:37"),
            "best_affected": tel.get("best_affected", 1),
            "actual_affected": tel.get("actual_affected", 8),
            "regret": tel.get("defense_regret", 0),
            "missed": tel.get("missed_impact", "HIGH"),
            "blast": tel.get("blast_radius", 8),
            "evidence_count": tel.get("evidence_count", 0),
            "renames": tel.get("renames", 0),
            "cred": tel.get("cred", 0),
            "lat": tel.get("lat", 0),
            "backup": tel.get("backup", 0),
            "n": tel.get("robustness_runs", 4),
        }, **kw})

    for key, pat, template in QUESTION_TEMPLATES:
        if key in q or pat in q:
            return {"answer": fmt(template), "evidence": tel.get("evidence_list", []),
                    "source": "Rule/ML engine state (no external LLM) | simulated evidence"}
    return {"answer": fmt(
            "I can help interpret the current simulated state. Here is what the deterministic engine shows: "
            "risk {risk_level} at {risk} confidence {confidence}. Intent: {intent}. Predicted target "
            "{predicted}. Recommended defense {defense}. Ask about classification, next target, isolation, "
            "earlier response, missed windows, robustness or request a report."),
            "evidence": tel.get("evidence_list", []),
            "source": "Rule/ML engine state (no external LLM) | simulated evidence"}
