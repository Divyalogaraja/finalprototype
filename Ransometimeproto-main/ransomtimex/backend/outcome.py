"""
Central simulated-outcome model.

Every "affected systems", "exposure", "downtime" and "impact" figure produced
anywhere in the product flows through this module so that all views stay
mutually consistent. Everything here is SIMULATED / ESTIMATED for a safe demo —
never presented as audited operational figures.
"""

# action_id -> profile
PROFILES = {
    "no_action":       {"contain": 5,   "downtime_min": 1080, "disruption": 0.95,
                        "residual": 0.90, "confidence": 0.60, "base_exposure": 1.00,
                        "label": "No Action"},
    "revoke_credentials": {"contain": 81, "downtime_min": 10, "disruption": 0.05,
                        "residual": 0.45, "confidence": 0.88, "base_exposure": 0.16,
                        "label": "Revoke Credentials"},
    "isolate_endpoint":   {"contain": 87, "downtime_min": 60, "disruption": 0.22,
                        "residual": 0.28, "confidence": 0.91, "base_exposure": 0.26,
                        "label": "Isolate Endpoint"},
    "block_path":         {"contain": 78, "downtime_min": 30, "disruption": 0.20,
                        "residual": 0.38, "confidence": 0.82, "base_exposure": 0.34,
                        "label": "Block Network Path"},
    "isolate_revoke":     {"contain": 96, "downtime_min": 60, "disruption": 0.30,
                        "residual": 0.08, "confidence": 0.94, "base_exposure": 0.06,
                        "label": "Isolate + Revoke"},
    "shutdown":           {"contain": 98, "downtime_min": 720, "disruption": 0.95,
                        "residual": 0.05, "confidence": 0.90, "base_exposure": 0.00,
                        "label": "Emergency Server Shutdown"},
}

# action order & ids
ACTIONS = ["no_action", "revoke_credentials", "isolate_endpoint",
           "block_path", "isolate_revoke", "shutdown"]


def action_options():
    return [PROFILES[a] | {"id": a} for a in ACTIONS]


def timing_factor(intervention_seconds_after_detection: float, window_safe=180.0):
    """0..1 ; higher = earlier/better. Best window ≈ <=3min after first signal."""
    if intervention_seconds_after_detection <= 0:
        return 1.0
    f = max(0.0, 1.0 - (intervention_seconds_after_detection - 30.0) / 400.0)
    return min(1.0, max(0.0, f))


def exposure_effective(action_id: str, timing: float, adaptation_penalty: float = 0.0):
    prof = PROFILES[action_id]
    if action_id == "no_action":
        return 1.0, prof
    base = prof["base_exposure"]
    # later action → more exposure; attacker adaptation slightly erodes the defense
    late_penalty = 1.0 + (1.0 - timing) * 1.4
    adapted = base * late_penalty * (1.0 + adaptation_penalty)
    return min(1.0, adapted), prof


def compute_outcome(action_id: str, potential_systems: int, timing: float = 1.0,
                    adaptation_penalty: float = 0.0) -> dict:
    """Return a full simulated outcome for an action taken at given timing."""
    prof = PROFILES[action_id]
    exp_eff, _ = exposure_effective(action_id, timing, adaptation_penalty)
    no_action_affected = potential_systems if potential_systems > 0 else 1
    affected = max(0, int(round(no_action_affected * exp_eff)))
    if action_id == "no_action":
        affected = no_action_affected
    exposure_pct = round(exp_eff * 100, 1) if action_id != "no_action" else 100.0
    downtime_min = prof["downtime_min"]
    if action_id not in ("no_action",):
        downtime_min = int(prof["downtime_min"] + (1.0 - timing) * 20)
    downtime_h = round(downtime_min / 60.0, 1)
    if action_id == "no_action":
        impact = "HIGH"
    else:
        impact = "LOW" if exp_eff <= 0.20 else ("MODERATE" if exp_eff <= 0.45 else "HIGH")
    return {
        "action_id": action_id,
        "label": prof["label"],
        "affected": affected,
        "exposure_pct": exposure_pct,
        "downtime_min": downtime_min,
        "downtime_h": downtime_h,
        "impact": impact,
        "containment": prof["contain"],
        "residual_risk": round(prof["residual"] * 100),
        "confidence": prof["confidence"],
        "timing": round(timing, 2),
    }
