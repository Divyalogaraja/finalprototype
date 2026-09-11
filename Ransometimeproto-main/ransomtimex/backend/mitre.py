"""MITRE ATT&CK mappings used for labeling synthetic events."""
MITRE = {
    "phishing_delivery":        {"id": "T1566.001", "name": "Phishing", "tactic": "Initial Access"},
    "suspicious_process":       {"id": "T1059", "name": "Command and Scripting Interpreter", "tactic": "Execution"},
    "mass_file_modification":   {"id": "T1486", "name": "Data Encrypted for Impact", "tactic": "Impact"},
    "rapid_file_rename":        {"id": "T1486", "name": "Data Encrypted for Impact", "tactic": "Impact"},
    "credential_access":        {"id": "T1078", "name": "Valid Accounts", "tactic": "Defense Evasion / Lateral Movement"},
    "privilege_escalation":     {"id": "T1068", "name": "Exploitation for Privilege Escalation", "tactic": "Privilege Escalation"},
    "lateral_movement":         {"id": "T1021", "name": "Remote Services", "tactic": "Lateral Movement"},
    "file_server_access":       {"id": "T1486", "name": "Data Encrypted for Impact", "tactic": "Impact"},
    "backup_access_attempt":    {"id": "T1490", "name": "Inhibit System Recovery", "tactic": "Impact"},
    "suspicious_network":       {"id": "T1041", "name": "Exfiltration Over C2 Channel", "tactic": "Exfiltration"},
    "command_scripting":        {"id": "T1059.001", "name": "PowerShell", "tactic": "Execution"},
}
