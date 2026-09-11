import React, { useEffect, useState } from 'react'
import { Hourglass, Play, ChevronRight, Info } from 'lucide-react'
import { useSim } from '../store/SimContext'
import { api } from '../lib/api'
import { Card, Loading, Empty, Bar, ErrorBox } from '../components/common'

const CLASS_COLOR = {
  BEST: '#3dd68c', SAFE: '#4ea1ff', GOOD: '#a78bfa', RISKY: '#ffb454', 'TOO LATE': '#ff3b52',
}

export default function InterventionWindow({ go }) {
  const { state } = useSim()
  const [data, setData] = useState(null)
  const [idx, setIdx] = useState(null)
  const [sid, setSid] = useState('S2')
  const [err, setErr] = useState(null)

  useEffect(() => {
    let alive = true
    api.intervention(sid)
      .then(d => { if (alive && d && d.points) { setData(d); setErr(null); setIdx(d.last_safe ? d.points.findIndex(p=>p.idx===d.last_safe.idx) : d.points.length-1) } })
      .catch(e => { if (alive) setErr(String(e?.message || e)) })
    return () => { alive = false }
  }, [sid])

  const p = data?.points?.[idx]

  return (
    <div className="space-y-4">
      <Header state={state} />
      <div className="flex gap-2">
        <select value={sid} onChange={e=>setSid(e.target.value)} className="bg-[#0e1730] border border-edge rounded-md px-2 py-1 text-[12px]">
          <option value="S2">Scenario: Compromised Endpoint (S2)</option>
          <option value="S1">Scenario: Phishing Credential (S1)</option>
        </select>
      </div>

      {err ? <ErrorBox msg={err} onRetry={() => { setErr(null); setData(null) }} />
        : !data ? <Loading text="Building intervention timeline…" /> : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card title="Intervention Timeline" subtitle="Drag the slider — when would YOU have acted?"
              accent="#a78bfa"
              right={<button onClick={()=>go('replay')} className="text-[11px] text-accent flex items-center gap-1 hover:underline">Counterfactual replay <ChevronRight size={12}/></button>}>
              <Timeline points={data.points} lastSafe={data.last_safe} />
              <div className="mt-4 pt-3 border-t border-edge/60">
                <div className="flex justify-between text-[12px] text-mut mb-2">
                  <span>Drag to position: <b className="text-white mono">{p?.ts}</b> · {p?.stage}</span>
                  <span className="chip" style={{ color: CLASS_COLOR[p?.class], background: `${CLASS_COLOR[p?.class]}1f` }}>{p?.class} WINDOW</span>
                </div>
                <input type="range" min={0} max={data.points.length-1} value={idx}
                  onChange={e=>setIdx(Number(e.target.value))} className="w-full" />
                <div className="flex justify-between text-[10px] mono text-mut mt-1">
                  {data.points.map(pt=><span key={pt.idx} onClick={()=>setIdx(pt.idx)} className="cursor-pointer hover:text-white">{pt.ts.slice(0,5)}</span>)}
                </div>
              </div>
            </Card>

            <Card title="Impact if you intervene at this point" accent="#ff7a4d">
              <ImpactProjection p={p} />
            </Card>
          </div>

          <div className="space-y-4">
            <Card title="Last safe intervention" accent="#3dd68c">
              {data.last_safe ? (
                <div>
                  <div className="text-3xl font-black mono text-ok">{data.last_safe.ts}</div>
                  <div className="text-[12px] text-mut mt-1">Acting at or before this timestamp keeps the blast to a minimum.</div>
                  <div className="text-[11px] text-mut mt-2">Before 10:04 → <b className="text-ok">Low</b> impact · 10:04–10:05 → <b className="text-warn">Moderate</b> · After 10:06 → <b className="text-danger">High</b>.</div>
                </div>
              ) : <Empty text="No safe window." />}
            </Card>
            <Card title="Period legend" subtitle="Intervention-window classification">
              <div className="space-y-2">
                {Object.entries(CLASS_COLOR).map(([k,c])=>
                  <div key={k} className="flex items-center gap-2 text-[12px]"><span className="w-3 h-3 rounded" style={{background:c}}/>{k}
                    {k==='BEST'&&<span className="text-mut text-[10px]">≤0:40s</span>}
                    {k==='SAFE'&&<span className="text-mut text-[10px]">0:40–2:20</span>}
                    {k==='GOOD'&&<span className="text-mut text-[10px]">~2:20–3:25</span>}
                    {k==='RISKY'&&<span className="text-mut text-[10px]">~3:25–4:40</span>}
                    {k==='TOO LATE'&&<span className="text-mut text-[10px]">&gt;4:40</span>}
                  </div>)}
              </div>
              <div className="mt-3 text-[11px] text-mut flex gap-1.5"><Info size={13} className="shrink-0 mt-0.5"/>These are SIMULATED projections from the state-transition model, not operational facts.</div>
            </Card>
            <Card title="Why timing matters" accent="#4ea1ff">
              <div className="space-y-2 text-[12px] text-mut">
                <p>Each ~60s of delay lets the attacker reach <b className="text-white">one more hop</b> toward critical storage/backup.</p>
                <p>An early <b className="text-ok">isolate + revoke</b> keeps the affected set near the origin endpoint.</p>
                <button onClick={()=>go('replay')} className="mt-1 text-accent text-[12px] flex items-center gap-1 hover:underline">Explore 'what if earlier' in Counterfactual Replay <Play size={12}/></button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

function Timeline({ points, lastSafe }) {
  const lastSafeIdx = points.findIndex(x=>x.idx===lastSafe.idx)
  const pts = points.map(pt => ({ ...pt, color: CLASS_COLOR[pt.class] }))
  // marker position in percent along the event index range
  const markerPct = (lastSafeIdx / Math.max(1, points.length-1)) * 100
  return (
    <div className="pt-2">
      <div className="relative h-20">
        <div className="absolute inset-x-0 top-8 h-10 rounded-lg flex" style={{ background:'linear-gradient(90deg,#123b2a,#0d2540 30%,#14305c 55%,#6b1f2e 80%,#5a1220)' }} />
        {pts.map((pt, i) => {
          const left = (i / Math.max(1, points.length-1)) * 100
          return (
            <div key={pt.idx} className="absolute top-8 -translate-y-1/2 flex flex-col items-center" style={{ left: `calc(${left}% - 6px)` }}>
              <span className="mono text-[9px] text-white/80 absolute -top-3">{pt.ts.slice(0,5)}</span>
            </div>
          )
        })}
        {/* last safe marker */}
        <div className="absolute -top-1 z-10 flex flex-col items-center" style={{ left: `calc(${markerPct}% )` }}>
          <span className="text-[9px] bg-ok text-black font-bold px-1.5 rounded-full whitespace-nowrap">LAST SAFE {lastSafe?.ts}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mt-1">
        {points.map(pt=>(
          <span key={pt.idx} className="px-1.5 py-0.5 rounded text-[9px] mono" style={{ color: pt.color, background:`${pt.color}1a` }}>{pt.class}</span>
        ))}
      </div>
    </div>
  )
}

function ImpactProjection({ p }) {
  if (!p) return null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <ImpactItem label="Isolate + Revoke here" affected={p.isolate_revoke_affected} color="#3dd68c" note="recommended" />
      <ImpactItem label="Revoke credentials here" affected={p.revoke_affected} color="#4ea1ff" note="" />
      <ImpactItem label="No action from here" affected={p.noaction_affected} color="#ff3b52" note="projected impact" />
    </div>
  )
}
function ImpactItem({ label, affected, color, note }) {
  const bars = Math.min(affected, 8)
  return (
    <div className="panel-soft rounded-lg p-3">
      <div className="text-[11px] text-mut">{label}</div>
      <div className="flex items-baseline gap-1 mt-1"><span className="text-3xl font-black mono" style={{color}}>{affected}</span><span className="text-[11px] text-mut">systems</span></div>
      <div className="flex gap-0.5 mt-2">{Array.from({length:8}).map((_,i)=><span key={i} className="w-2 h-4 rounded-sm" style={{background:i<bars?color:'#1c2a44'}}/>)}</div>
      <div className="text-[10px] text-mut mt-1">{note}</div>
    </div>
  )
}

function Header({ state }) {
  return (
    <div>
      <h1 className="text-xl font-bold text-white">Intervention Window</h1>
      <p className="text-[12px] text-mut">
        When is the best (and last) point to intervene? This maps the active
        {state.scenarioId ? ` ${state.scenarioId} ` : ' '}timeline to the best simulated response time.
      </p>
    </div>
  )
}
