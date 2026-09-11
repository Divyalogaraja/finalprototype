import React, { useState } from 'react'
import { X, ShieldAlert, Check, Ban, Pencil, FlaskConical } from 'lucide-react'
import { useSim } from '../store/SimContext'
import { sevOf } from '../lib/theme'
import { api } from '../lib/api'

export default function ApprovalModal() {
  const { state, dispatch, approve, recommendDecision } = useSim()
  const rec = state.recommend
  const [chosen, setChosen] = useState(null)
  const [approver, setApprover] = useState('SOC Analyst')
  const [reason, setReason] = useState('')
  const [sim, setSim] = useState(null)
  const [simBusy, setSimBusy] = useState(false)
  if (!state.approvalOpen || !rec) return null

  const action = chosen || rec.recommended
  const approval = rec.approval_level || { level: 'HIGH', requirement: 'Mandatory human approval' }
  const sc = sevOf(approval.level)
  const cand = (rec.candidates || []).find(c => c.action_id === action)

  async function simulateFirst() {
    setSimBusy(true); setSim(null)
    try { const r = await api.simulateDefense(action); setSim(r) } catch (e) {}
    setSimBusy(false)
  }

  async function act(decision) {
    const name = decision === 'APPROVED' ? approver : decision === 'REJECTED' ? `${approver}` : approver
    await approve(decision, action, name, reason || rec.reason)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm fade-in p-4">
      <div className="panel rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl border-edge overflow-hidden">
        <header className="flex items-center justify-between px-5 py-4 border-b border-edge bg-gradient-to-r from-danger/15 to-transparent">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="text-danger" size={20} />
            <div>
              <h2 className="font-bold text-white text-[15px]">RECOMMENDED ACTION — Human Approval Required</h2>
              <p className="text-[11px] text-mut">Approval tier: <span className="font-semibold" style={{ color: sc.text }}>{approval.level}</span> · {approval.requirement}</p>
            </div>
          </div>
          <button onClick={() => dispatch({ type: 'CLOSE_APPROVAL' })} className="text-mut hover:text-white"><X size={18} /></button>
        </header>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
            <div className="text-[11px] uppercase tracking-wider text-accent mb-1">Selected action</div>
            <div className="font-bold text-lg text-white">
              {rec.recommended_label} <span className="text-mut font-normal text-[12px]">· {rec.reason}</span>
            </div>
            <div className="flex flex-wrap gap-3 mt-2 text-[12px]">
              <span className="text-mut">Expected containment: <b className="text-ok">{rec.expected_outcome?.containment ?? cand?.containment}%</b></span>
              <span className="text-mut">Downtime: <b className="text-white">~{rec.expected_outcome?.downtime_h ?? '1'}h</b></span>
              <span className="text-mut">Residual risk: <b className="text-warn">{rec.expected_outcome?.residual_risk ?? cand?.outcome?.residual_risk}%</b></span>
              <span className="text-mut">Overall decision score: <b className="text-accent">{cand?.overall ?? rec.optimizer?.overall}</b></span>
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wider text-mut mb-2">Choose the action to execute</div>
            <div className="grid sm:grid-cols-2 gap-2">
              {(rec.candidates || []).filter(c => c.action_id !== 'no_action').map(c => {
                const sel = action === c.action_id
                return (
                  <button key={c.action_id} onClick={() => { setChosen(c.action_id); setSim(null) }}
                    className={`text-left p-2.5 rounded-lg border transition ${sel ? 'border-accent bg-accent/10' : 'border-edge hover:border-edge bg-panel-soft'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-white">{c.label}</span>
                      {sel && <span className="text-accent text-[10px]">● selected</span>}
                    </div>
                    <div className="text-[11px] text-mut mt-0.5">Contain {c.containment}% · Downtime ~{c.outcome?.downtime_h}h · Residual {c.outcome?.residual_risk}%</div>
                  </button>
                )
              })}
            </div>
          </div>

          {sim && (
            <div className="rounded-lg border border-info/30 bg-info/5 p-3 text-[12px] fade-in">
              <div className="font-semibold text-info mb-1">SIMULATED CONTAINMENT PREVIEW</div>
              <p className="text-mut">{sim.outcome?.label} — containment {sim.outcome?.containment}%, ~{sim.outcome?.downtime_h}h downtime, residual {sim.outcome?.residual_risk}%.</p>
              <p className="text-mut mt-1"><span className="text-white">Attacker adaptation:</span> {sim.adaptive?.response}</p>
            </div>
          )}
          {simBusy && <div className="text-[12px] text-mut">Simulating first…</div>}

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] text-mut">Approving role</span>
              <select value={approver} onChange={e => setApprover(e.target.value)}
                className="mt-1 w-full bg-[#0e1730] border border-edge rounded-md px-2 py-1.5 text-[13px]">
                <option>SOC Analyst</option><option>SOC Admin</option><option>Security Administrator</option><option>CISO</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] text-mut">Reason (optional)</span>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Justification"
                className="mt-1 w-full bg-[#0e1730] border border-edge rounded-md px-2 py-1.5 text-[13px] placeholder:text-mut/50" />
            </label>
          </div>
        </div>

        <footer className="px-5 py-3 border-t border-edge bg-black/20 flex flex-wrap gap-2 justify-end">
          <button onClick={simulateFirst} disabled={simBusy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-info/40 text-info text-[12px] font-medium hover:bg-info/10 disabled:opacity-50">
            <FlaskConical size={14} /> Simulate First
          </button>
          <button onClick={() => act('MODIFIED')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-warn/40 text-warn text-[12px] font-medium hover:bg-warn/10">
            <Pencil size={14} /> Modify
          </button>
          <button onClick={() => act('REJECTED')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-mut text-mut text-[12px] font-medium hover:bg-white/5">
            <Ban size={14} /> Reject / No Action
          </button>
          <button onClick={() => act('APPROVED')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-ok text-black text-[12px] font-bold hover:brightness-110">
            <Check size={15} /> Approve &amp; Contain
          </button>
        </footer>
      </div>
    </div>
  )
}
