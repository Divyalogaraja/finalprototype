"""Attack graph reconstruction (NetworkX), next-target prediction, blast radius."""
import networkx as nx
from assets import CRITICALITY_RANK

# Static reachability of the fictional network (SYNTHETIC).
REACH = {
    "LAB-PC-21": ["LAB-PC-22", "FAC-PC-07", "FILE-SRV-01", "AD-SRV-01", "NET-SEG-CORE"],
    "LAB-PC-22": ["LAB-PC-21", "FILE-SRV-01", "AD-SRV-01", "NET-SEG-CORE"],
    "FAC-PC-07": ["FILE-SRV-01", "ADMIN-PC-03", "ERP-SRV-01", "AD-SRV-01", "NET-SEG-CORE"],
    "ADMIN-PC-03": ["AD-SRV-01", "ERP-SRV-01", "LMS-SRV-01", "BACKUP-SRV-01", "NET-SEG-CORE"],
    "FILE-SRV-01": ["ERP-SRV-01", "LMS-SRV-01", "BACKUP-SRV-01", "AD-SRV-01", "NET-SEG-CORE"],
    "ERP-SRV-01": ["LMS-SRV-01", "BACKUP-SRV-01", "FILE-SRV-01", "AD-SRV-01", "NET-SEG-CORE"],
    "LMS-SRV-01": ["BACKUP-SRV-01", "ERP-SRV-01", "AD-SRV-01", "NET-SEG-CORE"],
    "BACKUP-SRV-01": ["FILE-SRV-01", "AD-SRV-01", "NET-SEG-CORE"],
    "AD-SRV-01": ["ERP-SRV-01", "LMS-SRV-01", "BACKUP-SRV-01", "FILE-SRV-01", "ADMIN-PC-03", "NET-SEG-CORE"],
    "NET-SEG-CORE": ["LAB-PC-21", "LAB-PC-22", "FAC-PC-07", "ADMIN-PC-03", "FILE-SRV-01", "ERP-SRV-01", "LMS-SRV-01", "BACKUP-SRV-01", "AD-SRV-01"],
}

CRIT_ORDER = {"Backup": 0, "Database": 0, "Server": 1, "Endpoint": 2, "Network Segment": 3}

def build_graph(assets: dict, compromised: list, predicted: str = None,
                attacker_position: str = None, signals: dict = None):
    """Return React-Flow style node/edge JSON plus computed metrics."""
    G = nx.DiGraph()
    for aid, a in assets.items():
        G.add_node(aid)
    for src, dsts in REACH.items():
        for d in dsts:
            if src in assets and d in assets:
                G.add_edge(src, d)

    compromised_set = set(compromised)
    active_edges = []
    # mark lateral movement edges between consecutive compromised hops
    if len(compromised) > 1:
        for i in range(len(compromised) - 1):
            active_edges.append((compromised[i], compromised[i + 1], "LATERAL_MOVEMENT"))

    nodes = []
    for aid, a in assets.items():
        state = a.state
        is_compromised = aid in compromised_set
        node_type = a.asset_type
        nodes.append({
            "id": aid,
            "label": a.asset_id,
            "sub": a.name,
            "type": node_type,
            "criticality": a.criticality,
            "risk": a.risk,
            "state": state,
            "compromise_probability": a.compromise_probability,
            "compromised": is_compromised,
            "predicted_next": (aid == predicted),
            "attacker_position": (aid == attacker_position),
        })

    edges = []
    seen = set()
    for src, dst, _lab in active_edges:
        edges.append({"id": f"{src}-{dst}-act", "source": src, "target": dst,
                      "label": "LATERAL_MOVEMENT", "kind": "active", "animated": True})
        seen.add((src, dst))
    for src, dst in G.edges():
        if (src, dst) in seen:
            continue
        kind = "CAN_ACCESS"
        edges.append({"id": f"{src}-{dst}", "source": src, "target": dst,
                      "label": kind, "kind": "passive", "animated": False})

    # blast radius reachable set from compromised frontier
    frontier = compromised
    exposed = set()
    for c in frontier:
        for d in REACH.get(c, []):
            if d not in compromised_set:
                exposed.add(d)
    exposed = sorted(exposed, key=lambda x: CRITICALITY_RANK[assets[x].criticality], reverse=True)
    return {"nodes": nodes, "edges": edges, "exposed": exposed,
            "compromised": list(compromised)}


# Ransomware impact targets: storage / recovery servers the attacker wants to encrypt.
# Directory/network infrastructure is used to move but is NOT the encryption target.
IMPACT_TARGETS = {"FILE-SRV-01", "ERP-SRV-01", "LMS-SRV-01", "BACKUP-SRV-01"}
INFRA_TARGETS = {"AD-SRV-01", "NET-SEG-CORE"}


def predict_next(assets: dict, compromised: list, signals: dict = None):
    """Score reachable, not-yet-compromised assets as next targets.

    For ransomware intent the model biases toward reachable impact targets
    (file/ERP/LMS/backup servers), consistent with attacker storage objectives,
    and down-weights pure infrastructure hops (directory/network).
    """
    compromised_set = set(compromised)
    candidates = {}
    auth_recent = (signals or {}).get("credential_access", False)
    ransomware = (signals or {}).get("mass_file_modification", False)
    for c in compromised:
        for d in REACH.get(c, []):
            if d in compromised_set or d not in assets:
                continue
            a = assets[d]
            crit = CRITICALITY_RANK[a.criticality]
            base = 40.0 + (crit - 1) * 8.0
            if auth_recent:
                base += 6.0
            if ransomware:
                if d in IMPACT_TARGETS:
                    base += 34.0
                if d in INFRA_TARGETS:
                    base -= 40.0
            candidates[d] = base + (candidates.get(d, 0.0))

    if not candidates:
        return None
    # If ransomware intent present, prefer impact targets even if an infra hop is nearer.
    if ransomware and any(d in IMPACT_TARGETS for d in candidates):
        for d in list(candidates):
            if d not in IMPACT_TARGETS:
                candidates[d] = max(candidates.get(d, 0), 0) * 0.35

    top = sorted(candidates.items(), key=lambda kv: kv[1], reverse=True)[:4]
    ranking = []
    maxv = max(candidates.values()) if candidates else 1
    for aid, raw in top:
        a = assets[aid]
        crit = CRITICALITY_RANK[a.criticality]
        conf = round(55 + 42 * (raw / maxv) + crit * 1.5, 1)
        conf = max(47.0, min(97.0, conf))
        auth_txt = "recent authentication relationship" if auth_recent else "network adjacency"
        reasons = [
            "reachable from compromised endpoint",
            "high asset criticality" if crit >= 2 else "moderate asset criticality",
            auth_txt,
            "attacker behavior matches lateral movement pattern",
        ]
        if aid in IMPACT_TARGETS:
            reasons.append("storage/impact asset consistent with ransomware objective")
        ranking.append({"asset": aid, "confidence": conf, "criticality": a.criticality,
                        "reasons": reasons})
    ranking.sort(key=lambda r: r["confidence"], reverse=True)
    predicted = ranking[0]["asset"] if ranking else None
    return {"ranking": ranking, "predicted": predicted,
            "lead_time_seconds": int(30 + len(ranking) * 4),
            "confidence": ranking[0]["confidence"] if ranking else 0}


def blast_radius(assets: dict, compromised: list, exposed: list):
    compromised_set = set(compromised)
    current_affected = compromised
    potential = list(dict.fromkeys(exposed + [c for c in compromised]))  # combined for viz
    potential_assets = len(compromised) + len(exposed)
    critical_exposed = [e for e in (compromised + exposed) if assets[e].criticality in ("High", "Critical")]
    backup_exposed = any(a.asset_type == "Backup" for a in
                         [assets[e] for e in (compromised + exposed) if e in assets])
    return {
        "current_affected": compromised,
        "current_affected_count": len(current_affected),
        "potential_affected": potential,
        "potential_affected_count": potential_assets,
        "critical_exposed": critical_exposed,
        "critical_exposed_count": len(critical_exposed),
        "backup_exposure": "HIGH" if backup_exposed else "LOW",
    }
