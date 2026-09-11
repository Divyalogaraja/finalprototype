// Thin fetch wrapper. All calls are relative so they work behind the Vite dev
// proxy (→ FastAPI :8000) and when served from FastAPI in production.
async function j(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status} ${url} ${body.slice(0, 200)}`)
  }
  return res.json()
}

export const api = {
  state: () => j('/api/state'),
  incidents: () => j('/api/incidents'),
  memory: () => j('/api/memory'),
  audit: () => j('/api/audit'),
  decisions: () => j('/api/decisions'),
  evaluation: () => j('/api/evaluation'),
  evaluationRun: () => j('/api/evaluation/run', { method: 'POST', body: JSON.stringify({}) }),
  evaluationReset: () => j('/api/evaluation/reset', { method: 'POST', body: JSON.stringify({}) }),
  evaluationReport: () => j('/api/evaluation/report'),
  falsePositive: () => j('/api/false-positive'),
  scenarios: () => j('/api/scenarios'),
  intervention: (sid = 'S2') => j(`/api/intervention/${sid}`),
  sigmaRules: () => j('/api/sigma-rules'),
  playbook: () => j('/api/playbook'),
  profile: () => j('/api/profile'),
  updateProfile: (payload) => j('/api/profile', { method: 'POST', body: JSON.stringify(payload) }),
  startSim: (scenario_id = 'S2', speed_ms = 650) =>
    j('/api/simulation/start', { method: 'POST', body: JSON.stringify({ scenario_id, speed_ms }) }),
  recommend: () => j('/api/defense/recommend', { method: 'POST', body: JSON.stringify({}) }),
  simulateDefense: (action_id) =>
    j('/api/defense/simulate', { method: 'POST', body: JSON.stringify({ action_id }) }),
  approve: (payload) =>
    j('/api/defense/approve', { method: 'POST', body: JSON.stringify(payload) }),
  rejectDefense: (payload) =>
    j('/api/defense/reject', { method: 'POST', body: JSON.stringify(payload || {}) }),
  complete: (payload) =>
    j('/api/incident/complete', { method: 'POST', body: JSON.stringify(payload) }),
  replay: (scenario_id, action_id, intervention_idx) =>
    j('/api/replay', { method: 'POST', body: JSON.stringify({ scenario_id, action_id, intervention_idx }) }),
  counterfactual: (scenario_id, intervention_idx) =>
    j('/api/counterfactual/run', { method: 'POST', body: JSON.stringify({ scenario_id, action_id: 'no_action', intervention_idx }) }),
  robustness: (defense, scenario_id = 'S2') =>
    j('/api/robustness/test', { method: 'POST', body: JSON.stringify({ defense, scenario_id }) }),
  playbookPropose: () => j('/api/playbook/propose', { method: 'POST', body: JSON.stringify({}) }),
  playbookApprove: () => j('/api/playbook/approve', { method: 'POST', body: JSON.stringify({}) }),
  playbookReject: () => j('/api/playbook/reject', { method: 'POST', body: JSON.stringify({}) }),
  ai: (question) => j('/api/ai', { method: 'POST', body: JSON.stringify({ question }) }),
  investigator: (question) => j('/api/investigator', { method: 'POST', body: JSON.stringify({ question }) }),
  // ---- dynamic live simulation (backend-authoritative) ----
  liveScenarios: () => j('/api/live/scenarios'),
  liveStart: (cfg = {}) => j('/api/live/start', { method: 'POST', body: JSON.stringify(cfg) }),
  liveState: () => j('/api/live/state'),
  liveAdvance: () => j('/api/live/advance', { method: 'POST', body: JSON.stringify({}) }),
  liveDecision: () => j('/api/live/decision', { method: 'POST', body: JSON.stringify({}) }),
  liveSimulate: (action_id, earlier = 0) => j('/api/live/simulate', { method: 'POST', body: JSON.stringify({ action_id, earlier }) }),
  liveAct: (action_id, decision) => j('/api/live/act', { method: 'POST', body: JSON.stringify({ action_id, decision }) }),
  liveReset: () => j('/api/live/reset', { method: 'POST', body: JSON.stringify({}) }),
}

