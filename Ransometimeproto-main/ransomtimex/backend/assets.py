"""
RansomTime-X — Fictional asset catalog & sample organization.
This is SYNTHETIC data for a safe demo. No connection to any real network.
"""
from dataclasses import dataclass, field
from typing import List


@dataclass
class Asset:
    asset_id: str
    asset_type: str          # Endpoint | Server | Database | Backup | Network Segment
    name: str
    criticality: str         # Medium | High | Critical
    role: str
    ip: str
    os: str
    services: List[str] = field(default_factory=list)
    # live state
    risk: float = 0.0
    state: str = "HEALTHY"   # HEALTHY | SUSPICIOUS | COMPROMISED | CONTAINED | OFFLINE
    compromise_probability: float = 0.0
    contained: bool = False

    def to_dict(self, include_state=True):
        d = {
            "asset_id": self.asset_id,
            "asset_type": self.asset_type,
            "name": self.name,
            "criticality": self.criticality,
            "role": self.role,
            "ip": self.ip,
            "os": self.os,
            "services": self.services,
        }
        if include_state:
            d.update({
                "risk": round(self.risk, 1),
                "state": self.state,
                "compromise_probability": round(self.compromise_probability, 3),
                "contained": self.contained,
            })
        return d


CRITICALITY_RANK = {"Medium": 1, "High": 2, "Critical": 3}


def build_assets() -> dict:
    """RMK College Cyber Defense Center (fictional sample)."""
    assets = [
        Asset("LAB-PC-21", "Endpoint", "Lab PC 21", "Medium", "Student lab workstation",
              "10.20.1.21", "Windows 11"),
        Asset("LAB-PC-22", "Endpoint", "Lab PC 22", "Medium", "Student lab workstation",
              "10.20.1.22", "Windows 11"),
        Asset("FAC-PC-07", "Endpoint", "Faculty PC 07", "Medium", "Faculty workstation",
              "10.20.2.7", "Windows 11"),
        Asset("ADMIN-PC-03", "Endpoint", "Admin PC 03", "High", "IT administration workstation",
              "10.20.3.3", "Windows 11"),
        Asset("FILE-SRV-01", "Server", "File Server 01", "High", "Shared network file store",
              "10.20.10.10", "Windows Server 2022", ["SMB", "AD services"]),
        Asset("ERP-SRV-01", "Server", "ERP Server 01", "Critical", "Enterprise resource planning",
              "10.20.10.20", "Linux RHEL", ["ERP web", "DB client"]),
        Asset("LMS-SRV-01", "Server", "LMS Server 01", "Critical", "Learning management system",
              "10.20.10.30", "Linux RHEL", ["LMS web", "DB client"]),
        Asset("BACKUP-SRV-01", "Backup", "Backup Server 01", "Critical", "Backup & recovery",
              "10.20.20.10", "Linux RHEL", ["Veeam agent", "SMB"]),
        Asset("AD-SRV-01", "Server", "Active Directory 01", "Critical", "Directory services",
              "10.20.5.5", "Windows Server 2022", ["LDAP", "DNS", "Kerberos"]),
        Asset("NET-SEG-CORE", "Network Segment", "Core Network Segment", "High",
              "Campus core switching", "10.20.0.1", "Cisco IOS", ["routing", "switching"]),
    ]
    return {a.asset_id: a for a in assets}


# Service accounts / credentials referenced during simulation
USERS = {
    "u-student-2147": {"username": "srahman21", "type": "Student", "risk": "Medium"},
    "u-faculty-312": {"username": "dsharma", "type": "Faculty", "risk": "Medium"},
    "u-svc-backup": {"username": "svc_veeam", "type": "Service Account", "risk": "High"},
    "u-admin-009": {"username": "admin_it", "type": "Administrator", "risk": "Critical"},
}
