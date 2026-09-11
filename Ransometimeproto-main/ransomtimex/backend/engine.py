"""Deterministic simulation engine building a full state progression."""
from assets import build_assets, USERS, CRITICALITY_RANK
from scenarios import SCENARIOS
from detection import RiskEngine, train_isolation_forest
from intent import infer_intent
from graph import build_graph, predict_next, blast_radius, REACH
from mitre import MITRE

SENSITIVE = {"phishing_delivery","suspicious_process","command_scripting","mass_file_modification",
             "rapid_file_rename","credential_access","privilege_escalation","suspicious_network",
             "lateral_movement","file_server_access","backup_access_attempt"}

iso = train_isolation_forest(seed=11)


def fresh_assets():
    return build_assets()


def asset_sequence(scenario):
    out = []
    for ev in scenario.events:
        if ev.asset in REACH and ev.asset not in out:
            out.append(ev.asset)
    return out


def compute_step(scenario, upto_index):
    """Recompute the authoritative state after processing scenario events[0..upto_index]."""
    assets = fresh_assets()
    risk = RiskEngine(iso)
    events = scenario.events[:upto_index + 1]
    present = {}
    compromised = []
    attacker_position = None
    for ev in events:
        if ev.event_type in SENSITIVE:
            present[ev.event_type] = True
            risk.observe(ev.event_type, ev.severity)
        # compromise the asset carried by the event (if it is a real asset)
        if ev.asset in REACH and ev.asset not in compromised:
            compromised.append(ev.asset)
            attacker_position = ev.asset
    risk_score = risk.combined(present)
    risk_level = risk.level(risk_score)
    intent = infer_intent(present)

    # asset states/risk propagation
    for aid in compromised:
        assets[aid].state = "COMPROMISED"
        assets[aid].compromise_probability = min(0.99, 0.6 + len(compromised) * 0.07)
        assets[aid].risk = risk_score
    if attacker_position:
        # mark files just-ahead as targeted
        for d in REACH.get(attacker_position, []):
            if d in assets and d not in compromised:
                assets[d].risk = max(assets[d].risk, risk_score * 0.8)

    pred = predict_next(assets, compromised, present)
    graph = build_graph(assets, compromised,
                        predicted=pred["predicted"] if pred else None,
                        attacker_position=attacker_position,
                        signals=present)
    blast = blast_radius(assets, compromised, graph["exposed"])
    return {
        "event_index": upto_index,
        "event": events[-1].__dict__ if events else None,
        "events_so_far": [e.__dict__ for e in events],
        "assets": {k: v.to_dict() for k, v in assets.items()},
        "risk_score": risk_score,
        "risk_level": risk_level,
        "signal_counts": risk.signal_counts,
        "present": present,
        "intent": intent,
        "compromised": compromised,
        "attacker_position": attacker_position,
        "prediction": pred,
        "graph": graph,
        "blast_radius": blast,
        "active": True,
        "completed": False,
        "contained": False,
        "mitre": {e.event_type: MITRE.get(e.event_type) for e in events},
    }


def final_impact_estimate(scenario, approved_action=None):
    """No-action outcome totals used for attribution once propagation is complete."""
    path = asset_sequence(scenario)
    from outcome import compute_outcome
    total = len(path)
    no = compute_outcome("no_action", total, 0.0)
    return {"total_reachable": total, "no_action_affected": no["affected"],
            "path": path}
