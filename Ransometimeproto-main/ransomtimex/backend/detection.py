"""
Behavioral Ransomware Detection.

Detection is DETERMINISTIC + ML ONLY. The LLM never makes detection decisions.

A weighted multi-signal risk engine combines behavioral signals rather than
relying on file extensions. An IsolationForest (scikit-learn) independently
scores the event-feature vector as an anomaly; the final confidence blends the
rule score and the ML anomaly score.
"""
from typing import Dict, List
import numpy as np
from sklearn.ensemble import IsolationForest

# Weighted signals (spec §5)
SIGNAL_WEIGHTS = {
    "phishing_delivery": 5,
    "suspicious_process": 8,
    "command_scripting": 6,
    "mass_file_modification": 25,
    "rapid_file_rename": 15,
    "credential_access": 15,
    "privilege_escalation": 15,
    "suspicious_network": 10,
    "lateral_movement": 15,
    "file_server_access": 12,
    "backup_access_attempt": 10,
}
BENIGN_COUNTERWEIGHT = 8  # benign activity reduces score (context)

# signal feature order for IsolationForest
FEATURES = list(SIGNAL_WEIGHTS.keys()) + ["benign_activity", "io_burst", "credential_surface"]

def _feature_vector(counts: Dict[str, int], benign: int) -> np.ndarray:
    return np.array([[counts.get(k, 0) for k in SIGNAL_WEIGHTS] + [benign, min(counts.get("mass_file_modification", 0) * 2, 10), counts.get("credential_access", 0)]])


def train_isolation_forest(seed: int = 7) -> IsolationForest:
    """Fit an IsolationForest on synthetic benign-vs-malicious feature vectors."""
    rng = np.random.default_rng(seed)
    benign = []
    malicious = []
    for _ in range(220):
        benign.append([0, rng.integers(0, 1), 0, 0, 0, rng.integers(0, 1), 0, 0, 0, 0, 0,
                       rng.integers(2, 8), 0, rng.integers(0, 1)])
    for _ in range(220):
        m = [0, 1, 1, rng.integers(1, 4), rng.integers(1, 3), 1, 1, 1, rng.integers(0, 2),
             0, 1, 0, rng.integers(3, 8), rng.integers(1, 3)]
        malicious.append(m)
    X = np.array(benign + malicious, dtype=float)
    iso = IsolationForest(n_estimators=80, contamination=0.42, random_state=seed)
    iso.fit(X)
    return iso


class RiskEngine:
    def __init__(self, iso_forest=None):
        self.iso = iso_forest or train_isolation_forest()
        self.signal_counts: Dict[str, int] = {k: 0 for k in SIGNAL_WEIGHTS}
        self.benign_count = 0
        self.reset_probe()

    def reset_probe(self):
        self.signal_counts = {k: 0 for k in SIGNAL_WEIGHTS}
        self.benign_count = 0

    def score(self, present: Dict[str, bool] = None) -> float:
        """Weighted rule score 0..100."""
        present = present or {}
        total = 0.0
        for k, w in SIGNAL_WEIGHTS.items():
            if present.get(k) or self.signal_counts.get(k, 0) > 0:
                total += w
        total = max(0.0, total - (self.benign_count * BENIGN_COUNTERWEIGHT))
        return round(min(total, 100.0), 1)

    def ml_anomaly(self) -> float:
        """Blend IsolationForest anomaly into a 0..100 confidence."""
        if self.iso is None:
            return 0.0
        X = _feature_vector(self.signal_counts, self.benign_count)
        df = self.iso.decision_function(X)[0]              # lower = more anomalous
        # map decision function to a 0..1 anomaly (benign centroid ~ +0.25, outliers < 0)
        anomaly = float(np.clip(0.5 - df * 1.6, 0.0, 1.0))
        return anomaly * 100

    def combined(self, present: Dict[str, bool] = None) -> float:
        """Deterministic blend of rule score and ML anomaly score."""
        rule = self.score(present)
        ml = self.ml_anomaly()
        return round(0.82 * rule + 0.18 * ml, 1)

    def observe(self, event_type: str, severity: str):
        if event_type in self.signal_counts:
            self.signal_counts[event_type] += 1
        # benign context can offset — events marked benign pass here

    def benign_activity(self):
        self.benign_count += 1

    def level(self, score: float) -> str:
        if score <= 30:
            return "LOW"
        if score <= 60:
            return "MEDIUM"
        if score <= 80:
            return "HIGH"
        return "CRITICAL"

    def evidence(self) -> List[Dict]:
        ev = []
        for k, v in self.signal_counts.items():
            if v > 0:
                ev.append({"signal": k, "count": v})
        return ev

    def breakdown(self) -> List[Dict]:
        return [{"signal": k, "weight": v} for k, v in SIGNAL_WEIGHTS.items()]
