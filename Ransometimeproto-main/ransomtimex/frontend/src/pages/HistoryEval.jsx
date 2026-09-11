import React from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, BarChart, Bar, Cell, Legend, ReferenceLine,
} from 'recharts'
import { History, FlaskConical, TrendingUp, TrendingDown, ShieldCheck, Timer } from 'lucide-react'
import { useSim } from '../store/SimContext'
import { Card, MetricCard, Empty, SevChip, KeyVal } from '../components/common'
import { riskColor } from '../lib/theme'

const TRENDS = Array.from({length:8}).map((_,i)=>({
  name: `I${String(i+1).padStart(3,'0')}`,
  defense_effect: Math.round(60+i*3.2),
  propagation: Math.max(1, Math.round(9-i*1.1)),
  mttd: Math.round(150-i*17),   // seconds
  mttr: Math.round(300-i*28),
}))

export default function HistoryEval({ go }) {
  const { state, refresh } = useSim()
  const inc = state.incidents || []
  const evalData = state.evalData
  const avgRegret = inc.length ? Math.round(inc.reduce((a,x)=>a+(x.defense_regret||0),0)/inc.length) : 0

  React.useEffect(() => { refresh('eval'); refresh('incidents') }, [])

  return (
    <div className="space-y-4">
      <Header inc={inc} avgRegret={avgRegret} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={History} label="Incidents logged" value={inc.length} tone="info" sub="this demo" />
        <MetricCard icon={FlaskConical} label="Avg defense regret" value={`${avgRegret}%`} tone="warn" sub="gap to best response" />
        <MetricCard icon={Timer} label="MTTD" value={lastOf(TRENDS,'mttd')+'s'} tone="ok" sub="trending down" />
        <MetricCard icon={Timer} label="MTTR" value={lastOf(TRENDS,'mttr')+'s'} tone="ok" sub="trending down" />
      </div>

      <Card title="Incident register" subtitle="Every decision is stored — recommended action, outcome, regret, best counterfactual"
        accent="#4ea1ff">
        {inc.length===0 ? <Empty icon={<History size={28}/>} text="No incidents yet — run and complete a simulation to populate history." /> :
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead><tr className="text-left text-[10px] uppercase text-mut">
                <th className="py-2 pr-3">ID</th><th className="pr-3">Risk</th><th className="pr-3">Attack stage</th>
                <th className="pr-3">Assets</th><th className="pr-3">Response</th><th className="pr-3">Regret</th>
                <th className="pr-3">Impact</th><th>Playbook</th>
              </tr></thead>
              <tbody>
                {inc.map((r,i)=>{
                  const affected = r.actual_outcome?.affected ?? r.outcome?.affected ?? (Array.isArray(r.affected_assets)?r.affected_assets.length:0)
                  const imp = r.actual_outcome?.impact || r.outcome?.impact || '—'
                  return (
                    <tr key={r.id} className="border-t border-edge/40 align-top">
                      <td className="py-2 pr-3 mono font-bold text-white">{r.id}</td>
                      <td className="pr-3"><span className="mono" style={{color:riskColor(r.risk_score||0)}}>{Math.round(r.risk_score||0)}</span></td>
                      <td className="pr-3 text-mut max-w-[150px] truncate">{r.attack_stage}</td>
                      <td className="pr-3 mono">{affected}</td>
                      <td className="pr-3 text-white/85">{r.actual_outcome?.label || r.recommended_action}</td>
                      <td className="pr-3 mono" style={{color: (r.defense_regret||0)>75?'#ff3b52':(r.defense_regret||0)>45?'#ffb454':'#3dd68c'}}>{Math.round(r.defense_regret||0)}%</td>
                      <td className="pr-3"><SevChip level={imp==='LOW'?'ok':imp==='MODERATE'?'high':'critical'}>{imp}</SevChip></td>
                      <td className="text-[10px] text-mut">{r.best_counterfactual ? 'v2 proposed' : 'baseline'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>}
      </Card>

      {/* trends */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Defense effectiveness over time" accent="#3dd68c">
          <TrendLine data={TRENDS} k="defense_effect" color="#3dd68c" label="Effectiveness %" />
        </Card>
        <Card title="Systems affected per incident" subtitle="Propagation reduction as playbook improves" accent="#ff3b52">
          <TrendLine data={TRENDS} k="propagation" color="#ff3b52" label="Systems" reverse />
        </Card>
        <Card title="MTTD / MTTR trend" subtitle="Seconds — faster response over time" accent="#4ea1ff">
          <div className="h-52">
            <ResponsiveContainer>
              <LineChart data={TRENDS} margin={{top:5,right:10,left:-22,bottom:0}}>
                <CartesianGrid stroke="#1c2a44" strokeDasharray="3 3"/>
                <XAxis dataKey="name" stroke="#8fa3c7" fontSize={10}/>
                <YAxis stroke="#8fa3c7" fontSize={10}/>
                <Tooltip contentStyle={{background:'#0c1322',border:'1px solid #1c2a44',fontSize:11}}/>
                <Legend wrapperStyle={{fontSize:10}}/>
                <Line type="monotone" dataKey="mttd" name="MTTD (s)" stroke="#4ea1ff" strokeWidth={2}/>
                <Line type="monotone" dataKey="mttr" name="MTTR (s)" stroke="#a78bfa" strokeWidth={2}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Recommendation improvement" subtitle="Share of recommended actions that matched best counterfactual" accent="#ffb454">
          <AreaTrend />
        </Card>
      </div>

      {/* Evaluation */}
      <Evaluation evalData={evalData} refresh={refresh} />
    </div>
  )
}

function TrendLine({data,k,color,label,reverse}){
  return (
    <div className="h-48">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{top:5,right:10,left:-22,bottom:0}}>
          <defs><linearGradient id={`g${k}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35}/><stop offset="100%" stopColor={color} stopOpacity={0}/>
          </linearGradient></defs>
          <CartesianGrid stroke="#1c2a44" strokeDasharray="3 3"/>
          <XAxis dataKey="name" stroke="#8fa3c7" fontSize={10}/>
          <YAxis stroke="#8fa3c7" fontSize={10} allowDecimals={false} domain={reverse?[0,'dataMax']:undefined}/>
          <Tooltip contentStyle={{background:'#0c1322',border:'1px solid #1c2a44',fontSize:11}}/>
          <Area type="monotone" dataKey={k} name={label} stroke={color} fill={`url(#g${k})`} strokeWidth={2}/>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function AreaTrend(){
  const data = TRENDS.map((t,i)=>({name:t.name, rec: Math.min(100, 60+i*5+ (i%3)) , fp: Math.max(2, 30-i*3)}))
  return (
    <div className="h-48">
      <ResponsiveContainer>
        <BarChart data={data} margin={{top:5,right:10,left:-22,bottom:0}}>
          <CartesianGrid stroke="#1c2a44" strokeDasharray="3 3"/>
          <XAxis dataKey="name" stroke="#8fa3c7" fontSize={10}/>
          <YAxis stroke="#8fa3c7" fontSize={10} allowDecimals={false}/>
          <Tooltip contentStyle={{background:'#0c1322',border:'1px solid #1c2a44',fontSize:11}}/>
          <Legend wrapperStyle={{fontSize:10}}/>
          <Bar dataKey="rec" name="Recommendation match %" fill="#4ea1ff" radius={[4,4,0,0]}/>
          <Bar dataKey="fp" name="False positives" fill="#ffb454" radius={[4,4,0,0]}/>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function Evaluation({ evalData, refresh }) {
  const [busy, setBusy] = React.useState(false)
  async function run() { setBusy(true); try { await refresh('eval-run') } finally { setBusy(false) } }
  async function reset() { setBusy(true); try { await refresh('eval-reset') } finally { setBusy(false) } }
  if (!evalData) return <Card><Empty icon={<FlaskConical size={26}/>} text="Evaluation metrics not loaded." />
    <div className="text-center mt-2"><button onClick={run} className="chip bg-accent/20 text-accent">Run Evaluation</button></div></Card>
  const { metrics, note } = evalData
  const top = metrics.filter(m=>['Precision','Recall','F1 Score','False Positive Rate','Detection Latency'].includes(m.metric))
  return (
    <Card title="Evaluation — Rule-based baseline vs RansomTime-X" subtitle="Simulated / experimental comparison" accent="#a78bfa"
      right={<div className="flex gap-1.5">
        <button onClick={run} disabled={busy} className="chip bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-50">Run Evaluation</button>
        <button onClick={reset} disabled={busy} className="chip bg-white/5 text-mut hover:text-white disabled:opacity-50">Reset</button>
        <span className="text-[9px] text-mut self-center">SIMULATED RESULTS</span>
      </div>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={top} layout="vertical" margin={{top:5,right:20,left:10,bottom:0}}>
              <CartesianGrid stroke="#1c2a44" strokeDasharray="3 3"/>
              <XAxis type="number" stroke="#8fa3c7" fontSize={10} domain={[0,100]}/>
              <YAxis type="category" dataKey="metric" stroke="#dfe7f3" fontSize={11} width={120}/>
              <Tooltip contentStyle={{background:'#0c1322',border:'1px solid #1c2a44',fontSize:11}}/>
              <Legend wrapperStyle={{fontSize:10}}/>
              <Bar dataKey="baseline" name="Rule-based baseline" fill="#ff5d6c" radius={[0,3,3,0]}/>
              <Bar dataKey="rtx" name="RansomTime-X" fill="#3dd68c" radius={[0,3,3,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="overflow-y-auto max-h-72 pr-1">
          {metrics.map(m=>{
            const better = m.higher ? m.rtx>m.baseline : m.rtx<m.baseline
            return (
              <div key={m.metric} className="flex items-center justify-between py-1.5 border-b border-edge/40 text-[12px]">
                <span className="text-white">{m.metric}</span>
                <span className="flex items-center gap-2">
                  <span className="mono text-[11px] text-danger/70 line-through decoration-danger/50">{fmtNum(m.baseline)}{m.unit}</span>
                  <span className="mono text-[11px] text-white font-bold">{fmtNum(m.rtx)}{m.unit}</span>
                  {m.baseline===0 ? <span className="text-[9px] text-accent">new</span> :
                    <span className="text-[10px]" style={{color:better?'#3dd68c':'#ff5d6c'}}>{better?'▲':'▼'}</span>}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-2 text-[11px] text-warn flex gap-1.5"><ShieldCheck size={13} className="shrink-0 mt-0.5"/>{note}</div>
      <p className="text-[11px] text-mut mt-1">Demo results update dynamically as incidents complete — they reflect the synthetic scenario, not production telemetry.</p>
    </Card>
  )
}

function fmtNum(v){ if(typeof v==='number') return (Math.round(v*100)/100); return v }
function lastOf(arr,k){ return arr.length?arr[arr.length-1][k]:'—' }
function Header({inc,avgRegret}){ return <div className="flex flex-wrap items-center justify-between gap-2"><div><h1 className="text-xl font-bold text-white">Incident History &amp; Evaluation</h1><p className="text-[12px] text-mut">Per-incident defense regret, counterfactual comparison, and baseline-vs-RansomTime-X metrics.</p></div><div className="text-[10px] text-mut">All figures SIMULATED / ESTIMATED.</div></div> }
