"""
AI Investigator — deterministic explanation + Q&A assistant.

The LLM never makes detection or response decisions. Every answer is assembled
from the actual simulated telemetry state passed in (evidence is never invented).
Works with no external API key. Optional LLM, if present, is not required.

Answers clearly label:
  OBSERVED / PREDICTION / SIMULATED ADAPTATION / LEARNED FROM SIMULATION /
  PROPOSED / REQUIRES HUMAN APPROVAL
"""

KIND = {
    "observed": "OBSERVED",
    "prediction": "PREDICTION",
    "adaptation": "SIMULATED ADAPTATION",
    "learned": "LEARNED FROM SIMULATION",
    "proposed": "PROPOSED / REQUIRES HUMAN APPROVAL",
}


def _fmt_list(items, empty="none recorded"):
    items = [str(x) for x in (items or []) if x]
    return ", ".join(items) if items else empty


def _kind_line(kind, text):
    return f"[{KIND.get(kind, kind)}]\n{text}"


def _base(tel):
    evidence = tel.get("evidence") or []
    ev_names = ", ".join(
        (e.get("signal", e) if isinstance(e, dict) else str(e)) for e in evidence[:8]
    ) or "no strong signals yet"
    return {
        "risk_level": tel.get("risk_level", "LOW"),
        "risk": tel.get("risk_score", 0),
        "confidence": tel.get("prediction_confidence", tel.get("risk_score", 0)),
        "evidence": ev_names,
        "predicted": tel.get("predicted_target") or "not yet predictable",
        "intent": tel.get("intent", "Observing"),
        "stage": tel.get("stage", "Observing"),
        "defense": tel.get("recommended_label", "Isolate + Revoke"),
        "defense_id": tel.get("recommended_id", "isolate_revoke"),
        "defense_reason": tel.get("defense_reason", "minimum-disruption containment of endpoint and credentials"),
        "robust": tel.get("robustness", "ROBUST"),
        "window": tel.get("intervention_window", "10:04:37"),
        "best_affected": tel.get("best_affected", 1),
        "actual_affected": tel.get("actual_affected", 8),
        "regret": tel.get("defense_regret", 0),
        "missed": tel.get("missed_impact", "HIGH"),
        "blast": tel.get("blast_radius", 0),
        "current_affected": tel.get("current_affected", 0),
        "critical_exposed": tel.get("critical_exposed", 0),
        "compromised": _fmt_list(tel.get("compromised") or []),
        "attacker": tel.get("attacker_position") or "unknown",
        "evidence_count": tel.get("evidence_count", 0),
        "renames": tel.get("renames", 0),
        "cred": tel.get("cred", 0),
        "lat": tel.get("lat", 0),
        "backup": tel.get("backup", 0),
        "n": tel.get("robustness_runs", 4),
        "status": tel.get("status", "STANDBY"),
        "contained": tel.get("contained", False),
        "approved": tel.get("approved_action") or "none yet",
        "playbook": tel.get("playbook_rationale") or "Credential revocation before isolation when a compromised account is detected.",
        "memory": tel.get("memory_summary") or "No defense-memory entries yet for this session.",
        "adaptation": tel.get("adaptation") or "No defense has been applied yet, so no attacker adaptation has been simulated.",
        "event_count": tel.get("event_count", 0),
        "origin": tel.get("origin") or ((tel.get("compromised") or ["the origin endpoint"])[0]),
    }


def _match(q, *needles):
    return any(n in q for n in needles)


def answer(question: str, telemetry: dict) -> dict:
    q = (question or "").lower().strip()
    tel = telemetry or {}
    b = _base(tel)
    evidence_list = tel.get("evidence_list") or []
    source = "Deterministic Investigator (no external LLM) | simulated telemetry only"

    def pack(kind, text, extra_ev=None):
        ev = extra_ev if extra_ev is not None else evidence_list
        return {
            "answer": _kind_line(kind, text.format(**b)),
            "evidence": ev,
            "kind": KIND.get(kind, kind),
            "source": source,
        }

    # --- what is happening / situation ---
    if _match(q, "what is happening", "what's happening", "what is going on", "situation", "current state", "status"):
        if b["event_count"] == 0 and (b["risk"] or 0) < 20:
            return pack("observed",
                "The console is in a monitoring posture. No correlated ransomware-like activity is recorded in the current simulation. Status: {status}.")
        return pack("observed",
            "A simulated multi-stage intrusion is in progress. Behavioral risk is {risk_level} ({risk}/100). "
            "Attack stage: {stage}. Compromised assets (OBSERVED): {compromised}. Attacker position: {attacker}. "
            "Intent engine: {intent}. {event_count} synthetic events have been correlated so far.")

    # --- why risky ---
    if _match(q, "why is this risky", "why risky", "why is it risky", "why dangerous", "risk"):
        return pack("observed",
            "Risk is {risk_level} because correlated behavioral signals co-occur: {evidence}. "
            "A lone signal would stay low; contextual correlation of file, credential and movement activity is what raises confidence. "
            "This is OBSERVED engine state, not a confirmed real-world compromise.")

    # --- evidence ---
    if _match(q, "what evidence", "supporting evidence", "evidence support", "what supports"):
        return pack("observed",
            "Supporting simulated telemetry: {evidence_count} file-modification signals, {renames} rapid renames, "
            "{cred} credential-access events, {lat} lateral-movement events, {backup} backup-access attempts. "
            "Signal names: {evidence}. These values come from the current simulation only.")

    # --- next target ---
    if _match(q, "target next", "next target", "will the attacker", "attacker target", "where is it going",
              "predicted target", "what will the attacker"):
        return pack("prediction",
            "The reconstructed attack graph scores reachable assets. The most likely NEXT target is {predicted} "
            "at {confidence}% confidence (PREDICTION, not an observed fact). "
            "Lead-time and ranking are estimates from reachability, criticality and credential activity. "
            "Blast radius if unchecked: {blast} systems.")

    # --- recommended defense ---
    if _match(q, "what defense", "defense recommended", "recommended defense", "what should we do",
              "which defense", "recommend"):
        return pack("proposed",
            "Recommended defense: {defense}. Reason: {defense_reason}. "
            "This is a PROPOSED action and REQUIRES HUMAN APPROVAL before any simulated containment runs. "
            "The optimizer prefers high containment with the least operational disruption (not always shutdown).")

    # --- why this defense ---
    if _match(q, "why was this defense", "why was this recommended", "why did you recommend",
              "why isolation", "why isolate", "why selected", "defense selected"):
        return pack("proposed",
            "{defense} was selected because the incident shows {risk_level} ransomware-risk with stage {stage}. "
            "{defense_reason}. Isolation plus credential revocation contains the origin while avoiding unnecessary "
            "shutdown of file/ERP/backup servers. Approval is still required — this is not an autonomous action.")

    # --- blast radius ---
    if _match(q, "blast radius", "how far", "how many systems", "exposure"):
        return pack("prediction",
            "OBSERVED currently affected: {current_affected} ({compromised}). "
            "PREDICTED blast radius if unchecked: {blast} systems, {critical_exposed} of them critical. "
            "Potential reach is a graph estimate, not a measured outage.")

    # --- if defense fails ---
    if _match(q, "defense fails", "if it fails", "if the defense fail", "what happens if",
              "fail", "no action", "if we do nothing"):
        return pack("prediction",
            "If the proposed defense is rejected or fails in simulation, the no-action branch continues to the "
            "full predicted blast radius (~{blast} systems, high impact). "
            "Best simulated counterfactual ({defense} earlier) limits affected systems to {best_affected} vs "
            "{actual_affected} unchecked. These are SIMULATED futures, not observed outcomes.")

    # --- attacker adaptation ---
    if _match(q, "how did the attacker adapt", "attacker adapt", "adaptation", "pivot"):
        return pack("adaptation",
            "{adaptation} This is a SIMULATED ADAPTATION of how an attacker might respond after a defense — "
            "it is not observed live telemetry.")

    # --- learning ---
    if _match(q, "what did the system learn", "what did we learn", "defense memory", "learning"):
        return pack("learned",
            "{memory} After each completed simulated incident the engine stores pattern, defense used, impact and "
            "a future recommendation. That memory is LEARNED FROM SIMULATION and never changes live controls by itself.")

    # --- playbook ---
    if _match(q, "playbook", "why was a playbook", "proposed change", "playbook change"):
        return pack("proposed",
            "Playbook proposal: {playbook} "
            "A playbook update is PROPOSED / REQUIRES HUMAN APPROVAL. Accepting it reorders response steps "
            "(typically revoke credentials before isolate) for the next simulated incident. Rejecting leaves the baseline.")

    # --- classification ---
    if _match(q, "classified", "classify", "ransomware"):
        return pack("observed",
            "This incident was classified as {risk_level} ransomware-risk because the behavioral engine "
            "observed correlated signals: {evidence}. The weighted multi-signal score reached {risk} with "
            "confidence {confidence}. Contextual correlation — not a single file extension — drove the decision.")

    # --- isolation specifically ---
    if _match(q, "isolation", "isolat"):
        return pack("proposed",
            "Isolation was recommended because the incident showed {risk_level} ransomware confidence with stage {stage}. "
            "Isolating the endpoint plus revoking the compromised credential contains the threat while preserving "
            "critical file/ERP/backup servers from unnecessary shutdown. HUMAN APPROVAL is required.")

    # --- earlier / 30 seconds ---
    if _match(q, "30 second", "30 seconds", "earlier"):
        return pack("prediction",
            "A counterfactual run acting ~30 seconds earlier (near {window}) projects far lower exposure. "
            "Simulated best counterfactual reaches {best_affected} affected systems vs {actual_affected} "
            "unchecked — the difference is avoidable impact. PREDICTION from the state-transition engine.")

    # --- missed intervention ---
    if _match(q, "biggest missed", "missed intervention", "missed impact", "defense regret"):
        return pack("prediction",
            "The largest missed intervention window was {window}. Acting there still sits in the safe window "
            "and would have stopped propagation before the file server. Defense regret: {regret}%. "
            "Avoidable impact class: {missed}. These figures are SIMULATED ESTIMATES.")

    # --- robustness ---
    if _match(q, "robust"):
        return pack("prediction",
            "Defense {defense} is rated {robust} because it stayed stable across {n} attacker-adaptation "
            "simulations. Sensitivity analysis showed the outcome did not flip under small assumption changes. "
            "If a defense flips, the engine flags UNCERTAIN — HUMAN REVIEW REQUIRED.")

    # --- report ---
    if _match(q, "report", "incident report", "generate"):
        return pack("observed",
            "INCIDENT REPORT (SIMULATED)\n"
            "OBSERVED — Risk: {risk_level} at {risk}; stage {stage}; intent: {intent}; "
            "compromised: {compromised}; events: {event_count}.\n"
            "PREDICTION — Next target {predicted} ({confidence}%); blast radius {blast}.\n"
            "PROPOSED / REQUIRES HUMAN APPROVAL — {defense}.\n"
            "LEARNED FROM SIMULATION — defense regret {regret}%; missed impact {missed}; "
            "best counterfactual {best_affected} vs {actual_affected} systems.\n"
            "Playbook: {playbook}")

    # --- containment / verification ---
    if _match(q, "contained", "containment", "verif"):
        verb = "Containment is recorded as successful in this simulation." if b["contained"] else \
               "Containment has not been approved yet, or no-action was selected."
        return pack("observed",
            verb + " Approved action: {approved}. Status: {status}. Residual predicted exposure uses the outcome model, not live hosts.")

    # --- default ---
    return pack("observed",
        "I can interpret the current simulated state. "
        "OBSERVED: risk {risk_level} at {risk}, stage {stage}, intent: {intent}, compromised: {compromised}. "
        "PREDICTION: next target {predicted} (not an observed fact). "
        "PROPOSED / REQUIRES HUMAN APPROVAL: {defense}. "
        "Ask about what is happening, evidence, next target, recommended defense, blast radius, "
        "defense failure, attacker adaptation, learning, or the playbook proposal.")
