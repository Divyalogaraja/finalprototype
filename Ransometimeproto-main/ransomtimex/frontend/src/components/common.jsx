import React from 'react'
import { riskColor, riskLabel, sevOf } from '../lib/theme'
import { Loader2 } from 'lucide-react'

export function Card({ title, subtitle, right, children, className = '', pad = true, accent }) {
  return (
    <section className={`panel rounded-xl overflow-hidden ${className}`}>
      {(title || right) && (
        <header className="flex items-start justify-between gap-3 px-4 pt-3 pb-2 border-b border-edge/60">
          <div className="min-w-0">
            {title && <h3 className="text-[13px] font-semibold text-white tracking-wide">{title}</h3>}
            {subtitle && <p className="text-[11px] text-mut mt-0.5">{subtitle}</p>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </header>
      )}
      {accent && <div className="h-0.5" style={{ background: `linear-gradient(90deg,${accent},transparent)` }} />}
      <div className={pad ? 'p-4' : ''}>{children}</div>
    </section>
  )
}

export function MetricCard({ icon: Icon, label, value, sub, tone = 'slate', accent }) {
  const tones = {
    slate: '#8fa3c7', ok: '#3dd68c', warn: '#ffb454', danger: '#ff5d6c',
    crit: '#ff3b52', info: '#a78bfa', accent: accent || '#4ea1ff',
  }
  const c = tones[tone] || tones.slate
  return (
    <div className="panel rounded-xl p-3 rise">
      <div className="flex items-center gap-2 text-mut">
        {Icon && <Icon size={15} style={{ color: c }} />}
        <span className="text-[11px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="mt-1.5 text-xl font-bold leading-none" style={{ color: c }}>{value}</div>
      {sub && <div className="text-[11px] text-mut mt-1.5">{sub}</div>}
    </div>
  )
}

export function Bar({ pct, color, h = 6 }) {
  return (
    <div className="rounded-full bg-edge/40 overflow-hidden" style={{ height: h }}>
      <div className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color || '#4ea1ff' }} />
    </div>
  )
}

export function Gauge({ value, label, sub, max = 100 }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const col = riskColor(value)
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90">
          <circle cx="50" cy="50" r="42" fill="none" stroke="#1c2a44" strokeWidth="10" />
          <circle cx="50" cy="50" r="42" fill="none" stroke={col} strokeWidth="10"
            strokeLinecap="round" strokeDasharray={`${pct * 2.64} 264`} className="transition-all duration-700" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold" style={{ color: col }}>{value}</span>
        </div>
      </div>
      {label && <div className="mt-1 text-[12px] font-semibold text-white">{label}</div>}
      {sub && <div className="text-[10px] text-mut">{sub}</div>}
    </div>
  )
}

export function RiskBadge({ score }) {
  const lvl = riskLabel(score)
  const s = sevOf(lvl)
  return <span className="chip mono" style={{ color: s.text, background: s.bg }}>{lvl}</span>
}

export function SevChip({ level, children }) {
  const s = sevOf(level)
  return <span className="chip" style={{ color: s.text, background: s.bg }}>{children || s.label}</span>
}

export function Dot({ color, pulse }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${pulse ? 'glow-dot' : ''}`} style={{ background: color }} />
}

export function Empty({ icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center text-mut py-10">
      {icon && <div className="mb-2">{icon}</div>}
      <div className="text-[13px]">{text || 'No data yet.'}</div>
    </div>
  )
}

export function Loading({ text = 'Loading…' }) {
  return (
    <div className="flex items-center gap-2 text-mut py-6 justify-center text-[13px]">
      <Loader2 size={16} className="animate-spin" /> {text}
    </div>
  )
}

export function ErrorBox({ msg, onRetry }) {
  return (
    <div className="panel rounded-xl p-4 border-danger/40">
      <div className="text-danger text-sm font-semibold mb-1">Something went wrong</div>
      <div className="text-[12px] text-mut mono break-all">{msg}</div>
      {onRetry && <button onClick={onRetry}
        className="mt-3 text-[12px] px-3 py-1 rounded-md bg-accent/15 text-accent hover:bg-accent/25">Retry</button>}
    </div>
  )
}

export function StatPill({ label, value, color }) {
  return (
    <div className="panel-soft rounded-lg px-3 py-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-mut">{label}</div>
      <div className="text-lg font-bold mono" style={{ color: color || '#fff' }}>{value}</div>
    </div>
  )
}

export function MiniBar({ a, b, label, aColor = '#ff5d6c', bColor = '#3dd68c', unit = '' }) {
  const hi = Math.max(1, a, b)
  return (
    <div className="text-[12px]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-mut">{label}</span>
        <span className="mono text-mut">{a}{unit} vs {b}{unit}</span>
      </div>
      <div className="flex gap-1">
        <div className="flex-1 rounded bg-edge/30 h-4 overflow-hidden">
          <div className="h-full rounded" style={{ width: `${(a / hi) * 100}%`, background: aColor, transition: 'width .6s' }} />
        </div>
        <div className="flex-1 rounded bg-edge/30 h-4 overflow-hidden">
          <div className="h-full rounded" style={{ width: `${(b / hi) * 100}%`, background: bColor, transition: 'width .6s' }} />
        </div>
      </div>
    </div>
  )
}

export function Legend({ items }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map(i => (
        <span key={i.label} className="flex items-center gap-1.5 text-[11px] text-mut">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: i.color }} />{i.label}
        </span>
      ))}
    </div>
  )
}

export function KeyVal({ k, v, mono, vColor }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-edge/40 text-[12px] last:border-0">
      <span className="text-mut">{k}</span>
      <span className={`font-medium text-white text-right ${mono ? 'mono' : ''}`} style={vColor ? { color: vColor } : {}}>{v}</span>
    </div>
  )
}
