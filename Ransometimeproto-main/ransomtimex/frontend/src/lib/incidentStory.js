// RansomTime-X · shared synthetic-incident story enrichment.
// Every page (Live Defense, Attack Graph, Counterfactual Replay, Command Center,
// etc.) consumes the SAME underlying events (state.live.events_so_far) and
// decorates them through these helpers so the narrative stays consistent and is
// never re-hardcoded per page.
//
// SAFE SIMULATION ONLY — nothing here is real telemetry, real credentials or a
// real ransomware execution. All values are synthetic demo data for the story.

export const EVENT_META = {
  phishing_delivery: { label: 'Phishing Delivery', proc: 'outlook.exe', mitre: 'T1566', mitreName: 'Phishing', stage: 'Initial Access', glyph: '✉' },
  suspicious_process: { label: 'Suspicious Process', proc: 'powershell.exe', mitre: 'T1059', mitreName: 'Command and Scripting Interpreter', stage: 'Execution', glyph: '⚙' },
  command_scripting: { label: 'Command & Scripting', proc: 'cmd.exe /c', mitre: 'T1059', mitreName: 'Command and Scripting Interpreter', stage: 'Execution', glyph: '⌨' },
  mass_file_modification: { label: 'Mass File Modification', proc: 'copy / explorer', mitre: 'T1486', mitreName: 'Data Encrypted for Impact', stage: 'Execution', glyph: '🗂' },
  rapid_file_rename: { label: 'Rapid File Rename', proc: 'ren.exe', mitre: 'T1486', mitreName: 'Data Encrypted for Impact', stage: 'Execution', glyph: '✎' },
  credential_access: { label: 'Credential Access', proc: 'lsass / logon', mitre: 'T1078', mitreName: 'Valid Accounts', stage: 'Credential Access', glyph: '🔑' },
  privilege_escalation: { label: 'Privilege Escalation', proc: 'seclogon / whoami', mitre: 'T1068', mitreName: 'Privilege Escalation', stage: 'Privilege Escalation', glyph: '▲' },
  suspicious_network: { label: 'Suspicious Network', proc: 'net.exe', mitre: 'T1041', mitreName: 'Exfiltration Over C2', stage: 'Lateral Movement', glyph: '⇄' },
  lateral_movement: { label: 'Lateral Movement', proc: 'wmic / psexec', mitre: 'T1021', mitreName: 'Remote Services', stage: 'Lateral Movement', glyph: '➤' },
  file_server_access: { label: 'File Server Access', proc: '\\share', mitre: 'T1486', mitreName: 'Data Encrypted for Impact', stage: 'Impact Preparation', glyph: '🗄' },
  backup_access_attempt: { label: 'Backup / Recovery Attempt', proc: 'vssadmin / wbadmin', mitre: 'T1490', mitreName: 'Inhibit System Recovery', stage: 'Impact Preparation', glyph: '💾' },
}

// Stage order shown in the horizontal kill-chain strip.
export const KILLCHAIN = ['Initial Access', 'Execution', 'Credential Access', 'Privilege Escalation', 'Lateral Movement', 'Impact Preparation']

// Map observed event_types -> canonical kill-chain stage index (0..5).
export function stageIndexFor(type) {
  const s = EVENT_META[type]?.stage
  const i = KILLCHAIN.indexOf(s)
  return i < 0 ? -1 : i
}

// Short readable list label for an event_type (used in "why it matters" evidence).
export const EVENT_SHORT = {
  phishing_delivery: 'Phishing delivery', suspicious_process: 'Suspicious process',
  command_scripting: 'Command & scripting', mass_file_modification: 'Mass file modification',
  rapid_file_rename: 'Rapid file rename', credential_access: 'Credential / auth anomaly',
  privilege_escalation: 'Privilege escalation', suspicious_network: 'Suspicious internal connection',
  lateral_movement: 'Lateral movement', file_server_access: 'File-server access',
  backup_access_attempt: 'Backup access attempt',
}

const USER_FOR = { 'u-student-2147': 'student-user', 'LAB-PC-21': 'student-user', 'FAC-PC-07': 'faculty-user', 'FILE-SRV-01': 'svc-fileshare', 'BACKUP-SRV-01': 'svc-backup' }

// Directional "source → destination" framing for the log detail / story.
function pathFrame(ev) {
  const a = ev.asset || ''
  if (ev.event_type === 'lateral_movement') return { source: prevOrigin(ev), destination: a }
  if (ev.event_type === 'file_server_access' || ev.event_type === 'backup_access_attempt') return { source: prevOrigin(ev), destination: a }
  if (ev.event_type === 'credential_access') return { source: prevOrigin(ev), destination: a }
  return { source: a, destination: '' }
}
function prevOrigin(ev) {
  const a = ev.asset || ''
  if (a === 'FILE-SRV-01' || a === 'BACKUP-SRV-01') return 'FAC-PC-07'
  if (a === 'FAC-PC-07') return 'LAB-PC-21'
  return 'LAB-PC-21'
}

// Decorate one raw scenario event into a full SOC log row.
export function enrichEvent(e, eventsAll = []) {
  const meta = EVENT_META[e.event_type] || { label: e.event_type, proc: '—', mitre: e.mitre || '', mitreName: '', stage: 'Observing', glyph: '▪' }
  const asset = e.asset || ''
  const frame = pathFrame(e)
  const priorTypes = (eventsAll || []).map(x => x.event_type)
  const idx = priorTypes.indexOf(e.event_type)
  const prior = idx >= 0 ? priorTypes.slice(0, idx) : []
  return {
    id: 'EVT-' + String((idx >= 0 ? idx : 0) + 10000),
    ts: e.timestamp || '—',
    device: asset,
    user: USER_FOR[asset] || 'student-user',
    eventType: e.event_type,
    label: meta.label,
    proc: e.process || meta.proc,
    source: frame.source,
    destination: frame.destination,
    severity: (e.severity || 'medium').toUpperCase(),
    confidence: Math.round((e.confidence || 0) * 100),
    mitre: e.mitre || meta.mitre,
    mitreName: meta.mitreName,
    stage: meta.stage,
    glyph: meta.glyph,
    description: e.note || meta.label,
    evidence: distinctShort(prior, e.event_type),
  }
}

function distinctShort(priorTypes, current) {
  const seen = {}
  const out = []
  priorTypes.forEach(t => { const s = EVENT_SHORT[t]; if (s && !seen[t]) { seen[t] = true; out.push(s) } })
  // always surface at least one anchor for the current event family
  const cur = EVENT_SHORT[current]
  if (!out.length && cur) out.push(cur)
  return out
}

// Build the ordered "Attack Story" — one beat per distinct observed stage, plus a
// final AI-correlated narrative line grounded in intent + risk confidence.
export function attackStory(events) {
  const beats = []
  const seenStage = {}
  ;(events || []).forEach(e => {
    const st = EVENT_META[e.event_type]?.stage || 'Observing'
    if (!seenStage[st]) { seenStage[st] = true; beats.push({ ts: e.timestamp, stage: st, label: EVENT_SHORT[e.event_type] || e.event_type, type: e.event_type }) }
  })
  return beats
}

export function MITRE_NAME(t) {
  return EVENT_META[t]?.mitreName || ''
}
