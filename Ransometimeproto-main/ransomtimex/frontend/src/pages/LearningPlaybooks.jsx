import React, { useEffect, useState } from 'react'
import { GraduationCap, BookOpen, Check, X, Eye, RefreshCw, Sparkles } from 'lucide-react'
import { useSim } from '../store/SimContext'
import { Card, Empty, Loading } from '../components/common'

export default function LearningPlaybooks() {
  const { state, refresh, proposePlaybook, approvePlaybook, rejectPlaybook } = useSim()
  const pb = state.playbook
  const proposed = state.proposedUpdate
  const [showDiff, setShowDiff] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [actingMsg, setActingMsg] = useState(null)

  useEffect(() => { refresh('playbook'); refresh('memory') }, [])

  async function accept() {
    setAccepting(true); setActingMsg(null)
    try { await approvePlaybook(); setActingMsg('Playbook update approved and now ACTIVE.') }
    catch (e) { setActingMsg('Could not approve: ' + (e?.message || e)) }
    setAccepting(false)
  }
  async function reject() {
    setRejecting(true); setActingMsg(null)
    try { await rejectPlaybook(); setActingMsg('Proposal rejected — baseline playbook unchanged.') }
    catch (e) { setActingMsg('Could not reject: ' + (e?.message || e)) }
    setRejecting(false)
  }

  const current = pb?.current

  return (
    <div className="space-y-4">
      <Header />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Defense Memory" subtitle="Organizational learning — patterns that repeat"
          accent="#a78bfa"
          right={<span className="chip bg-accent/15 text-accent">{state.memory.length} remembered</span>}>
          {state.memory.length===0 ? <Empty icon={<BookOpen size={26}/>} text="Complete an incident to record its defense memory." /> :
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {state.memory.map((m,i)=>(
                <div key={i} className="rounded-lg panel-soft p-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-mut uppercase tracking-wide">Pattern</span>
                    <span className="mono text-white/80 text-[10px]">{m.pattern}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5 text-[11px]">
                    <span className="chip bg-accent/15 text-accent">Defense: {m.defense_used}</span>
                    <span className="chip bg-ok/15 text-ok">{m.outcome}</span>
                    <span className="chip text-[10px]" style={{color:m.impact==='LOW'?'#3dd68c':m.impact==='MODERATE'?'#ffb454':'#ff3b52',background:'rgba(255,255,255,.05)'}}>Impact {m.impact}</span>
                  </div>
                  <div className="text-[11px] text-mut mt-1.5"><span className="text-white">Future recommendation:</span> {m.future_recommendation}</div>
                  <div className="flex items-center justify-between mt-1 text-[10px]">
                    <span className="text-mut">Decision quality</span>
                    <span className="mono text-white">{Math.round((m.decision_quality||0)*100)}%</span>
                  </div>
                </div>
              ))}
            </div>}
          <div className="mt-3 text-[11px] text-mut flex gap-1.5"><Sparkles size={13} className="text-accent shrink-0 mt-0.5"/>RansomTime-X learns <b className="text-white">organization-specific</b> patterns, not generic ones.</div>
        </Card>

        <div className="space-y-4">
          <Card title="Playbook evolution" subtitle="Proposed update from the last incident" accent="#3dd68c">
            {proposed ? (
              <div className="rounded-lg border border-ok/30 bg-ok/5 p-3">
                <div className="chip bg-ok/20 text-ok mb-2">PROPOSED v{proposed.version} (not yet applied)</div>
                <p className="text-[12px] text-white/90">{proposed.rationale}</p>
                <div className="text-[11px] text-mut mt-2">Applying it never modifies live controls silently — it awaits your decision below.</div>
                {showDiff && (
                  <div className="mt-2 rounded-md border border-accent/20 bg-accent/5 p-2 text-[11px] fade-in">
                    <div className="text-white font-semibold mb-1">Proposed change</div>
                    <div className="text-mut">Reorder actions: <b className="text-ok">revoke_credentials</b> before <b className="text-ok">isolate_endpoint</b> when a compromised user account is detected and no critical workload runs on the endpoint.</div>
                    <div className="text-mut mt-1">Old order: isolate_endpoint → revoke_credentials → protect_file_server</div>
                    <div className="text-mut">New order: <b className="text-ok">revoke_credentials → isolate_endpoint</b> → protect_file_server</div>
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <button onClick={accept} disabled={accepting} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-ok text-black text-[12px] font-bold hover:brightness-110 disabled:opacity-50"><Check size={14}/> {accepting?'Applying…':'Accept update'}</button>
                  <button onClick={()=>setShowDiff(s=>!s)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg panel-soft text-mut text-[12px] hover:text-white"><Eye size={14}/> {showDiff?'Hide':'Review'} diff</button>
                  <button onClick={reject} disabled={rejecting} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-danger/40 text-danger text-[12px] hover:bg-danger/10 disabled:opacity-50"><X size={14}/> {rejecting?'Rejecting…':'Reject'}</button>
                </div>
                {actingMsg && <div className="mt-2 text-[11px] text-info">{actingMsg}</div>}
              </div>
            ) : (
              <div className="text-center py-4">
                <Empty icon={<Sparkles size={26}/>} text="No pending proposal. Complete an incident to auto-generate a playbook update." />
                <button onClick={proposePlaybook} className="mt-2 text-[11px] text-accent flex items-center gap-1 mx-auto">Propose update from last outcome <RefreshCw size={11}/></button>
              </div>
            )}
          </Card>

          <Card title="Current playbook" subtitle={current?.name} accent="#4ea1ff"
            right={<span className="chip bg-ok/15 text-ok">{current?.state} · v{current?.version}</span>}>
            {!current ? <Loading/> : <YamlViewer pb={current} highlight={proposed?.version>1} />}
          </Card>
        </div>
      </div>
      <LearnStatement />
    </div>
  )
}

function YamlViewer({ pb, highlight }) {
  // normalize: pb has parsed trigger/actions/approval dicts (from backend) OR we build
  const actions = pb.actions || []
  const conditions = { compromised_account: true, suspicious_network_connection: true, ...(highlight ? { no_critical_workload_on_endpoint: true } : {}) }
  const obj = {
    playbook: { name: pb.name || 'ransomware_lateral_movement_response' },
    trigger: pb.trigger || { risk_score: '>80', attack_stage: 'lateral_movement' },
    conditions,
    actions,
    approval: pb.approval || { risk_level: 'high', human_approval: true },
    verification: ['check_attack_activity', 'verify_containment'],
    learning: { store_outcome: true, propose_update: true },
  }
  const yaml = renderYaml(obj)
  return (
    <pre className="mono text-[11px] leading-relaxed overflow-x-auto p-0">{colorize(yaml)}</pre>
  )
}

function renderYaml(o, indent=0, out=[]){
  const sp=' '.repeat(indent)
  if(Array.isArray(o)){ o.forEach(v=>{ out.push(`${sp}- ${typeof v==='object'?JSON.stringify(v):v}`) }) ; return out }
  Object.entries(o).forEach(([k,v])=>{
    if(v && typeof v==='object'){ out.push(`${sp}${k}:`); renderYaml(v, indent+2, out) }
    else { const str = typeof v==='string' ? (v.startsWith('>')||v.includes(' ')?`"${v}"`:v) : (v===true?'true':v===false?'false':String(v)); out.push(`${sp}${k}: ${str}`) }
  })
  return out
}

function colorize(lines){
  return lines.map((ln,i)=>{
    if(!ln.trim()) return <span key={i}>&nbsp;</span>
    const m=ln.match(/^(\s*)(- )?([A-Za-z_]+): ?(.*)$/)
    if(m && m[2]){ // bullet action
      return <span key={i} className="yaml-s block">{m[1]}<span className="text-[#7dd3fc]">{m[2]}</span>{m[3]}</span>
    }
    if(m){ return <span key={i} className="block"><span className="text-[#cbd5e1]">{m[1]}</span><span className="yaml-k">{m[3]}</span><span className="text-[#cbd5e1]">:</span> {quoteVal(m[4])}</span> }
    return <span key={i} className="block text-[#cbd5e1]">{ln}</span>
  })
}
function quoteVal(v){
  if(!v) return <span className="yaml-s">-</span>
  if(v.startsWith('"')||v.startsWith("'")) return <span className="yaml-s">{v}</span>
  if(v==='true'||v==='false') return <span className="yaml-n">{v}</span>
  if(/^-?\d/.test(v)) return <span className="yaml-n">{v}</span>
  return <span className="yaml-s">{v}</span>
}

function LearnStatement(){
  return (
    <Card accent="#3dd68c">
      <div className="flex flex-col md:flex-row items-start gap-4">
        <GraduationCap className="text-accent shrink-0 mt-1" size={28}/>
        <div>
          <div className="font-bold text-white mb-1">How do we defend better next time?</div>
          <p className="text-[12px] text-mut">Every incident feeds a learning loop: it records the pattern & outcome as defense memory, proposes a targeted playbook update, and — once you approve it — the next simulated attack is defended using the improved playbook. Defenses never change silently; humans stay in control.</p>
        </div>
      </div>
    </Card>
  )
}
function Header(){return <div><h1 className="text-xl font-bold text-white">Learning &amp; Playbooks</h1><p className="text-[12px] text-mut">Defense memory, playbook evolution and the version-controlled YAML that drives response.</p></div>}
