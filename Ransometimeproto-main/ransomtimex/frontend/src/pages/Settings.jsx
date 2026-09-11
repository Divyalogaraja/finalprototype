import React, { useState } from 'react'
import {
  Settings as SetIcon, User, Mail, Shield, Building2, Activity, ShieldAlert,
  SlidersHorizontal, FlaskConical, GraduationCap, Bell, Database, Bot,
  FileCode2, Server, RotateCcw, Save, ShieldCheck, Lock, Check, X, ChevronRight, Info, Pencil,
} from 'lucide-react'
import { Card } from '../components/common'

/* =========================================================================
   RansomTime-X · Settings (UI redesign only)
   Dark SOC console styling. Local draft + Save/Reset. No backend changes.
   No real credentials, keys or secrets are displayed or stored here.
   ========================================================================= */

// Demo operator shown in User Details (Safe Demo identity — not credentials).
const OPERATOR = {
  employee_id: 'SEC-ADM-001',
  display_name: 'Divya Logaraja',
  role: 'Security Administrator',
  department: 'Cyber Security & Threat Operations',
  email: 'divyalogaraja308@gmail.com',
  phone: '+91 ••••• •0820',
  org: 'RMK College Cyber Defense Center',
  access_level: 'Administrator',
  status: 'Active',
}

// A single top-level configuration model used by the whole page.
const DEFAULTS = {
  // Security monitoring
  realtime: true, behavioral: true, attackGraph: true, nextTarget: true,
  blastRadius: true, confidenceScores: true,
  // Defense strategy
  minDisruption: true, counterfactual: true, attackerAdapt: true,
  confidenceThreshold: 80, continuity: 'High',
  // Learning
  memory: true, predReality: true, missedImpact: true, regret: true,
  autoPlaybook: true, storeOutcomes: true,
  // Alerts
  threatAlerts: true, approvalAlerts: true, confDrop: true, containment: true,
  newExposure: true,
  // AI
  aiExplain: true, aiSummary: true, aiQa: true, aiDefenseExplain: true, aiReport: true,
}

export default function Settings({ go }) {
  const [cfg, setCfg] = useState(DEFAULTS)
  const [dirty, setDirty] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [toast, setToast] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [editingUser, setEditingUser] = useState(false)
  const [userDraft, setUserDraft] = useState(null)

  const set = (key, value) => { setCfg(c => ({ ...c, [key]: value })); setDirty(true) }

  function saveChanges() {
    setLastSaved('Just now')
    setDirty(false)
    setToast('Settings saved for this session.')
    window.setTimeout(() => setToast(null), 3200)
  }
  function resetSettings() {
    setCfg(DEFAULTS); setDirty(false); setLastSaved(null); setConfirmReset(false)
    setToast('Settings reset to defaults.')
    window.setTimeout(() => setToast(null), 3200)
  }
  function flash(msg) { setToast(msg); window.setTimeout(() => setToast(null), 3200) }

  const user = editingUser && userDraft ? userDraft : OPERATOR
  function openEdit() { setEditingUser(true); setUserDraft({ ...OPERATOR }) }
  function saveUser() {
    setEditingUser(false)
    flash('Profile details updated (demo only — nothing sensitive is stored).')
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-6">
      {/* ---------- Header ---------- */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <span className="chip" style={{ background: 'rgba(61,214,140,.14)', color: '#3dd68c' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-ok inline-block mr-1" /> SYSTEM CONFIGURATION ACTIVE
            </span>
          </div>
          <p className="text-[12px] text-mut mt-1 max-w-2xl">
            Configure RansomTime-X defense behavior, organization context, response policies and simulation
            preferences. Adjustments apply to the safe-simulation console.
          </p>
        </div>
        <div className="chip" style={{ background: 'rgba(255,180,84,.12)', color: '#ffb454' }}>
          <Shield size={12} className="mr-1" /> Simulated Environment · Safe Demo
        </div>
      </header>

      {/* ============ 1 · USER DETAILS ============ */}
      <Card className="rise" accent="#4ea1ff"
        right={<button onClick={openEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/15 border border-accent/40 text-accent text-[12px] font-semibold hover:bg-accent/25 focus-visible:outline-accent">
          <Pencil size={13} /> Edit Profile
        </button>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* identity / avatar */}
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl shrink-0 bg-gradient-to-br from-[#12305c] to-[#0a1730] border border-accent/40 flex items-center justify-center">
              <span className="text-2xl font-black text-accent">{user.display_name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="pt-1">
              <div className="text-lg font-bold text-white leading-tight">{user.display_name}</div>
              <div className="text-[12px] text-accent">{user.role}</div>
              <div className="mt-2 flex items-center gap-2 text-[12px]">
                <span className="chip" style={{ background: 'rgba(61,214,140,.14)', color: '#3dd68c' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-ok inline-block mr-1 glow-dot" /> Active
                </span>
                <span className="text-mut">{user.department}</span>
              </div>
            </div>
          </div>

          {/* details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 self-center">
            <KV k="Employee ID" v={user.employee_id} mono />
            <KV k="Organization" v={user.org} />
            <KV k="Email" v={<a href={`mailto:${user.email}`} className="text-accent hover:underline break-all">{user.email}</a>} />
            <KV k="Access Level" v={<span className="text-warn">{user.access_level}</span>} />
            <KV k="Role / title" v={user.role} />
            <KV k="Status" v={<span className="text-ok">● Active</span>} />
          </div>
        </div>

        {editingUser && (
          <div className="mt-5 border-t border-edge/60 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 fade-in">
            <TextInput label="Full name" value={userDraft.display_name} onChange={v => setUserDraft(d => ({ ...d, display_name: v }))} />
            <TextInput label="Role / title" value={userDraft.role} onChange={v => setUserDraft(d => ({ ...d, role: v }))} />
            <TextInput label="Department / unit" value={userDraft.department} onChange={v => setUserDraft(d => ({ ...d, department: v }))} />
            <TextInput label="Employee ID" value={userDraft.employee_id} onChange={v => setUserDraft(d => ({ ...d, employee_id: v }))} />
            <TextInput label="Email" value={userDraft.email} type="email" onChange={v => setUserDraft(d => ({ ...d, email: v }))} />
            <div className="flex items-end gap-2">
              <button onClick={saveUser} className="px-3 py-1.5 rounded-lg bg-accent text-white text-[12px] font-semibold hover:brightness-110"><Check size={13} className="inline mr-1" />Save</button>
              <button onClick={() => setEditingUser(false)} className="px-3 py-1.5 rounded-lg panel-soft text-mut text-[12px]">Cancel</button>
            </div>
          </div>
        )}
        <p className="text-[10px] text-mut mt-3 flex items-center gap-1.5">
          <Lock size={11} /> No passwords, API keys or credentials are exposed or stored on this page.
        </p>
      </Card>

      {/* ============ 2 · ORGANIZATION ============ */}
      <SectionCard title="Organization" subtitle="Context of the protected environment" icon={Building2}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
          <KV k="Organization Name" v="RMK College" />
          <KV k="Security Center" v="RMK College Cyber Defense Center" />
          <KV k="Environment" v="Simulated / Safe Demo" />
          <KV k="Organization Type" v="Educational Institution" />
          <KV k="Protected Assets" v={<span className="text-white mono font-bold">48</span>} />
          <KV k="Deployment Region" v="Chennai, India" />
        </div>
        <div className="mt-3 text-[11px] text-mut">Not affiliated with or connected to any real RMK network.</div>
      </SectionCard>

      {/* ============ 3 · SECURITY MONITORING ============ */}
      <SectionCard title="Security Monitoring" subtitle="Real-time detection & prediction capabilities" icon={Activity}>
        <ToggleGroup>
          <ToggleRow label="Real-Time Threat Detection" desc="Continuously monitor endpoints, servers and network events." checked={cfg.realtime} onChange={v => set('realtime', v)} />
          <ToggleRow label="Behavioral Ransomware Detection" desc="Detect suspicious file modification, process, authentication and network behavior." checked={cfg.behavioral} onChange={v => set('behavioral', v)} />
          <ToggleRow label="Attack Graph Monitoring" desc="Reconstruct compromise paths across the environment." checked={cfg.attackGraph} onChange={v => set('attackGraph', v)} />
          <ToggleRow label="Next-Target Prediction" desc="Score reachable assets for the most likely next target." checked={cfg.nextTarget} onChange={v => set('nextTarget', v)} />
          <ToggleRow label="Blast Radius Prediction" desc="Estimate reachable & critical assets if left unchecked." checked={cfg.blastRadius} onChange={v => set('blastRadius', v)} />
          <ToggleRow label="Show Confidence Scores" desc="Always display uncertainty ranges with predictions." checked={cfg.confidenceScores} onChange={v => set('confidenceScores', v)} />
        </ToggleGroup>
      </SectionCard>

      {/* ============ 4 · RESPONSE & CONTAINMENT POLICY ============ */}
      <Card className="rise" accent="#ffb454"
        right={<button onClick={() => go && go('live')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-warn/15 border border-warn/40 text-warn text-[12px] font-semibold hover:bg-warn/25">
          <ShieldAlert size={13} /> Configure Policy
        </button>}>
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="text-warn" size={16} />
          <h3 className="text-[13px] font-semibold text-white tracking-wide">Response &amp; Containment Policy</h3>
        </div>
        <p className="text-[11px] text-mut mb-3">Human-in-the-loop adaptive defense — approval tiers by risk level.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <PolicyTier tone="low" name="LOW RISK" title="Automatic Response"
            items={['Automatically execute approved low-impact actions']} />
          <PolicyTier tone="med" name="MEDIUM RISK" title="Analyst Approval"
            items={['AI recommends the action', 'Security analyst must approve']} />
          <PolicyTier tone="high" name="HIGH RISK" title="Human Approval Required"
            items={['No autonomous high-impact action', 'Mandatory administrator approval']} />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge/60 bg-panel-soft px-3 py-2">
          <span className="text-[11px] text-mut">Current Policy:</span>
          <span className="chip" style={{ background: 'rgba(167,139,250,.16)', color: '#a78bfa' }}>
            <ShieldCheck size={12} className="mr-1" /> Human-in-the-Loop Adaptive Defense
          </span>
        </div>
        <p className="text-[10px] text-mut mt-2">Every high-impact action is held for mandatory human approval before any simulated containment runs.</p>
      </Card>

      {/* ============ 5 · DEFENSE STRATEGY ============ */}
      <SectionCard title="Defense Strategy" subtitle="Minimum-disruption optimization" icon={SlidersHorizontal}>
        <ToggleGroup>
          <ToggleRow label="Minimum-Disruption Defense" desc="Prefer the effective response with the least operational impact." checked={cfg.minDisruption} onChange={v => set('minDisruption', v)} />
          <ToggleRow label="Counterfactual Simulation Before High-Impact Action" desc="Replay alternatives before approving a costly action." checked={cfg.counterfactual} onChange={v => set('counterfactual', v)} />
          <ToggleRow label="Attacker Adaptation Simulation" desc="Model how the attacker may pivot after a defense is applied." checked={cfg.attackerAdapt} onChange={v => set('attackerAdapt', v)} />
        </ToggleGroup>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div className="rounded-lg panel-soft p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-mut">Defense Confidence Threshold</span>
              <span className="mono text-accent font-bold text-sm">{cfg.confidenceThreshold}%</span>
            </div>
            <input type="range" min={50} max={95} step={5} value={cfg.confidenceThreshold}
              onChange={e => set('confidenceThreshold', Number(e.target.value))}
              className="w-full accent-accent" aria-label="Defense confidence threshold" />
            <div className="flex justify-between text-[9px] text-mut mono"><span>50%</span><span>95%</span></div>
          </div>
          <div className="rounded-lg panel-soft p-3">
            <span className="block text-[11px] text-mut mb-2">Business Continuity Priority</span>
            <Dropdown value={cfg.continuity} options={['High', 'Medium', 'Low']}
              onChange={v => set('continuity', v)} />
            <p className="text-[10px] text-mut mt-2">Higher priority favours responses that avoid shutdown of critical infrastructure.</p>
          </div>
        </div>
        <p className="text-[11px] text-mut mt-3">RansomTime-X evaluates containment effectiveness against operational disruption before recommending a defense action.</p>
      </SectionCard>

      {/* ============ 6 · SIMULATION SETTINGS ============ */}
      <Card className="rise" accent="#3dd68c">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <FlaskConical className="text-ok" size={16} />
            <h3 className="text-[13px] font-semibold text-white tracking-wide">Safe Simulation Environment</h3>
          </div>
          <span className="chip" style={{ background: 'rgba(61,214,140,.16)', color: '#3dd68c' }}>
            <Shield size={12} className="mr-1" /> SAFE DEMO ENVIRONMENT
          </span>
        </div>
        <p className="text-[11px] text-mut mb-3">Simulation mode is enforced as safe. Destructive capabilities are permanently disabled.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
          <ModeRow label="Simulation Mode" value="SAFE / ENABLED" state="ok" />
          <ModeRow label="Real Ransomware Execution" value="DISABLED" state="off" />
          <ModeRow label="Destructive Actions" value="DISABLED" state="off" />
          <ModeRow label="Real Credential Theft" value="DISABLED" state="off" />
          <ModeRow label="Real Network Exploitation" value="DISABLED" state="off" />
          <ModeRow label="Synthetic Attack Events" value="ENABLED" state="ok" />
        </div>
        <p className="text-[11px] text-mut mt-3 flex items-start gap-1.5">
          <Info size={13} className="shrink-0 mt-0.5 text-ok" />
          All ransomware scenarios are simulated using synthetic security events. No real ransomware, credential
          theft or destructive activity is executed.
        </p>
      </Card>

      {/* ============ 7 · INCIDENT LEARNING ============ */}
      <SectionCard title="Defense Intelligence &amp; Learning" subtitle="Use past simulated outcomes to defend better" icon={GraduationCap}
        right={<span className="chip" style={{ background: 'rgba(143,163,199,.14)', color: '#8fa3c7' }}>Learning Scope: Organization-specific</span>}>
        <ToggleGroup>
          <ToggleRow label="Defense Memory" desc="Remember which defenses worked for which patterns." checked={cfg.memory} onChange={v => set('memory', v)} />
          <ToggleRow label="Prediction vs Reality" desc="Compare predicted targets against actual outcomes." checked={cfg.predReality} onChange={v => set('predReality', v)} />
          <ToggleRow label="Missed-Impact Analysis" desc="Quantify avoidable impact from delayed response." checked={cfg.missedImpact} onChange={v => set('missedImpact', v)} />
          <ToggleRow label="Defense Regret Analysis" desc="Measure the gap to the best feasible response." checked={cfg.regret} onChange={v => set('regret', v)} />
          <ToggleRow label="Automatic Playbook Evolution" desc="Propose updated response playbooks after each incident." checked={cfg.autoPlaybook} onChange={v => set('autoPlaybook', v)} />
          <ToggleRow label="Store Incident Outcomes" desc="Persist outcomes to organizational defense memory." checked={cfg.storeOutcomes} onChange={v => set('storeOutcomes', v)} />
        </ToggleGroup>
        <p className="text-[11px] text-mut mt-2">Previous simulated incidents are used to improve future defense recommendations for this organization.</p>
      </SectionCard>

      {/* ============ 8 · ALERT & NOTIFICATION ============ */}
      <SectionCard title="Alerts &amp; Notifications" subtitle="When to notify the SOC operator" icon={Bell}>
        <ToggleGroup>
          <ToggleRow label="Threat Alerts" desc="Notify on new behavioral threat indicators." checked={cfg.threatAlerts} onChange={v => set('threatAlerts', v)} />
          <ToggleRow label="High-Risk Defense Approval" desc="Notify when a high-risk action awaits approval." checked={cfg.approvalAlerts} onChange={v => set('approvalAlerts', v)} />
          <ToggleRow label="Prediction Confidence Drop" desc="Flag when prediction confidence falls below threshold." checked={cfg.confDrop} onChange={v => set('confDrop', v)} />
          <ToggleRow label="Containment Failure" desc="Alert if a containment step fails to apply." checked={cfg.containment} onChange={v => set('containment', v)} />
          <ToggleRow label="New Critical Asset Exposure" desc="Alert when a critical asset enters the blast radius." checked={cfg.newExposure} onChange={v => set('newExposure', v)} />
        </ToggleGroup>
        <div className="mt-2 rounded-lg panel-soft px-3 py-2 inline-flex items-center gap-2 text-[12px] text-mut">
          <span className="text-white">Notification Method:</span>
          <span className="chip bg-accent/15 text-accent">Dashboard + In-App</span>
        </div>
      </SectionCard>

      {/* ============ 9 · DATA & PRIVACY ============ */}
      <Card className="rise" accent="#a78bfa">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Database className="text-info" size={16} />
            <h3 className="text-[13px] font-semibold text-white tracking-wide">Data &amp; Privacy</h3>
          </div>
          <span className="chip" style={{ background: 'rgba(167,139,250,.16)', color: '#a78bfa' }}>
            <Lock size={12} className="mr-1" /> Privacy Protected
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
          <KV k="Telemetry Mode" v="Synthetic / Anonymized" />
          <KV k="Data Retention" v="30 Days" />
          <KV k="Personally Identifiable Information" v={<span className="text-danger">Disabled</span>} />
          <KV k="Raw Credentials" v={<span className="text-danger">Never Stored</span>} />
          <KV k="Real College Network Data" v={<span className="text-danger">Disabled</span>} />
          <KV k="Encryption at rest" v={<span className="text-ok">Enabled</span>} />
        </div>
        <p className="text-[10px] text-mut mt-3 flex items-center gap-1.5">
          <Lock size={11} /> No real passwords, API keys, authentication tokens or confidential infrastructure
          information are displayed or stored.
        </p>
      </Card>

      {/* ============ 10 · AI INVESTIGATOR ============ */}
      <SectionCard title="AI Investigator" subtitle="Investigation & decision support" icon={Bot}
        right={<span className="chip bg-info/15 text-info">Provider: Gemini</span>}>
        <ToggleGroup>
          <ToggleRow label="Incident Explanation" desc="Explain why an incident was classified as ransomware." checked={cfg.aiExplain} onChange={v => set('aiExplain', v)} />
          <ToggleRow label="Attack Summary Generation" desc="Summarize attack chains into plain language." checked={cfg.aiSummary} onChange={v => set('aiSummary', v)} />
          <ToggleRow label="Investigator Q&A" desc="Answer analyst questions using recorded telemetry." checked={cfg.aiQa} onChange={v => set('aiQa', v)} />
          <ToggleRow label="Defense Recommendation Explanation" desc="Explain the reasoning behind a recommended defense." checked={cfg.aiDefenseExplain} onChange={v => set('aiDefenseExplain', v)} />
          <ToggleRow label="Report Generation" desc="Produce structured incident reports." checked={cfg.aiReport} onChange={v => set('aiReport', v)} />
        </ToggleGroup>
        <p className="text-[11px] text-mut mt-2">AI is used for investigation, explanation and decision support. Core ransomware detection does not depend solely on an LLM. Provider API keys are never displayed.</p>
      </SectionCard>

      {/* ============ 11 · PLAYBOOK SETTINGS ============ */}
      <SectionCard title="Response Playbooks" subtitle="How RansomTime-X responds" icon={FileCode2}
        right={
          <div className="flex gap-2">
            <button onClick={() => go && go('learning')} className="px-2.5 py-1 rounded-lg panel-soft text-mut text-[12px] hover:text-white border border-edge">View Playbooks</button>
            <button onClick={() => go && go('learning')} className="px-2.5 py-1 rounded-lg bg-accent/15 border border-accent/40 text-accent text-[12px] font-semibold hover:bg-accent/25">Edit Playbook</button>
          </div>
        }>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
          <KV k="Current Playbook" v="Ransomware Adaptive Defense" />
          <KV k="Format" v="YAML" mono />
          <KV k="Detection Rules" v="Sigma-inspired" />
          <KV k="Attack Mapping" v="MITRE ATT&CK" />
          <KV k="Verification" v={<span className="text-ok">Enabled</span>} />
          <KV k="Learning" v={<span className="text-ok">Enabled</span>} />
        </div>
      </SectionCard>

      {/* ============ 12 · SYSTEM INFORMATION ============ */}
      <SectionCard title="System Information" subtitle="Engine status & environment" icon={Server}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
          <KV k="RansomTime-X Version" v="1.0.0" mono />
          <KV k="Environment" v="Safe Simulation" />
          <KV k="Detection Engine" v="Behavioral AI" />
          <KV k="Attack Graph" v={<span className="text-ok">Enabled</span>} />
          <KV k="Counterfactual Engine" v={<span className="text-ok">Enabled</span>} />
          <KV k="Defense Optimizer" v={<span className="text-ok">Enabled</span>} />
          <KV k="Learning Engine" v={<span className="text-ok">Enabled</span>} />
          <KV k="API Status" v={<span className="text-ok">● Connected</span>} />
          <KV k="System Status" v={<span className="text-ok">● Operational</span>} />
        </div>
      </SectionCard>

      {/* ============ FOOTER ============ */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-edge/60 pt-4">
        <div className="text-[11px] text-mut">
          Last configuration update: {lastSaved || '—'}
          {dirty && <span className="ml-2 text-warn">· Unsaved changes</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setConfirmReset(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-danger/40 text-danger text-[12px] font-medium hover:bg-danger/10 focus-visible:outline-danger">
            <RotateCcw size={14} /> Reset Settings
          </button>
          <button onClick={saveChanges} disabled={!dirty && !lastSaved}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-ok text-black text-[12px] font-bold hover:brightness-110 disabled:opacity-40 focus-visible:outline-ok">
            <Save size={14} /> Save Changes
          </button>
        </div>
      </div>
      {toast && <div className="fixed bottom-6 right-6 z-40 chip fade-in" style={{ background: '#0f2a1c', color: '#3dd68c', border: '1px solid rgba(61,214,140,.3)', padding: '8px 14px' }}>{toast}</div>}

      {/* Reset confirmation modal */}
      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm fade-in p-4">
          <div className="panel rounded-2xl max-w-md w-full p-5 border-edge shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <RotateCcw className="text-danger" size={18} />
              <h3 className="text-[15px] font-bold text-white">Reset Settings?</h3>
            </div>
            <p className="text-[13px] text-mut">This restores all Settings to their default values. It does not alter
              any simulated incidents, defense memory or playbooks already saved.</p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setConfirmReset(false)} className="px-4 py-2 rounded-lg panel-soft text-mut text-[12px] hover:text-white">Cancel</button>
              <button onClick={resetSettings} className="px-4 py-2 rounded-lg bg-danger text-white text-[12px] font-semibold hover:brightness-110">Reset to Defaults</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* =========================================================================
   Reusable building blocks
   ========================================================================= */

function SectionCard({ title, subtitle, icon: Icon, right, children }) {
  return (
    <Card className="rise" right={right}>
      <div className="flex items-center gap-2 mb-0.5">
        {Icon && <Icon className="text-accent" size={16} />}
        <h3 className="text-[13px] font-semibold text-white tracking-wide">{title}</h3>
      </div>
      {subtitle && <p className="text-[11px] text-mut mb-3">{subtitle}</p>}
      {children}
    </Card>
  )
}

function KV({ k, v, mono }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-edge/30 text-[12px] last:border-0">
      <span className="text-mut pr-2">{k}</span>
      <span className={`text-right text-white/90 ${mono ? 'mono' : ''}`}>{v}</span>
    </div>
  )
}

function ToggleGroup({ children }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">{children}</div>
}

function ToggleRow({ label, desc, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-edge/30">
      <div className="min-w-0">
        <div className="text-[13px] text-white font-medium leading-tight">{label}</div>
        {desc && <div className="text-[10px] text-mut leading-snug mt-0.5">{desc}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} ariaLabel={label} />
    </div>
  )
}

function Toggle({ checked, onChange, disabled, ariaLabel }) {
  return (
    <button type="button" role="switch" aria-checked={!!checked} aria-label={ariaLabel}
      disabled={disabled} onClick={() => !disabled && onChange(!checked)}
      className={`relative shrink-0 w-11 h-6 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-accent
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${checked ? 'bg-ok' : 'bg-edge'}`}>
      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  )
}

function ModeRow({ label, value, state }) {
  const color = state === 'ok' ? '#3dd68c' : state === 'off' ? '#ffb454' : '#8fa3c7'
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-edge/30 text-[12px]">
      <span className="text-white/85">{label}</span>
      <span className="chip mono" style={{ color, background: `${color}1c` }}>{value}</span>
    </div>
  )
}

function TextInput({ label, value, onChange, type = 'text' }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wide text-mut">{label}</span>
      <input type={type} value={value || ''} onChange={e => onChange(e.target.value)}
        className="mt-1 w-full bg-[#0e1730] border border-edge rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-accent" />
    </label>
  )
}

function Dropdown({ value, options, onChange }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full bg-[#0e1730] border border-edge rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-accent">
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function PolicyTier({ tone, name, title, items }) {
  const palette = {
    low: { border: 'rgba(61,214,140,.45)', bg: 'rgba(61,214,140,.07)', text: '#3dd68c' },
    med: { border: 'rgba(255,180,84,.45)', bg: 'rgba(255,180,84,.07)', text: '#ffb454' },
    high: { border: 'rgba(255,93,108,.5)', bg: 'rgba(255,93,108,.08)', text: '#ff5d6c' },
  }[tone]
  return (
    <div className="rounded-lg p-3 border" style={{ borderColor: palette.border, background: palette.bg }}>
      <div className="text-[10px] font-bold tracking-wider" style={{ color: palette.text }}>{name}</div>
      <div className="text-[13px] text-white font-semibold mt-0.5">{title}</div>
      <ul className="mt-2 space-y-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[11px] text-mut">
            <span className="mt-1 w-1 h-1 rounded-full shrink-0" style={{ background: palette.text }} />
            {it}
          </li>
        ))}
      </ul>
    </div>
  )
}
