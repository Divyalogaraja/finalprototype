"""
Safe demo scenarios. These are PURE SYNTHETIC event sequences.
No real encryption, no credential theft, no lateral movement is executed.
"""
from dataclasses import dataclass
from typing import List

@dataclass
class ScenarioEvent:
    timestamp: str      # HH:MM:SS
    asset: str
    event_type: str
    severity: str       # low | medium | high | critical
    confidence: float
    mitre: str
    note: str

@dataclass
class Scenario:
    id: str
    name: str
    initial: str          # starting asset
    description: str
    events: List[ScenarioEvent]

# ------- SCENARIO 1 : phishing-led credential compromise -------
SCENARIO_1 = Scenario(
    id="S1",
    name="Phishing-led Credential Compromise",
    initial="LAB-PC-21",
    description="Credential compromise flows into privilege escalation, lateral movement and ransomware preparation.",
    events=[
        ScenarioEvent("10:01:00","LAB-PC-21","phishing_delivery","medium",0.70,"T1566","Suspicious attachment opened on student workstation"),
        ScenarioEvent("10:01:22","u-student-2147","credential_access","high",0.80,"T1078","Valid account used from suspicious host"),
        ScenarioEvent("10:02:14","LAB-PC-21","suspicious_process","high",0.86,"T1059","PowerShell spawns with encoded arguments"),
        ScenarioEvent("10:02:40","LAB-PC-21","mass_file_modification","high",0.93,"T1486","Mass file write / modify burst on local drives"),
        ScenarioEvent("10:03:02","LAB-PC-21","privilege_escalation","high",0.84,"T1068","Local privilege escalation attempt observed"),
        ScenarioEvent("10:04:00","FAC-PC-07","lateral_movement","high",0.82,"T1021","Credential reuse across remote service"),
        ScenarioEvent("10:05:12","FAC-PC-07","file_server_access","critical",0.90,"T1486","Suspicious access to FILE-SRV-01 share"),
        ScenarioEvent("10:06:03","FILE-SRV-01","mass_file_modification","critical",0.95,"T1486","Encryption-like I/O pattern on file server"),
        ScenarioEvent("10:06:47","FILE-SRV-01","backup_access_attempt","critical",0.89,"T1490","Attempt to reach backup server / shadow copies"),
    ],
)

# ------- SCENARIO 2 : compromised endpoint (primary demo) -------
SCENARIO_2 = Scenario(
    id="S2",
    name="Compromised Endpoint (Primary)",
    initial="LAB-PC-21",
    description="Endpoint suspicious process cascades into mass file modification, credential access, lateral movement and backup targeting.",
    events=[
        ScenarioEvent("10:01:00","LAB-PC-21","suspicious_process","medium",0.72,"T1059","Command and Scripting Interpreter: PowerShell activity"),
        ScenarioEvent("10:02:14","LAB-PC-21","mass_file_modification","high",0.93,"T1486","Mass file modification burst detected"),
        ScenarioEvent("10:02:33","LAB-PC-21","rapid_file_rename","high",0.87,"T1486","Rapid file renaming pattern across documents"),
        ScenarioEvent("10:03:05","u-student-2147","credential_access","high",0.85,"T1078","Valid Accounts: credential use outside baseline"),
        ScenarioEvent("10:04:00","LAB-PC-21","privilege_escalation","high",0.83,"T1068","Privilege escalation toward admin rights"),
        ScenarioEvent("10:05:11","FAC-PC-07","lateral_movement","high",0.81,"T1021","Remote Services: lateral movement to faculty PC"),
        ScenarioEvent("10:06:02","FILE-SRV-01","file_server_access","critical",0.92,"T1486","File server share accessed with encryption pattern"),
        ScenarioEvent("10:07:00","BACKUP-SRV-01","backup_access_attempt","critical",0.90,"T1490","Inhibit System Recovery: backup access attempt"),
    ],
)

SCENARIOS = {"S1": SCENARIO_1, "S2": SCENARIO_2}

# lightweight event -> stage mapping for the demo timeline
STAGE_OF_EVENT = {
    "phishing_delivery": "Initial Access",
    "suspicious_process": "Initial Suspicious Process",
    "mass_file_modification": "Mass File Modification",
    "rapid_file_rename": "Mass File Modification",
    "credential_access": "Credential Access",
    "privilege_escalation": "Privilege Escalation",
    "lateral_movement": "Lateral Movement",
    "file_server_access": "File Server Targeted",
    "backup_access_attempt": "Backup / Recovery Targeted",
}
