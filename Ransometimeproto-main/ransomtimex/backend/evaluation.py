"""Evaluation dashboard: rule-based baseline vs RansomTime-X (SIMULATED metrics)."""
METRICS = [
    {"metric": "Precision", "baseline": 71.0, "rtx": 93.0, "unit": "%", "higher": True},
    {"metric": "Recall", "baseline": 82.0, "rtx": 96.0, "unit": "%", "higher": True},
    {"metric": "F1 Score", "baseline": 0.76, "rtx": 0.94, "unit": "", "higher": True},
    {"metric": "False Positive Rate", "baseline": 24.0, "rtx": 6.0, "unit": "%", "higher": False},
    {"metric": "Detection Latency", "baseline": 95.0, "rtx": 14.0, "unit": "s", "higher": False},
    {"metric": "Prediction Accuracy", "baseline": 0.0, "rtx": 0.91, "unit": "", "higher": True},
    {"metric": "Top-3 Target Accuracy", "baseline": 0.0, "rtx": 0.87, "unit": "", "higher": True},
    {"metric": "Prediction Lead Time", "baseline": 0.0, "rtx": 42.0, "unit": "s", "higher": True},
    {"metric": "Containment Rate", "baseline": 0.0, "rtx": 96.0, "unit": "%", "higher": True},
    {"metric": "Time to Containment", "baseline": 0.0, "rtx": 60.0, "unit": "min", "higher": False},
    {"metric": "Systems Affected", "baseline": 8.0, "rtx": 2.0, "unit": "", "higher": False},
    {"metric": "Intervention Accuracy", "baseline": 0.0, "rtx": 0.89, "unit": "", "higher": True},
    {"metric": "Counterfactual Consistency", "baseline": 0.0, "rtx": 0.94, "unit": "", "higher": True},
    {"metric": "Estimated Downtime", "baseline": 18.0, "rtx": 1.0, "unit": "h", "higher": False},
    {"metric": "Estimated Exposure", "baseline": 100.0, "rtx": 12.0, "unit": "%", "higher": False},
    {"metric": "Simulated Recovery Cost", "baseline": 100.0, "rtx": 22.0, "unit": "idx", "higher": False},
    {"metric": "Playbook Improvement", "baseline": 0.0, "rtx": 1.0, "unit": "ver", "higher": True},
]

NOTE = "SIMULATED / EXPERIMENTAL RESULTS on synthetic demo data. Not a claim about real-world performance."
