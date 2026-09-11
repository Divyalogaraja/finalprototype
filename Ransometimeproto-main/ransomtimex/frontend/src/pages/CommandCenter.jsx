import React from 'react'
import {
  Radar, Target, Activity, ShieldAlert, ShieldOff, Hourglass, ShieldCheck,
  Crosshair, Eye, GitBranch, Flame, Play, ChevronRight, CheckCircle2, AlertTriangle,
} from 'lucide-react'
import { useSim } from '../store/SimContext'
import { Card, MetricCard, Gauge, RiskBadge, SevChip, Bar, Empty } from '../components/common'
import { AttackProgressTimeline, MitreChips, EventStream, ClosedLoop } from '../components/widgets'
import { sevOf, riskColor } from '../lib/theme'
import { TimeMachine } from '../components/TimeMachine'

const ATTACK_STAGE_MITRE = {
  'Initial Suspicious Process': 'T1059 Command and Scripting Interpreter',
  'Mass File Modification': 'T1486 Data Encrypted for Impact',
  'Credential Access': 'T1078 Valid Accounts',
  'Privilege Escalation': 'T1068 Privilege Escalation',
  'Lateral Movement': 'T1021 Remote Services',
  'File Server Targeted': 'T1486 Data Encrypted for Impact',
}

export default function CommandCenter({ go, runNow }) {
  const { state, dispatch, recommendDecision } = useSim()
  const live = state.live || {}
  const rec = state.recommend
  const risk = live.risk_score || 0
  const lvl = live.risk_level || 'LOW'
  const pred = live.prediction || {}
  const blast = live.blast_radius || {}
  const intent = live.intent || {}
  const compromised = live.compromised || []
  const attackStage = intent.stage || 'Observing'

  const stageTime = [...(live.events_so_far || [])].reverse().find(e => e.event_type === 'lateral_movement')?.timestamp

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Command Center</h1>
          <p className="text-[12px] text-mut">Detect → Understand → Predict → Decide → Defend → Replay → Learn. Live posture of the active simulated incident.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { go('live'); dispatch({ type: 'LOOP', i: 1 }) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent/15 border border-accent/40 text-accent text-[12px] font-semibold hover:bg-accent/25">
            <Activity size={14} /> Go to Live Defense
          </button>
          <button onClick={runNow} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-danger/20 border border-danger/40 text-danger text-[12px] font-semibold hover:bg-danger/30">
            <Radar size={14} /> Run Safe Ransomware Simulation
          </button>
        </div>
      </div>

      {/* summary metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <MetricCard icon={Flame} label="Ransomware Risk" value={<span style={{ color: riskColor(risk) }}>{Math.round(risk)}</span>} sub={<RiskBadge score={risk} />} tone="danger" />
        <MetricCard icon={GitBranch} label="Attack Stage" value={<span className="text-[13px] leading-tight">{shortStage(attackStage)}</span>} sub="of kill chain" tone="warn" />
        <MetricCard icon={Crosshair} label="Predicted Target" value={<span className="text-[13px]">{pred.predicted || '—'}</span>} sub={pred.confidence ? `Confidence ${Math.round(pred.confidence)}%` : ''} tone="crit" />
        <MetricCard icon={ShieldOff} label="Blast Radius" value={<span className="text-[13px]">{blast.potential_affected_count ?? 0} systems</span>} sub={`${blast.critical_exposed_count ?? 0} critical`} tone="danger" />
        <MetricCard icon={ShieldCheck} label="Defense Conf" value={<span className="text-[13px]">{rec?.optimizer?.overall ?? '—'}%</span>} sub={rec?.recommended_label || ''} tone="ok" />
        <MetricCard icon={Hourglass} label="Intervention" value={<span className="text-[13px]">10:04:37</span>} sub="last safe window" tone="info" />
        <MetricCard icon={ShieldAlert} label="Protected Assets" value="48" sub="monitored" tone="ok" />
        <MetricCard icon={Target} label="Assets at Risk" value={<span className="text-[13px]">{compromised.length || blast.current_affected_count || 0}</span>} sub={`predicted next target ${pred.predicted || ''}`} tone="warn" />
      </div>

      {/* main: timeline + right narrative */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <Card title="Attack Progress" subtitle="Behavioral stages observed · MITRE ATT&CK techniques"
            right={<SevChip level={lvl}>{`${lvl} RISK`}</SevChip>}>
            <AttackProgressTimeline />
            <div className="mt-4 pt-3 border-t border-edge/60">
              <MitreChips events={live.events_so_far || []} />
            </div>
          </Card>

          <Card title="Cyber Defense Time Machine" subtitle="One decision point · many simulated futures"
            accent="#a78bfa">
            <TimeMachine predicted={pred.predicted} />
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="Recommended Defense" accent="#3dd68c"
              right={rec && <RiskBadge score={rec?.expected_outcome?.residual_risk ?? 0} />}>
              {rec ? (
                <div>
                  <div className="text-lg font-bold text-ok mb-1">{rec.recommended_label}</div>
                  <p className="text-[12px] text-mut mb-3">{rec.reason}</p>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div><div className="text-[10px] text-mut">Containment</div><div className="font-bold text-white">{rec.expected_outcome?.containment ?? rec.optimizer?.containment}%</div></div>
                    <div><div className="text-[10px] text-mut">Downtime</div><div className="font-bold text-white">~{rec.expected_outcome?.downtime_h ?? 1}h</div></div>
                    <div><div className="text-[10px] text-mut">Overall</div><div className="font-bold text-accent">{rec.optimizer?.overall ?? '—'}</div></div>
                  </div>
                  <button onClick={() => { recommendDecision(); dispatch({ type: 'OPEN_APPROVAL' }) }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-ok text-black text-[12px] font-bold hover:brightness-110">
                    <ShieldCheck size={14} /> Review &amp; Approve Defense
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Empty icon={<ShieldCheck size={26} />} text="Run a simulation or recommend a defense to compare options." />
                  <button onClick={() => recommendDecision()}
                    className="w-full py-2 rounded-lg bg-accent/15 text-accent border border-accent/40 text-[12px] font-semibold hover:bg-accent/25">
                    Generate Defense Recommendation
                  </button>
                </div>
              )}
            </Card>

            <Card title="Predicted Next Target" accent="#ff3b52" right={<SevChip level="critical">HIGH CONFIDENCE</SevChip>}>
              {pred.predicted ? (
                <div>
                  <div className="flex items-center gap-3">
                    <div className="text-3xl font-black mono text-white">{pred.predicted}</div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="text-[12px] text-mut">Confidence</div>
                    <div className="flex-1"><Bar pct={pred.confidence} color="#ff3b52" /></div>
                    <div className="text-[13px] mono font-bold text-white">{Math.round(pred.confidence)}%</div>
                  </div>
                  <div className="text-[11px] text-mut mt-1">Lead time: <b className="text-white">{pred.lead_time_seconds}s</b></div>
                  <div className="mt-3 space-y-1.5">
                    {(pred.ranking || []).map(r => (
                      <div key={r.asset} className="flex items-center gap-2 text-[11px]">
                        <span className="w-32 truncate mono text-mut">{r.asset}</span>
                        <div className="flex-1"><Bar pct={r.confidence} color={r.asset === pred.predicted ? '#ff3b52' : '#4ea1ff'} h={4} /></div>
                        <span className="mono text-mut w-9 text-right">{Math.round(r.confidence)}%</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => go('live')} className="mt-3 text-[11px] text-accent flex items-center gap-1 hover:underline">
                    Why this prediction? <ChevronRight size={12} />
                  </button>
                </div>
              ) : <Empty text="No prediction yet." />}
            </Card>
          </div>

          {/* live stream */}
          <Card title="Live Event Stream" subtitle={`Incident ${state.incidents?.length ? 'INC-' + String(state.incidents.length).padStart(3,'0') : 'ACTIVE'} · simulation output`}
            right={<span className="chip" style={{ color: sevOf(lvl).text, background: sevOf(lvl).bg }}>{live.events_so_far?.length || 0} events</span>}>
            <EventStream />
          </Card>
        </div>

        {/* right narrative */}
        <div className="space-y-4">
          <Card title="Situation Brief" accent="#4ea1ff">
            <div className="space-y-3 text-[12px]">
              <Brief icon={<Eye size={15} color="#4ea1ff" />} label="What is happening?"
                text={compromised.length ? `Behavioral ransomware indicators on ${compromised[0]} (${compromised.length} host${compromised.length>1?'s':''} now compromised). ${intent.sentence || ''}` : 'Monitoring; no correlated indicators yet.'} />
              <Brief icon={<Crosshair size={15} color="#ff5d6c" />} label="Where is it going?"
                text={pred.predicted ? `Next predicted target ${pred.predicted} at ${Math.round(pred.confidence)}%. Blast radius ${blast.potential_affected_count ?? '—'} systems.` : 'Not yet predictable.'} />
              <Brief icon={<ShieldCheck size={15} color="#3dd68c" />} label="What should we do?"
                text={rec ? `Recommended: ${rec.recommended_label} (containment ${rec.expected_outcome?.containment ?? ''}%). A human approval is required.` : 'Awaiting recommendation — see Recommended Defense.'} />
              <Brief icon={<AlertTriangle size={15} color="#ffb454" />} label="What if we do nothing?"
                text={`Unchecked propagation is projected to reach ${blast.potential_affected_count ?? 'multiple'} systems incl. critical storage/backup. Counterfactual replay quantifies avoidable impact.`} />
            </div>
          </Card>

          <Card title="Blast Radius" accent="#ff7a4d">
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <div className="panel-soft rounded-lg py-2"><div className="text-lg font-bold text-danger">{compromised.length}</div><div className="text-[9px] text-mut uppercase">Current</div></div>
              <div className="panel-soft rounded-lg py-2"><div className="text-lg font-bold text-white">{blast.potential_affected_count ?? 0}</div><div className="text-[9px] text-mut uppercase">Potential</div></div>
              <div className="panel-soft rounded-lg py-2"><div className="text-lg font-bold text-warn">{blast.critical_exposed_count ?? 0}</div><div className="text-[9px] text-mut uppercase">Critical</div></div>
            </div>
            <div className="space-y-1 text-[11px]">
              {[...(blast.current_affected || []), ...(blast.potential_affected || []).slice(0,6)].map((a, i, arr) => {
                const isCur = i < (blast.current_affected || []).length
                return (
                  <div key={a + i} className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${isCur ? 'bg-danger' : 'bg-warn'}`} />
                    <span className="mono text-white/90">{a}</span>
                    <span className="text-[9px] text-mut">{isCur ? 'affected' : i === (blast.current_affected||[]).length ? 'predicted next' : 'reachable'}</span>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card title="Active Intent Engine" right={<span className="text-[11px] mono text-accent">confidence {Math.round(intent.confidence * 100)}%</span>}>
            {intent.intent ? (
              <div>
                <div className="chip mb-2" style={{ color: '#ff7a4d', background: 'rgba(255,122,77,.14)' }}>{intent.stage}</div>
                <p className="text-[12px] text-white/85 leading-snug">{intent.sentence}</p>
                <div className="mt-2">
                  <div className="text-[10px] uppercase text-mut mb-1">Supporting evidence</div>
                  <div className="flex flex-wrap gap-1">
                    {(intent.evidence || []).map(e => <span key={e} className="chip bg-white/5 text-[10px] text-mut">{e}</span>)}
                  </div>
                </div>
              </div>
            ) : <Empty text={intent.sentence} />}
          </Card>

          <Card title="Stage Map" right={<RiskBadge score={risk} />}>
            <Gauge value={Math.round(risk)} sub={attackStage} label="Behavioral Risk" />
            <div className="mt-3"><Bar pct={risk} color={riskColor(risk)} h={8} /></div>
          </Card>
        </div>
      </div>

      {/* closed-loop footer */}
      <Card pad={false}>
        <div className="px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-2">
          <div className="text-[11px] uppercase tracking-widest text-mut">Adaptive closed loop</div>
          <ClosedLoop stage={state.activeStage} />
          <div className="flex items-center gap-1.5 text-[11px] text-mut"><CheckCircle2 size={13} className="text-ok" /> all simulations synthetic</div>
        </div>
      </Card>
    </div>
  )
}

function shortStage(s) {
  const st = Object.keys(ATTACK_STAGE_MITRE).find(k => s?.toUpperCase().includes(k.toUpperCase().split(' ')[0]))
  return s ? s.replace('RANSOMWARE', '') : 'Observing'
}

function Brief({ icon, label, text }) {
  return (
    <div className="flex gap-2.5">
      <div className="mt-0.5">{icon}</div>
      <div>
        <div className="text-[12px] font-semibold text-white">{label}</div>
        <div className="text-[12px] text-mut leading-snug">{text}</div>
      </div>
    </div>
  )
}
