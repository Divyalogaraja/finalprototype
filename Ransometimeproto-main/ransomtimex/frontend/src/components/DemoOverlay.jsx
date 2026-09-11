import React, { useEffect, useRef, useState } from 'react'
import { X, ShieldCheck, Bot } from 'lucide-react'
import { useSim } from '../store/SimContext'

const SCRIPT = [
  { t: '0:00', label: 'Safe environment', sub: 'Monitoring active, no correlated activity.' },
  { t: '0:20', label: 'Suspicious activity detected', sub: 'PowerShell + mass file modification on LAB-PC-21.' },
  { t: '0:40', label: 'Ransomware confidence rises', sub: 'Behavioral risk climbs past HIGH as signals correlate.' },
  { t: '1:00', label: 'Attack graph generated', sub: 'Reconstruction shows compromise path & reachability.' },
  { t: '1:20', label: 'Next target predicted', sub: 'FILE-SRV-01 predicted with high confidence.' },
  { t: '1:40', label: 'Defense options compared', sub: 'Min-disruption optimizer ranks 6 responses.' },
  { t: '2:00', label: 'Human approval', sub: 'Isolate + Revoke presented for mandatory approval.' },
  { t: '2:15', label: 'Simulated containment', sub: 'Propagation stopped, attack graph updated.' },
  { t: '2:30', label: 'Incident replay', sub: 'Timeline becomes interactive for the analyst.' },
  { t: '2:40', label: 'Alternate realities', sub: 'Side-by-side of what each action would have caused.' },
  { t: '2:50', label: 'Defense regret measured', sub: 'Gap to best feasible response quantified.' },
  { t: '3:00', label: 'Playbook evolved', sub: 'A proposed update is ready for review.' },
]

export default function DemoOverlay({ onClose, runNow }) {
  const sim = useSim()
  const [idx, setIdx] = useState(0)
  const [done, setDone] = useState(false)
  const approvedRef = useRef(false)

  useEffect(() => {
    sim.startRun('S2', 420)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // advance captions
  useEffect(() => {
    if (done) return
    const iv = setInterval(() => {
      setIdx(i => {
        if (i >= SCRIPT.length - 1) { clearInterval(iv); return i }
        return i + 1
      })
    }, 1500)
    return () => clearInterval(iv)
  }, [done])

  // when decision posture arrives, auto-approve
  useEffect(() => {
    const s = sim.state
    if (s.phase === 'decision' && s.recommend && !approvedRef.current) {
      approvedRef.current = true
      const t = setTimeout(() => sim.approve('APPROVED', 'isolate_revoke', '3-min Demo', 'Automated demo approval'), 1400)
      return () => clearTimeout(t)
    }
    if (s.phase === 'resolved' && s.approvedAction && !done) {
      const t = setTimeout(() => { sim.loadDeep('counterfactual'); sim.loadDeep('robust'); setDone(true) }, 400)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.state.phase, sim.state.recommend, sim.state.resolvedFlag])

  const S = SCRIPT[Math.min(idx, SCRIPT.length - 1)]
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur">
      <div className="w-[min(680px,94vw)] text-center fade-in">
        <button onClick={onClose} className="absolute top-5 right-5 text-mut hover:text-white"><X size={20} /></button>
        <div className="text-[11px] uppercase tracking-[0.3em] text-accent mb-4">RansomTime-X · Guided 3-minute demo</div>
        <div className="text-[13px] mono text-mut mb-1">{S.t}</div>
        <div className="text-3xl font-bold text-white mb-2">{done ? 'RansomTime-X learned from this incident.' : S.label}</div>
        <div className="text-mut mb-8 min-h-[3rem]">{done ? 'A better playbook is proposed and ready for review. The next simulated attack will use it.' : S.sub}</div>

        {!done ? (
          <>
            <div className="max-w-md mx-auto h-1 rounded bg-edge overflow-hidden">
              <div className="h-full bg-accent transition-all duration-500" style={{ width: `${(idx / (SCRIPT.length - 1)) * 100}%` }} />
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-mut mono">
              <span>{S.t}</span><span>3:00</span>
            </div>
          </>
        ) : (
          <div className="flex justify-center gap-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg bg-accent text-white font-semibold text-sm hover:brightness-110">View Results</button>
            <button onClick={() => sim.dispatch({ type: 'OPEN_APPROVAL' })}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg panel-soft text-mut text-sm hover:text-white">
              <Bot size={15} /> Ask AI
            </button>
          </div>
        )}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-ok"><ShieldCheck size={13} /> All actions are SIMULATED — nothing is executed on real systems.</div>
      </div>
    </div>
  )
}
