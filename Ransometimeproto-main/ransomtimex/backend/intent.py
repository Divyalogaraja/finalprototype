"""AI Attack Intent Engine — correlates events to infer attacker intent."""
ATTACK_KILLCHAIN = [
    "Initial Access", "Execution", "Credential Access", "Privilege Escalation",
    "Lateral Movement", "Impact / Ransomware Preparation",
]

INTENT_RULES = [
    {
        "name": "RANSOMWARE PREPARATION",
        "requires": ["mass_file_modification", "credential_access", "privilege_escalation"],
        "description": "Mass file modification combined with credential and privilege activity is the classic ransomware preparation pattern.",
    },
    {
        "name": "PROPAGATION / RECOVERY DISRUPTION",
        "requires": ["privilege_escalation", "lateral_movement", "backup_access_attempt"],
        "description": "Privileged lateral movement toward backup/recovery infrastructure indicates intent to disrupt recovery.",
    },
    {
        "name": "LATERAL MOVEMENT TOWARD CRITICAL STORAGE",
        "requires": ["lateral_movement", "file_server_access"],
        "description": "Movement toward central file storage points at broad-encryption objectives.",
    },
]

INTENT_SENTENCE = {
    "RANSOMWARE PREPARATION": "Ransomware preparation on the endpoint: mass file modification, credential access and privilege escalation are being correlated.",
    "PROPAGATION / RECOVERY DISRUPTION": "Credential-enabled propagation and recovery disruption toward backup infrastructure.",
    "LATERAL MOVEMENT TOWARD CRITICAL STORAGE": "Credential-enabled lateral movement toward critical storage infrastructure.",
}


def infer_intent(present: dict) -> dict:
    best = None
    best_matched = 0
    for rule in INTENT_RULES:
        matched = sum(1 for r in rule["requires"] if present.get(r))
        if matched > best_matched:
            best = rule
            best_matched = matched
    if best is None:
        return {"stage": "Observing", "intent": None, "confidence": 0.0,
                "sentence": "No correlated intent yet — monitoring signals.",
                "evidence": [], "progress": 0}
    total_required = len(best["requires"])
    conf = round(0.5 + 0.5 * (best_matched / total_required), 2)
    # add supporting evidence
    evidence = [k for k in best["requires"] if present.get(k)]
    sentence = INTENT_SENTENCE.get(best["name"], best["description"])
    return {"stage": best["name"], "intent": best["name"],
            "confidence": conf, "sentence": sentence,
            "evidence": evidence, "progress": best_matched}
