import React from 'react'
import { useSim } from '../store/SimContext'
import { MapPin, ArrowDown, ArrowRight } from 'lucide-react'

export function TimeMachine({ predicted }) {
  const { state } = useSim()
  const compromised = state.live?.compromised || []
  const attacker = state.live?.attacker_position
  const path = compromised.length ? compromised : ['LAB-PC-21']
  return (
    <div className="flex flex-col md:flex-row gap-3 items-stretch">
      {/* PAST -> CURRENT */}
      <div className="flex-1">
        <div className="text-[10px] uppercase tracking-widest text-mut mb-2">Past → Current</div>
        <div className="space-y-1.5">
          {path.map((a, i) => (
            <React.Fragment key={a}>
              <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-[12px] mono ${a === attacker ? 'border-danger/60 bg-danger/10 text-white' : 'border-edge bg-panel-soft text-white/85'}`}>
                <span className={`w-2 h-2 rounded-full ${a === attacker ? 'bg-danger glow-dot' : 'bg-accent'}`} />
                {a}
                <span className="text-[9px] text-mut ml-auto">{a === attacker ? 'attacker position' : i === 0 ? 'initial' : 'hop'}</span>
              </div>
              {i < path.length - 1 && <div className="pl-4 text-[10px] text-mut"><ArrowDown size={11} className="inline" /> compromised</div>}
            </React.Fragment>
          ))}
          {compromised.length === 0 && <div className="text-[12px] text-mut">No assets compromised yet.</div>}
        </div>

        {/* decision point */}
        <div className="my-3 flex items-center gap-2 rounded-lg border border-accent/50 bg-accent/10 px-3 py-1.5">
          <MapPin size={14} className="text-accent" />
          <span className="text-[11px] font-bold text-accent uppercase tracking-wider">You are here · decision point</span>
        </div>

        {/* predicted future */}
        <div className="text-[10px] uppercase tracking-widest text-mut mb-1">Predicted future</div>
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-crit/50 bg-crit/10 text-[12px] mono text-white">
          <span className="w-2 h-2 rounded-full bg-crit glow-dot" /> {predicted || 'FILE-SRV-01'} <span className="text-[9px] text-mut ml-auto">next target</span>
        </div>
      </div>

      {/* divider */}
      <div className="hidden md:flex flex-col items-center justify-center px-1 text-mut">
        <ArrowRight size={18} />
      </div>

      {/* alternate futures */}
      <div className="flex-1">
        <div className="text-[10px] uppercase tracking-widest text-mut mb-2">Alternate futures (if you act now)</div>
        <div className="space-y-1.5">
          <Branch label="NO ACTION" impact="HIGH IMPACT" color="#ff3b52" count="8 systems" />
          <Branch label="REVOKE CREDENTIALS" impact="LOW IMPACT" color="#3dd68c" count="1 system" />
          <Branch label="ISOLATE ENDPOINT" impact="LOW-MODERATE" color="#a78bfa" count="2 systems" />
          <Branch label="REVOKE + ISOLATE" impact="MINIMUM SIMULATED IMPACT" color="#4ea1ff" count="recommended" highlight />
        </div>
      </div>
    </div>
  )
}

function Branch({ label, impact, color, count, highlight }) {
  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-[11px] ${highlight ? 'border-ok/60 bg-ok/10' : 'border-edge bg-panel-soft'}`}>
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="font-semibold text-white/90">{label}</span>
      <span className="ml-auto text-right">
        <div style={{ color }} className="font-bold">{impact}</div>
        <div className="text-[9px] text-mut">{count}</div>
      </span>
    </div>
  )
}
