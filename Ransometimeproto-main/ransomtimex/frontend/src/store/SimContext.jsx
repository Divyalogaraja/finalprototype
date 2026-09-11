import React, {
  createContext, useContext, useReducer, useEffect, useRef, useCallback,
} from 'react'
import { api } from '../lib/api'

const Ctx = createContext(null)
export const useSim = () => useContext(Ctx)

const STAGES = ['OBSERVE', 'DETECT', 'UNDERSTAND', 'PREDICT', 'DECIDE',
  'DEFEND', 'REPLAY', 'COMPARE', 'LEARN', 'IMPROVE']

const initial = {
  booting: true,
  error: null,
  phase: 'idle',            // idle | playing | decision | resolved
  scenarioId: 'S2',
  scenarioMeta: null,
  timeline: [],
  steps: [],
  curIndex: 0,
  curStop: 5,               // index at which to pause for decision
  speed: 700,
  live: null,               // active snapshot (a step or approved/contained state)
  statusText: 'STANDBY',
  // decision artifacts
  recommend: null,
  recommendLoading: false,
  approvalOpen: false,
  approveBusy: false,
  approvedAction: null,
  actualOutcome: null,
  contained: false,
  // deep analytics (lazy-loaded per page, cached here)
  counterfactual: null,
  replay: null,
  missedImpact: null,
  robust: null,
  incidents: [],
  memory: [],
  audit: [],
  decisions: [],
  evalData: null,
  falsePos: null,
  playbook: null,
  proposedUpdate: null,
  profile: null,
  aiResult: null,
  aiThinking: false,
  // demo mode
  demo: false,
  demoTick: null,
  // selection & detail
  selectedNode: null,
  activeStage: 'DETECT',
  activeLoop: STAGES.indexOf('DETECT'),
  // ---- dynamic LIVE run (backend-authoritative, HTTP-stepped) ----
  liveMeta: null,        // run metadata (incident_id, scenario, seed, path)
  liveIdx: -1,
  livePhase: 'idle',     // idle | running | decision | resolved
  livePaused: false,
  liveSpeed: 1,
  liveDecision: null,    // decision payload from /api/live/decision
  liveSummary: null,
  liveAction: null,
  liveContained: false,
  liveSimulated: {},     // action_id -> branch result
  liveScenarios: null,
}

function decisionIndex(steps) {
  for (let i = 0; i < steps.length; i++) {
    const et = steps[i]?.event?.event_type
    if (et === 'lateral_movement' || et === 'file_server_access') return i
  }
  return Math.max(0, steps.length - 2)
}

// Find a pending (not-yet-approved) playbook proposal in version history.
function pendingProposal(pb) {
  if (!pb || !Array.isArray(pb.versions)) return null
  const p = pb.versions.find(v => (v.state || '').toUpperCase() === 'PROPOSED')
  if (!p) return null
  // normalise into the shape the UI expects
  return {
    name: p.name, version: p.version, state: 'PROPOSED',
    rationale: p.rationale || 'Review the proposed playbook change.', updated: p.updated || null,
  }
}

function reducer(s, a) {
  switch (a.type) {
    case 'BOOT_OK': return { ...s, booting: false, scenarioMeta: a.meta, incidents: a.incidents }
    case 'BOOT_ERR': return { ...s, booting: false, error: a.msg }
    case 'SET_ERROR': return { ...s, error: a.msg, approveBusy: false, recommendLoading: false, aiThinking: false }
    case 'LIVE_META': return { ...s, liveMeta: a.meta, livePhase: a.phase || 'running', liveIdx: -1, livePaused: false, liveDecision: null, liveSummary: null, liveAction: null, liveSimulated: {}, liveContained: false, scenarioId: a.meta?.scenario || s.scenarioId, recommend: null, missedImpact: null, counterfactual: null, phase: 'playing', statusText: 'DETECTING' }
    case 'LIVE_SNAP': return { ...s, live: a.snapshot, liveIdx: a.index, livePaused: a.paused ?? s.livePaused, statusText: a.snapshot?.risk_level || s.statusText }
    case 'LIVE_PHASE': return { ...s, livePhase: a.phase }
    case 'LIVE_DECISION': return { ...s, liveDecision: a.payload, livePhase: 'decision', phase: 'decision', statusText: 'DECISION WINDOW', recommend: a.payload?.recommendation || s.recommend }
    case 'LIVE_SIM': return { ...s, liveSimulated: { ...s.liveSimulated, [a.action]: a.branch } }
    case 'LIVE_RESOLVED': return { ...s, livePhase: 'resolved', liveSummary: a.summary, liveAction: a.action, liveContained: !!a.contained, livePaused: false, live: a.snapshot || s.live, liveDecision: null, phase: 'resolved', statusText: a.contained ? 'CONTAINED' : 'RESOLVED', missedImpact: a.summary ? {
      avoidable_systems: a.summary.avoidable_exposure, avoidable_exposure: a.summary.avoidable_exposure,
      avoidable_downtime_h: 0, defense_regret: a.summary.defense_regret,
      actual: { affected: a.summary.affected },
      best_counterfactual: { affected: Math.max(1, (a.summary.no_action_affected || 0) - (a.summary.avoidable_exposure || 0)) },
      note: 'SIMULATED ESTIMATE from the live run.',
    } : s.missedImpact }
    case 'LIVE_PAUSE': return { ...s, livePaused: !!a.paused }
    case 'LIVE_SPEED': return { ...s, liveSpeed: a.speed }
    case 'LIVE_RESET': return { ...s, liveMeta: null, liveIdx: -1, livePhase: 'idle', livePaused: false, liveDecision: null, liveSummary: null, liveAction: null, liveSimulated: {}, liveContained: false, live: a.snapshot || null, recommend: null, phase: 'idle', statusText: 'STANDBY', approvalOpen: false }
    case 'START': return {
      ...s, scenarioId: a.scenarioId, steps: a.steps, timeline: a.timeline,
      scenarioMeta: a.meta, curIndex: 0, curStop: decisionIndex(a.steps),
      phase: 'playing', speed: a.speed, live: a.steps[0],
      statusText: 'DETECTING', approvalOpen: false, approvedAction: null,
      actualOutcome: null, contained: false, missedImpact: null, robust: null,
      counterfactual: null, replay: null, recommend: null, proposeUpdate: null,
    }
    case 'STEP': {
      const idx = Math.min(a.idx, s.steps.length - 1)
      const live = s.steps[idx]
      let phase = s.phase
      let statusText = live ? live.risk_level : s.statusText
      if (s.phase === 'playing') {
        if (idx >= s.curStop) { phase = 'decision'; statusText = 'DECISION WINDOW' }
      }
      return { ...s, curIndex: idx, live, phase, statusText }
    }
    case 'SET_STOP': return { ...s, curStop: a.idx }
    case 'DECISION': return { ...s, phase: 'decision', statusText: 'DECISION WINDOW' }
    case 'SET_SPEED': return { ...s, speed: a.speed }
    case 'RESUME_PLAY': return { ...s, phase: 'playing', statusText: 'ESCALATING' }
    case 'OPEN_APPROVAL': return { ...s, approvalOpen: true }
    case 'CLOSE_APPROVAL': return { ...s, approvalOpen: false }
    case 'REC_LOAD': return { ...s, recommendLoading: true }
    case 'REC_OK': return { ...s, recommendLoading: false, recommend: a.rec }
    case 'REC_ERR': return { ...s, recommendLoading: false, error: a.msg }
    case 'APPROVE_OK': return {
      ...s, approvalOpen: false, approveBusy: false, approvedAction: a.action,
      actualOutcome: a.outcome, live: a.state, contained: a.decision !== 'REJECTED',
      phase: a.decision === 'REJECTED' ? 'decision' : 'resolved',
      statusText: a.decision === 'REJECTED' ? 'ESCALATION' : 'CONTAINED',
    }
    case 'APPROVE_BUSY': return { ...s, approveBusy: true }
    case 'COMPLETE': return {
      ...s, missedImpact: a.missed, proposedUpdate: a.proposal,
      statusText: 'RESOLVED', phase: 'resolved', incidents: a.incidents,
    }
    case 'SET_COUNTERFACTUAL': return { ...s, counterfactual: a.data }
    case 'SET_REPLAY': return { ...s, replay: a.data }
    case 'SET_ROBUST': return { ...s, robust: a.data }
    case 'SET_AI': return { ...s, aiResult: a.data, aiThinking: false }
    case 'AI_THINK': return { ...s, aiThinking: true }
    case 'MEMORY': return { ...s, memory: a.data }
    case 'AUDIT': return { ...s, audit: a.data, decisions: a.decisions }
    case 'EVAL': return { ...s, evalData: a.data }
    case 'FALSEPOS': return { ...s, falsePos: a.data }
    // Derive the pending proposal from version history so it survives reloads.
    case 'PLAYBOOK': return { ...s, playbook: a.data, proposedUpdate: pendingProposal(a.data) }
    case 'PROFILE': return { ...s, profile: a.data }
    case 'PROPOSED': return { ...s, proposedUpdate: a.data }
    case 'PLAYBOOK_APPROVED': return { ...s, playbook: a.data, proposedUpdate: null }
    case 'INCIDENTS': return { ...s, incidents: a.data }
    case 'SELECT_NODE': return { ...s, selectedNode: a.node }
    case 'LOOP': return { ...s, activeLoop: a.i, activeStage: STAGES[a.i] }
    case 'DEMO_ON': return { ...s, demo: true }
    case 'DEMO_OFF': return { ...s, demo: false, demoTick: null }
    case 'DEMO_TICK': return { ...s, demoTick: a.tick }
    case 'RESET_SELECT': return { ...s, selectedNode: null }
    case 'LIVE_SCEN': return { ...s, liveScenarios: a.data }
    default: return s
  }
}

export function SimProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial)
  const stateRef = useRef(state)
  stateRef.current = state

  // ---------- boot ----------
  useEffect(() => {
    ;(async () => {
      try {
        const [state0, meta, incidents, memory, audit, decisions, playbook, profile] = await Promise.all([
          api.state(), api.scenarios(), api.incidents(), api.memory(), api.audit(),
          api.decisions(), api.playbook(), api.profile(),
        ])
        // Place the default decision posture as the live snapshot (no animation).
        dispatch({ type: 'START', scenarioId: 'S2', steps: [state0], timeline: [],
          curStop: 0, phase: 'decision', speed: 700, live: state0, meta: null })
        dispatch({ type: 'BOOT_OK', meta, incidents: incidents.incidents || [] })
        dispatch({ type: 'AUDIT', audit: audit.audit || [], decisions: decisions.decisions || [] })
        dispatch({ type: 'MEMORY', memory: memory.memory || [] })
        dispatch({ type: 'PLAYBOOK', playbook })
        dispatch({ type: 'PROFILE', data: profile })
      } catch (e) {
        dispatch({ type: 'BOOT_ERR', msg: String(e?.message || e) })
      }
    })()
  }, [])

  // ---------- playback ----------
  useEffect(() => {
    if (state.phase !== 'playing') return
    if (!state.steps || state.steps.length === 0) return
    if (state.curIndex >= state.curStop && state.curIndex >= state.steps.length - 1) return
    const id = setInterval(() => {
      const s = stateRef.current
      if (s.phase !== 'playing') { clearInterval(id); return }
      const next = s.curIndex + 1
      if (next >= s.steps.length) { dispatch({ type: 'DECISION' }); clearInterval(id); return }
      dispatch({ type: 'STEP', idx: next })
      // auto-recommend when we first reach the decision window
      if (next >= s.curStop && !s.approvedAction) {
        recommendNow()
      }
      if (next >= s.curStop) { clearInterval(id); dispatch({ type: 'DECISION' }) }
    }, state.speed)
    return () => clearInterval(id)
  }, [state.phase, state.steps, state.curStop, state.speed])

  // recommend callback
  const recommendNow = useCallback(async (openModal = true) => {
    try {
      dispatch({ type: 'REC_LOAD' })
      const rec = await api.recommend()
      dispatch({ type: 'REC_OK', rec })
      if (openModal) dispatch({ type: 'OPEN_APPROVAL' })
    } catch (e) {
      dispatch({ type: 'REC_ERR', msg: String(e?.message || e) })
    }
  }, [])

  const startRun = useCallback(async (scenarioId = 'S2', speed = 650) => {
    try {
      dispatch({ type: 'SET_ERROR', msg: null })
      const data = await api.startSim(scenarioId, speed)
      const meta = (await api.scenarios()).scenarios[scenarioId]
      dispatch({ type: 'START', scenarioId, steps: data.steps, timeline: data.timeline,
        curStop: decisionIndex(data.steps), speed, meta })
    } catch (e) {
      dispatch({ type: 'SET_ERROR', msg: String(e?.message || e) })
    }
  }, [])

  const resumePastDecision = useCallback(() => {
    dispatch({ type: 'RESUME_PLAY' }) // continues to end then decision
  }, [])

  const recommendDecision = useCallback(async (openModal = true) => {
    await recommendNow(openModal)
  }, [recommendNow])

  const approve = useCallback(async (decision, actionId, approver, reason) => {
    const s = stateRef.current
    dispatch({ type: 'APPROVE_BUSY' })
    const interventionIdx = s.curIndex
    try {
      const res = await api.approve({
        action_id: actionId || s.recommend?.recommended || 'isolate_revoke',
        decision, approver, reason, intervention_idx: interventionIdx,
      })
      dispatch({ type: 'APPROVE_OK', action: res.action_id, outcome: res.outcome,
        state: res.state, decision })
      if (decision === 'APPROVED') {
        const done = await api.complete({
          action_id: actionId || s.recommend?.recommended || 'isolate_revoke',
          decision, approver, reason, intervention_idx: interventionIdx,
        })
        const incidents = await api.incidents()
        dispatch({ type: 'COMPLETE', missed: done.missed_impact, proposal: done.playbook_proposal,
          incidents: incidents.incidents || [] })
        const memory = await api.memory(); const audit = await api.audit()
        const decisions2 = await api.decisions()
        dispatch({ type: 'MEMORY', memory: memory.memory || [] })
        dispatch({ type: 'AUDIT', audit: audit.audit || [], decisions: decisions2.decisions || [] })
      }
    } catch (e) {
      dispatch({ type: 'SET_ERROR', msg: String(e?.message || e) })
    }
  }, [])

  const askAI = useCallback(async (q) => {
    dispatch({ type: 'AI_THINK' })
    try {
      const r = await api.ai(q)
      dispatch({ type: 'SET_AI', data: r })
    } catch (e) {
      try {
        const r = await api.investigator(q)
        dispatch({ type: 'SET_AI', data: r })
      } catch (e2) {
        const live = stateRef.current.live || {}
        const rec = stateRef.current.recommend || {}
        const pred = live.prediction || {}
        const intent = live.intent || {}
        dispatch({ type: 'SET_AI', data: {
          answer: `[OBSERVED]\nDeterministic investigator (local fallback). Risk ${live.risk_level || 'LOW'} at ${live.risk_score || 0}. Stage: ${intent.stage || 'Observing'}. ${intent.sentence || ''}\n\n[PREDICTION]\nNext target ${pred.predicted || 'not yet predictable'} (${Math.round(pred.confidence || 0)}% confidence) — not an observed fact.\n\n[PROPOSED / REQUIRES HUMAN APPROVAL]\n${rec.recommended_label || 'Generate a defense recommendation first.'}`,
          evidence: Object.keys(live.signal_counts || {}).filter(k => live.signal_counts[k]),
          source: 'Local deterministic fallback (no LLM)',
          kind: 'OBSERVED',
        } })
      }
    }
  }, [])

  const loadDeep = useCallback(async (kind) => {
    const s = stateRef.current
    const sc = s.scenarioId || 'S2'
    const idx = s.curIndex >= 0 ? s.curIndex : 5
    try {
      if (kind === 'counterfactual') {
        const d = await api.counterfactual(sc, idx); dispatch({ type: 'SET_COUNTERFACTUAL', data: d })
      } else if (kind === 'replay') {
        const d = await api.replay(sc, s.approvedAction || 'isolate_revoke', idx)
        dispatch({ type: 'SET_REPLAY', data: d })
      } else if (kind === 'robust') {
        const d = await api.robustness(s.approvedAction || 'isolate_revoke', sc)
        dispatch({ type: 'SET_ROBUST', data: d })
      }
    } catch (e) { /* ignore */ }
  }, [])

  const refresh = useCallback(async (what) => {
    try {
      if (what === 'incidents') { const d = await api.incidents(); dispatch({ type: 'INCIDENTS', data: d.incidents || [] }) }
      if (what === 'memory') { const d = await api.memory(); dispatch({ type: 'MEMORY', data: d.memory || [] }) }
      if (what === 'audit') { const d = await api.audit(); const x = await api.decisions(); dispatch({ type: 'AUDIT', audit: d.audit || [], decisions: x.decisions || [] }) }
      if (what === 'eval') { const d = await api.evaluation(); dispatch({ type: 'EVAL', data: d }) }
      if (what === 'eval-run') { const d = await api.evaluationRun(); dispatch({ type: 'EVAL', data: d }) }
      if (what === 'eval-reset') { const d = await api.evaluationReset(); dispatch({ type: 'EVAL', data: d }) }
      if (what === 'falsepos') { const d = await api.falsePositive(); dispatch({ type: 'FALSEPOS', data: d }) }
      if (what === 'playbook') { const d = await api.playbook(); dispatch({ type: 'PLAYBOOK', data: d }) }
    } catch (e) { /* ignore */ }
  }, [])

  const proposePlaybook = useCallback(async () => {
    try {
      const d = await api.playbookPropose(); dispatch({ type: 'PROPOSED', data: d })
    } catch (e) { dispatch({ type: 'SET_ERROR', msg: String(e?.message || e) }) }
  }, [])

  const approvePlaybook = useCallback(async () => {
    await api.playbookApprove()
    const d = await api.playbook()
    dispatch({ type: 'PLAYBOOK_APPROVED', data: d })
  }, [])

  const rejectPlaybook = useCallback(async () => {
    await api.playbookReject()
    const d = await api.playbook()
    dispatch({ type: 'PLAYBOOK_APPROVED', data: d }) // clears proposedUpdate after reload
  }, [])

  const selectNode = useCallback((n) => dispatch({ type: 'SELECT_NODE', node: n }), [])

  const updateProfile = useCallback(async (payload) => {
    const p = await api.updateProfile(payload)
    dispatch({ type: 'PROFILE', data: p })
    return p
  }, [])

  // ---------------- dynamic LIVE run controller ----------------
  const liveRef = useRef({ timer: null, busy: false, phase: 'idle', paused: false, speed: 1 })
  const liveStateRef = useRef(state)
  liveStateRef.current = state

  const scheduleLive = useCallback(() => {
    const ref = liveRef.current
    if (ref.timer) { clearTimeout(ref.timer); ref.timer = null }
    if (ref.paused || ref.phase !== 'running') return
    const delay = Math.max(150, 950 / ref.speed)
    ref.timer = setTimeout(async () => {
      if (ref.paused || ref.phase !== 'running') return
      await advanceLiveOnce()
      if (liveStateRef.current.livePhase === 'running') scheduleLive()
    }, delay)
  }, [])

  const advanceLiveOnce = useCallback(async () => {
    const ref = liveRef.current
    if (ref.busy) return
    ref.busy = true
    try {
      const r = await api.liveAdvance()
      if (r && r.kind === 'event') {
        dispatch({ type: 'LIVE_SNAP', snapshot: r.snapshot, index: r.index })
        if (r.decision_ready) {
          dispatch({ type: 'LIVE_PHASE', phase: 'decision' })
          ref.phase = 'decision'
          try { const d = await api.liveDecision(); dispatch({ type: 'LIVE_DECISION', payload: d.payload }) } catch (e) { /* ignore */ }
        }
      } else if (r && r.kind === 'resolved') {
        dispatch({ type: 'LIVE_RESOLVED', summary: r.summary, action: r.action, contained: r.contained, snapshot: r.snapshot })
        ref.phase = 'resolved'
      } else if (r && r.ok === false) {
        dispatch({ type: 'LIVE_PHASE', phase: 'idle' })
      }
    } catch (e) { /* transient */ }
    ref.busy = false
  }, [])

  const startLive = useCallback(async (cfg = {}) => {
    const ref = liveRef.current
    if (ref.timer) { clearTimeout(ref.timer); ref.timer = null }
    ref.busy = false; ref.paused = false; ref.phase = 'running'
    let scen
    try { scen = await api.liveScenarios() } catch (e) { scen = null }
    const meta = await api.liveStart(cfg)
    dispatch({ type: 'LIVE_META', meta })
    if (scen) dispatch({ type: 'LIVE_SCEN', data: scen })
    // stream the first events quickly
    for (let i = 0; i < 2; i++) await advanceLiveOnce()
    scheduleLive()
  }, [advanceLiveOnce, scheduleLive])

  const pauseLive = useCallback((paused) => {
    const ref = liveRef.current
    ref.paused = paused
    dispatch({ type: 'LIVE_PAUSE', paused })
    if (paused) { if (ref.timer) { clearTimeout(ref.timer); ref.timer = null } }
    else scheduleLive()
  }, [scheduleLive])

  const stepLive = useCallback(async () => {
    await advanceLiveOnce()
    if (liveStateRef.current.livePhase === 'running') scheduleLive()
  }, [advanceLiveOnce, scheduleLive])

  const setLiveSpeed = useCallback((speed) => {
    liveRef.current.speed = speed
    dispatch({ type: 'LIVE_SPEED', speed })
  }, [])

  const simulateLive = useCallback(async (action_id, earlier = 0) => {
    try { const r = await api.liveSimulate(action_id, earlier); if (r && r.branch) dispatch({ type: 'LIVE_SIM', action: action_id, branch: r.branch }) } catch (e) { /* ignore */ }
  }, [])

  const decideLive = useCallback(async (action_id, decision = 'APPROVED') => {
    const ref = liveRef.current
    if (ref.timer) { clearTimeout(ref.timer); ref.timer = null }
    try {
      const r = await api.liveAct(action_id, decision)
      if (r && r.summary) dispatch({ type: 'LIVE_RESOLVED', summary: r.summary, action: r.action, contained: r.contained, snapshot: r.snapshot })
      ref.phase = 'resolved'
      try {
        const incidents = await api.incidents()
        dispatch({ type: 'INCIDENTS', data: incidents.incidents || [] })
        const memory = await api.memory(); const audit = await api.audit(); const decisions2 = await api.decisions()
        dispatch({ type: 'MEMORY', memory: memory.memory || [] })
        dispatch({ type: 'AUDIT', audit: audit.audit || [], decisions: decisions2.decisions || [] })
        const pb = await api.playbook(); dispatch({ type: 'PLAYBOOK', data: pb })
      } catch (e) { /* refresh is best-effort */ }
    } catch (e) { dispatch({ type: 'SET_ERROR', msg: String(e?.message || e) }) }
  }, [])

  const resetLive = useCallback(async () => {
    const ref = liveRef.current
    if (ref.timer) { clearTimeout(ref.timer); ref.timer = null }
    ref.busy = false; ref.paused = false; ref.phase = 'idle'
    try { await api.liveReset() } catch (e) { /* still reset UI */ }
    let snap = null
    try { snap = await api.state() } catch (e) { snap = null }
    dispatch({ type: 'LIVE_RESET', snapshot: snap })
  }, [])

  const value = {
    state, dispatch,
    startRun, resumePastDecision, recommendDecision, approve, askAI, loadDeep, refresh,
    proposePlaybook, approvePlaybook, rejectPlaybook, updateProfile, selectNode, STAGES,
    startLive, pauseLive, stepLive, setLiveSpeed, simulateLive, decideLive, resetLive,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
