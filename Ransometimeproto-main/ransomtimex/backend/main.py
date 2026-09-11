"""
RansomTime-X FastAPI backend.
Simulation, detection, prediction, defense and attribution are DETERMINISTIC/ML.
No LLM is used for any decision. Everything operates on SYNTHETIC events.
"""
import asyncio
import os
import time
import uuid
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

import store
from assets import build_assets, USERS
from scenarios import SCENARIOS, STAGE_OF_EVENT
from engine import compute_step, fresh_assets, final_impact_estimate
from outcome import compute_outcome, PROFILES
from defense import recommend, adaptive_response
from attribution import run_counterfactual, missed_impact, robustness_test, reachable_full, replay_scenario, resolve_scenario
from false_positive import CONTEXT_STEPS, BENIGN_ACTIVITIES
from evaluation import METRICS, NOTE, evaluation_snapshot, run_evaluation, reset_evaluation
from ai_investigator import answer as ai_answer
import graph as graphmod
import live as livemod

store.init_db()

app = FastAPI(title="RansomTime-X API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def no_cache_html(request, call_next):
    """Never cache index.html so browser always pulls the newest build.
    Hashed JS/CSS assets are immutable by filename, so only HTML matters."""
    resp = await call_next(request)
    p = request.url.path
    if p == "/" or (p and not p.startswith("/api") and not p.startswith("/ws") and not p.startswith("/assets")):
        resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return resp

# ---------------- live state ----------------
LIVE = {
    "current": None,       # current step snapshot
    "scenario": None,
    "running": False,
    "status": "STANDBY",
    "started_ts": None,
    "approved_action": None,
    "actual_outcome": None,
    "defense_regret": None,
    "missed": None,
    "audited": False,
    "robustness": None,
}

class WSManager:
    def __init__(self):
        self.conns = set()

    async def connect(self, ws):
        await ws.accept()
        self.conns.add(ws)

    def disconnect(self, ws):
        self.conns.discard(ws)

    async def broadcast(self, message: dict):
        for ws in list(self.conns):
            try:
                await ws.send_json(message)
            except Exception:
                self.conns.discard(ws)

manager = WSManager()


def decision_posture():
    """Default Command Center posture: ongoing simulated incident at its decision frame."""
    sid = "S2"
    steps = progression(sid)
    idx = 5  # lateral-movement decision frame (predicted FILE-SRV-01)
    s = compute_step(SCENARIOS[sid], idx)
    potential = s["blast_radius"]["potential_affected_count"] or 8
    s["active"] = True
    s["status"] = "ACTIVE"
    s["decision_index"] = idx
    s["timeline"] = [e["timestamp"] for e in s["events_so_far"]]
    s["incident"] = "INC-003"
    return s


def _live_run():
    return getattr(livemod, "RUN", None)


def _sync_live(snap):
    """Keep classic LIVE dict aligned with the dynamic live run so every page
    (detection, graph, prediction, defense, investigator) reads one state."""
    if not snap:
        return
    LIVE["current"] = dict(snap)
    LIVE["status"] = snap.get("status") or LIVE.get("status") or "ACTIVE"
    if snap.get("approved_action"):
        LIVE["approved_action"] = snap.get("approved_action")
    if snap.get("actual_outcome"):
        LIVE["actual_outcome"] = snap.get("actual_outcome")
    LIVE["contained"] = bool(snap.get("contained"))


def _active_snapshot():
    """Single source of truth: live run if present, else classic LIVE, else idle."""
    run = _live_run()
    if run and run.get("idx", -1) >= 0:
        if run.get("phase") == "resolved" and run.get("_final_snap"):
            snap = dict(run["_final_snap"])
        else:
            snap = livemod.snapshot_at(run, run["idx"])
        snap["status"] = run.get("status") or snap.get("status") or "ACTIVE"
        snap["incident_id"] = run.get("incident_id")
        snap["live_phase"] = run.get("phase")
        snap["scenario_id"] = run.get("scenario_id")
        _sync_live(snap)
        return snap
    if LIVE["current"]:
        return dict(LIVE["current"])
    s = decision_posture()
    LIVE["current"] = dict(s)
    LIVE["scenario"] = LIVE.get("scenario") or "S2"
    return s


def idle_state():
    """Pre-simulation healthy graph & assets."""
    assets = fresh_assets()
    for a in assets.values():
        a.state = "HEALTHY"
    g = graphmod.build_graph(assets, [], None, None, {})
    return {"risk_score": 0.0, "risk_level": "LOW", "assets": {k: v.to_dict() for k, v in assets.items()},
            "compromised": [], "attacker_position": None, "prediction": None,
            "graph": g, "blast_radius": {"current_affected": [], "current_affected_count": 0,
                                         "potential_affected_count": 0, "critical_exposed_count": 0,
                                         "backup_exposure": "LOW"},
            "intent": {"intent": None, "confidence": 0.0, "sentence": "Monitoring — no correlated activity.",
                       "evidence": [], "stage": "Observing"},
            "active": False, "completed": False, "contained": False, "events_so_far": [],
            "signal_counts": {}, "present": {}, "mitre": {}}


# ---------------- Pydantic bodies ----------------
class SimStart(BaseModel):
    scenario_id: str = "S2"
    speed_ms: int = 700

class DefenseBody(BaseModel):
    action_id: str = "isolate_revoke"

class ApproveBody(BaseModel):
    action_id: str = "isolate_revoke"
    approver: str = "SOC Analyst"
    reason: str = ""
    decision: str = "APPROVED"   # APPROVED | REJECTED | MODIFIED
    intervention_idx: Optional[int] = None

class ReplayBody(BaseModel):
    scenario_id: str = "S2"
    action_id: str = "no_action"
    intervention_idx: int = 0

class RobustBody(BaseModel):
    defense: str = "isolate_revoke"
    scenario_id: str = "S2"

class ProfileBody(BaseModel):
    employee_id: str = "SOC-1001"
    display_name: str = "Aarav Nair"
    role: str = "SOC Analyst"
    department: str = "Cyber Security Operations"
    email: str = ""
    phone: str = ""
    org: str = "RMK College Cyber Defense Center"
    region: str = "Chennai, India"
    timezone: str = "Asia/Kolkata (UTC+5:30)"
    access_level: str = "Analyst"
    last_login: str = ""

class LiveStartBody(BaseModel):
    scenario_id: str = "S-LAT"
    reproducible: bool = True
    intensity: float = 0.6

class LiveActBody(BaseModel):
    action_id: str = "isolate_revoke"
    decision: str = "APPROVED"

class LiveSimBody(BaseModel):
    action_id: str = "no_action"
    earlier: int = 0

class AIBody(BaseModel):
    question: str = ""
    evidence: str = ""


# ---------------- helpers ----------------
def progression(scenario_id):
    s = SCENARIOS[scenario_id]
    steps = [compute_step(s, i) for i in range(len(s.events))]
    # attach prediction lead-time base from spec
    return steps


def run_simulation_async(scenario_id, speed_ms):
    """Broadcast each step over websocket with delay."""
    steps = progression(scenario_id)
    LIVE["current"] = steps[-1]
    return steps


@app.post("/api/simulation/start")
def sim_start(body: SimStart):
    sid = body.scenario_id
    if sid not in SCENARIOS:
        return {"error": "unknown scenario"}
    steps = progression(sid)
    LIVE["scenario"] = sid
    LIVE["started_ts"] = datetime.now().isoformat()
    LIVE["running"] = True
    LIVE["current"] = steps[-1]
    LIVE["status"] = "DETECTING"
    LIVE["audited"] = False
    LIVE["approved_action"] = None
    LIVE["actual_outcome"] = None
    LIVE["defense_regret"] = None
    LIVE["missed"] = None
    sc = SCENARIOS[sid]
    return {"scenario_id": sid, "total_events": len(steps),
            "timeline": [e.timestamp for e in sc.events],
            "steps": steps, "speed_ms": body.speed_ms,
            "initial": sc.initial, "name": sc.name}


@app.get("/api/state")
def state():
    s = _active_snapshot()
    s["running"] = LIVE["running"] or ((_live_run() or {}).get("phase") == "running")
    s["status"] = LIVE.get("status") or s.get("status") or "STANDBY"
    s["approved_action"] = LIVE.get("approved_action") or s.get("approved_action")
    s["actual_outcome"] = LIVE.get("actual_outcome") or s.get("actual_outcome")
    return s


@app.get("/api/assets")
def assets_api():
    st = _active_snapshot()
    return {"assets": st["assets"]}


@app.get("/api/attack-graph")
def attack_graph():
    st = _active_snapshot()
    return st.get("graph") or {}


@app.get("/api/predictions")
def predictions():
    st = _active_snapshot()
    return {"prediction": st.get("prediction"),
            "blast_radius": st.get("blast_radius"),
            "intent": st.get("intent")}


@app.get("/api/events")
def events():
    st = _active_snapshot()
    return {"events": st.get("events_so_far", [])}


@app.get("/api/detection/current")
def detection_current():
    st = _active_snapshot()
    return {
        "risk_score": st.get("risk_score", 0),
        "risk_level": st.get("risk_level", "LOW"),
        "signal_counts": st.get("signal_counts") or {},
        "present": st.get("present") or {},
        "intent": st.get("intent") or {},
        "compromised": st.get("compromised") or [],
        "events": st.get("events_so_far") or [],
        "status": st.get("status") or LIVE.get("status"),
        "simulated": True,
    }


# ---------------- defense ----------------
@app.post("/api/defense/recommend")
def recommend_api(body: DefenseBody = DefenseBody()):
    st = _active_snapshot()
    potential = (st.get("blast_radius") or {}).get("potential_affected_count") or 8
    risk_level = st.get("risk_level", "LOW")
    propagating = len(st.get("compromised", [])) > 1
    rec = recommend({"risk_score": st.get("risk_score", 0), "risk_level": risk_level,
                     "propagating": propagating, "potential_systems": potential})
    LIVE["rec"] = rec
    return rec


@app.get("/api/defense/review")
def defense_review():
    rec = LIVE.get("rec")
    if not rec:
        rec = recommend_api()
    st = _active_snapshot()
    return {"recommendation": rec, "state": {
        "risk_score": st.get("risk_score"), "risk_level": st.get("risk_level"),
        "compromised": st.get("compromised"), "prediction": st.get("prediction"),
    }, "requires_human_approval": True}


@app.post("/api/defense/simulate")
def defense_simulate(body: DefenseBody):
    st = _active_snapshot()
    potential = (st.get("blast_radius") or {}).get("potential_affected_count") or 8
    return {"action_id": body.action_id,
            "outcome": compute_outcome(body.action_id, potential, 0.9),
            "adaptive": adaptive_response(body.action_id, fresh_assets())}


@app.post("/api/defense/approve")
def defense_approve(body: ApproveBody):
    st = _active_snapshot()
    potential = (st.get("blast_radius") or {}).get("potential_affected_count") or 8
    touched_before = len(st.get("compromised", []))
    timing = 0.9
    o = compute_outcome(body.action_id, potential, timing)
    o["affected"] = max(touched_before, o["affected"])
    LIVE["approved_action"] = body.action_id
    LIVE["actual_outcome"] = o
    LIVE["running"] = False
    LIVE["status"] = "CONTAINED" if body.decision == "APPROVED" else "PENDING"
    LIVE["contained"] = (body.decision == "APPROVED")
    # build contained graph state
    contained = dict(st)
    assets = {k: dict(v) for k, v in st["assets"].items()}
    for aid, a in assets.items():
        if a["state"] in ("COMPROMISED", "SUSPICIOUS"):
            a["state"] = "CONTAINED"
            a["contained"] = True
    # attacker stops
    graph = dict(st["graph"])
    graph["edges"] = [e for e in graph["edges"] if e.get("kind") != "active"] or graph["edges"]
    contained["assets"] = assets
    contained["contained"] = True
    contained["completed"] = (body.decision == "APPROVED")
    contained["approved_action"] = body.action_id
    contained["actual_outcome"] = o
    LIVE["current"] = contained

    # audit + decision record
    rec = LIVE.get("rec") or recommend({"risk_score": st.get("risk_score",0),
                                        "risk_level": st.get("risk_level","LOW"),
                                        "propagating": len(st.get("compromised",[]))>1,
                                        "potential_systems": potential})
    store.save_decision({
        "ts": datetime.now().strftime("%H:%M:%S"),
        "incident": LIVE.get("incident_id", "INC-003"),
        "recommendation": PROFILES[body.action_id]["label"],
        "decision": body.decision, "approver": body.approver,
        "reason": body.reason or rec.get("reason", ""),
        "sim_outcome": {"containment": rec["optimizer"]["overall"]},
        "actual_outcome": o,
    })
    return {"approved": body.decision, "action_id": body.action_id, "outcome": o,
            "state": contained}


@app.post("/api/defense/reject")
def defense_reject(body: ApproveBody = ApproveBody()):
    body.decision = "REJECTED"
    body.action_id = body.action_id or "no_action"
    return defense_approve(body)


# ---------------- replay / counterfactual ----------------
@app.post("/api/replay")
def replay_api(body: ReplayBody):
    return replay_scenario(body.scenario_id, body.action_id, body.intervention_idx)


@app.post("/api/counterfactual/run")
def counterfactual_api(body: ReplayBody):
    return run_counterfactual(body.scenario_id, body.intervention_idx)


@app.post("/api/robustness/test")
def robustness_api(body: RobustBody):
    return robustness_test(body.defense, body.scenario_id)


# ---------------- playbook ----------------
@app.post("/api/playbook/propose")
def playbook_propose():
    store.initial_playbook()
    return store.propose_update()


@app.post("/api/playbook/approve")
def playbook_approve():
    v = store.approve_playbook()
    return {"approved": True, "version": v}


@app.post("/api/playbook/reject")
def playbook_reject():
    ok = store.reject_playbook()
    return {"rejected": ok}


@app.get("/api/playbook")
def playbook():
    store.initial_playbook()
    cur = store.current_playbook()
    ver = store.playbook_versions()
    return {"current": cur, "versions": ver}


# ---------------- incident complete / history ----------------
@app.post("/api/incident/complete")
def incident_complete(body: ApproveBody):
    sid = LIVE["scenario"] or "S2"
    st = _active_snapshot()
    sc = resolve_scenario(sid)
    potential = reachable_full(sc) if getattr(sc, "events", None) else 8
    action = LIVE["approved_action"] or body.action_id or "isolate_revoke"
    o = LIVE["actual_outcome"] or compute_outcome(action, potential, 0.9)
    last = max(0, len(getattr(sc, "events", []) or []) - 1)
    miss = missed_impact("no_action", sid, last)
    iid = f"INC-{str(store.list_incidents().__len__() + 3).zfill(3)}"
    LIVE["incident_id"] = iid
    LIVE["defense_regret"] = miss["defense_regret"]
    LIVE["missed"] = miss
    pred = st.get("prediction") or {}
    incident = {
        "id": iid, "ts": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "risk_score": st.get("risk_score", 93), "risk_level": st.get("risk_level", "HIGH"),
        "attack_stage": (st.get("intent") or {}).get("stage", "RANSOMWARE PREPARATION"),
        "scenario": sid, "affected_assets": st.get("compromised", []),
        "affected_count": len(st.get("compromised", [])),
        "predicted_target": (pred.get("predicted") if pred else "FILE-SRV-01"),
        "prediction_confidence": (pred.get("confidence") if pred else 91),
        "recommended_action": PROFILES[action]["label"],
        "approval_status": "RESOLVED", "approved_action": action,
        "actual_outcome": o, "defense_regret": miss["defense_regret"],
        "best_counterfactual": miss["best_counterfactual"],
        "missed": miss,
    }
    store.save_incident(incident)
    # store defense memory
    store.add_memory({
        "pattern": "credential compromise + privilege escalation + lateral movement",
        "defense_used": PROFILES[action]["label"],
        "outcome": "Propagation stopped" if LIVE["contained"] else "Propagation continued",
        "impact": o["impact"], "decision_quality": max(0.0, 100 - miss["defense_regret"]) / 100,
        "future_recommendation": "Prioritize credential revocation within 30 seconds.",
    })
    # propose playbook update automatically after learning
    store.initial_playbook()
    proposed = store.propose_update()
    incident["playbook_update"] = proposed
    LIVE["status"] = "RESOLVED"
    return {"incident": incident, "missed_impact": miss,
            "playbook_proposal": proposed}


@app.get("/api/incidents")
def incidents():
    return {"incidents": store.list_incidents()}


@app.get("/api/incidents/{iid}")
def incident_detail(iid: str):
    return {"incident": store.get_incident(iid)}


@app.get("/api/decisions")
def decisions():
    return {"decisions": store.decisions()}


@app.get("/api/audit")
def audit():
    return {"audit": store.audit_log()}


@app.get("/api/memory")
def memory():
    return {"memory": store.memory()}


@app.get("/api/profile")
def profile():
    return store.get_profile()


@app.post("/api/profile")
def profile_update(body: ProfileBody):
    p = store.save_profile(body.model_dump() if hasattr(body, "model_dump") else body.dict())
    return p


# ---------------- static dashboards ----------------
@app.get("/api/evaluation")
def evaluation():
    return evaluation_snapshot()


@app.get("/api/evaluation/scenarios")
def evaluation_scenarios():
    return scenarios_api()


@app.get("/api/evaluation/report")
def evaluation_report():
    snap = evaluation_snapshot()
    inc = store.list_incidents()
    return {**snap, "incidents": len(inc), "simulated": True}


@app.post("/api/evaluation/run")
def evaluation_run():
    return run_evaluation(store.list_incidents())


@app.post("/api/evaluation/reset")
def evaluation_reset_api():
    return reset_evaluation()


@app.get("/api/false-positive")
def false_positive():
    return {"context_steps": CONTEXT_STEPS, "benign": BENIGN_ACTIVITIES}


def _ai_telemetry(st=None):
    st = st or _active_snapshot()
    pred = st.get("prediction") or {}
    blast = st.get("blast_radius") or {}
    intent = st.get("intent") or {}
    rec = LIVE.get("rec") or {}
    run = _live_run() or {}
    signals = st.get("signal_counts") or {}
    evidence = [s for s, c in signals.items() if c]
    mem = store.memory()[:3]
    mem_summary = "; ".join(
        f"{m.get('pattern','?')} → {m.get('defense_used','?')} ({m.get('outcome','')})"
        for m in mem
    ) if mem else "No defense-memory entries yet for this session."
    pb = store.current_playbook()
    proposed = None
    try:
        vers = store.playbook_versions()
        proposed = next((v for v in vers if (v.get("state") or "").upper() == "PROPOSED"), None)
    except Exception:
        proposed = None
    adapt = st.get("adaptation_note") or ""
    if LIVE.get("approved_action"):
        adapt = adapt or adaptive_response(LIVE["approved_action"], fresh_assets()).get("response", "")
    action = LIVE.get("approved_action") or rec.get("recommended") or "isolate_revoke"
    return {
        "risk_score": st.get("risk_score", 0), "risk_level": st.get("risk_level", "LOW"),
        "prediction_confidence": (pred.get("confidence") if pred else st.get("risk_score", 0)),
        "predicted_target": (pred.get("predicted") if pred else None),
        "intent": intent.get("sentence", "Observing"),
        "stage": intent.get("stage", "Observing"),
        "recommended_label": rec.get("recommended_label") or PROFILES.get(action, PROFILES["isolate_revoke"])["label"],
        "recommended_id": rec.get("recommended") or action,
        "defense_reason": rec.get("reason") or "minimum-disruption containment of endpoint and credentials",
        "evidence": evidence,
        "evidence_list": evidence,
        "blast_radius": blast.get("potential_affected_count", 0),
        "current_affected": blast.get("current_affected_count") or len(st.get("compromised") or []),
        "critical_exposed": blast.get("critical_exposed_count", 0),
        "compromised": st.get("compromised") or [],
        "attacker_position": st.get("attacker_position"),
        "defense_regret": (LIVE["defense_regret"] if LIVE["defense_regret"] is not None else 0),
        "missed_impact": (LIVE["missed"] or {}).get("avoidable_impact", "HIGH"),
        "intervention_window": "10:04:37",
        "best_affected": (LIVE["missed"] or {}).get("best_counterfactual", {}).get("affected", 1),
        "actual_affected": (LIVE["missed"] or {}).get("actual", {}).get("affected", blast.get("potential_affected_count", 8)),
        "robustness": "ROBUST",
        "evidence_count": signals.get("mass_file_modification", 0),
        "renames": signals.get("rapid_file_rename", 0),
        "cred": signals.get("credential_access", 0),
        "lat": signals.get("lateral_movement", 0),
        "backup": signals.get("backup_access_attempt", 0),
        "status": st.get("status") or LIVE.get("status") or "STANDBY",
        "contained": bool(st.get("contained") or LIVE.get("contained")),
        "approved_action": LIVE.get("approved_action") or st.get("approved_action"),
        "playbook_rationale": (proposed or {}).get("rationale") or (pb or {}).get("rationale") or "",
        "memory_summary": mem_summary,
        "adaptation": adapt,
        "event_count": len(st.get("events_so_far") or []),
        "origin": (run.get("path") or [None])[0] or (st.get("compromised") or [None])[0],
    }


def _ai_response(question: str):
    try:
        res = ai_answer(question, _ai_telemetry())
    except Exception as e:
        res = {"answer": f"[OBSERVED]\nInvestigator assembled a fallback from engine state. ({e})",
               "evidence": [], "source": "Deterministic Investigator fallback"}
    res["question"] = question
    return res


@app.get("/api/ai")
def ai(question: str = "", evidence: str = ""):
    return _ai_response(question)


@app.post("/api/ai")
def ai_post(body: AIBody = AIBody()):
    return _ai_response(body.question or "")


@app.get("/api/investigator")
def investigator_get(question: str = ""):
    return _ai_response(question)


@app.post("/api/investigator")
def investigator_post(body: AIBody = AIBody()):
    return _ai_response(body.question or "")


@app.get("/api/investigator/story")
def investigator_story():
    st = _active_snapshot()
    intent = st.get("intent") or {}
    events = st.get("events_so_far") or []
    beats = [{"ts": e.get("timestamp"), "type": e.get("event_type"), "asset": e.get("asset")} for e in events]
    return {"kind": "OBSERVED", "stage": intent.get("stage"), "sentence": intent.get("sentence"),
            "beats": beats, "simulated": True}


@app.get("/api/investigator/evidence")
def investigator_evidence():
    st = _active_snapshot()
    signals = st.get("signal_counts") or {}
    present = [k for k, v in signals.items() if v]
    return {"kind": "OBSERVED", "signals": signals, "present": present,
            "events": st.get("events_so_far") or [], "simulated": True}


def _classify(seconds: int) -> str:
    if seconds <= 40: return "BEST"
    if seconds <= 140: return "SAFE"
    if seconds <= 205: return "GOOD"
    if seconds <= 280: return "RISKY"
    return "TOO LATE"


@app.get("/api/intervention/{scenario_id}")
def intervention(scenario_id: str = "S2"):
    from attribution import replay_scenario, _seconds, _touched_before
    sc = resolve_scenario(scenario_id)
    if not sc or not getattr(sc, "events", None):
        return {"error": "unknown scenario", "points": [], "last_safe": None, "timeline": []}
    points = []
    for i in range(len(sc.events)):
        secs = _seconds(sc, i)
        iso = replay_scenario(scenario_id, "isolate_revoke", i)["outcome"]
        noa = replay_scenario(scenario_id, "no_action", i)["outcome"]
        rev = replay_scenario(scenario_id, "revoke_credentials", i)["outcome"]
        points.append({
            "idx": i, "ts": sc.events[i].timestamp, "stage": STAGE_OF_EVENT.get(sc.events[i].event_type, sc.events[i].event_type),
            "seconds": secs, "class": _classify(secs),
            "isolate_revoke_affected": iso["affected"], "revoke_affected": rev["affected"],
            "noaction_affected": noa["affected"], "touched": _touched_before(sc, i),
        })
    last_safe = None
    for p in points:
        if p["class"] in ("SAFE", "BEST", "GOOD"):
            last_safe = p
    return {"scenario_id": scenario_id, "points": points, "last_safe": last_safe,
            "timeline": [e.timestamp for e in sc.events]}


@app.get("/api/scenarios")
def scenarios_api():
    out = {}
    for sid, sc in SCENARIOS.items():
        out[sid] = {"id": sc.id, "name": sc.name, "initial": sc.initial,
                    "description": sc.description, "event_count": len(sc.events)}
    return {"scenarios": out}


@app.get("/api/sigma-rules")
def sigma():
    try:
        with open(__file__.replace("main.py", "sigma_rules.yaml"), "r") as f:
            return {"yaml": f.read()}
    except Exception:
        return {"yaml": "# rules unavailable"}


@app.get("/api/system")
def system():
    return {"status": "PROTECTED", "threat_level": LIVE.get("status", "STANDBY"),
            "active_incidents": 1 if (LIVE["running"] or LIVE["status"] != "RESOLVED") else 0,
            "protected_assets": 48, "last_event": LIVE.get("started_ts"),
            "org": "RMK College Cyber Defense Center (fictional sample)"}


# ---------------- websocket ----------------
@app.websocket("/ws/events")
async def ws_events(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            msg = await ws.receive_text()
            if msg == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(ws)


@app.get("/health")
def health():
    return {"ok": True}




# =========================================================================

# =========================================================================
# DYNAMIC LIVE SIMULATION  (backend-authoritative, HTTP-stepped, safe & synthetic)
# Each run generates a seeded/random scenario + event sequence on the backend.
# The frontend advances the run step-by-step via /api/live/* — the backend is the
# source of truth; no static log array is ever replayed client-side.
# =========================================================================

def _run():
    return getattr(livemod, "RUN", None)


@app.get("/api/live/scenarios")
def live_scenarios():
    out = []
    for sid in livemod.ORDER:
        c = livemod.SCENARIOS[sid]
        out.append({"id": sid, "name": c["name"], "origin_user": c["origin_user"],
                    "acts": [a["etype"] for a in c["acts"]], "paths": c["paths"]})
    return {"scenarios": out, "order": livemod.ORDER}


@app.post("/api/live/start")
def live_start(body: LiveStartBody = LiveStartBody()):
    sid = str(body.scenario_id or "S-LAT")
    rep = bool(body.reproducible)
    intensity = float(body.intensity or 0.6)
    run = livemod.generate_run(sid, reproducible=rep, intensity=intensity)
    run["incident_id"] = f"RXT-{str(len(store.list_incidents()) + 1).zfill(4)}"
    run["idx"] = -1
    run["phase"] = "running"
    run["decided"] = False
    run["action"] = None
    run["decision"] = None
    livemod.RUN = run
    LIVE["scenario"] = sid
    LIVE["running"] = True
    LIVE["status"] = "DETECTING"
    LIVE["approved_action"] = None
    LIVE["actual_outcome"] = None
    LIVE["defense_regret"] = None
    LIVE["missed"] = None
    LIVE["contained"] = False
    return {"ok": True, "incident_id": run["incident_id"], "scenario": sid,
            "name": run["cfg"]["name"], "seed": run["seed"], "reproducible": rep,
            "path": run["path"], "origin": run["path"][0],
            "total": len(run["events"]), "decision_at": run["stop"]}


@app.post("/api/live/reset")
@app.post("/api/simulation/reset")
def live_reset():
    livemod.reset_run()
    LIVE["current"] = idle_state()
    LIVE["running"] = False
    LIVE["status"] = "STANDBY"
    LIVE["approved_action"] = None
    LIVE["actual_outcome"] = None
    LIVE["rec"] = None
    LIVE["contained"] = False
    return {"ok": True, "kind": "reset", "snapshot": LIVE["current"]}


@app.get("/api/live/state")
def live_state():
    run = _run()
    if not run:
        return {"ok": False, "msg": "no live run"}
    idx = run.get("idx", -1)
    if idx < 0:
        return {"ok": True, "kind": "idle", "phase": run.get("phase")}
    snap = livemod.snapshot_at(run, idx)
    snap["status"] = run.get("status", "ACTIVE")
    snap["incident_id"] = run["incident_id"]
    _sync_live(snap)
    return {"ok": True, "kind": "state", "index": idx, "phase": run.get("phase"),
            "snapshot": snap, "incident_id": run["incident_id"]}


@app.post("/api/live/advance")
@app.post("/api/simulation/next")
def live_advance():
    """Generate & return the next event (backend source of truth)."""
    run = _run()
    if not run:
        return {"ok": False, "kind": "error", "msg": "start a live run first"}
    if run.get("phase") != "running":
        return {"ok": True, "kind": "resolved", "phase": run.get("phase"),
                "summary": run.get("_summary")}
    idx = run.get("idx", -1) + 1
    run["idx"] = idx
    if idx <= run["stop"]:
        snap = livemod.snapshot_at(run, idx)
        snap["status"] = "ACTIVE"
        snap["incident_id"] = run["incident_id"]
        _sync_live(snap)
        LIVE["running"] = True
        LIVE["status"] = snap.get("risk_level") or "ACTIVE"
        return {"ok": True, "kind": "event", "index": idx,
                "event": snap.get("event"), "snapshot": snap,
                "incident_id": run["incident_id"],
                "decision_ready": idx == run["stop"]}
    # past decision frame without an action — auto high-impact resolution
    base = livemod.snapshot_at(run, len(run["events"]) - 1)
    base["contained"] = False
    base["status"] = "RESOLVED"
    action = run.get("action") or "no_action"
    summary = livemod.summarize(run, run["stop"], action, run.get("decision") or "REJECTED", base)
    _persist_live_incident(run, run["stop"], action, run.get("decision") or "REJECTED", base, summary)
    run["phase"] = "resolved"
    run["_summary"] = summary
    run["_final_snap"] = base
    _sync_live(base)
    LIVE["running"] = False
    LIVE["status"] = "RESOLVED"
    return {"ok": True, "kind": "resolved", "summary": summary,
            "snapshot": base, "incident_id": run["incident_id"]}


@app.post("/api/live/decision")
def live_decision():
    run = _run()
    if not run:
        return {"ok": False, "msg": "no live run"}
    payload = livemod.decision_payload(run, run["stop"])
    LIVE["rec"] = payload.get("recommendation")
    _sync_live(payload.get("snapshot"))
    return {"ok": True, "kind": "decision",
            "payload": payload,
            "incident_id": run["incident_id"]}


@app.post("/api/live/simulate")
def live_simulate(body: LiveSimBody = LiveSimBody()):
    """Counterfactual branch — never mutates the real run state."""
    run = _run()
    if not run:
        return {"ok": False, "msg": "no live run"}
    br = livemod.simulate_branch(run, run["stop"], str(body.action_id or "no_action"),
                                 earlier=int(body.earlier or 0))
    return {"ok": True, "kind": "branch", "branch": br}


@app.post("/api/live/act")
def live_act(body: LiveActBody = LiveActBody()):
    """Human-in-the-loop simulated containment / no-action resolution."""
    run = _run()
    if not run or run.get("phase") == "resolved":
        return {"ok": False, "msg": "no active run"}
    action = str(body.action_id or "isolate_revoke")
    decision = str(body.decision or "APPROVED")
    run["action"] = action
    run["decision"] = decision
    no_action = action == "no_action" or decision != "APPROVED"
    if no_action:
        final = livemod.snapshot_at(run, len(run["events"]) - 1)
        final["contained"] = False
        final["status"] = "RESOLVED"
        summary = livemod.summarize(run, run["stop"], action, decision, final)
    else:
        final, o = livemod.contained_snapshot(run, run["stop"], action, "APPROVED")
        summary = livemod.summarize(run, run["stop"], action, "APPROVED", final)
    _persist_live_incident(run, run["stop"], action, decision, final, summary)
    run["phase"] = "resolved"
    run["_summary"] = summary
    run["_final_snap"] = final
    _sync_live(final)
    LIVE["running"] = False
    LIVE["status"] = "CONTAINED" if not no_action else "RESOLVED"
    LIVE["approved_action"] = action
    LIVE["actual_outcome"] = final.get("actual_outcome")
    try:
        store.initial_playbook()
        store.propose_update()
    except Exception:
        pass
    return {"ok": True, "kind": "resolved", "action": action, "decision": decision,
            "contained": not no_action, "summary": summary,
            "snapshot": final, "incident_id": run["incident_id"]}


def _persist_live_incident(run, stop, action, decision, final, summary):
    from defense import recommend as _rec
    base = livemod.snapshot_at(run, stop)
    potential = base["blast_radius"]["potential_affected_count"] or 8
    r = _rec({"risk_score": base["risk_score"], "risk_level": base["risk_level"],
              "propagating": len(base["compromised"]) > 1, "potential_systems": potential})
    pred = base.get("prediction") or {}
    o = final.get("actual_outcome") or livemod.simulate_branch(run, stop, action)["outcome"]
    incident = {
        "id": run["incident_id"], "ts": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "risk_score": summary["peak_risk"],
        "attack_stage": (base.get("intent") or {}).get("stage", "RANSOMWARE PREPARATION"),
        "scenario": run["scenario_id"], "affected_assets": base.get("compromised", []),
        "predicted_target": (pred.get("predicted") if pred else run["path"][2] if len(run["path"]) > 2 else ""),
        "prediction_confidence": int((pred.get("confidence") if pred else 0) or 0),
        "recommended_action": PROFILES.get(action, PROFILES["isolate_revoke"]).get("label", action),
        "approval_status": "CONTAINED" if decision == "APPROVED" and action != "no_action" else "RESOLVED",
        "approved_action": action,
        "actual_outcome": o, "defense_regret": summary["defense_regret"],
        "best_counterfactual": {"action": "isolate_revoke",
                                "affected": max(1, summary["no_action_affected"] - summary["avoidable_exposure"])},
        "playbook_update": {}, "summary": summary,
    }
    store.save_incident(incident)
    store.save_decision({"ts": datetime.now().strftime("%H:%M:%S"), "incident": run["incident_id"],
                         "recommendation": PROFILES.get(action, {}).get("label", action),
                         "decision": decision, "approver": "SOC Analyst", "reason": r.get("reason", ""),
                         "sim_outcome": {"containment": (r.get("optimizer") or {}).get("overall")},
                         "actual_outcome": o})
    store.add_memory({
        "pattern": " + ".join(a["etype"] for a in run["cfg"]["acts"][:4]),
        "defense_used": PROFILES.get(action, PROFILES["isolate_revoke"]).get("label", action),
        "outcome": "Propagation stopped" if decision == "APPROVED" and action != "no_action" else "Propagation continued",
        "impact": o.get("impact", "HIGH"),
        "decision_quality": max(0.0, 1.0 - (summary["defense_regret"] / max(1, summary["no_action_affected"]))),
        "future_recommendation": "Prioritize isolate+revoke within the safe intervention window.",
    })


# ---------------- learning / playbook / fork aliases ----------------
@app.get("/api/learning/summary")
def learning_summary():
    mem = store.memory()
    pb = store.current_playbook()
    return {"kind": "LEARNED FROM SIMULATION", "memory_count": len(mem),
            "playbook": pb, "incidents": len(store.list_incidents())}


@app.get("/api/learning/history")
def learning_history():
    return {"kind": "LEARNED FROM SIMULATION", "incidents": store.list_incidents(),
            "decisions": store.decisions()}


@app.get("/api/learning/defense-memory")
def learning_memory():
    return {"kind": "LEARNED FROM SIMULATION", "memory": store.memory()}


@app.get("/api/playbooks")
@app.get("/api/playbooks/current")
def playbooks_current():
    store.initial_playbook()
    return {"kind": "OBSERVED", "current": store.current_playbook(),
            "versions": store.playbook_versions()}


@app.get("/api/playbooks/proposals")
def playbooks_proposals():
    store.initial_playbook()
    vers = store.playbook_versions()
    proposed = [v for v in vers if (v.get("state") or "").upper() == "PROPOSED"]
    return {"kind": "PROPOSED / REQUIRES HUMAN APPROVAL", "proposals": proposed}


@app.get("/api/adaptation")
def adaptation_api():
    st = _active_snapshot()
    action = LIVE.get("approved_action") or "isolate_revoke"
    return {"kind": "SIMULATED ADAPTATION", "adaptive": adaptive_response(action, fresh_assets()),
            "note": st.get("adaptation_note"), "simulated": True}


@app.get("/api/simulation/forks")
def simulation_forks():
    sid = LIVE.get("scenario") or "S2"
    idx = (_active_snapshot() or {}).get("event_index", 5)
    try:
        return {"kind": "PREDICTION", **run_counterfactual(sid, idx)}
    except Exception as e:
        return {"kind": "PREDICTION", "results": {}, "error": str(e)}


# ---------------- static SPA hosting (production build) ----------------
DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "dist")
if os.path.isdir(DIST) and os.path.isfile(os.path.join(DIST, "index.html")):
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import JSONResponse
    _assets = os.path.join(DIST, "assets")
    if os.path.isdir(_assets):
        app.mount("/assets", StaticFiles(directory=_assets), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        # Never return HTML for API/WS misses — that caused "Unexpected token '<'".
        if full_path.startswith("api/") or full_path == "api" or full_path.startswith("ws"):
            return JSONResponse({"error": "not found", "path": "/" + full_path}, status_code=404)
        fp = os.path.join(DIST, full_path)
        if full_path and os.path.isfile(fp):
            return FileResponse(fp)
        return FileResponse(os.path.join(DIST, "index.html"))
