# RansomTime-X
**Adaptive Ransomware Defense & Cyber Decision Intelligence Platform**

> Detect. Predict. Decide. Defend. Replay. Learn.

A **safe, simulated** prototype that demonstrates a full **closed-loop** defense concept:
`OBSERVE → DETECT → UNDERSTAND → PREDICT → CHOOSE DEFENSE → CONTAIN → RECONSTRUCT → FIND INTERVENTION WINDOW → REPLAY ALTERNATIVES → MEASURE MISSED IMPACT → LEARN → UPDATE PLAYBOOK → DEFEND BETTER`.

⚠️ **Safety:** This is a hackathon prototype only. It runs a synthetic, state-transition
simulation on a fictional "RMK College Cyber Defense Center". It does **not** encrypt files,
steal credentials, scan real networks or execute destructive commands. Every attack and every
response is a simulated event. No connection to any real network or institution.

---

## The core idea
Instead of static ransomware alerts, RansomTime-X turns each incident into a **decision
instrument**: it reconstructs the attack path, predicts the next target, estimates the blast
radius, finds the **intervention window**, then lets you **replay counterfactual futures** and
measure **how much impact could have been avoided**. Outcomes are written to a **defense
memory**, which proposes a **playbook update** that improves the *next* simulated defense.

## Architecture

```
ransomtimex/
├── backend/                 # FastAPI + deterministic/ML simulation engine
│   ├── assets.py            # fictional asset catalog & criticality
│   ├── scenarios.py         # 2 safe synthetic scenarios (S1, S2)
│   ├── mitre.py             # MITRE ATT&CK technique labels
│   ├── detection.py         # weighted risk engine + IsolationForest (scikit-learn)
│   ├── intent.py            # AI attack-intent engine (rule correlation)
│   ├── graph.py             # NetworkX attack graph + next-target prediction + blast radius
│   ├── outcome.py           # single source of truth for simulated outcomes
│   ├── defense.py           # min-disruption defense optimizer + HITL approval tiers
│   ├── attribution.py       # counterfactual replay / missed impact / defense regret / robustness
│   ├── ai_investigator.py   # explanation + Q&A only (LLM never decides)
│   ├── store.py             # SQLite persistence: incidents, decisions, memory, playbooks, audit
│   ├── sigma_rules.yaml     # Sigma-inspired YAML detection rules
│   └── main.py              # FastAPI app + endpoints + WebSocket
└── frontend/                # React + Vite + Tailwind + React Flow + Recharts
    └── src/
        ├── store/SimContext.jsx   # single simulation state driving the whole UI
        ├── components/            # layout, approval modal, time machine, widgets, common
        └── pages/                 # 11 nav screens
```

## Running it
**Option A — single server (recommended, no Node needed at runtime).** Build the
frontend once, then FastAPI serves the whole app + API on one port:
```bash
cd frontend && npm install && npm run build   # create dist/ (only needed once)
cd ../backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000   # open http://localhost:8000
```
**Option B — dev mode** (live-reload frontend):
```bash
# terminal 1
cd backend && uvicorn main:app --host 0.0.0.0 --port 8000
# terminal 2
cd frontend && npm install && npm run dev     # proxies /api -> :8000, open :5173
```

## How to demo the closed loop (≈2–3 min)
1. **Command Center** — live decision posture of an ongoing simulated incident (behavioral risk,
   predicted target, blast radius, recommended defense, "what is happening / where / do / if not").
2. Press **Run Safe Simulation** → events stream live; risk climbs; the attack graph reconstructs.
3. It auto-pauses at the **decision window** → an **approval modal** appears with the
   minimum-disruption recommendation (Isolate + Revoke). Choose **Simulate First**, **Approve**, **Modify** or **Reject**.
4. On **Approve** the incident completes: containment shown, **defense regret / missed impact** computed,
   incident logged, **defense memory** written, and a **playbook update is proposed**.
5. Explore **Intervention Window** (drag the slider), **Counterfactual Replay** (the USP), **Alternate
   Reality**, **Defense Intelligence** (robustness), **Learning & Playbooks**, **Incident History & Eval**,
   and the **AI Investigator**. Or press **3-min Demo** for a guided tour.

## API (FastAPI)
`GET /api/incidents · /incidents/{id} · /events · /assets · /attack-graph · /predictions · /state ·
/intervention/{scenario} · /scenarios · /memory · /audit · /playbook · /evaluation · /false-positive ·
/ai?question=… · /sigma-rules · /system`

`POST /api/simulation/start · /defense/recommend · /defense/approve · /defense/simulate · /replay ·
/counterfactual/run · /robustness/test · /playbook/propose · /playbook/approve · /incident/complete`

WebSocket: `/ws/events` (live event streaming).

## Honest caveats
- All telemetry, asset data and impact/cost numbers are **SIMULATED / ESTIMATED** for a fictional org.
  They are not claims about real-world detection performance.
- An **LLM is not connected** in this build. The AI Investigator answers from the deterministic engine's
  recorded telemetry via a template grounding layer, so the same safety guarantees apply offline. A real
  LLM could be plugged into `ai_investigator.py` behind the existing evidence interface without ever
  giving it a raw decision.
- IsolationForest/scikit-learn provide the ML anomaly signal; detection remains explainable and weighted.
