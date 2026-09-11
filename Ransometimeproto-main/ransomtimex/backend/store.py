"""
Persistence (SQLite) for incidents, decisions/audit, defense memory, playbooks.
Also in-memory simulation session state.
"""
import json
import os
import sqlite3
import threading
import uuid

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rtx.db")
_lock = threading.Lock()

def _conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init_db():
    with _lock:
        c = _conn()
        c.executescript("""
        CREATE TABLE IF NOT EXISTS incidents(
            id TEXT PRIMARY KEY,
            ts TEXT, risk_score REAL, attack_stage TEXT, scenario TEXT,
            affected_assets TEXT, predicted_target TEXT, prediction_confidence REAL,
            recommended_action TEXT, approval_status TEXT, outcome TEXT,
            defense_regret REAL, best_counterfactual TEXT, playbook_update TEXT, payload TEXT
        );
        CREATE TABLE IF NOT EXISTS decisions(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT, incident TEXT, recommendation TEXT, decision TEXT,
            approver TEXT, reason TEXT, sim_outcome TEXT, actual_outcome TEXT
        );
        CREATE TABLE IF NOT EXISTS memory(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pattern TEXT, defense_used TEXT, outcome TEXT, impact TEXT,
            decision_quality REAL, future_recommendation TEXT
        );
        CREATE TABLE IF NOT EXISTS playbooks(
            version INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT, state TEXT, trigger TEXT, actions TEXT, approval TEXT,
            rationale TEXT, updated TEXT
        );
        CREATE TABLE IF NOT EXISTS audit_log(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT, incident TEXT, recommendation TEXT, decision TEXT,
            approver TEXT, reason TEXT, sim_outcome TEXT, actual_outcome TEXT
        );
        CREATE TABLE IF NOT EXISTS profile(
            id INTEGER PRIMARY KEY,
            employee_id TEXT, display_name TEXT, role TEXT, department TEXT,
            email TEXT, phone TEXT, org TEXT,
            region TEXT, timezone TEXT, access_level TEXT, last_login TEXT,
            updated TEXT
        );
        """)
        c.commit()
        _seed(c)
        c.close()


def _seed(c):
    """Seed sample incident history on a fresh database (synthetic demo data)."""
    n = c.execute("SELECT COUNT(*) c FROM incidents").fetchone()["c"]
    if n:
        return
    samples = [
        dict(id="INC-001", ts="2026-08-19 14:03:12", risk_score=62, attack_stage="Credential compromise",
             scenario="S1", affected_assets=["LAB-PC-22"], affected_count=1, predicted_target="FILE-SRV-01",
             prediction_confidence=78, recommended_action="Revoke Credentials", approval_status="RESOLVED",
             approved_action="revoke_credentials", defense_regret=41,
             actual_outcome=dict(label="Revoke Credentials", affected=2, exposure_pct=12, downtime_h=0.3,
                                 impact="LOW", containment=81), playbook_update=dict(version=1),
             pattern="Credential compromise", defense_used="Credential revocation", future="Prioritize credential monitoring."),
        dict(id="INC-002", ts="2026-08-26 09:41:55", risk_score=77, attack_stage="Lateral movement",
             scenario="S2", affected_assets=["LAB-PC-21", "FAC-PC-07"], affected_count=2,
             predicted_target="FILE-SRV-01", prediction_confidence=85,
             recommended_action="Isolate Endpoint", approval_status="RESOLVED", approved_action="isolate_endpoint",
             defense_regret=63, actual_outcome=dict(label="Isolate Endpoint", affected=3, exposure_pct=21,
                 downtime_h=1.2, impact="LOW", containment=87), playbook_update=dict(version=1),
             pattern="Endpoint compromise + lateral movement", defense_used="Endpoint isolation",
             future="Add credential revocation to isolation flow."),
    ]
    for s in samples:
        payload = json.dumps(s)
        c.execute("""INSERT INTO incidents
          (id,ts,risk_score,attack_stage,scenario,affected_assets,predicted_target,
           prediction_confidence,recommended_action,approval_status,outcome,
           defense_regret,best_counterfactual,playbook_update,payload)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
          (s["id"], s["ts"], s["risk_score"], s["attack_stage"], s["scenario"],
           json.dumps(s["affected_assets"]), s["predicted_target"], s["prediction_confidence"],
           s["recommended_action"], s["approval_status"], json.dumps(s.get("actual_outcome", {})),
           s["defense_regret"], json.dumps({}), json.dumps(s.get("playbook_update", {})), payload))


# ------------------ analyst profile ------------------
PROFILE_KEYS = ("employee_id", "display_name", "role", "department", "email",
                "phone", "org", "region", "timezone", "access_level", "last_login")

DEFAULT_PROFILE = {
    "employee_id": "SOC-1001",
    "display_name": "Aarav Nair",
    "role": "SOC Analyst",
    "department": "Cyber Security Operations",
    "email": "aarav.nair@rmk-cdc.demo",
    "phone": "+91 90000 00001",
    "org": "RMK College Cyber Defense Center",
    "region": "Chennai, India",
    "timezone": "Asia/Kolkata (UTC+5:30)",
    "access_level": "Analyst (read + approve low/medium)",
    "last_login": "2026-09-08 09:12:00",
}

# ensure the stored row is the single current user
def _ensure_profile_table_columns(c):
    cols = [r["name"] for r in c.execute("PRAGMA table_info(profile)").fetchall()]
    adds = {
        "employee_id": "TEXT", "department": "TEXT", "phone": "TEXT",
        "access_level": "TEXT", "last_login": "TEXT",
    }
    for col, typ in adds.items():
        if col not in cols:
            c.execute(f"ALTER TABLE profile ADD COLUMN {col} {typ}")


def get_profile():
    with _lock:
        c = _conn()
        _ensure_profile_table_columns(c)
        row = c.execute("SELECT * FROM profile WHERE id=1").fetchone()
        if row:
            d = dict(row)
            c.close()
            return {k: d.get(k) or DEFAULT_PROFILE.get(k) for k in PROFILE_KEYS}
        c.close()
        return dict(DEFAULT_PROFILE)


def save_profile(p):
    d = {k: p.get(k) or DEFAULT_PROFILE.get(k) for k in PROFILE_KEYS}
    with _lock:
        c = _conn()
        _ensure_profile_table_columns(c)
        c.execute("""INSERT OR REPLACE INTO profile
                     (id,employee_id,display_name,role,department,email,phone,org,
                      region,timezone,access_level,last_login,updated)
                     VALUES(1,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))""",
                  (d["employee_id"], d["display_name"], d["role"], d["department"],
                   d["email"], d["phone"], d["org"], d["region"],
                   d["timezone"], d["access_level"], d["last_login"]))
        c.commit(); c.close()
    return get_profile()


# ------------------ simulation session state ------------------
class SessionState:
    """Holds the live synthetic incident state shared across endpoints & ws."""
    def __init__(self):
        self.reset()

    def reset(self):
        self.scenario_id = None
        self.events = []            # emitted scenario events (dicts)
        self.present = {}           # signal flags
        self.signal_counts = {}
        self.compromised = []       # ordered asset ids
        self.attacker_position = None
        self.risk_score = 0.0
        self.risk_level = "LOW"
        self.active = False
        self.completed = False
        self.contained = False
        self.running_ws = set()
        self.last_event_ts = "—"
        self.incident_id = None
        self.approved_action = None
        self.expected_outcome = None
        self.intervention_idx = None

STATE = SessionState()

# ------------------ incidents ------------------
def save_incident(inc: dict):
    with _lock:
        c = _conn()
        c.execute("""INSERT OR REPLACE INTO incidents
          (id,ts,risk_score,attack_stage,scenario,affected_assets,predicted_target,
           prediction_confidence,recommended_action,approval_status,outcome,
           defense_regret,best_counterfactual,playbook_update,payload)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
          (inc["id"], inc.get("ts"), inc.get("risk_score"), inc.get("attack_stage"),
           inc.get("scenario"), json.dumps(inc.get("affected_assets", [])),
           inc.get("predicted_target"), inc.get("prediction_confidence"),
           inc.get("recommended_action"), inc.get("approval_status"),
           json.dumps(inc.get("actual_outcome", {})), inc.get("defense_regret"),
           json.dumps(inc.get("best_counterfactual", {})),
           json.dumps(inc.get("playbook_update", {})), json.dumps(inc)))
        c.commit(); c.close()


def list_incidents():
    with _lock:
        c = _conn()
        rows = c.execute("SELECT * FROM incidents ORDER BY rowid DESC").fetchall()
        c.close()
        out = []
        for r in rows:
            d = dict(r)
            for k in ("affected_assets","outcome","best_counterfactual","playbook_update","payload"):
                try: d[k] = json.loads(d[k])
                except Exception: pass
            payload = d.get("payload") if isinstance(d.get("payload"), dict) else {}
            if payload:
                d = {**d, **payload}
            if not d.get("actual_outcome") and d.get("outcome"):
                d["actual_outcome"] = d["outcome"]
            out.append(d)
        return out


def get_incident(iid: str):
    for i in list_incidents():
        if i["id"] == iid:
            return i
    return None


# ------------------ decisions / audit ------------------
def save_decision(dec: dict):
    with _lock:
        c = _conn()
        c.execute("""INSERT INTO decisions(ts,incident,recommendation,decision,approver,reason,sim_outcome,actual_outcome)
                     VALUES(?,?,?,?,?,?,?,?)""",
                  (dec.get("ts"), dec.get("incident"), dec.get("recommendation"),
                   dec.get("decision"), dec.get("approver"), dec.get("reason"),
                   json.dumps(dec.get("sim_outcome", {})), json.dumps(dec.get("actual_outcome", {}))))
        # also to audit_log for the immutable view
        c.execute("""INSERT INTO audit_log(ts,incident,recommendation,decision,approver,reason,sim_outcome,actual_outcome)
                     VALUES(?,?,?,?,?,?,?,?)""",
                  (dec.get("ts"), dec.get("incident"), dec.get("recommendation"),
                   dec.get("decision"), dec.get("approver"), dec.get("reason"),
                   json.dumps(dec.get("sim_outcome", {})), json.dumps(dec.get("actual_outcome", {}))))
        c.commit(); c.close()


def audit_log():
    with _lock:
        c = _conn()
        rows = c.execute("SELECT * FROM audit_log ORDER BY id DESC").fetchall()
        c.close()
        return [dict(r) for r in rows]


def decisions():
    with _lock:
        c = _conn()
        rows = c.execute("SELECT * FROM decisions ORDER BY id DESC").fetchall()
        c.close()
        return [dict(r) for r in rows]


# ------------------ defense memory ------------------
def add_memory(entry: dict):
    with _lock:
        c = _conn()
        c.execute("""INSERT INTO memory(pattern,defense_used,outcome,impact,decision_quality,future_recommendation)
                     VALUES(?,?,?,?,?,?)""",
                  (entry.get("pattern"), entry.get("defense_used"), entry.get("outcome"),
                   entry.get("impact"), entry.get("decision_quality"),
                   entry.get("future_recommendation")))
        c.commit(); c.close()


def memory():
    with _lock:
        c = _conn()
        rows = c.execute("SELECT * FROM memory ORDER BY id DESC").fetchall()
        c.close()
        return [dict(r) for r in rows]


# ------------------ playbooks ------------------
def current_playbook():
    with _lock:
        c = _conn()
        rows = c.execute("SELECT * FROM playbooks WHERE state='ACTIVE' ORDER BY version DESC LIMIT 1").fetchall()
        c.close()
        if rows:
            r = dict(rows[0])
            for k in ("trigger","actions","approval"):
                try: r[k] = json.loads(r[k])
                except Exception: pass
            return r
        return None


def initial_playbook():
    seed = {
        "name": "ransomware_lateral_movement_response", "state": "ACTIVE", "version": 1,
        "trigger": {"risk_score": ">80", "attack_stage": "lateral_movement"},
        "conditions": {"compromised_account": True, "suspicious_network_connection": True},
        "actions": ["revoke_credentials", "isolate_endpoint", "monitor_propagation",
                    "protect_file_server", "verify_backup_reachability"],
        "approval": {"risk_level": "high", "human_approval": True},
        "verification": ["check_attack_activity", "verify_containment"],
        "learning": {"store_outcome": True, "propose_update": True},
        "rationale": "Baseline playbook for credential-driven lateral movement.",
    }
    with _lock:
        c = _conn()
        # Idempotent: only seed the baseline when no playbook has been created yet.
        n = c.execute("SELECT COUNT(*) c FROM playbooks").fetchone()["c"]
        if n == 0:
            c.execute("""INSERT INTO playbooks(name,state,trigger,actions,approval,rationale,updated)
                         VALUES('ransomware_lateral_movement_response','ACTIVE',?,?,?,?,datetime('now'))""",
                      (json.dumps(seed["trigger"]), json.dumps(seed["actions"]),
                       json.dumps(seed["approval"]), seed["rationale"]))
            c.commit()
        c.close()
    return seed


def _ver_to_yaml(ver):
    # shape a dict resembling YAML for the viewer
    try:
        trigger = json.loads(ver["trigger"]) if isinstance(ver["trigger"], str) else ver["trigger"]
    except Exception:
        trigger = ver["trigger"]
    try:
        actions = json.loads(ver["actions"]) if isinstance(ver["actions"], str) else ver["actions"]
    except Exception:
        actions = ver["actions"]
    try:
        approval = json.loads(ver["approval"]) if isinstance(ver["approval"], str) else ver["approval"]
    except Exception:
        approval = ver["approval"]
    conditions = {"compromised_account": True, "suspicious_network_connection": True}
    if ver.get("version", 1) > 1:
        conditions["no_critical_workload_on_endpoint"] = True
    return {
        "playbook": {"name": ver.get("name", "ransomware_lateral_movement_response")},
        "trigger": trigger, "conditions": conditions,
        "actions": actions, "approval": approval,
        "verification": ["check_attack_activity", "verify_containment"],
        "learning": {"store_outcome": True, "propose_update": True},
    }


def propose_update():
    """Create a proposed playbook version (never applied silently). Reuses an
    existing pending PROPOSED so repeated calls do not pile up duplicates."""
    trigger = {"risk_score": ">80", "attack_stage": "lateral_movement"}
    actions = ["revoke_credentials", "isolate_endpoint", "monitor_propagation",
               "protect_file_server", "verify_backup_reachability"]
    approval = {"risk_level": "high", "human_approval": True}
    rationale = ("Credential revocation should occur before endpoint isolation when a compromised "
                 "user account is detected and no critical workload is running on the endpoint.")
    with _lock:
        c = _conn()
        # return existing pending proposal if one already exists
        row = c.execute("SELECT * FROM playbooks WHERE state='PROPOSED' ORDER BY version DESC LIMIT 1").fetchone()
        if row:
            r = dict(row)
            c.close()
            return {"name": r["name"], "version": r["version"], "state": "PROPOSED",
                    "rationale": r["rationale"], "updated": None}
        rows = c.execute("SELECT MAX(version) m FROM playbooks").fetchall()
        nxt = (rows[0]["m"] or 0) + 1
        c.execute("INSERT OR REPLACE INTO playbooks(version,name,state,trigger,actions,approval,rationale,updated) "
                  "VALUES(?,?,?,?,?,?,?,NULL)",
                  (nxt, "ransomware_lateral_movement_response", "PROPOSED",
                   json.dumps(trigger), json.dumps(actions), json.dumps(approval), rationale))
        c.commit(); c.close()
    return {"name": "ransomware_lateral_movement_response", "version": nxt, "state": "PROPOSED",
            "rationale": rationale, "updated": None}


def reject_playbook(version=None):
    """Mark a pending proposal as REJECTED (never silently applied)."""
    with _lock:
        c = _conn()
        if version is None:
            row = c.execute("SELECT * FROM playbooks WHERE state='PROPOSED' ORDER BY version DESC LIMIT 1").fetchone()
        else:
            row = c.execute("SELECT * FROM playbooks WHERE version=?", (version,)).fetchone()
        if not row:
            c.close(); return False
        c.execute("UPDATE playbooks SET state='REJECTED', updated=datetime('now') WHERE version=?", (row["version"],))
        c.commit(); c.close()
        return True


def approve_playbook(version=None):
    with _lock:
        c = _conn()
        # find proposed
        if version is None:
            row = c.execute("SELECT * FROM playbooks WHERE state='PROPOSED' ORDER BY version DESC LIMIT 1").fetchone()
        else:
            row = c.execute("SELECT * FROM playbooks WHERE version=? ", (version,)).fetchone()
        if not row:
            c.close(); return None
        ver = dict(row)
        # demote existing active to SUPERSEDED
        c.execute("UPDATE playbooks SET state='SUPERSEDED' WHERE state='ACTIVE'")
        c.execute("UPDATE playbooks SET state='ACTIVE', updated=datetime('now') WHERE version=?", (ver["version"],))
        c.commit()
        ver["state"] = "ACTIVE"
        c.close()
        return ver


def playbook_versions():
    with _lock:
        c = _conn()
        rows = c.execute("SELECT * FROM playbooks ORDER BY version DESC").fetchall()
        c.close()
        return [dict(r) for r in rows]
