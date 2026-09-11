"""Adaptive defense recommendation, min-disruption optimization & HITL approval."""
from outcome import PROFILES, compute_outcome, action_options


def decision_scores(action_id: str, potential_systems: int, timing: float = 1.0):
    prof = PROFILES[action_id]
    o = compute_outcome(action_id, potential_systems, timing)
    containment = o["containment"]
    disruption = prof["disruption"]
    residual = prof["residual"]
    business_continuity = round(100 - disruption * 60)
    recovery_risk = round((1 - residual) * 100)
    overall = round(0.4 * containment + 0.35 * business_continuity + 0.25 * recovery_risk)
    return {
        "action_id": action_id,
        "containment": containment,
        "business_continuity": business_continuity,
        "recovery_risk": recovery_risk,
        "overall": overall,
        "outcome": o,
    }


def recommend(state: dict) -> dict:
    """Choose the least-disruptive effective defense (NOT always the most aggressive)."""
    risk_score = state["risk_score"]
    risk_level = state["risk_level"]
    propagating = state.get("propagating", False)
    potential = state.get("potential_systems", 6)

    scoring = [decision_scores(a, potential, 1.0) for a in PROFILES]
    # Containment threshold adaptive to posture
    if risk_level in ("CRITICAL", "HIGH") and propagating:
        floor = 85
    elif risk_level in ("CRITICAL", "HIGH"):
        floor = 78
    else:
        floor = 60

    eligible = [s for s in scoring if s["containment"] >= floor]
    # Prefer not to escalate to full shutdown unless it is the only viable option
    non_shutdown = [s for s in eligible if s["action_id"] != "shutdown"]
    pool = non_shutdown if non_shutdown else eligible
    if not pool:
        pool = scoring

    chosen = max(pool, key=lambda s: (s["overall"], s["containment"]))
    o = chosen["outcome"]

    reasons = []
    if risk_level in ("CRITICAL", "HIGH"):
        reasons.append(f"high ransomware confidence / {risk_level} risk posture")
    if propagating:
        reasons.append("active lateral movement detected")
    if chosen["action_id"] == "isolate_revoke":
        reasons.append("compromised credentials + endpoint both require containment")
    elif chosen["action_id"] == "isolate_endpoint":
        reasons.append("endpoint isolation contains without unnecessary credential churn")
    elif chosen["action_id"] == "revoke_credentials":
        reasons.append("credential revocation is least-disruptive while blocking reuse")
    reasons.append("high containment with low residual risk")

    approval_level = approval_level_for(risk_level, propagating, chosen["action_id"])

    return {
        "candidates": [{**s, **{"label": PROFILES[s["action_id"]]["label"]}} for s in scoring],
        "recommended": chosen["action_id"],
        "recommended_label": PROFILES[chosen["action_id"]]["label"],
        "expected_outcome": o,
        "reason": "Recommended: " + PROFILES[chosen["action_id"]]["label"] + " — " + "; ".join(reasons[:2]),
        "reasons": reasons,
        "optimizer": {
            "containment": chosen["containment"],
            "business_continuity": chosen["business_continuity"],
            "recovery_risk": chosen["recovery_risk"],
            "overall": chosen["overall"],
            "explanation": "The selected response provides high containment while avoiding "
                           "unnecessary shutdown of critical infrastructure.",
        },
        "approval_level": approval_level,
    }


def approval_level_for(risk_level: str, propagating: bool, action_id: str) -> dict:
    if action_id == "shutdown" or risk_level == "CRITICAL":
        lvl, label, req = "CRITICAL", "Critical", "Mandatory security administrator approval"
    elif propagating and risk_level in ("HIGH",):
        lvl, label, req = "HIGH", "High", "Mandatory human approval"
    elif action_id == "no_action" and risk_level == "LOW":
        lvl, label, req = "LOW", "Low", "Automatic simulated response"
    else:
        lvl, label, req = "MEDIUM", "Medium", "AI recommendation + analyst approval"
    return {"level": lvl, "label": label, "requirement": req}


def adaptive_response(action_id: str, assets: dict) -> dict:
    """Attacker adaptation to a chosen defense (adversarial, defender-vs-adaptive-attacker)."""
    label = PROFILES[action_id]["label"]
    responses = {
        "no_action": {
            "response": "No defensive change observed — attacker continues unopposed.",
            "original_path": ["LAB-PC-21", "FAC-PC-07", "FILE-SRV-01", "BACKUP-SRV-01"],
            "alternative_path": ["LAB-PC-21", "FAC-PC-07", "FILE-SRV-01", "ERP-SRV-01"],
            "blocked": [],
        },
        "revoke_credentials": {
            "response": "Student credentials revoked — attacker pivots to a compromised service account.",
            "original_path": ["LAB-PC-21", "FAC-PC-07", "FILE-SRV-01"],
            "alternative_path": ["u-svc-backup", "FAC-PC-07", "FILE-SRV-01", "BACKUP-SRV-01"],
            "blocked": ["u-student-2147"],
        },
        "isolate_endpoint": {
            "response": "Endpoint isolated — attacker attempts alternate host via reused service account.",
            "original_path": ["LAB-PC-21", "FAC-PC-07"],
            "alternative_path": ["u-svc-backup", "FAC-PC-07", "FILE-SRV-01"],
            "blocked": ["LAB-PC-21"],
        },
        "block_path": {
            "response": "Network path blocked — attacker probes a parallel administrative route.",
            "original_path": ["LAB-PC-21", "FAC-PC-07", "FILE-SRV-01"],
            "alternative_path": ["ADMIN-PC-03", "ERP-SRV-01", "BACKUP-SRV-01"],
            "blocked": ["NET-SEG-CORE-LAB"],
        },
        "isolate_revoke": {
            "response": "Endpoint isolated and credentials revoked — attacker has few remaining footholds; limited adaptation.",
            "original_path": ["LAB-PC-21"],
            "alternative_path": ["u-svc-backup", "ADMIN-PC-03"],
            "blocked": ["LAB-PC-21", "u-student-2147"],
        },
        "shutdown": {
            "response": "Critical server shut down — attacker loses target but large business disruption ensues.",
            "original_path": [],
            "alternative_path": ["FILE-SRV-01"],
            "blocked": ["FILE-SRV-01", "ERP-SRV-01"],
        },
    }
    r = responses.get(action_id, responses["no_action"])
    return {"defense": label, **r}
