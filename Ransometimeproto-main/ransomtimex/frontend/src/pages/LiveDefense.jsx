import React, { useEffect, useMemo, useState } from 'react'
import {
  Play, Pause, SkipForward, RotateCcw, Radar, Activity, Flame, ShieldCheck,
  Target, Crosshair, GitBranch, Server, Boxes, Clock, FlaskConical, ChevronRight,
  AlertTriangle, Download, Check, X, Brain, Eye, Network, History, Shield, Users, Lock,
} from 'lucide-react'
import { useSim } from '../store/SimContext'
import { Card, Bar, RiskBadge, SevChip, Empty, Dot } from '../components/common'
import { sevOf, riskColor } from '../lib/theme'
import { enrichEvent, attackStory, KILLCHAIN, stageIndexFor } from '../lib/incidentStory'

const SCEN_LIST = { 'S-LAT': 'Lateral Movement (Lab PC)', 'S-PHISH': 'Phishing Credential', 'S-FAC': 'Faculty Device', 'S-INSIDER': 'Insider-like' }
const OPT_LABEL = { no_action: 'No Action', revoke_credentials: 'Revoke Session', isolate_endpoint: 'Isolate Endpoint', block_path: 'Block Path', isolate_revoke: 'Revoke + Isolate', shutdown: 'Shutdown' }
const FILTERS = ['All', 'Critical', 'High', 'Medium', 'Low', 'Authentication', 'File Activity', 'Process', 'Network', 'Privilege', 'Lateral Movement']
const CATS = { Authentication: ['credential_access'], 'File Activity': ['mass_file_modification', 'rapid_file_rename', 'file_server_access'], Process: ['suspicious_process', 'command_scripting'], Network: ['suspicious_network'], Privilege: ['privilege_escalation'], 'Lateral Movement': ['lateral_movement'] }

export default function LiveDefense({ go }) {
  const sim = useSim()
  const { state, dispatch } = sim
  const live = state.live || {}
  const phase = state.livePhase || 'idle'
  const meta = state.liveMeta
  const [cfg, setCfg] = useState({ scenario_id: 'S-LAT', reproducible: true })
  const [speed, setSpeed] = useState(1)
  const events = live.events_so_far || []
  const risk = live.risk_score || 0
  const lvl = live.risk_level || 'LOW'
  const pred = live.prediction || {}
  const blast = live.blast_radius || {}
  const compromised = live.compromised || []
  const intent = live.intent || {}
  const running = phase === 'running'
  const decision = phase === 'decision'
  const idle = phase === 'idle'

  const run = (s = 1) => { sim.setLiveSpeed(s); setSpeed(s); sim.startLive({ scenario_id: cfg.scenario_id, reproducible: cfg.reproducible, intensity: 0.6 }) }

  return (
    <div className="space-y-4">
      <Hero phase={phase} meta={meta} risk={risk} lvl={lvl} intent={intent} />

      {/* CONTROL BAR */}
      <div className="panel rounded-xl px-3 py-2.5 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11px] text-mut">Scenario
          <select value={cfg.scenario_id} onChange={e => setCfg(c => ({ ...c, scenario_id: e.target.value }))} className="bg-[#0e1730] border border-edge rounded-md px-2 py-1 text-[12px] text-white focus:border-accent">{Object.entries(SCEN_LIST).map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-mut">Mode
          <select value={cfg.reproducible ? 'rep' : 'rand'} onChange={e => setCfg(c => ({ ...c, reproducible: e.target.value === 'rep' }))} className="bg-[#0e1730] border border-edge rounded-md px-2 py-1 text-[12px] text-white focus:border-accent"><option value="rep">Reproducible (seeded)</option><option value="rand">Randomized</option></select>
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-mut">Speed
          <select value={speed} onChange={e => { const v = Number(e.target.value); setSpeed(v); sim.setLiveSpeed(v) }} className="bg-[#0e1730] border border-edge rounded-md px-2 py-1 text-[12px] text-white focus:border-accent">{[0.5, 1, 2, 5].map(v => <option key={v} value={v}>{v === 1 ? '1x' : v + 'x'}</option>)}</select>
        </label>
        <div className="mx-1 h-5 w-px bg-edge/70" />
        {!running ? (
          <button onClick={() => run()} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-danger text-white text-[12px] font-bold hover:brightness-110"><Radar size={14}/> Run Safe Simulation</button>
        ) : state.livePaused ? (
          <button onClick={() => sim.pauseLive(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ok text-black text-[12px] font-bold hover:brightness-110"><Play size={14}/> Resume</button>
        ) : (
          <button onClick={() => sim.pauseLive(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-warn/20 text-warn border border-warn/40 text-[12px] font-semibold hover:bg-warn/30"><Pause size={14}/> Pause</button>
        )}
        <button onClick={() => sim.stepLive()} disabled={!running} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg panel-soft text-mut text-[12px] border border-edge disabled:opacity-40"><SkipForward size={14}/> Step Event</button>
        <button onClick={() => { sim.pauseLive(false); dispatch({ type: 'LIVE_PHASE', phase: 'idle' }) }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg panel-soft text-mut text-[12px] border border-edge hover:text-white"><RotateCcw size={14}/> Reset</button>
        <div className="ml-auto text-[10px] text-mut flex items-center gap-1"><FlaskConical size={11} className="text-ok"/> backend-generated · safe synthetic</div>
      </div>

      {/* STATUS STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Strip icon={Flame} label="Risk Score" value={<span style={{ color: riskColor(risk) }}>{idle ? 0 : Math.round(risk)}</span>} sub={idle ? '—' : lvl} />
        <Strip icon={GitBranch} label="Attack Stage" value={idle ? 'Monitoring' : intent.stage || 'Monitoring'} tone="#ffb454" />
        <Strip icon={Target} label="Predicted Target" value={idle || !pred.predicted ? '—' : pred.predicted} tone="#ff3b52" sub={pred.confidence && !idle ? `conf ${Math.round(pred.confidence)}%` : ''} />
        <Strip icon={Server} label="Origin" value={idle ? '—' : (meta?.origin || compromised[0] || '—')} mono tone="#4ea1ff" />
        <Strip icon={Boxes} label="Blast Radius" value={idle ? '0' : `${blast.potential_affected_count ?? 0}`} sub={idle ? '' : `${compromised.length} current`} tone="#ff7a4d" />
        <Strip icon={Activity} label="Event Count" value={idle ? '0' : String(events.length)} tone="#3dd68c" />
      </div>

      {idle && <Idle onRun={run} />}

      {!idle && (<>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 space-y-4">
            <Telemetry events={events} running={running} paused={state.livePaused}
              onPause={() => sim.pauseLive(!state.livePaused)}
              onExport={() => exportIncident(meta, events)} go={go} />
            <StoryPanel events={events} live={live} />
          </div>
          <div className="space-y-4">
            <PredictionPanel pred={pred} blast={blast} compromised={compromised} />
            <KillStrip events={events} intent={intent} />
            <div className="grid grid-cols-2 gap-3">
              <LinkCard onClick={() => go('graph')} icon={Network} label="Attack Graph" tone="#4ea1ff" />
              <LinkCard onClick={() => go('window')} icon={Clock} label="Intervention" tone="#a78bfa" />
              <LinkCard onClick={() => go('replay')} icon={History} label="Replay" tone="#3dd68c" />
              <LinkCard onClick={() => go('alt')} icon={GitBranch} label="Compare" tone="#ffb454" />
            </div>
          </div>
        </div>

        {decision && state.liveDecision && (
          <DecisionPanel decision={state.liveDecision} simulated={state.liveSimulated}
            onSimulate={(a) => sim.simulateLive(a)}
            onApprove={(a) => sim.decideLive(a, 'APPROVED')}
            onReject={(a) => sim.decideLive(a, 'REJECTED')}
            onSimulateAll={() => ['no_action', 'revoke_credentials', 'isolate_endpoint', 'isolate_revoke'].forEach(a => sim.simulateLive(a))} />
        )}

        {phase === 'resolved' && <ResultPanel summary={state.liveSummary} contained={state.liveContained} action={state.liveAction} go={go} />}
      </>)}

      <p className="text-[10px] text-mut flex items-start gap-1.5 px-1"><Lock size={11} className="mt-0.5 shrink-0"/> All telemetry is dynamically generated synthetic data in the safe simulation environment. Nothing touches real endpoints, credentials or files.</p>
    </div>
  )
}

function exportIncident(meta, events) {
  const rows = [['TIME', 'DEVICE', 'USER', 'EVENT', 'SOURCE', 'DESTINATION', 'SEVERITY', 'CONFIDENCE', 'DESCRIPTION']]
  events.forEach(e => { const en = enrichEvent(e, events); rows.push([en.ts, en.device, en.user, en.label, en.source, en.destination || '-', en.severity, en.confidence + '%', en.description]) })
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = `${meta?.incident_id || 'incident'}.csv`; a.click(); URL.revokeObjectURL(url)
}

function Hero({ phase, meta, risk, lvl, intent }) {
  const col = phase === 'running' ? '#4ea1ff' : phase === 'decision' ? '#ffb454' : phase === 'resolved' ? '#3dd68c' : '#3dd68c'
  const label = phase === 'idle' ? 'LIVE MONITORING' : phase === 'running' ? 'SIMULATION RUNNING' : phase === 'decision' ? 'DECISION WINDOW' : 'INCIDENT RESOLVED'
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0d2540] to-[#0a1426] border border-accent/40 flex items-center justify-center"><Activity size={18} className="text-accent" /></div>
        <div>
          <div className="flex items-center gap-2"><h1 className="text-xl font-bold text-white">RansomTime-<span className="text-accent">X</span></h1><span className="chip bg-white/5 text-white/70">LIVE DEFENSE</span></div>
          <p className="text-[12px] text-mut">Dynamic engine · events generated & streamed from the backend.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {meta && <span className="chip mono bg-white/5 text-white/80">Incident {meta.incident_id}</span>}
        {phase === 'decision' && <span className="chip" style={{ background: 'rgba(255,180,84,.15)', color: '#ffb454' }}><AlertTriangle size={12}/> Human approval required</span>}
        <span className="chip" style={{ background: `${col}1c`, color: col }}><Dot color={col} pulse={phase !== 'resolved'}/> {label}</span>
      </div>
    </header>
  )
}

function Strip({ icon: Icon, label, value, sub, tone = '#4ea1ff', mono }) {
  return (
    <div className="panel rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-mut mb-1"><Icon size={13} style={{ color: tone }} /><span className="text-[10px] uppercase tracking-wider">{label}</span></div>
      <div className={`text-[16px] leading-tight font-bold text-white ${mono ? 'mono' : ''}`}>{value}</div>
      {sub && <div className="text-[10px] text-mut mono mt-0.5">{sub}</div>}
    </div>
  )
}

function Idle({ onRun }) {
  return (
    <Card>
      <div className="flex flex-col items-center py-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0d2540] to-[#0a1426] border border-accent/30 flex items-center justify-center mb-3"><Radar size={26} className="text-accent" /></div>
        <div className="text-2xl font-black text-white tracking-wide">SYSTEM PROTECTED</div>
        <div className="mt-1 flex items-center gap-2 text-[12px] text-ok"><Dot color="#3dd68c" pulse /> LIVE MONITORING — no active incident</div>
        <p className="text-mut text-[13px] mt-4 max-w-xl">Select a scenario, mode and speed, then press <b className="text-white">▶ Run Safe Simulation</b>. RansomTime-X generates events on the backend, analyzes each one, and builds the attack story, prediction and defense live.</p>
        <button onClick={onRun} className="mt-6 flex items-center gap-2 px-6 py-2.5 rounded-xl bg-danger text-white text-sm font-bold hover:brightness-110 shadow-lg shadow-danger/20"><Radar size={16}/> RUN SAFE SIMULATION</button>
        <div className="mt-3 text-[10px] text-mut flex items-center gap-1.5"><Shield size={11} className="text-ok"/> Safe synthetic simulation — no real ransomware, encryption, credential theft or scanning.</div>
      </div>
    </Card>
  )
}

function Telemetry({ events, running, paused, onPause, onExport, go }) {
  const [sel, setSel] = useState(null)
  const [filter, setFilter] = useState('All')
  const enriched = useMemo(() => events.map(e => enrichEvent(e, events)), [events])
  const list = enriched.filter(e => {
    if (filter === 'All') return true
    if (['Critical', 'High', 'Medium', 'Low'].includes(filter)) return e.severity === filter.toUpperCase()
    return (CATS[filter] || []).includes(e.eventType)
  })
  return (
    <Card pad={false}
      title={<span className="text-[13px] font-semibold text-white tracking-wide">LIVE SECURITY TELEMETRY</span>}
      right={<div className="flex items-center gap-1">
        <span className="chip" style={{ background: 'rgba(61,214,140,.14)', color: '#3dd68c' }}><Dot color="#3dd68c" pulse={running && !paused}/> {running ? (paused ? 'PAUSED' : 'STREAMING') : 'ENDED'}</span>
        <button onClick={onPause} className="chip panel-soft text-[11px] text-mut hover:text-white">{paused ? 'Resume' : 'Pause Stream'}</button>
        <button onClick={onExport} className="chip bg-accent/15 text-accent text-[11px] hover:bg-accent/25"><Download size={11}/> Export</button>
      </div>}>
      <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1 border-b border-edge/40">
        {FILTERS.map(f => <button key={f} onClick={() => setFilter(f)} className={`px-2 py-0.5 rounded text-[10px] mono ${filter === f ? 'bg-accent text-black' : 'panel-soft text-mut hover:text-white'}`}>{f}</button>)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 p-3">
        <div className="md:col-span-3 space-y-1.5 max-h-[440px] overflow-y-auto pr-1">
          {list.length === 0 && <Empty icon={<Activity size={22}/>} text={running ? 'Streaming events…' : 'No matching events.'} />}
          {[...list].reverse().map((e, i) => <LogRow key={i} e={e} active={sel && sel.id === e.id} onClick={() => setSel(sel && sel.id === e.id ? null : e)} />)}
        </div>
        <div className="md:col-span-2">
          {sel ? <LogDetail e={sel} onClose={() => setSel(null)} go={go} /> :
            <div className="h-full min-h-[200px] rounded-lg border border-dashed border-edge flex flex-col items-center justify-center text-center text-mut p-4"><Eye size={22} className="mb-2 opacity-50" /><div className="text-[12px]">Click a telemetry row to inspect why it is suspicious, its MITRE mapping and the evidence chain.</div></div>}
        </div>
      </div>
    </Card>
  )
}
function LogRow({ e, active, onClick }) {
  const sc = sevOf(e.severity)
  return (
    <button onClick={onClick} className={`w-full text-left stream-in flex items-center gap-2 rounded-md px-2 py-1.5 border-l-2 transition ${active ? 'bg-accent/10' : 'bg-panel-soft/50 hover:bg-accent/5'}`} style={{ borderColor: sc.text }}>
      <span className="mono text-[10px] text-mut w-[64px] shrink-0">{e.ts}</span>
      <span className="text-[12px] shrink-0" style={{ width: 16 }}>{e.glyph}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2"><span className="mono text-[11px] text-accent">{e.device}</span><span className="text-[11px] font-medium text-white truncate">{e.label}</span>{e.destination && <span className="mono text-[9px] text-mut">→ {e.destination}</span>}</div>
        <div className="text-[9px] text-mut truncate">{e.description}</div>
      </div>
      <div className="shrink-0 flex items-center gap-1.5"><span className="text-[10px] mono text-white/70">{e.confidence}%</span><span className="chip mono text-[8px]" style={{ color: sc.text, background: sc.bg }}>{e.severity}</span></div>
    </button>
  )
}
function LogDetail({ e, onClose, go }) {
  const sc = sevOf(e.severity)
  return (
    <div className="rounded-lg border border-edge/70 bg-[#0b1222] p-3 fade-in">
      <div className="flex items-center justify-between mb-1"><span className="text-[11px] font-bold uppercase tracking-wide text-white">Event Detail</span><button onClick={onClose} className="text-mut hover:text-white"><X size={14}/></button></div>
      <div className="text-[10px] mono text-mut">EVT ID <b className="text-accent">{e.id}</b> · {e.ts}</div>
      <div className="mt-2 space-y-1.5">
        <Kv k="Device" v={e.device} />
        <Kv k="User / Account" v={e.user} />
        <Kv k="Event" v={e.label} />
        <Kv k="Process" v={e.proc} />
        <Kv k="Source → Destination" v={e.destination ? `${e.source} → ${e.destination}` : e.source} />
        <Kv k="Detection" v={e.description} />
        <Kv k="Attack stage" v={e.stage} />
        <div className="flex items-center justify-between py-1 border-b border-edge/40 text-[12px]"><span className="text-mut">Severity</span><span className="chip mono" style={{ color: sc.text, background: sc.bg }}>{e.severity}</span></div>
        <Kv k="Confidence" v={`${e.confidence}% (simulated)`} />
        <div className="flex items-center justify-between py-1 border-b border-edge/40 text-[12px]"><span className="text-mut">MITRE ATT&amp;CK</span><span className="chip mono bg-white/5 text-white">{e.mitre} — {e.mitreName}</span></div>
      </div>
      <div className="mt-2 rounded-md bg-info/5 border border-info/25 p-2">
        <div className="text-[10px] font-bold text-info mb-0.5">Why it matters</div>
        <p className="text-[11px] text-mut leading-snug">Previous {e.evidence.length ? e.evidence.slice(0, 3).join(', ').toLowerCase() : 'suspicious activity'} increase confidence this belongs to the same chain as the compromised {e.source || e.device}.</p>
      </div>
      {e.evidence.length > 0 && <div className="mt-2"><div className="text-[10px] uppercase text-mut mb-1">Evidence</div><div className="flex flex-wrap gap-1">{e.evidence.map((x, i) => <span key={i} className="chip bg-white/5 text-[10px] text-mut">• {x}</span>)}</div></div>}
      <button onClick={() => go('graph')} className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-accent/15 border border-accent/40 text-accent text-[12px] font-semibold hover:bg-accent/25"><Network size={13}/> View in Attack Graph</button>
    </div>
  )
}
function Kv({ k, v }) { return <div className="flex items-center justify-between py-1 border-b border-edge/40 text-[12px] last:border-0"><span className="text-mut pr-2">{k}</span><span className="text-white/90 text-right">{v}</span></div> }

function StoryPanel({ events, live }) {
  const beats = attackStory(events)
  const intent = live.intent || {}
  const conf = Math.min(95, Math.max(55, intent.confidence ? Math.round(intent.confidence * 100) : Math.round(live.risk_score || 0)))
  return (
    <Card title="Attack Story (built from live events)" subtitle="Reconstructed chronologically as the simulation generates each event" accent="#ff5d6c" right={<SevChip level={live.risk_level || 'low'}>{events.length} events</SevChip>}>
      {beats.length === 0 ? <Empty icon={<Activity size={24}/>} text="Streaming…"/> : (
        <div className="relative pl-5">
          <div className="absolute left-[7px] top-1 bottom-1 w-0.5 bg-gradient-to-b from-ok via-warn to-danger" />
          {beats.map((b, i) => (
            <div key={i} className="relative pb-2.5 last:pb-0 stream-in" style={{ animationDelay: `${i * 40}ms` }}>
              <span className="absolute -left-5 top-1 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: stageColor(b.stage), background: '#0c1322' }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: stageColor(b.stage) }} /></span>
              <span className="mono text-[11px] text-mut mr-2">{b.ts}</span><span className="text-[12px] text-white/90">{b.stage}</span>
            </div>
          ))}
        </div>
      )}
      {beats.length > 1 && (
        <div className="mt-3 rounded-lg border border-info/30 bg-info/5 p-3">
          <div className="flex items-center gap-1.5 mb-1"><Brain size={13} className="text-info"/><span className="text-[10px] font-bold uppercase tracking-wide text-info">Correlated incident</span></div>
          <p className="text-[12px] text-white/90 leading-snug">Evidence indicates a possible multi-stage ransomware intrusion originating from {events[0]?.asset || 'an endpoint'}, progressing toward critical storage. <i>Prediction, not certainty.</i></p>
          <div className="mt-2 flex items-center gap-2 text-[11px]"><span className="text-mut">Correlation confidence</span><div className="flex-1 max-w-[200px]"><Bar pct={conf} color="#a78bfa" h={5}/></div><span className="mono text-white font-bold">{conf}%</span></div>
        </div>
      )}
    </Card>
  )
}
function stageColor(s) { const i = KILLCHAIN.indexOf(s); if (i <= 1) return '#3dd68c'; if (i === 2) return '#4ea1ff'; if (i === 3) return '#ffb454'; return '#ff3b52' }

function KillStrip({ events, intent }) {
  const obs = {}; (events || []).forEach(e => { const si = stageIndexFor(e.event_type); if (si >= 0) obs[si] = true })
  const cs = intent.stage || ''; let cur = KILLCHAIN.findIndex(x => cs && cs.toUpperCase().includes(x.toUpperCase().split(' ')[0]))
  return (
    <Card title="Attack Stage" subtitle="MITRE-inspired progression" accent="#ff7a4d" right={<RiskBadge score={events.length ? 61 : 0}/>}>
      <div className="space-y-1">{KILLCHAIN.map((x, i) => { const done = obs[i]; const now = !done && i === cur; const pre = !done && !now && i === cur + 1; const col = done ? '#3dd68c' : now ? '#ff3b52' : pre ? '#ffb454' : '#26365a'
        return (
          <div key={x} className="flex items-center gap-2 py-0.5">
            <span className="w-4 h-4 rounded-full border flex items-center justify-center text-[9px]" style={{ borderColor: done ? '#3dd68c' : col, background: done ? '#3dd68c' : now ? 'rgba(255,59,82,.2)' : 'transparent' }}>{done ? <Check size={10} className="text-black"/> : now ? <span className="w-1.5 h-1.5 rounded-full bg-danger glow-dot"/> : <span className="text-mut/40">○</span>}</span>
            <span className={`text-[11px] ${done ? 'text-white/70 line-through decoration-ok/40' : now ? 'text-white font-bold' : 'text-mut'}`}>{x}</span>
            {now && <span className="chip bg-danger/20 text-danger text-[8px] ml-auto">CURRENT</span>}{pre && <span className="chip bg-warn/15 text-warn text-[8px] ml-auto">PREDICTED</span>}
          </div>)})}</div>
    </Card>
  )
}

function PredictionPanel({ pred, blast, compromised }) {
  const reasons = []; if (compromised.length) reasons.push(`Connected to compromised ${compromised[0]}`); reasons.push('High-value critical asset'); reasons.push('Similar attack path observed in simulation')
  return (
    <Card title="Next Target Prediction" accent="#ff3b52" right={<span className="chip bg-danger/20 text-danger text-[10px]">Predicted</span>}>
      {!pred.predicted ? <Empty text="Prediction appears as the attack graph is reconstructed."/> : (<>
        <div className="flex items-end gap-3"><div className="text-3xl font-black mono text-white">{pred.predicted}</div><div className="text-[11px] text-mut pb-1">next</div></div>
        <div className="mt-2 flex items-center gap-2"><span className="text-[11px] text-mut">Confidence</span><div className="flex-1"><Bar pct={pred.confidence} color="#ff3b52"/></div><span className="mono text-[12px] text-white font-bold">{Math.round(pred.confidence)}%</span></div>
        <div className="mt-1 text-[10px] text-mut mono">Estimated window ~{pred.lead_time_seconds}s (simulated)</div>
        <ul className="mt-2 space-y-1">{reasons.map((r, i) => <li key={i} className="flex items-start gap-2 text-[11px] text-white/85"><span className="text-danger font-bold">+</span><span>{r}</span></li>)}</ul>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat n={compromised.length} l="current" /><Stat n={blast.potential_affected_count ?? 0} l="exposed" /><Stat n={blast.critical_exposed_count ?? 0} l="critical" />
        </div>
        <p className="mt-2 text-[9px] text-mut flex items-start gap-1"><AlertTriangle size={11} className="mt-0.5 shrink-0"/> Predicted — estimated, not measured.</p>
      </>)}
    </Card>
  )
}
function Stat({ n, l }) { return <div className="panel-soft rounded-lg py-1.5"><div className="text-lg font-bold mono text-white">{n}</div><div className="text-[8px] text-mut uppercase">{l}</div></div> }

function LinkCard({ onClick, icon: Icon, label, tone }) { return <button onClick={onClick} className="panel rounded-xl p-3 hover:brightness-110 transition text-left"><Icon size={15} style={{ color: tone }}/><div className="text-[12px] text-white font-medium mt-1">{label}</div><div className="text-[10px] text-accent flex items-center gap-0.5 mt-0.5">Open <ChevronRight size={10}/></div></button> }

function DecisionPanel({ decision, simulated, onSimulate, onApprove, onReject, onSimulateAll }) {
  const corr = decision?.correlated || {}
  const rec = decision?.recommendation || {}
  const options = decision?.options || []
  const recommendedId = rec.recommended || 'isolate_revoke'
  return (
    <Card pad={false} title={<span className="flex items-center gap-2"><AlertTriangle size={15} className="text-warn"/> Human Approval Required — AI Defense Decision</span>} right={<span className="chip bg-warn/15 text-warn">Recommended: {rec.recommended_label}</span>}>
      <div className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-info/25 bg-info/5 p-3 mb-3">
          <div><div className="text-[10px] uppercase text-mut">Correlated incident</div><div className="text-[13px] text-white font-semibold">{corr.title}</div></div>
          <div className="text-right"><div className="text-[10px] uppercase text-mut">Origin</div><div className="mono text-white">{corr.origin}</div></div>
          <div className="text-right"><div className="text-[10px] uppercase text-mut">Stage</div><div className="text-white text-[12px]">{corr.stage}</div></div>
          <div className="text-right"><div className="text-[10px] uppercase text-mut">Confidence</div><div className="text-lg font-black mono text-info">{corr.confidence}%</div></div>
        </div>
        <div className="flex items-start gap-2 mb-3"><Brain size={15} className="text-ok shrink-0 mt-0.5"/><p className="text-[12px] text-mut leading-snug">{rec.reason}</p></div>
        <div className="flex items-center justify-between mb-2"><span className="text-[10px] uppercase tracking-wider text-mut">Simulated outcome per option (analyzed before execution)</span><button onClick={onSimulateAll} className="chip bg-info/20 text-info hover:bg-info/30 text-[11px]">Simulate All Options</button></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {options.map((o, i) => { const id = o.action_id; const br = simulated[id]; const isRec = id === recommendedId
            return (
              <div key={id} className={`rounded-lg border p-3 ${isRec ? 'border-ok/60 bg-ok/10' : 'border-edge/60 bg-panel-soft'}`}>
                <div className="flex items-center justify-between"><span className="text-[9px] mono text-mut uppercase">Option {String.fromCharCode(65 + i)}</span>{isRec && <span className="chip bg-ok text-black text-[8px]">REC</span>}</div>
                <div className="text-[13px] font-bold text-white mt-0.5">{OPT_LABEL[id] || o.label}</div>
                {br ? <BranchOut br={br} /> : <div className="mt-2 space-y-1 text-[11px]">
                  <Mini k="Containment" v={`${o.containment}%`} c="#3dd68c" />
                  <Mini k="Downtime" v={`~${(o.outcome && o.outcome.downtime_h) != null ? o.outcome.downtime_h : '?'}h`} />
                  <Mini k="Score" v={`${o.overall != null ? o.overall : '—'}`} c="#4ea1ff" />
                </div>}
                <div className="mt-2 flex gap-1.5">
                  <button onClick={() => onSimulate(id)} className="flex-1 py-1 rounded-md bg-accent/15 text-accent border border-accent/30 text-[10px] font-semibold hover:bg-accent/25">Simulate</button>
                  <button onClick={() => onApprove(id)} className="flex-1 py-1 rounded-md bg-ok text-black text-[10px] font-bold hover:brightness-110">Approve</button>
                </div>
              </div> )})}
        </div>
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <button onClick={() => onReject(recommendedId)} className="px-4 py-2 rounded-lg border border-danger/50 text-danger text-[12px] font-semibold hover:bg-danger/10"><X size={14} className="inline mr-1"/> Reject</button>
          <div className="text-[10px] text-mut flex items-center gap-1.5"><Users size={11} className="text-warn"/> Simulated containment only — no real endpoint, session or file is touched. Human-in-the-loop.</div>
        </div>
      </div>
    </Card>
  )
}
function BranchOut({ br }) { const o = br?.outcome || {}; const no = br?.no_action_outcome || {}
  return (
    <div className="mt-2 rounded-md bg-black/20 border border-edge/50 p-2 fade-in">
      <div className="text-[9px] uppercase text-mut">Simulated</div>
      <div className="flex justify-between text-[11px] mt-1"><span className="text-mut">Exposure</span><span className="mono text-white">{o.exposure_pct != null ? o.exposure_pct + '%' : '—'}</span></div>
      <div className="flex justify-between text-[11px]"><span className="text-mut">Affected</span><span className="mono text-white">{o.affected} sys</span></div>
      <div className="flex justify-between text-[11px]"><span className="text-mut">No-action base</span><span className="mono text-danger">{no.affected} sys</span></div>
    </div>
  )
}
function Mini({ k, v, c }) { return <div className="flex justify-between"><span className="text-mut">{k}</span><span className="mono text-white" style={c ? { color: c } : {}}>{v}</span></div> }

function ResultPanel({ summary, contained, action, go }) {
  const sum = summary || {}
  return (
    <Card accent={contained ? '#3dd68c' : '#ff3b52'}
      title={contained ? <span className="flex items-center gap-2"><Check size={15} className="text-ok"/> SIMULATED CONTAINMENT SUCCESSFUL</span> : <span className="flex items-center gap-2"><AlertTriangle size={15} className="text-danger"/> NO ACTION — HIGH SIMULATED IMPACT</span>}
      right={<SevChip level={contained ? 'ok' : 'critical'}>{contained ? 'CONTAINED' : 'HIGH IMPACT'}</SevChip>}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Box k="Peak risk" v={`${sum.peak_risk}/100`} />
        <Box k="Systems affected" v={sum.affected} note={contained ? `vs no-action ${sum.no_action_affected}` : ''} />
        <Box k="Avoidable exposure" v={sum.avoidable_exposure} note="estimated" />
        <Box k="Downtime" v={`~${sum.downtime_h}h`} note="simulated" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 items-center">
        <span className="text-[12px] text-mut">Recommended &amp; selected:</span><span className="chip bg-ok/15 text-ok">{OPT_LABEL[action] || action}</span>
        <div className="ml-auto flex gap-2">
          <button onClick={() => go('alt')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/15 border border-accent/40 text-accent text-[12px] font-semibold hover:bg-accent/25"><GitBranch size={13}/> Compare outcomes</button>
          <button onClick={() => go('replay')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-info/15 border border-info/40 text-info text-[12px] font-semibold hover:bg-info/25"><History size={13}/> Replay incident</button>
          <button onClick={() => go('defintel')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ok/15 border border-ok/40 text-ok text-[12px] font-semibold hover:bg-ok/25"><Brain size={13}/> What did we learn?</button>
        </div>
      </div>
      {!contained && <p className="mt-2 text-[11px] text-danger">No action was taken (simulated). Unchecked propagation reached the projected blast radius. Isolating + revoking earlier would reduce the simulated impact.</p>}
    </Card>
  )
}
function Box({ k, v, note }) { return <div className="rounded-lg panel-soft p-3"><div className="text-[10px] uppercase text-mut">{k}</div><div className="text-2xl font-black text-white mono mt-1">{v}</div>{note && <div className="text-[9px] text-mut">{note}</div>}</div> }
