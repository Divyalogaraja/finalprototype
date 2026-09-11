import React from 'react'
import {
  LayoutDashboard, Activity, Network, Hourglass, RotateCcw, GitFork,
  ShieldCheck, GraduationCap, History, Bot, Settings, Play,
  Radar, Shield, ShieldOff, Cpu, Clock3,
} from 'lucide-react'
import { useSim } from '../store/SimContext'
import { sevOf } from '../lib/theme'

export const NAV = [
  { id: 'command', label: 'Command Center', Icon: LayoutDashboard, q: 'What is happening?' },
  { id: 'live', label: 'Live Defense', Icon: Activity, q: 'What should we do now?' },
  { id: 'graph', label: 'Attack Graph', Icon: Network, q: 'Where is the attacker going?' },
  { id: 'window', label: 'Intervention Window', Icon: Hourglass, q: 'When should we act?' },
  { id: 'replay', label: 'Counterfactual Replay', Icon: RotateCcw, q: 'What if we chose differently?' },
  { id: 'alt', label: 'Alternate Reality', Icon: GitFork, q: 'Which defense caused less damage?' },
  { id: 'defintel', label: 'Defense Intelligence', Icon: ShieldCheck, q: 'How robust is our defense?' },
  { id: 'learning', label: 'Learning & Playbooks', Icon: GraduationCap, q: 'How do we defend better next time?' },
  { id: 'history', label: 'Incident History & Eval', Icon: History, q: 'What did we learn across incidents?' },
  { id: 'investigator', label: 'AI Investigator', Icon: Bot, q: 'Ask about any decision.' },
  { id: 'settings', label: 'Settings', Icon: Settings, q: 'Organization & scenarios.' },
]

export function Logo() {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <div className="relative w-8 h-8 rounded-md bg-gradient-to-br from-[#122a4d] to-[#0a1428] border border-accent/30 flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 32 32">
          <path d="M6 24 16 8l10 16" stroke="#4ea1ff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <circle cx="16" cy="8" r="2.6" fill="#ff5d6c" />
        </svg>
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-bold tracking-tight text-white">RansomTime-<span className="text-accent">X</span></div>
        <div className="text-[9px] uppercase tracking-[0.18em] text-mut">Adaptive Ransomware Defense</div>
      </div>
    </div>
  )
}

export function Sidebar({ active, setActive }) {
  const { state } = useSim()
  const pulse = state.live?.risk_level === 'CRITICAL'
  return (
    <aside className="w-60 shrink-0 border-r border-edge/70 flex flex-col bg-[#080d1a]/80 backdrop-blur">
      <div className="px-4 py-4 border-b border-edge/60">
        <Logo />
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map(({ id, label, Icon }) => {
          const on = active === id
          return (
            <button key={id} onClick={() => setActive(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-[13px] transition
                ${on ? 'bg-accent/15 text-white' : 'text-mut hover:bg-white/5 hover:text-white'}`}>
              <Icon size={16} className={on ? 'text-accent' : ''} />
              <span className="flex-1">{label}</span>
              {id === 'live' && pulse && <span className="w-2 h-2 rounded-full glow-dot" style={{ background: '#ff5d6c' }} />}
            </button>
          )
        })}
      </nav>
      <div className="px-4 py-3 border-t border-edge/60 text-[10px] text-mut">
        <div className="flex items-center gap-1.5 mb-1"><Radar size={11} className="text-accent" /> RMK College CDC</div>
        <div className="opacity-70">Simulated environment · Safe demo</div>
      </div>
    </aside>
  )
}

function Pill({ icon: Icon, label, value, color }) {
  return (
    <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md panel-soft text-[11px]">
      {Icon && <Icon size={13} style={{ color }} />}
      <span className="text-mut">{label}</span>
      <span className="font-semibold mono" style={{ color: color || '#fff' }}>{value}</span>
    </div>
  )
}

export function TopBar({ onRun, onDemo, runBusy, demoBusy }) {
  const { state } = useSim()
  const live = state.live || {}
  const lvl = live.risk_level || 'LOW'
  const sc = sevOf(lvl)
  const threatColor = lvl === 'CRITICAL' ? '#ff3b52' : lvl === 'HIGH' ? '#ff7a4d' : lvl === 'MEDIUM' ? '#ffb454' : '#3dd68c'
  const activeIncidents = (state.phase === 'playing' || state.phase === 'decision') && !state.contained ? 1 : 0
  const protectedAssets = 48
  const evList = live.events_so_far || []
  const lastEv = evList.length ? evList[evList.length - 1]?.timestamp : (live.event?.timestamp || '—')
  return (
    <header className="h-16 shrink-0 border-b border-edge/70 bg-[#080d1a]/80 backdrop-blur flex items-center gap-3 px-4">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full panel-soft">
          <Shield size={14} className="text-ok" />
          <span className="text-[11px] font-semibold text-ok">PROTECTED</span>
        </div>
        <span className="hidden xl:block text-[12px] text-mut truncate">RMK College Cyber Defense Center</span>
      </div>

      <div className="flex-1" />

      <Pill icon={Shield} label="Threat" value={lvl} color={threatColor} />
      <Pill icon={Activity} label="Incidents" value={String(Math.max(activeIncidents, state.incidents?.length ? 0 : 0))} color={activeIncidents ? '#ffb454' : '#8fa3c7'} />
      <Pill icon={Cpu} label="Assets" value={String(protectedAssets)} color="#4ea1ff" />
      <Pill icon={ShieldOff} label="At risk" value={String(live.blast_radius?.potential_affected_count ?? (live.compromised?.length || 0))} color="#ff7a4d" />
      <Pill icon={Clock3} label="Last" value={lastEv} color="#8fa3c7" />
      <div className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md ${state.statusText === 'RESOLVED' || state.statusText === 'STANDBY' ? 'panel-soft' : 'bg-accent/10'}`}>
        <span className="w-1.5 h-1.5 rounded-full ${pulse}" style={{ background: state.statusText === 'RESOLVED' || state.statusText === 'STANDBY' ? '#3dd68c' : '#4ea1ff' }} />
        <span className="text-[11px] mono text-mut">{state.statusText || 'STANDBY'}</span>
      </div>

      <button onClick={onDemo} disabled={demoBusy || runBusy}
        className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-info/40 text-info text-[12px] font-medium hover:bg-info/10 disabled:opacity-50">
        <Play size={13} /> 3-min Demo
      </button>
      <button onClick={onRun} disabled={runBusy}
        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-danger/20 border border-danger/40 text-danger text-[12px] font-semibold hover:bg-danger/30 disabled:opacity-50">
        <Radar size={13} /> Run Safe Simulation
      </button>
    </header>
  )
}
