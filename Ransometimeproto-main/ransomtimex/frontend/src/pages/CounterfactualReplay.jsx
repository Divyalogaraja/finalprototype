import React, { useEffect, useState } from 'react'
import {
  RotateCcw, Play, GitBranch, Clock, TrendingDown, AlertTriangle, ArrowRight, Bot,
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useSim } from '../store/SimContext'
import { api } from '../lib/api'
import { Card, Loading, Empty, Bar, Gauge, RiskBadge } from '../components/common'

const SCENARIO_LETTERS = {
  no_action: 'A', revoke_credentials: 'B', isolate_endpoint: 'C', block_path: 'D', isolate_revoke: 'E',
}
const SCEN_NARRATIVE = {
  no_action: 'No intervention. The attacker continues unchecked to the full blast radius.',
  revoke_credentials: 'Revoke the compromised credentials — the attacker loses this identity vector.',
  isolate_endpoint: 'Isolate the origin endpoint — containment but some business disruption.',
  block_path: 'Block the network path — stops one route but attacker may pivot.',
  isolate_revoke: 'Isolate the endpoint and revoke credentials — minimum simulated impact.',
}

export default function CounterfactualReplay({ go }) {
  const { state, dispatch } = useSim()
  const [interventionPts, setInterventionPts] = useState([])
  const [idx, setIdx] = useState(null)
  const [busy, setBusy] = useState(false)
  const [activeAction, setActiveAction] = useState(null)
  const [adaptive, setAdaptive] = useState(null)

  useEffect(() => {
    api.intervention(state.scenarioId || 'S2').then(d => {
      setInterventionPts(d.points || [])
      const ls = d.last_safe ? d.points.findIndex(p=>p.idx===d.last_safe.idx) : d.points.length-1
      setIdx(ls >= 0 ? ls : 0)
    })
  }, [state.scenarioId])

  async function runReplay() {
    setBusy(true); setActiveAction(null); setAdaptive(null)
    const d = await api.counterfactual(state.scenarioId || 'S2', interventionPts[idx]?.idx ?? idx)
    dispatch({ type: 'SET_COUNTERFACTUAL', data: d })
    setBusy(false)
  }

  const cf = state.counterfactual
  const results = cf?.results || {}

  async function showAdaptation(actionId) {
    setActiveAction(actionId)
    const r = await api.simulateDefense(actionId)
    setAdaptive(r)
  }

  return (
    <div className="space-y-4">
      <Header />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="space-y-4">
          <Card title="Replay Incident" subtitle="Freeze the timeline · branch into simulated futures"
            accent="#a78bfa"
            right={<button onClick={runReplay} disabled={busy} className="flex items-center gap-1.5 chip bg-accent text-black font-bold px-3 py-1.5 hover:brightness-110 disabled:opacity-50">
              {busy ? <RotateCcw size={13} className="animate-spin"/> : <Play size={13}/>} REPLAY INCIDENT</button>}>
            <p className="text-[12px] text-mut mb-3">What if we had acted earlier? Choose the intervention point, then re-run the state-transition engine into multiple futures.</p>
            <div className="text-[11px] text-mut mb-1">Intervention point</div>
            {interventionPts.length===0 ? <Loading text="Loading timeline…"/> : (
              <div className="flex flex-wrap gap-1.5">
                {interventionPts.map(pt=>(
                  <button key={pt.idx} onClick={()=>setIdx(interventionPts.findIndex(x=>x.idx===pt.idx))}
                    className={`px-2 py-1 rounded-md border text-[11px] ${interventionPts[idx]?.idx===pt.idx?'border-accent bg-accent/15 text-white':'border-edge text-mut'}`}>
                    {pt.ts} <span className="opacity-70">· {pt.class}</span>
                  </button>
                ))}
              </div>
            )}
            {interventionPts[idx] && <div className="mt-3 text-[11px] text-mut">Selected: <b className="text-white">{interventionPts[idx].ts}</b> ({interventionPts[idx].stage}) — {interventionPts[idx].class} window</div>}
          </Card>

          <Card title="The intervention question" accent="#4ea1ff">
            <div className="space-y-3 text-[12px]">
              <Question k="What did the defender know at this moment?" v="Behavioral risk, correlated intent, reconstructed graph, predicted next target and blast radius were all available." />
              <Question k="What action was available?" v="Six candidate responses from least- to most-disruptive — revoke, isolate, block path, isolate+revoke, or shutdown." />
              <Question k="What would have happened under each?" v="Run the counterfactual engine below; each action produces a distinct simulated future." />
            </div>
            <div className="mt-3 flex gap-1.5 text-[11px] text-mut"><AlertTriangle size={13} className="shrink-0 text-warn mt-0.5"/>All futures are SIMULATED / ESTIMATED — never presented as audited figures.</div>
          </Card>
        </div>

        <div className="xl:col-span-2">
          {!cf ? (
            <Card title="Alternate futures" subtitle="Press REPLAY INCIDENT to run the branch">
              <Empty icon={<GitBranch size={30}/>} text="No replay yet. Choose an intervention point and replay the incident." />
            </Card>
          ) : (
            <div className="space-y-4">
              <Card title="Scenario comparison" subtitle={`Decision point ${cf.decision_timestamp} · ${cf.scenario_id}`}
                accent="#a78bfa" right={<RiskBadge score={100-(cf.results?.isolate_revoke?.affected||1)*10} />}>
                <ScenarioTable results={results} onSelect={showAdaptation} active={activeAction} />
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card title="Adaptive attacker response" subtitle="Defender vs adaptive attacker">
                  {adaptive ? (
                    <div className="text-[12px]">
                      <div className="chip bg-accent/15 text-accent mb-2">{adaptive.adaptive?.defense || ''}</div>
                      <p className="text-white/90"><b className="text-warn">Attacker adapts:</b> {adaptive.adaptive?.response}</p>
                      <div className="mt-2 grid grid-cols-1 gap-1 text-[11px]">
                        <PathRow label="Original path" path={adaptive.adaptive?.original_path} color="#ff5d6c" />
                        <PathRow label="Alternative path" path={adaptive.adaptive?.alternative_path} color="#ffb454" />
                        <PathRow label="Blocked" path={adaptive.adaptive?.blocked} color="#3dd68c" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.keys(SCENARIO_LETTERS).filter(k=>k!=='no_action').map(a=>(
                        <button key={a} onClick={()=>showAdaptation(a)}
                          className={`px-2.5 py-1.5 rounded-md border text-[11px] ${activeAction===a?'border-accent bg-accent/15 text-white':'border-edge text-mut hover:text-white'}`}>
                          Model adaptation for {SCENARIO_LETTERS[a]}
                        </button>
                      ))}
                    </div>
                  )}
                </Card>

                <Card title="Timing sensitivity" subtitle="Affected systems by intervention time (isolate+revoke)">
                  {cf.sweep?.length ? (
                    <div className="h-44">
                      <ResponsiveContainer>
                        <LineChart data={cf.sweep} margin={{top:5,right:10,left:-20,bottom:0}}>
                          <CartesianGrid stroke="#1c2a44" strokeDasharray="3 3"/>
                          <XAxis dataKey="intervention_event" stroke="#8fa3c7" fontSize={10}/>
                          <YAxis stroke="#8fa3c7" fontSize={10} allowDecimals={false}/>
                          <Tooltip contentStyle={{background:'#0c1322',border:'1px solid #1c2a44',fontSize:11}} formatter={(v)=>[`${v} systems`,'Affected']} labelFormatter={(l)=>`Intervention after event #${l}`}/>
                          <Line type="monotone" dataKey="affected" stroke="#4ea1ff" strokeWidth={2} dot={{r:3}}/>
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <Empty text="No sweep data."/>}
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>

      <MissedImpactStrip go={go} />
    </div>
  )
}

function ScenarioTable({ results, onSelect, active }) {
  const rows = Object.entries(results).map(([id, o]) => ({ id, ...o }))
  const bestAffected = Math.min(...rows.map(r=>r.affected))
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead><tr className="text-left text-[10px] uppercase tracking-wider text-mut">
          <th className="py-2">Scenario</th><th>Systems</th><th>Exposure</th><th>Downtime</th><th>Impact</th><th>Adapt</th>
        </tr></thead>
        <tbody>
          {rows.map(r=>{
            const impactColor = r.impact==='LOW'?'#3dd68c':r.impact==='MODERATE'?'#ffb454':'#ff3b52'
            return (
              <tr key={r.id} className={`border-t border-edge/50 ${active===r.id?'bg-accent/5':''}`}>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] flex items-center justify-center font-bold">{SCENARIO_LETTERS[r.id]}</span>
                    <button onClick={()=>onSelect(r.id)} className="text-white font-medium hover:text-accent">{r.label}</button>
                  </div>
                  <div className="text-[10px] text-mut mt-0.5 pl-7">{SCEN_NARRATIVE[r.id]}</div>
                </td>
                <td className="mono font-bold" style={{color:r.affected===bestAffected&&r.impact!=='HIGH'?'#3dd68c':'#fff'}}>{r.affected}</td>
                <td className="mono">{r.exposure_pct}%</td>
                <td className="mono">{r.downtime_h}h</td>
                <td><span className="chip" style={{color:impactColor,background:`${impactColor}1f`}}>{r.impact}</span></td>
                <td><button onClick={()=>onSelect(r.id)} className="text-[11px] text-accent hover:underline">model</button></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="mt-2 text-[10px] text-mut">SIMULATED figures from the state-transition engine.</div>
    </div>
  )
}

function MissedImpactStrip({ go }) {
  const { state } = useSim()
  const m = state.missedImpact
  if (!m) return null
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card title="Missed impact attribution" accent="#ff7a4d">
        <div className="text-[11px] text-mut mb-2">ACTUAL vs BEST FEASIBLE (SIMULATED ESTIMATE)</div>
        <div className="grid grid-cols-3 gap-2 text-center mb-3">
          <div className="panel-soft rounded-lg py-2"><div className="text-xl font-bold text-danger">{m.avoidable_systems}</div><div className="text-[9px] text-mut">avoidable systems</div></div>
          <div className="panel-soft rounded-lg py-2"><div className="text-xl font-bold text-warn">{m.avoidable_exposure}%</div><div className="text-[9px] text-mut">avoidable exposure</div></div>
          <div className="panel-soft rounded-lg py-2"><div className="text-xl font-bold text-white">{m.avoidable_downtime_h}h</div><div className="text-[9px] text-mut">avoidable downtime</div></div>
        </div>
        <div className="space-y-1.5">
          <ImpactBar label="Actual impact" affected={m.actual?.affected||0} color="#ff3b52"/>
          <ImpactBar label="Best counterfactual" affected={m.best_counterfactual?.affected||0} color="#3dd68c"/>
          <ImpactBar label="Potentially avoided" affected={m.avoidable_systems||0} color="#ffb454" filled/>
        </div>
      </Card>
      <Card title="Defense Regret" accent="#a78bfa" right={<span className="text-[10px] text-mut">gap to best response</span>}>
        <Gauge value={Math.round(m.defense_regret||0)} label="DEFENSE REGRET SCORE" sub={`${m.actual?.affected||0} vs ${m.best_counterfactual?.affected||0} systems`} />
        <p className="text-[11px] text-mut mt-2">Earlier credential revocation could have significantly reduced simulated propagation.</p>
        <button onClick={()=>go('alt')} className="mt-2 text-accent text-[11px] flex items-center gap-1 hover:underline">See alternate realities <ArrowRight size={12}/></button>
      </Card>
      <Card title="Visual: impact avoided" accent="#3dd68c">
        <div className="space-y-3">
          <ImpactVisual label="Actual impact" n={m.actual?.affected||0} total={Math.max(m.actual?.affected||1,m.best_counterfactual?.affected||1,1)} color="#ff3b52"/>
          <ImpactVisual label="Best counterfactual" n={m.best_counterfactual?.affected||0} total={Math.max(m.actual?.affected||1,m.best_counterfactual?.affected||1,1)} color="#3dd68c"/>
          <div className="panel-soft rounded-lg p-2 text-[11px] text-mut">Note: {m.note}</div>
        </div>
      </Card>
    </div>
  )
}
function ImpactBar({label,affected,color,filled}){
  const max=8
  return <div className="flex items-center gap-2 text-[11px]"><span className="w-32 text-mut">{label}</span>
    <div className="flex gap-0.5 flex-1">{Array.from({length:max}).map((_,i)=><span key={i} className="flex-1 h-3 rounded-sm" style={{background:(i<affected)?color:'#1c2a44'}}/>)}</div>
    <span className="mono w-6 text-right">{affected}</span></div>
}
function ImpactVisual({label,n,total,color}){
  const w=Math.round(n/Math.max(total,1)*100)
  return <div className="flex items-center gap-2"><span className="text-[10px] text-mut w-32">{label}</span>
    <div className="flex-1 h-3 rounded bg-edge/40 overflow-hidden"><div className="h-full" style={{width:`${w}%`,background:color}}/></div><span className="text-[11px] mono">{n}</span></div>
}
function Header(){return (<div><h1 className="text-xl font-bold text-white">Counterfactual Replay</h1><p className="text-[12px] text-mut">The core USP — branch the incident and measure what each action would have caused.</p></div>)}
function PathRow({label,path,color}){
  return <div className="flex items-start gap-1.5"><span className="w-28 text-mut shrink-0">{label}</span><div className="flex flex-wrap gap-1">{path?.length?path.map((p,i)=><span key={p+i} className="chip text-[9px]" style={{color,background:`${color}1a`}}>{p}</span>):<span className="text-mut">none</span>}</div></div>
}
function Question({k,v}){return <div><div className="text-white font-semibold text-[12px]">{k}</div><div className="text-mut">{v}</div></div>}
