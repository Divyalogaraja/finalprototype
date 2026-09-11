import React from 'react'
import { useSim } from '../store/SimContext'
import { sevOf, STATE_COLOR } from '../lib/theme'
import { Loading } from './common'

const EVENT_DESC = {
  phishing_delivery: 'Phishing delivery', suspicious_process: 'Suspicious process',
  mass_file_modification: 'Mass file modification', rapid_file_rename: 'Rapid file rename',
  credential_access: 'Credential access', privilege_escalation: 'Privilege escalation',
  lateral_movement: 'Lateral movement', file_server_access: 'File server access',
  backup_access_attempt: 'Backup access attempt', command_scripting: 'Command scripting',
  suspicious_network: 'Suspicious network',
}
const MITRE_META = {
  T1059: 'Command and Scripting Interpreter', T1078: 'Valid Accounts',
  T1068: 'Privilege Escalation', T1021: 'Remote Services',
  T1486: 'Data Encrypted for Impact', T1490: 'Inhibit System Recovery',
  T1566: 'Phishing', T1041: 'C2 Exfiltration',
}

export function EventStream({ max = 30, dense }) {
  const { state } = useSim()
  const events = state.live?.events_so_far || []
  const rows = events.slice(-max).reverse()
  if (!events.length) return <div className="text-[12px] text-mut text-center py-6">Awaiting events…</div>
  return (
    <div className={`space-y-1.5 ${dense ? '' : 'max-h-72 overflow-y-auto pr-1'}`}>
      {rows.map((e, i) => {
        const sc = sevOf(e.severity)
        const mitre = e.mitre
        return (
          <div key={i} className="stream-in flex gap-2 items-start rounded-md bg-panel-soft/70 px-2 py-1.5 border-l-2" style={{ borderColor: sc.text }}>
            <span className="mono text-[11px] text-mut shrink-0 pt-0.5">{e.timestamp}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="mono text-[11px] text-accent">{e.asset}</span>
                <span className="text-[11px] font-medium text-white truncate">{EVENT_DESC[e.event_type] || e.event_type}</span>
              </div>
              {mitre && <div className="text-[10px] text-mut mono">MITRE {mitre} · {MITRE_META[mitre] || ''}</div>}
            </div>
            <span className="mono text-[11px] shrink-0" style={{ color: sc.text }}>{Math.round((e.confidence || 0) * 100)}%</span>
          </div>
        )
      })}
    </div>
  )
}

export function AttackProgressTimeline() {
  const { state } = useSim()
  const events = state.live?.events_so_far || []
  const stages = [
    { k: 'suspicious_process', label: 'Initial Suspicious Process', mitre: 'T1059' },
    { k: 'mass_file_modification', label: 'Mass File Modification', mitre: 'T1486' },
    { k: 'credential_access', label: 'Credential Access', mitre: 'T1078' },
    { k: 'privilege_escalation', label: 'Privilege Escalation', mitre: 'T1068' },
    { k: 'lateral_movement', label: 'Lateral Movement', mitre: 'T1021' },
    { k: 'file_server_access', label: 'File Server Targeted', mitre: 'T1486' },
  ]
  const seen = {}
  events.forEach(e => { if (!(e.event_type in seen)) seen[e.event_type] = e })
  const doneCount = stages.filter(s => seen[s.k]).length
  return (
    <div className="relative">
      <div className="absolute left-0 right-0 top-[9px] h-0.5 bg-edge/50" />
      <div className="absolute left-0 top-[9px] h-0.5 bg-gradient-to-r from-ok via-warn to-danger transition-all duration-700"
        style={{ width: `${(doneCount / Math.max(1, stages.length)) * 100}%` }} />
      <div className="grid grid-cols-6 gap-1 relative">
        {stages.map((s, i) => {
          const hit = seen[s.k]
          const fill = !!hit
          const col = fill ? (i >= 4 ? '#ff5d6c' : i >= 2 ? '#ffb454' : '#4ea1ff') : '#26365a'
          return (
            <div key={s.k} className="text-center pt-1">
              <div className="mx-auto w-4 h-4 rounded-full border-2 flex items-center justify-center"
                style={{ borderColor: col, background: fill ? col : '#0c1322' }}>
                {fill && <div className="w-1.5 h-1.5 rounded-full bg-[#0b1120]" />}
              </div>
              <div className="mt-1 text-[9px] leading-tight text-mut">{s.label}</div>
              <div className="text-[9px] mono" style={{ color: fill ? '#dfe7f3' : '#3a4a6a' }}>{hit?.timestamp || ''} {s.mitre}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function MitreChips({ events }) {
  const list = (events || [])
  const set = {}
  list.forEach(e => { if (e.mitre && !(e.mitre in set)) set[e.mitre] = e.severity })
  const keys = Object.keys(set)
  if (!keys.length) return <div className="text-[11px] text-mut">No MITRE techniques observed yet.</div>
  return (
    <div className="flex flex-wrap gap-1.5">
      {keys.map(k => { const sc = sevOf(set[k]); return (
        <span key={k} className="chip mono border" style={{ color: sc.text, background: sc.bg, borderColor: `${sc.text}33` }}>
          {k} · {MITRE_META[k] || ''}
        </span>
      ) })}
    </div>
  )
}

export function ClosedLoop({ stage }) {
  const LOOP = ['OBSERVE', 'DETECT', 'UNDERSTAND', 'PREDICT', 'DECIDE', 'DEFEND',
    'REPLAY', 'COMPARE', 'LEARN', 'IMPROVE']
  const cur = LOOP.indexOf(stage || 'DETECT')
  return (
    <div className="flex items-center gap-1 flex-wrap justify-center py-1">
      {LOOP.map((l, i) => (
        <React.Fragment key={l}>
          <span className={`px-2 py-0.5 rounded text-[10px] mono font-semibold ${i === cur ? 'bg-accent text-black' : i < cur ? 'text-ok' : 'text-mut/60'}`}>
            {l}
          </span>
          {i < LOOP.length - 1 && <span className="text-[10px] text-mut/50">{i === cur ? '▼' : '→'}</span>}
          {i === LOOP.length - 1 && <span className="text-[10px] text-mut/50 rotate-90">↺</span>}
        </React.Fragment>
      ))}
    </div>
  )
}

export function AssetStateChip({ state }) {
  const col = STATE_COLOR[state] || '#8fa3c7'
  return <span className="chip mono" style={{ color: col, background: `${col}1f` }}>{state}</span>
}

export function RiskBand() {
  const { state } = useSim()
  const r = state.live?.risk_score || 0
  const lvl = state.live?.risk_level || 'LOW'
  return (
    <div>
      <div className="flex justify-between text-[10px] mono mb-1">
        <span style={{ color: '#3dd68c' }}>LOW 0–30</span>
        <span style={{ color: '#ffb454' }}>MED 31–60</span>
        <span style={{ color: '#ff7a4d' }}>HIGH 61–80</span>
        <span style={{ color: '#ff3b52' }}>CRIT 81–100</span>
      </div>
      <div className="relative h-3 rounded bg-gradient-to-r from-ok via-warn to-crit/80 overflow-hidden">
        <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-5 rounded bg-white shadow transition-all duration-700"
          style={{ left: `calc(${Math.min(100, r)}% - 3px)` }} />
      </div>
      <div className="text-right text-[13px] mono font-bold mt-1" style={{ color: sevOf(lvl).text }}>{r} · {lvl}</div>
    </div>
  )
}
