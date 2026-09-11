"""Counterfactual replay, missed-impact attribution, defense regret, robustness.

State-transition simulation of "what if we had acted earlier". Everything is a
safe simulated/estimated number for demo purposes.
"""
from scenarios import SCENARIOS
from assets import build_assets
from outcome import PROFILES, compute_outcome, timing_factor, action_options
from graph import REACH


def resolve_scenario(scenario_id: str):
    """Static S1/S2 scenarios, or the current live run if its id is requested."""
    if scenario_id in SCENARIOS:
        return SCENARIOS[scenario_id]
    try:
        import live as livemod
        run = getattr(livemod, "RUN", None)
        if run and run.get("events") and scenario_id in (
            run.get("scenario_id"), "live", "current", "S-LAT", "S-PHISH", "S-FAC", "S-INSIDER",
        ):
            return livemod.as_scenario(run)
    except Exception:
        pass
    return SCENARIOS.get(scenario_id) or SCENARIOS["S2"]

TIMELINE_SECONDS = {"10:01:00": 0, "10:02:00": 60, "10:03:00": 120, "10:04:00": 180,
                    "10:05:00": 240, "10:06:00": 300, "10:07:00": 360}


def _asset_path(scenario) -> list:
    """Distinct asset ids progressively reached along scenario event sequence."""
    out = []
    for ev in scenario.events:
        if ev.asset in REACH and ev.asset not in out:
            out.append(ev.asset)
    return out


def _seconds(scenario, idx: int) -> int:
    """Simulated wall-clock seconds elapsed since the first signal (10:01:00)."""
    if idx >= len(scenario.events):
        return int(_seconds(scenario, len(scenario.events) - 1) + 20)
    if idx < 0 or not scenario.events:
        return 0
    h, m, s = (int(x) for x in scenario.events[idx].timestamp.split(":"))
    total = h * 3600 + m * 60 + s - (10 * 3600 + 1 * 60)  # base 10:01:00
    return max(0, total)


def _touched_before(scenario, idx: int) -> int:
    """Number of distinct systems compromised by events up to (and including) idx."""
    seen = []
    for ev in scenario.events[:idx + 1]:
        if ev.asset in REACH and ev.asset not in seen:
            seen.append(ev.asset)
    return len(seen)


def reachable_full(scenario) -> int:
    """Operational host targets reachable if no action (no_action exposure).

    Directory/network infrastructure (AD, NET-SEG) is excluded because it is used
    to move, not encrypted. Represents the realistic blast if propagation is unchecked.
    """
    start = scenario.events[0].asset if scenario.events else "LAB-PC-21"
    seen = {start}
    stack = [start]
    while stack:
        c = stack.pop()
        for n in REACH.get(c, []):
            if n not in seen:
                seen.add(n)
                stack.append(n)
    hosts = [a for a in seen if a not in ("NET-SEG-CORE", "AD-SRV-01")]
    return max(1, len(hosts))


def replay_scenario(scenario_id: str, action_id: str, intervention_idx: int) -> dict:
    scenario = resolve_scenario(scenario_id)
    path = _asset_path(scenario)
    potential = reachable_full(scenario)
    # how many systems are already touched at intervention point
    touched_before = _touched_before(scenario, intervention_idx)
    seconds = _seconds(scenario, intervention_idx)
    timing = timing_factor(seconds)
    if action_id == "no_action":
        # no_action still lets full propagation happen from wherever attacker is
        o = compute_outcome("no_action", potential, 0.0)
    else:
        o = compute_outcome(action_id, potential, timing)
        o["affected"] = max(touched_before, o["affected"])
    prof = PROFILES[action_id]
    return {
        "scenario_id": scenario_id,
        "action_id": action_id,
        "action_label": prof["label"],
        "intervention_event": intervention_idx,
        "intervention_seconds": seconds,
        "timing": round(timing, 2),
        "outcome": o,
        "touched_before": touched_before,
        "potential": potential,
    }


def run_counterfactual(scenario_id: str, intervention_idx: int) -> dict:
    """All actions across a decision point + a sweep over earlier intervention points."""
    scenario = resolve_scenario(scenario_id)
    if not scenario.events:
        return {"scenario_id": scenario_id, "decision_point": 0, "decision_timestamp": "—",
                "results": {}, "sweep": []}
    intervention_idx = max(0, min(int(intervention_idx or 0), len(scenario.events) - 1))
    results = {}
    for action_id in PROFILES:
        r = replay_scenario(scenario_id, action_id, intervention_idx)
        results[action_id] = r["outcome"]
    # sweep of intervention points for the headline action to show timing sensitivity
    sweep_points = range(max(0, intervention_idx - 3), intervention_idx + 1)
    sweep = []
    for p in sweep_points:
        o = replay_scenario(scenario_id, "isolate_revoke", p)["outcome"]
        sweep.append({"intervention_event": p, "seconds": _seconds(scenario, p),
                      "affected": o["affected"], "exposure_pct": o["exposure_pct"]})
    return {"scenario_id": scenario_id,
            "decision_point": intervention_idx,
            "decision_timestamp": scenario.events[intervention_idx].timestamp,
            "results": results, "sweep": sweep}


def missed_impact(actual_action: str, scenario_id: str, intervention_idx: int) -> dict:
    sc = resolve_scenario(scenario_id)
    last = max(0, len(sc.events) - 1)
    actual = replay_scenario(scenario_id, actual_action, last)["outcome"]
    # best feasible counterfactual = isolate_revoke at earliest safe window
    best = replay_scenario(scenario_id, "isolate_revoke", 0)["outcome"]
    avoidable_affected = actual["affected"] - best["affected"]
    avoidable_exposure = round(actual["exposure_pct"] - best["exposure_pct"], 1)
    avoidable_downtime = round(actual["downtime_h"] - best["downtime_h"], 1)
    regret = round((actual["exposure_pct"] - best["exposure_pct"]) / max(actual["exposure_pct"], 1) * 100, 1)
    avoidable_impact = "HIGH" if avoidable_affected >= 3 else ("MODERATE" if avoidable_affected >= 1 else "LOW")
    return {
        "actual": actual, "best_counterfactual": best,
        "avoidable_systems": max(0, avoidable_affected),
        "avoidable_exposure": max(0, avoidable_exposure),
        "avoidable_downtime_h": max(0, avoidable_downtime),
        "avoidable_impact": avoidable_impact,
        "defense_regret": max(0.0, min(100.0, regret)),
        "note": "SIMULATED ESTIMATE — counterfactual figures are illustrative, not audited.",
    }


def robustness_test(defense_action: str, scenario_id: str, probs=(0.3, 0.5, 0.7, 0.9)) -> dict:
    """Run a defense across attacker-adaptation assumptions; label robustness."""
    outcomes = []
    stable = True
    for p in probs:
        o = compute_outcome(defense_action, 8, timing=0.9, adaptation_penalty=p)
        outcomes.append({"adaptation_prob": p, "affected": o["affected"],
                         "exposure_pct": o["exposure_pct"], "impact": o["impact"]})
    impacts = {x["impact"] for x in outcomes}
    affected_vals = {x["affected"] for x in outcomes}
    if len(impacts) == 1 and len(affected_vals) == 1:
        label, verdict = "ROBUST", "ROBUST"
    elif len(impacts) <= 2:
        label, verdict = "MODERATELY ROBUST", "MODERATELY ROBUST"
    else:
        label, verdict = "UNCERTAIN", "UNCERTAIN — HUMAN REVIEW REQUIRED"
    return {"defense": defense_action, "defense_label": PROFILES[defense_action]["label"],
            "runs": outcomes, "label": label, "verdict": verdict}
