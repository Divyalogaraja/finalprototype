"""False-positive reduction demo: context beats isolated signals."""

CONTEXT_STEPS = [
    {"label": "PowerShell only (benign admin)",
     "present": {"suspicious_process": True},
     "risk": 18, "note": "Matches normal administrative activity."},
    {"label": "PowerShell + mass file modification",
     "present": {"suspicious_process": True, "mass_file_modification": True},
     "risk": 68, "note": "Two correlated signals — elevated but not conclusive."},
    {"label": "+ credential access",
     "present": {"suspicious_process": True, "mass_file_modification": True,
                 "credential_access": True},
     "risk": 83, "note": "Three signals align with ransomware preparation."},
    {"label": "+ lateral movement",
     "present": {"suspicious_process": True, "mass_file_modification": True,
                 "credential_access": True, "lateral_movement": True},
     "risk": 93, "note": "Full behavioral chain confirms propagation intent."},
]

BENIGN_ACTIVITIES = [
    {"name": "Normal PowerShell", "signals": ["suspicious_process"], "risk": 18,
     "verdict": "BENIGN"},
    {"name": "Large legitimate file copy", "signals": ["mass_file_modification"], "risk": 25,
     "verdict": "BENIGN"},
    {"name": "Backup operation", "signals": ["mass_file_modification", "file_server_access"], "risk": 37,
     "verdict": "BENIGN — schedule-aligned"},
    {"name": "Software update", "signals": ["suspicious_process", "suspicious_network"], "risk": 24,
     "verdict": "BENIGN"},
    {"name": "Bulk file rename (approved app)", "signals": ["rapid_file_rename"], "risk": 15,
     "verdict": "BENIGN"},
]

ISOLATED = {"name": "Single alert in isolation", "risk": 18,
            "message": "An isolated signal (e.g. PowerShell alone) stays LOW — never auto-triggers ransomware."}
