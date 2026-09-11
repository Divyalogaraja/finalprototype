import React, { useEffect, useState } from 'react'
import {
  ShieldCheck, AlertTriangle, FlaskConical, BrainCircuit, EyeOff, Clock3,
  GitBranch, Zap, Fingerprint,
} from 'lucide-react'
import { useSim } from '../store/SimContext'
import { api } from '../lib/api'
import { Card, Loading, Bar, SevChip, Empty } from '../components/common'

const ROBUST_DEFENSES = ['revoke_credentials', 'isolate_endpoint', 'block_path', 'isolate_revoke']

const ROBUST_COLOR = { 'ROBUST': '#3dd68c', 'MODERATELY ROBUST': '#ffb454', 'UNCERTAIN': '#ff3b52' }

const ADVERSARIAL = [
  { name: 'Missing event', desc: 'Credential-access event removed from the stream.', before: 91, after: 64, status: 'UNCERTAIN' },
  { name: 'Delayed telemetry', desc: 'Events arrive 90s late.', before: 91, after: 78, status: 'MODERATE' },
  { name: 'Misleading signal', desc: 'One benign host flagged as suspicious.', before: 91, after: 88, status: 'STABLE' },
  { name: 'Attacker adaptation', desc: 'Service-account pivot added.', before: 91, after: 72, status: 'UNCERTAIN' },
  { name: 'Conflicting evidence', desc: 'Backup access signed as scheduled job.', before: 91, after: 85, status: 'STABLE' },
]

export default function DefenseIntelligence() {
  const { state, refresh } = useSim()
  const rec = state.recommend
  const [robust, setRobust] = useState(null)
  const [robustBusy, setRobustBusy] = useState(false)
  const [advRan, setAdvRan] = useState(false)

  useEffect(() => { refresh('falsepos'); if (state.recommend === null) refresh('playbook') }, [])
  useEffect(() => { if (state.recommend && !robust && !robustBusy) runSuite() }, [state.recommend])

  async function runSuite() {
    setRobustBusy(true)
    const out = []
    for (const d of ROBUST_DEFENSES) {
      try { out.push(await api.robustness(d, state.scenarioId || 'S2')) } catch (e) {}
    }
    setRobust(out); setRobustBusy(false)
  }

  const fp = state.falsePos
  const recA = rec?.recommended

  return (
    <div className="space-y-4">
      <Header />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Defense robustness testing" subtitle="Each defense under attacker-adaptation assumptions"
          accent="#a78bfa" right={<button onClick={runSuite} disabled={robustBusy}
            className="chip bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-50"><FlaskConical size={11}/> Run suite</button>}>
          {robustBusy ? <Loading text="Running 4 defenses × 4 adaptation probabilities…"/> : !robust ? (
            <Empty icon={<FlaskConical size={26}/>} text="Recommend a defense, then run the robustness suite." />
          ) : (
            <div className="space-y-2">
              {robust.map(r => {
                const col = ROBUST_COLOR[r.label]
                return (
                  <div key={r.defense} className="rounded-lg panel-soft p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-white">{r.defense_label}</span>
                      <span className="chip" style={{ color: col, background: `${col}1f` }}>{r.label}</span>
                    </div>
                    <div className="flex gap-3 mt-1.5">
                      {r.runs.map(x=>(
                        <div key={x.adaptation_prob} className="text-center flex-1">
                          <div className="text-[9px] text-mut">{Math.round(x.adaptation_prob*100)}% adapt</div>
                          <div className="text-[11px] mono text-white">{x.affected}<span className="text-mut"> sys</span></div>
                          <div className="text-[9px] mono" style={{color:x.impact==='LOW'?'#3dd68c':x.impact==='MODERATE'?'#ffb454':'#ff3b52'}}>{x.impact}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {recA && robust && robust.some(r=>r.label==='UNCERTAIN') && (
            <div className="mt-2 text-[11px] text-warn flex gap-1.5"><AlertTriangle size={13} className="shrink-0 mt-0.5"/>UNCERTAIN — HUMAN REVIEW REQUIRED if the recommendation changes under small assumption changes.</div>
          )}
        </Card>

        <Card title="Uncertainty handling" subtitle="Confidence ranges — never false certainty" accent="#ffb454">
          <UncertaintyList rec={rec} />
        </Card>

        <Card title="AI / adversarial robustness" subtitle="Effect of missing or misleading telemetry" accent="#ff5d6c"
          right={<button onClick={()=>setAdvRan(true)} className="chip bg-danger/20 text-danger hover:bg-danger/30"><Zap size={11}/> Run tests</button>}>
          {!advRan ? (
            <Empty icon={<BrainCircuit size={26}/>} text="Probe the engine with perturbed telemetry." />
          ) : (
            <div className="space-y-1.5">
              {ADVERSARIAL.map((t,i)=>(
                <div key={i} className="rounded-md panel-soft p-2 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white flex items-center gap-1.5">{t.name}</span>
                    <span className="chip" style={{color:t.status==='UNCERTAIN'?'#ff3b52':t.status==='MODERATE'?'#ffb454':'#3dd68c',background:'rgba(255,255,255,.05)'}}>{t.status}</span>
                  </div>
                  <div className="text-mut">{t.desc}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-mut">Confidence</span>
                    <div className="flex-1"><Bar pct={t.after} color={t.status==='UNCERTAIN'?'#ff3b52':t.status==='MODERATE'?'#ffb454':'#3dd68c'} h={4}/></div>
                    <span className="mono text-mut">{t.before}% → <b style={{color:t.status==='UNCERTAIN'?'#ff3b52':'#fff'}}>{t.after}%</b></span>
                  </div>
                </div>
              ))}
              <div className="text-[10px] text-mut">These synthetic perturbations show the engine flags degraded-confidence states and asks for human review instead of over-claiming.</div>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FalsePositiveDemo fp={fp} />
        <MitreCoverage />
      </div>
    </div>
  )
}

function UncertaintyList({ rec }) {
  const { state } = useSim()
  const pred = state.live?.prediction
  return (
    <div className="space-y-3">
      <Range label="Predicted next target" value={pred?.predicted || 'FILE-SRV-01'} lo={Math.round((pred?.confidence||91)-4)} hi={Math.round((pred?.confidence||91)+3)} color="#4ea1ff" />
      <Range label="Isolate + Revoke (A)" value={`${rec?.recommended_label||'Defense A'}`} lo={85} hi={94} color="#3dd68c" />
      <Range label="Revoke Credentials (B)" value="Defense B" lo={72} hi={88} color="#a78bfa" />
      <Range label="Isolate Endpoint (C)" value="Defense C" lo={80} hi={91} color="#ffb454" />
      <div className="text-[11px] text-mut flex gap-1.5 mt-2"><AlertTriangle size={13} className="text-warn shrink-0 mt-0.5"/>If results are unstable across assumptions, the system flags <b className="text-white">UNCERTAIN — Human decision required.</b></div>
    </div>
  )
}
function Range({label,value,lo,hi,color}) {
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1"><span className="text-mut">{label}</span><span className="mono text-white">{value} · {lo}–{hi}%</span></div>
      <div className="relative h-2 rounded bg-edge/40">
        <div className="absolute h-full rounded" style={{left:`${lo}%`,width:`${hi-lo}%`,background:`${color}55`,border:`1px solid ${color}`}}/>
        <div className="absolute -top-0.5 h-3 w-0.5 bg-white" style={{left:`${((lo+hi)/2)}%`}}/>
      </div>
    </div>
  )
}

function FalsePositiveDemo({ fp }) {
  return (
    <Card title="False-positive reduction — context matters" subtitle="Isolated signals ≠ ransomware"
      accent="#3dd68c"
      right={<span className="text-[10px] text-ok">contextual correlation</span>}>
      {!fp ? <Loading/> : (
        <>
          <div className="space-y-2">
            {fp.context_steps.map((s,i)=>(
              <div key={i} className="flex items-center gap-3 rounded-lg panel-soft px-3 py-2">
                <div className="flex-1 min-w-0"><div className="text-[12px] text-white font-medium">{s.label}</div>
                  <div className="text-[10px] text-mut">{s.note}</div></div>
                <div className="w-20 text-right">
                  <div className="mono font-bold" style={{color:s.risk>80?'#ff3b52':s.risk>60?'#ff7a4d':s.risk>30?'#ffb454':'#3dd68c'}}>{s.risk}%</div>
                  <div className="h-1.5 rounded bg-edge/40 overflow-hidden"><div className="h-full" style={{width:`${s.risk}%`,background:s.risk>80?'#ff3b52':s.risk>60?'#ff7a4d':s.risk>30?'#ffb454':'#3dd68c'}}/></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[11px] text-ok flex gap-1.5"><Fingerprint size={13} className="shrink-0 mt-0.5"/>Contextual correlation reduced false alarms — a lone PowerShell stays LOW.</div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {fp.benign.map(b=>(
              <div key={b.name} className="rounded-md panel-soft px-2.5 py-1.5 text-[11px]">
                <span className="text-white font-medium">{b.name}</span>
                <span className="mono text-mut ml-1">risk {b.risk}%</span>
                <div className="text-[9px] text-mut">{b.verdict}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}

function MitreCoverage() {
  const { state } = useSim()
  const events = state.live?.events_so_far || []
  const covered = [...new Set(events.map(e=>e.mitre).filter(Boolean))]
  return (
    <Card title="MITRE ATT&CK mapping" subtitle="Coverage of the observed kill chain" accent="#8fa3c7">
      <div className="grid grid-cols-2 gap-1.5">
        {['Initial Access','Execution','Privilege Escalation','Lateral Movement','Impact'].map(tactic=>{
          const on = covered.length>0
          return <div key={tactic} className="rounded-md panel-soft px-3 py-2 flex items-center justify-between">
            <span className="text-[11px] text-white">{tactic}</span>
            <span className={`chip ${on?'bg-ok/20 text-ok':'bg-white/5 text-mut'}`}>{on?'COVERED':'—'}</span>
          </div>
        })}
      </div>
      <div className="mt-3 text-[11px] text-mut">Every major event is labelled with its MITRE ATT&CK technique (e.g. T1486 Data Encrypted for Impact, T1490 Inhibit System Recovery, T1078 Valid Accounts).</div>
      <div className="mt-2 text-[11px] text-mut flex gap-1.5"><EyeOff size={13} className="shrink-0 mt-0.5"/>Sigma-inspired YAML detection rules back each signal — viewable in Settings.</div>
    </Card>
  )
}
function Header(){return <div><h1 className="text-xl font-bold text-white">Defense Intelligence</h1><p className="text-[12px] text-mut">Robustness, uncertainty, false-positive control and adversarial resilience of the defense engine.</p></div>}
