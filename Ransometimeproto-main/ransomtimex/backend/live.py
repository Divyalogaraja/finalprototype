"""
RansomTime-X · DYNAMIC live simulation engine (WebSocket-streamed).

Unlike the original scripted engine (which replayed a fixed prebuilt log array on
the client), this module GENERATES a fresh event sequence per run through a
seeded-or-random state machine, then streams each event + its authoritative
snapshot. It reuses the proven deterministic detectors/graph/prediction/defense
modules so analysis is identical to the pipeline already in the app.

SAFE SIMULATION ONLY — events are synthetic text. No real ransomware, encryption,
credential theft, lateral movement, scanning or destructive action ever runs.
"""
import random
import time
import uuid
from datetime import datetime

from scenarios import ScenarioEvent
from engine import compute_step
from assets import build_assets
from graph import REACH, IMPACT_TARGETS, predict_next
from defense import recommend
from outcome import compute_outcome, PROFILES, ACTIONS
from attribution import missed_impact

HOST = {
    'LAB-PC-21': 'student-user', 'LAB-PC-22': 'student-user', 'FAC-PC-07': 'faculty-user',
    'ADMIN-PC-03': 'it-admin-user', 'FILE-SRV-01': 'svc-fileshare', 'ERP-SRV-01': 'svc-erp',
    'LMS-SRV-01': 'svc-lms', 'BACKUP-SRV-01': 'svc-veeam', 'AD-SRV-01': 'svc-ad',
}
USERID = {'LAB-PC-21': 'u-student-2147', 'LAB-PC-22': 'u-student-2147', 'FAC-PC-07': 'u-faculty-312',
          'ADMIN-PC-03': 'u-admin-009', 'FILE-SRV-01': 'u-svc-fileshare', 'BACKUP-SRV-01': 'u-svc-backup',
          'ERP-SRV-01': 'u-svc-erp', 'LMS-SRV-01': 'u-svc-lms'}

# MITRE technique per event family
MITRE_OF = {
    'phishing_delivery': 'T1566', 'suspicious_process': 'T1059', 'command_scripting': 'T1059',
    'mass_file_modification': 'T1486', 'rapid_file_rename': 'T1486', 'credential_access': 'T1078',
    'privilege_escalation': 'T1068', 'suspicious_network': 'T1041', 'lateral_movement': 'T1021',
    'file_server_access': 'T1486', 'backup_access_attempt': 'T1490',
}
SEV = {'phishing_delivery': ('medium', 'high'), 'suspicious_process': ('medium', 'high'),
       'command_scripting': ('medium', 'high'), 'mass_file_modification': ('high', 'critical'),
       'rapid_file_rename': ('high', 'critical'), 'credential_access': ('high', 'high'),
       'privilege_escalation': ('high', 'high'), 'suspicious_network': ('medium', 'high'),
       'lateral_movement': ('high', 'critical'), 'file_server_access': ('critical', 'critical'),
       'backup_access_attempt': ('critical', 'critical')}
CONF = {'phishing_delivery': 0.7, 'suspicious_process': 0.78, 'command_scripting': 0.74,
        'mass_file_modification': 0.9, 'rapid_file_rename': 0.86, 'credential_access': 0.84,
        'privilege_escalation': 0.82, 'suspicious_network': 0.72, 'lateral_movement': 0.85,
        'file_server_access': 0.9, 'backup_access_attempt': 0.9}

NOTE = {
    'phishing_delivery': 'Synthetic phishing-like delivery observed on {asset}',
    'suspicious_process': 'Suspicious process behavior on {asset}',
    'command_scripting': 'Command & scripting activity on {asset}',
    'mass_file_modification': 'Mass file modification burst detected on {asset}',
    'rapid_file_rename': 'Rapid file renaming pattern on {asset}',
    'credential_access': 'Authentication anomaly for {user}',
    'privilege_escalation': 'Privilege escalation behavior detected on {asset}',
    'suspicious_network': 'Suspicious internal connection observed',
    'lateral_movement': 'Lateral movement from {src} toward {dst}',
    'file_server_access': 'Suspicious access to file server {dst}',
    'backup_access_attempt': 'Backup / recovery access attempt to {dst}',
}

# role key -> which path asset an event carries / references
ROLE_ASSET = {'origin': 0, 'user': None, 'hop': 1, 'impact': 2, 'backup': 3}

# ---------------------------------------------------------------------------
# Scenario configuration: each scenario lists acts and a set of candidate paths.
# path = ordered asset chain [origin endpoint, hop endpoint, impact target, backup]
# ---------------------------------------------------------------------------
SCENARIOS = {
    'S-LAT': {
        'id': 'S-LAT', 'name': 'Compromised Lab PC → Lateral Movement → File Server Exposure',
        'origin_user': 'student-user',
        'acts': [
            {'etype': 'suspicious_process', 'role': 'origin'},
            {'etype': 'mass_file_modification', 'role': 'origin'},
            {'etype': 'rapid_file_rename', 'role': 'origin'},
            {'etype': 'credential_access', 'role': 'user'},
            {'etype': 'privilege_escalation', 'role': 'origin'},
            {'etype': 'lateral_movement', 'role': 'hop'},
            {'etype': 'file_server_access', 'role': 'impact'},
            {'etype': 'backup_access_attempt', 'role': 'backup'},
        ],
        'paths': [
            ['LAB-PC-21', 'FAC-PC-07', 'FILE-SRV-01', 'BACKUP-SRV-01'],
            ['LAB-PC-21', 'LAB-PC-22', 'FILE-SRV-01', 'BACKUP-SRV-01'],
            ['LAB-PC-22', 'FAC-PC-07', 'ERP-SRV-01', 'BACKUP-SRV-01'],
        ],
    },
    'S-PHISH': {
        'id': 'S-PHISH', 'name': 'Phishing → Credential → Lateral Movement → Ransomware-like Activity',
        'origin_user': 'student-user',
        'acts': [
            {'etype': 'phishing_delivery', 'role': 'origin'},
            {'etype': 'suspicious_process', 'role': 'origin'},
            {'etype': 'credential_access', 'role': 'user'},
            {'etype': 'privilege_escalation', 'role': 'origin'},
            {'etype': 'suspicious_network', 'role': 'origin'},
            {'etype': 'lateral_movement', 'role': 'hop'},
            {'etype': 'file_server_access', 'role': 'impact'},
        ],
        'paths': [
            ['LAB-PC-21', 'FAC-PC-07', 'FILE-SRV-01', 'BACKUP-SRV-01'],
            ['LAB-PC-22', 'LAB-PC-21', 'FILE-SRV-01', 'BACKUP-SRV-01'],
        ],
    },
    'S-FAC': {
        'id': 'S-FAC', 'name': 'Compromised Faculty Device → Internal Access → Server Targeting → Backup Exposure',
        'origin_user': 'faculty-user',
        'acts': [
            {'etype': 'suspicious_process', 'role': 'origin'},
            {'etype': 'mass_file_modification', 'role': 'origin'},
            {'etype': 'credential_access', 'role': 'user'},
            {'etype': 'privilege_escalation', 'role': 'origin'},
            {'etype': 'lateral_movement', 'role': 'hop'},
            {'etype': 'file_server_access', 'role': 'impact'},
            {'etype': 'backup_access_attempt', 'role': 'backup'},
        ],
        'paths': [
            ['FAC-PC-07', 'ADMIN-PC-03', 'ERP-SRV-01', 'BACKUP-SRV-01'],
            ['FAC-PC-07', 'FILE-SRV-01', 'LMS-SRV-01', 'BACKUP-SRV-01'],
        ],
    },
    'S-INSIDER': {
        'id': 'S-INSIDER', 'name': 'Insider-like Anomalous Behavior → Mass File Activity → Suspicious Network',
        'origin_user': 'it-admin-user',
        'acts': [
            {'etype': 'suspicious_process', 'role': 'origin'},
            {'etype': 'mass_file_modification', 'role': 'origin'},
            {'etype': 'rapid_file_rename', 'role': 'origin'},
            {'etype': 'credential_access', 'role': 'user'},
            {'etype': 'suspicious_network', 'role': 'origin'},
            {'etype': 'file_server_access', 'role': 'impact'},
            {'etype': 'backup_access_attempt', 'role': 'backup'},
        ],
        'paths': [
            ['ADMIN-PC-03', 'ERP-SRV-01', 'LMS-SRV-01', 'BACKUP-SRV-01'],
            ['ADMIN-PC-03', 'FILE-SRV-01', 'BACKUP-SRV-01', 'AD-SRV-01'],
        ],
    },
}
ORDER = ['S-LAT', 'S-PHISH', 'S-FAC', 'S-INSIDER']


def pick_path(cfg, rng):
    return list(rng.choice(cfg['paths']))


def make_event(etype, role, path, rng, clock):
    """Build one ScenarioEvent from an act, injecting randomness within limits."""
    idx = ROLE_ASSET.get(role)
    if role == 'user':
        host = path[0]
        asset = USERID.get(host, 'u-' + host.lower())
    else:
        asset = path[idx]
    host = asset if asset in HOST else path[0]
    sev_lo, sev_hi = SEV[etype]
    sev = sev_lo if sev_lo == sev_hi else (sev_hi if rng.random() < 0.35 else sev_lo)
    conf = min(0.97, CONF[etype] + rng.uniform(-0.04, 0.05))
    src = path[0] if role in ('hop', 'impact', 'backup') else host
    dst = asset if role in ('hop', 'impact', 'backup') else host
    note = NOTE[etype].format(asset=asset, user=HOST.get(host, 'user'), src=src, dst=dst)
    clock['s'] += rng.randint(2, 6) if etype != 'credential_access' else rng.randint(1, 2)
    return ScenarioEvent(ts(clock['s']), asset, etype, sev, round(conf, 2), MITRE_OF[etype], note)


def ts(sec):
    base = 10 * 3600 + 4 * 60 + 12  # start ~10:04:12
    tot = base + sec
    h = (tot // 3600) % 24
    m = (tot % 3600) // 60
    s = tot % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


def generate_run(scenario_id, reproducible=True, intensity=0.6, seed=None):
    """Create a run: pick a path + instantiate every act into a ScenarioEvent."""
    cfg = SCENARIOS.get(scenario_id) or SCENARIOS['S-LAT']
    if seed is None:
        seed = int(random.SystemRandom().randint(0, 2 ** 31 - 1)) if not reproducible else 4242
    rng = random.Random(seed)
    path = pick_path(cfg, rng)
    events = []
    clock = {'s': 0}
    for act in cfg['acts']:
        ev = make_event(act['etype'], act['role'], path, rng, clock)
        events.append(ev)
    # events_so_far index at which to pause for a human decision
    stop = -1
    for i, e in enumerate(events):
        if e.event_type in ('lateral_movement', 'file_server_access'):
            stop = i
            break
    if stop < 0:
        stop = max(0, len(events) - 2)
    return {
        'scenario_id': scenario_id,
        'cfg': cfg,
        'events': events,
        'path': path,
        'seed': seed,
        'reproducible': bool(reproducible),
        'intensity': float(intensity),
        'stop': stop,
    }


def _snapshot(run, idx):
    """Authoritative state after processing events[0..idx] via the proven engine."""
    events = run['events']
    idx = max(0, min(idx, len(events) - 1))
    wrapper = type('Scenario', (), {'events': events[:idx + 1], 'id': run['scenario_id'],
                                    'initial': run['path'][0], 'name': run['cfg']['name']})()
    return compute_step(wrapper, len(events[:idx + 1]) - 1)


def snapshot_at(run, idx):
    s = _snapshot(run, idx)
    s['status'] = 'ACTIVE'
    s['incident_ref'] = run.get('incident_id')
    return s


def recommendation(run, idx):
    s = _snapshot(run, idx)
    potential = s['blast_radius']['potential_affected_count'] or 8
    rec = recommend({'risk_score': s['risk_score'], 'risk_level': s['risk_level'],
                     'propagating': len(s['compromised']) > 1, 'potential_systems': potential})
    return rec


# ===========================================================================
# Orchestration helpers (pure logic — no asyncio). The WebSocket handler drives
# these while streaming; counterfactual branches never mutate the real run.
# ===========================================================================

def option_view():
    out = []
    for aid in ACTIONS:
        p = PROFILES[aid]
        out.append({
            'action_id': aid,
            'label': p['label'],
            'containment': p['contain'],
            'disruption': p['disruption'],
            'residual': p['residual'],
            'score': None,
        })
    return out


def correlated_incident(run, snapshot):
    intent = snapshot.get('intent') or {}
    signals = {k: v for k, v in (snapshot.get('signal_counts') or {}).items() if v}
    risk = snapshot.get('risk_score', 0)
    conf = int(round(intent.get('confidence', 0) * 100)) if intent.get('confidence') else min(97, int(risk))
    return {
        'title': 'Possible multi-stage ransomware intrusion',
        'confidence': min(95, max(60, conf)),
        'stage': intent.get('stage', 'Suspicious Activity'),
        'origin': run['path'][0],
        'sentence': (intent.get('sentence') or 'Correlated behavioral indicators suggest an active intrusion.'),
        'evidence': list(signals.keys()),
    }


def story(run, snapshot):
    """Dynamically built Attack Story from the events generated this run."""
    beats = []
    seen = {}
    for e in snapshot.get('events_so_far', []):
        st = (e or {}).get('event_type')
        if not st or st in seen:
            continue
        seen[st] = True
        beats.append({'ts': e.get('timestamp'), 'type': st, 'asset': e.get('asset')})
    return beats


def decision_payload(run, idx):
    snap = snapshot_at(run, idx)
    rec = recommendation(run, idx)
    options = decision_scores_all(run, snap)
    intv = intervention_window(run, idx)
    return {
        'idx': idx,
        'snapshot': snap,
        'correlated': correlated_incident(run, snap),
        'story': story(run, snap),
        'recommendation': rec,
        'options': options,
        'intervention': intv,
    }


def decision_scores_all(run, snap):
    potential = snap['blast_radius']['potential_affected_count'] or 8
    scored = []
    for aid in ACTIONS:
        try:
            from defense import decision_scores
            s = decision_scores(aid, potential, 1.0)
            scored.append(s)
        except Exception:
            scored.append({'action_id': aid, 'overall': 0, 'containment': 0,
                           'outcome': {'affected': 0}})
    return scored


def intervention_window(run, idx):
    """Simulated window classification from how far into the kill chain we are."""
    n = len(run['events'])
    f = idx / max(1, n - 1)
    if f < 0.45:
        cls, color, txt = 'SAFE', '#3dd68c', 'Intervention window OPEN — early & safe.'
    elif f < 0.72:
        cls, color, txt = 'CAUTION', '#ffb454', 'Intervention window narrowing — propagate risk rising.'
    else:
        cls, color, txt = 'CRITICAL', '#ff3b52', 'Late window — impact target exposure likely.'
    return {'class': cls, 'color': color, 'text': txt, 'stage': (snapshot_at(run, idx).get('intent') or {}).get('stage', 'Observing')}


def contained_snapshot(run, idx, action_id, decision='APPROVED'):
    """Simulated containment result (does NOT touch any real network)."""
    base = snapshot_at(run, idx)
    potential = base['blast_radius']['potential_affected_count'] or 8
    timing = max(0.2, 1.0 - idx * 0.04)
    o = compute_outcome(action_id, potential, timing)
    touched = len(base.get('compromised', []))
    o['affected'] = max(touched, o['affected'])
    assets = {k: dict(v) for k, v in base['assets'].items()}
    for aid, a in assets.items():
        if a['state'] in ('COMPROMISED', 'SUSPICIOUS'):
            a['state'] = 'CONTAINED'
            a['contained'] = True
    graph = dict(base['graph'])
    graph['edges'] = [e for e in graph['edges'] if e.get('kind') != 'active'] or graph['edges']
    snap = dict(base)
    snap['assets'] = assets
    snap['graph'] = graph
    snap['contained'] = True
    snap['completed'] = decision == 'APPROVED'
    snap['approved_action'] = action_id
    snap['actual_outcome'] = o
    snap['risk_score'] = round(max(12.0, base['risk_score'] * (0.28 if action_id != 'no_action' else 1.0)), 1)
    snap['status'] = 'CONTAINED' if decision == 'APPROVED' else 'PENDING'
    if action_id != 'no_action':
        snap['prediction'] = None
        snap['attacker_position'] = None
        # attacker adaptation: if a foothold existed beyond origin, note alternate path candidate
        if touched > 1:
            snap['adaptation_note'] = 'Alternate simulated path identified from remaining foothold — contained before further spread.'
    return snap, o


def simulate_branch(run, idx, action_id, earlier=0):
    """Counterfactual branch (independent; the real run is not mutated)."""
    snap = snapshot_at(run, idx)
    potential = snap['blast_radius']['potential_affected_count'] or 8
    timing = max(0.1, 1.0 - (idx - earlier) * 0.04)
    o = compute_outcome(action_id, potential, timing)
    no = compute_outcome('no_action', potential, timing)
    return {
        'action_id': action_id,
        'label': PROFILES.get(action_id, {}).get('label', action_id),
        'outcome': o,
        'no_action_outcome': no,
        'branch_snapshot': _branch_asset_states(snap, action_id),
        'simulated': True,
    }


def _branch_asset_states(snap, action_id):
    assets = snap.get('assets', {})
    out = {}
    contained_hosts = set()
    if action_id in ('isolate_endpoint', 'isolate_revoke'):
        contained_hosts.add(snap.get('compromised', ['LAB-PC-21'])[0])
    for aid, a in assets.items():
        d = dict(a)
        if aid in contained_hosts:
            d['state'] = 'CONTAINED'
            d['contained'] = True
        out[aid] = d
    return out


def summarize(run, idx, action_id, decision, contained_state):
    """Finalize summary metrics used for Incident Summary / Defense Regret."""
    base = snapshot_at(run, idx)
    peak = base['risk_score']
    o = contained_state.get('actual_outcome') or compute_outcome(action_id, base['blast_radius']['potential_affected_count'] or 8, 1.0)
    no = compute_outcome('no_action', base['blast_radius']['potential_affected_count'] or 8, 0.3)
    avoid = max(0, (no['affected'] or 0) - (o['affected'] or 0))
    return {
        'origin': run['path'][0],
        'path': run['path'],
        'peak_risk': int(peak),
        'affected': o['affected'],
        'no_action_affected': no['affected'],
        'avoidable_exposure': avoid,
        'downtime_h': o.get('downtime_h', 1.0),
        'defense_regret': round(no['affected'] - o['affected'], 0),
        'action': action_id,
        'decision': decision,
        'contained': decision == 'APPROVED' and action_id != 'no_action',
        'impact': o.get('impact', 'HIGH'),
        'confidence': int(o.get('confidence', 0) * 100) if o.get('confidence') else 0,
    }


def incident_id(store_list_len):
    return f"RXT-{str(store_list_len + 1).zfill(4)}"
