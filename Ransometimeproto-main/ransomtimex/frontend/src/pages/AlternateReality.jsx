import React from 'react'
import { GitFork, Play, CheckCircle2, XCircle, ArrowRight, ShieldCheck } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend, CartesianGrid } from 'recharts'
import { useSim } from '../store/SimContext'
import { api } from '../lib/api'
import { Card, Loading, Empty } from '../components/common'

export default function AlternateReality({ go }) {
  const { state, dispatch } = useSim()
  const cf = state.counterfactual

  async function run() {
    const idx = state.curIndex >= 0 ? state.curIndex : 5
    const d = await api.counterfactual(state.scenarioId || 'S2', idx)
    dispatch({ type: 'SET_COUNTERFACTUAL', data: d })
  }

  const chart = cf ? Object.entries(cf.results).filter(([k])=>['no_action','revoke_credentials','isolate_endpoint','block_path','isolate_revoke'].includes(k))
    .map(([id,o])=>({ name: shortName(o.label), affected: o.affected, downtime: o.downtime_h, exposure: o.exposure_pct })) : []

  const colors = { 'No Action':'#ff3b52', 'Revoke Credentials':'#4ea1ff', 'Isolate Endpoint':'#a78bfa', 'Block Network Path':'#ffb454', 'Isolate + Revoke':'#3dd68c' }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="text-xl font-bold text-white">Alternate Reality</h1>
        <p className="text-[12px] text-mut">Side-by-side of what each decision would have caused — all SIMULATED.</p></div>
        <button onClick={run} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-info/20 border border-info/40 text-info text-[12px] font-semibold hover:bg-info/30">
          <Play size={14}/> {cf ? 'Refresh futures' : 'Run scenario comparison'}
        </button>
      </div>

      {!cf ? (
        <Card><Empty icon={<GitFork size={30}/>} text="Run the counterfactual first (here or in Counterfactual Replay) to compare alternate realities." />
          <div className="text-center"><button onClick={run} className="px-4 py-2 rounded-lg bg-info/20 text-info text-[12px] border border-info/40">Run comparison now</button></div></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <RealityCard title="ACTUAL REALITY (no intervention)"
              o={cf.results.no_action} color="#ff3b52" note="If the incident had run unchecked." />
            <RealityCard title="SCENARIO B — REVOKE"
              o={cf.results.revoke_credentials} color="#4ea1ff" note="Credentials revoked at decision point." />
            <RealityCard title="SCENARIO C — ISOLATE"
              o={cf.results.isolate_endpoint} color="#a78bfa" note="Endpoint isolated at decision point." />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <RealityCard title="SCENARIO D — BLOCK PATH"
              o={cf.results.block_path} color="#ffb454" note="Network path to storage blocked." />
            <RealityCard title="SCENARIO E — REVOKE + ISOLATE"
              o={cf.results.isolate_revoke} color="#3dd68c" note="Recommended minimum-impact defense." highlight />
            <RealityCard title="BEST FEASIBLE (earliest)"
              o={state.missedImpact?.best_counterfactual || cf.results.isolate_revoke} color="#3dd68c" note="Best counterfactual response." />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Systems affected by scenario" accent="#ff5d6c">
              <div className="h-60">
                <ResponsiveContainer>
                  <BarChart data={chart} margin={{top:10,right:10,left:-18,bottom:0}}>
                    <CartesianGrid stroke="#1c2a44" strokeDasharray="3 3"/>
                    <XAxis dataKey="name" stroke="#8fa3c7" fontSize={9} interval={0} angle={-18} textAnchor="end" height={50}/>
                    <YAxis stroke="#8fa3c7" fontSize={10} allowDecimals={false}/>
                    <Tooltip contentStyle={{background:'#0c1322',border:'1px solid #1c2a44',fontSize:11}}/>
                    <Legend wrapperStyle={{fontSize:10}}/>
                    <Bar dataKey="affected" name="Systems affected" radius={[4,4,0,0]}>
                      {chart.map(c=> <Cell key={c.name} fill={colors[cf.results[Object.keys(cf.results).find(k=>shortName(cf.results[k].label)===c.name)]?.label] || '#4ea1ff'}/>)}
                    </Bar>
                    <Bar dataKey="downtime" name="Downtime (h)" fill="#8fa3c7" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="text-[10px] text-mut mt-1">All impact/cost values are SIMULATED / ESTIMATED — never audited financial figures.</div>
            </Card>
            <PredictionVsReality />
          </div>
        </>
      )}
    </div>
  )
}

function RealityCard({ title, o, color, note, highlight }) {
  if (!o) return null
  const impactColor = o.impact==='LOW'?'#3dd68c':o.impact==='MODERATE'?'#ffb454':'#ff3b52'
  return (
    <Card title={title} accent={color}
      right={highlight && <span className="chip bg-ok text-black text-[9px]">RECOMMENDED</span>}>
      <div className="grid grid-cols-2 gap-2 text-center mb-2">
        <div className="panel-soft rounded-lg py-2"><div className="text-xl font-black" style={{color}}>{o.affected}</div><div className="text-[9px] text-mut">systems affected</div></div>
        <div className="panel-soft rounded-lg py-2"><div className="text-xl font-black text-white">{o.exposure_pct}%</div><div className="text-[9px] text-mut">exposure</div></div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center mb-2">
        <div className="panel-soft rounded-lg py-2"><div className="font-bold text-white">{o.downtime_h}h</div><div className="text-[9px] text-mut">downtime</div></div>
        <div className="panel-soft rounded-lg py-2"><span className="chip" style={{color:impactColor,background:`${impactColor}1f`}}>{o.impact} IMPACT</span><div className="text-[9px] text-mut mt-1">estimated</div></div>
      </div>
      <div className="text-[11px] text-mut flex gap-1.5"><ArrowRight size={13} className="shrink-0 mt-0.5" style={{color}}/>{note}</div>
    </Card>
  )
}

function PredictionVsReality() {
  const { state } = useSim()
  const live = state.live || {}
  const predicted = live.prediction?.predicted || '—'
  const confidence = live.prediction?.confidence || 0
  const actual = live.compromised?.includes(predicted) ? predicted : (live.attacker_position || live.compromised?.[live.compromised.length-1] || '—')
  const correct = !!(predicted && predicted !== '—' && actual && predicted === actual)
  return (
    <Card title="Prediction vs Reality" accent="#4ea1ff">
      <div className="grid grid-cols-2 gap-2 text-center">
        <div><div className="text-[10px] text-mut uppercase">Predicted target</div><div className="text-lg font-bold mono text-white">{predicted}</div></div>
        <div><div className="text-[10px] text-mut uppercase">Actual target</div><div className="text-lg font-bold mono text-white">{actual}</div></div>
      </div>
      <div className="flex items-center justify-center gap-2 my-2">
        {correct ? <span className="chip bg-ok/20 text-ok"><CheckCircle2 size={12}/> Result: Correct</span> : <span className="chip bg-danger/20 text-danger"><XCircle size={12}/> Incorrect</span>}
      </div>
      <div className="panel-soft rounded-lg p-3">
        <div className="flex justify-between text-[11px] mb-1"><span className="text-mut">Prediction confidence</span><span className="mono text-white">{Math.round(confidence)}%</span></div>
        <div className="h-2 rounded bg-edge/40 overflow-hidden"><div className="h-full bg-gradient-to-r from-accent to-ok" style={{width:`${confidence}%`}}/></div>
      </div>
      <div className="text-[11px] text-mut mt-2 flex gap-1.5"><ShieldCheck size={13} className="text-ok shrink-0 mt-0.5"/>Outcome is stored to defense memory and used to improve next prediction.</div>
    </Card>
  )
}

function shortName(l){ const m={'No Action':'No Action','Revoke Credentials':'Revoke','Isolate Endpoint':'Isolate','Block Network Path':'Block Path','Isolate + Revoke':'Isol+Revoke'}; return m[l]||l }
