import React, { useState, useEffect, useRef, Component } from 'react'
import { useSim } from './store/SimContext'
import { Sidebar, TopBar } from './components/layout'
import ApprovalModal from './components/ApprovalModal'
import DemoOverlay from './components/DemoOverlay'
import { Loading, ErrorBox } from './components/common'

class PageBoundary extends Component {
  constructor(props) { super(props); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  componentDidCatch(err, info) { console.error('Page error:', err, info) }
  render() {
    if (this.state.err) {
      return (
        <div className="space-y-3">
          <ErrorBox msg={`${this.state.err}`} onRetry={() => this.setState({ err: null })} />
          <p className="text-[12px] text-mut">This view hit a runtime error. Use <b>Retry</b> above, or check the browser console for details.</p>
        </div>
      )
    }
    return this.props.children
  }
}

import CommandCenter from './pages/CommandCenter'
import LiveDefense from './pages/LiveDefense'
import AttackGraph from './pages/AttackGraph'
import InterventionWindow from './pages/InterventionWindow'
import CounterfactualReplay from './pages/CounterfactualReplay'
import AlternateReality from './pages/AlternateReality'
import DefenseIntelligence from './pages/DefenseIntelligence'
import LearningPlaybooks from './pages/LearningPlaybooks'
import HistoryEval from './pages/HistoryEval'
import AIInvestigator from './pages/AIInvestigator'
import Settings from './pages/Settings'

const PAGES = {
  command: CommandCenter, live: LiveDefense, graph: AttackGraph, window: InterventionWindow,
  replay: CounterfactualReplay, alt: AlternateReality, defintel: DefenseIntelligence,
  learning: LearningPlaybooks, history: HistoryEval, investigator: AIInvestigator,
  settings: Settings,
}

export default function App() {
  const { state, startRun, startLive, dispatch, refresh, recommendDecision } = useSim()
  const [active, setActive] = useState('command')
  const [runBusy, setRunBusy] = useState(false)
  const [demo, setDemo] = useState(false)
  const prefetchedRef = useRef(false)

  // Auto-compute a recommendation when the live posture is clearly elevated,
  // but don't force the approval modal open on first paint.
  useEffect(() => {
    const risk = state.live?.risk_score || 0
    if (risk >= 61 && state.phase === 'decision' && !state.recommend &&
        !state.recommendLoading && !prefetchedRef.current) {
      prefetchedRef.current = true
      recommendDecision(false)
    }
  }, [state.live?.risk_score, state.recommend, state.recommendLoading, state.phase])

  async function runNow(sid) {
    setRunBusy(true)
    prefetchedRef.current = false
    // DYNAMIC live simulation (backend-authoritative, streamed into state.live).
    try {
      await startLive({ scenario_id: sid || 'S-LAT', reproducible: true, intensity: 0.6 })
      setActive('live')
    } catch (e) { /* surface on page */ }
    setRunBusy(false)
    dispatch({ type: 'LOOP', i: 1 })
  }

  // refresh lightweight dashboards on first navigation to certain pages
  useEffect(() => {
    if (active === 'learning') refresh('playbook')
    if (active === 'history') { refresh('incidents'); refresh('eval') }
    if (active === 'defintel') refresh('falsepos')
  }, [active])

  const Page = PAGES[active] || CommandCenter
  if (state.booting) return <Boot />
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar active={active} setActive={setActive} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          onRun={() => runNow()}
          onDemo={() => setDemo(true)}
          runBusy={runBusy} demoBusy={demo}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-5">
          {state.error && !state.live && (
            <div className="mb-4"><ErrorBox msg={state.error} /></div>
          )}
          <PageBoundary key={active}>
            <Page go={setActive} runNow={runNow} />
          </PageBoundary>
        </main>
      </div>
      <ApprovalModal />
      {demo && <DemoOverlay onClose={() => setDemo(false)} onAskAI={() => { setDemo(false); setActive('investigator') }} runNow={runNow} />}
    </div>
  )
}

function Boot() {
  return (
    <div className="h-screen flex items-center justify-center bg-base">
      <div className="text-center">
        <div className="text-2xl font-bold text-white mb-1">RansomTime-<span className="text-accent">X</span></div>
        <div className="text-[12px] text-mut mb-5">Adaptive Ransomware Defense &amp; Cyber Decision Intelligence</div>
        <Loading text="Initializing defense posture…" />
      </div>
    </div>
  )
}
