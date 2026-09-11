"""Evaluation dashboard: rule-based baseline vs RansomTime-X (SIMULATED metrics)."""
METRICS = [
    {"metric": "Precision", "baseline": 71.0, "rtx": 93.0, "unit": "%", "higher": True},
    {"metric": "Recall", "baseline": 82.0, "rtx": 96.0, "unit": "%", "higher": True},
    {"metric": "F1 Score", "baseline": 0.76, "rtx": 0.94, "unit": "", "higher": True},
    {"metric": "False Positive Rate", "baseline": 24.0, "rtx": 6.0, "unit": "%", "higher": False},
    {"metric": "Detection Latency", "baseline": 95.0, "rtx": 14.0, "unit": "s", "higher": False},
    {"metric": "Prediction Accuracy", "baseline": 0.0, "rtx": 0.91, "unit": "", "higher": True},
    {"metric": "Top-3 Target Accuracy", "baseline": 0.0, "rtx": 0.87, "unit": "", "higher": True},
    {"metric": "Prediction Lead Time", "baseline": 0.0, "rtx": 42.0, "unit": "s", "higher": True},
    {"metric": "Containment Rate", "baseline": 0.0, "rtx": 96.0, "unit": "%", "higher": True},
    {"metric": "Time to Containment", "baseline": 0.0, "rtx": 60.0, "unit": "min", "higher": False},
    {"metric": "Systems Affected", "baseline": 8.0, "rtx": 2.0, "unit": "", "higher": False},
    {"metric": "Intervention Accuracy", "baseline": 0.0, "rtx": 0.89, "unit": "", "higher": True},
    {"metric": "Counterfactual Consistency", "baseline": 0.0, "rtx": 0.94, "unit": "", "higher": True},
    {"metric": "Estimated Downtime", "baseline": 18.0, "rtx": 1.0, "unit": "h", "higher": False},
    {"metric": "Estimated Exposure", "baseline": 100.0, "rtx": 12.0, "unit": "%", "higher": False},
    {"metric": "Simulated Recovery Cost", "baseline": 100.0, "rtx": 22.0, "unit": "idx", "higher": False},
    {"metric": "Playbook Improvement", "baseline": 0.0, "rtx": 1.0, "unit": "ver", "higher": True},
]

NOTE = "SIMULATED / EXPERIMENTAL RESULTS on synthetic demo data. Not a claim about real-world performance."

# Mutable copy used by /api/evaluation/run so the dashboard reflects completed incidents.
CURRENT = {"metrics": [dict(m) for m in METRICS], "note": NOTE, "runs": 0}


def evaluation_snapshot():
    return {"metrics": CURRENT["metrics"], "note": CURRENT["note"], "runs": CURRENT["runs"]}


def reset_evaluation():
    CURRENT["metrics"] = [dict(m) for m in METRICS]
    CURRENT["note"] = NOTE
    CURRENT["runs"] = 0
    return evaluation_snapshot()


def run_evaluation(incidents=None):
    """Recompute a few dashboard metrics from logged simulated incidents. Still synthetic."""
    incidents = incidents or []
    n = len(incidents)
    contained = 0
    affected = []
    for inc in incidents:
        o = inc.get("actual_outcome") or inc.get("outcome") or {}
        if isinstance(o, str):
            o = {}
        if (inc.get("approval_status") or "").upper() in ("CONTAINED", "RESOLVED") and (
            inc.get("approved_action") not in (None, "no_action")
        ):
            contained += 1
        aff = o.get("affected") if isinstance(o, dict) else None
        if aff is not None:
            affected.append(aff)
    metrics = [dict(m) for m in METRICS]
    if n:
        contain_rate = round(100.0 * contained / max(1, n), 1)
        avg_aff = round(sum(affected) / max(1, len(affected)), 2) if affected else 2.0
        for m in metrics:
            if m["metric"] == "Containment Rate":
                m["rtx"] = contain_rate
            elif m["metric"] == "Systems Affected":
                m["rtx"] = avg_aff
            elif m["metric"] == "Playbook Improvement":
                m["rtx"] = 1.0 if any(inc.get("playbook_update") for inc in incidents) else 0.0
    CURRENT["metrics"] = metrics
    CURRENT["runs"] = CURRENT.get("runs", 0) + 1
    CURRENT["note"] = NOTE + f" Last run used {n} simulated incident(s)."
    return evaluation_snapshot()
