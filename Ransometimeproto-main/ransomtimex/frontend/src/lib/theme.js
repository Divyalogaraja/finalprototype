// Shared color / severity helpers used across the UI.
export const SEV = {
  low: { text: '#3dd68c', bg: 'rgba(61,214,140,.12)', label: 'LOW' },
  medium: { text: '#ffb454', bg: 'rgba(255,180,84,.13)', label: 'MEDIUM' },
  high: { text: '#ff7a4d', bg: 'rgba(255,122,77,.14)', label: 'HIGH' },
  critical: { text: '#ff3b52', bg: 'rgba(255,59,82,.16)', label: 'CRITICAL' },
}

export function sevOf(level) {
  const k = String(level || '').toLowerCase()
  return SEV[k] || { text: '#8fa3c7', bg: 'rgba(143,163,199,.12)', label: level || '—' }
}

export const STATE_COLOR = {
  HEALTHY: '#3dd68c',
  SUSPICIOUS: '#ffb454',
  COMPROMISED: '#ff3b52',
  CONTAINED: '#4ea1ff',
  OFFLINE: '#6b7b9c',
}

export const TYPE_GLYPH = {
  Endpoint: '🖥', Server: '🗄', Database: '🗃', Backup: '💾',
  'Network Segment': '🌐', User: '👤', Credential: '🔑',
}

export const MITRE_SHORT = {
  'T1059': 'Command and Scripting Interpreter',
  'T1078': 'Valid Accounts',
  'T1068': 'Privilege Escalation',
  'T1021': 'Remote Services',
  'T1486': 'Data Encrypted for Impact',
  'T1490': 'Inhibit System Recovery',
  'T1566': 'Phishing',
}

export function fmtTs(sec) {
  // seconds since 10:01 base used in replay timelines
  const start = 10 * 60 + 1
  const tot = start + sec
  const h = Math.floor(tot / 60), m = tot % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function riskColor(v) {
  if (v <= 30) return '#3dd68c'
  if (v <= 60) return '#ffb454'
  if (v <= 80) return '#ff7a4d'
  return '#ff3b52'
}
export function riskLabel(v) {
  if (v <= 30) return 'LOW'
  if (v <= 60) return 'MEDIUM'
  if (v <= 80) return 'HIGH'
  return 'CRITICAL'
}
