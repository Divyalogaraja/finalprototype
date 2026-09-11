import React, { useMemo, useState } from 'react'
import ReactFlow, { Handle, Position, Background, Controls, MarkerType } from 'reactflow'
import { Network, Target, Crosshair, ShieldAlert, Radio, X, Fingerprint, Info, ChevronRight } from 'lucide-react'
import { useSim } from '../store/SimContext'
import { Card, Empty, KeyVal, SevChip } from '../components/common'
import { sevOf } from '../lib/theme'
import { enrichEvent, stageIndexFor, KILLCHAIN } from '../lib/incidentStory'

const X_BY_TYPE = { Endpoint: 0, Server: 280, Database: 560, Backup: 560, 'Network Segment': -260 }
const TYPE_TINT = {
  Endpoint: '#4ea1ff', Server: '#ffb454', Database: '#a78bfa',
  Backup: '#3dd68c', 'Network Segment': '#8fa3c7',
}

function AssetNode({ data }) {
  const tone = TYPE_TINT[data.typ] || '#8fa3c7'
  let ring = '#26365a', glow = ''
  if (data.compromised) { ring = '#ff3b52'; glow = 'box-shadow:0 0 12px rgba(255,59,82,.5)' }
  else if (data.contained) { ring = '#4ea1ff' }
  else if (data.predicted_next) { ring = '#ff3b52' }
  else if (data.attacker_position) { ring = '#ff5d6c'; glow = 'box-shadow:0 0 12px rgba(255,93,108,.5)' }
  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div onClick={data.onSelect}
        className={`w-[150px] rounded-lg border-2 bg-[#0c1322]/95 p-2 cursor-pointer hover:brightness-125 transition ${data.compromised ? 'animate-pulse' : ''}`}
        style={{ borderColor: ring, ...(glow ? { boxShadow: ring === '#ff3b52' ? '0 0 14px rgba(255,59,82,.45)' : glow } : {}) }}>
        <div className="flex items-center justify-between">
          <span className="text-[13px] mono font-bold text-white">{data.label}</span>
          {data.criticality === 'Critical' ? <ShieldAlert size={13} className="text-danger" />
            : data.criticality === 'High' ? <ShieldAlert size={13} className="text-warn" />
            : <Fingerprint size={12} className="text-mut" />}
        </div>
        <div className="text-[9px] text-mut truncate">{data.sub}</div>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="chip text-[9px]" style={{ color: tone, background: `${tone}1f` }}>{data.typ}</span>
          {data.state && <span className="chip text-[9px]" style={{ color: data.state==='COMPROMISED'?'#ff3b52':data.state==='CONTAINED'?'#4ea1ff':'#8fa3c7', background:'rgba(255,255,255,.04)' }}>{data.state}</span>}
        </div>
        {data.predicted_next && <div className="text-[9px] text-danger font-bold mt-1 flex items-center gap-1"><Target size={9}/> PREDICTED NEXT</div>}
        {data.attacker_position && <div className="text-[9px] text-warn font-bold mt-1 flex items-center gap-1"><Crosshair size={9}/> ATTACKER HERE</div>}
        {data.compromise_probability > 0 && <div className="text-[9px] mono text-mut mt-1">p(compromise) {(data.compromise_probability*100).toFixed(0)}%</div>}
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}

const nodeTypes = { asset: AssetNode }

export default function AttackGraph() {
  const { state, selectNode, dispatch } = useSim()
  const graph = state.live?.graph || { nodes: [], edges: [] }
  const assets = state.live?.assets || {}
  const [filter, setFilter] = useState(null)

  const { nodes, edges } = useMemo(() => {
    const byType = {}
    graph.nodes.forEach(n => { (byType[n.type] = byType[n.type] || []).push(n) })
    const yPos = {}
    let k = 0
    graph.nodes.forEach((n, i) => { yPos[n.id] = 60 + k * 92; k++ })
    // group by type columns but keep visual variety
    const rfNodes = graph.nodes.map((n, i) => {
      const visible = filter ? n.type === filter || n.compromised || n.predicted_next || n.attacker_position : true
      return {
        id: n.id, type: 'asset', position: { x: X_BY_TYPE[n.type] ?? 280, y: yPos[n.id] },
        data: { ...n, typ: n.type, onSelect: () => selectNode(n) },
        style: { opacity: visible ? 1 : 0.15 },
      }
    })
    const rfEdges = graph.edges.map(e => {
      const active = e.kind === 'active'
      const stroke = active ? '#ff3b52' : '#273a5e'
      return {
        id: e.id, source: e.source, target: e.target,
        animated: active, label: active ? 'LATERAL' : undefined,
        style: { stroke, strokeWidth: active ? 2 : 1 },
        markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
      }
    })
    return { nodes: rfNodes, edges: rfEdges }
  }, [graph, filter, selectNode])

  const sel = state.selectedNode

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-white">Attack Graph</h1>
          <p className="text-[12px] text-mut">Reconstructed reachability & attacker position · click a node for detail</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {['Endpoint','Server','Backup','Network Segment'].map(t => (
            <button key={t} onClick={() => setFilter(filter===t?null:t)}
              className={`px-2.5 py-1 rounded-md text-[11px] border ${filter===t?'bg-accent/20 border-accent text-white':'panel-soft border-edge text-mut'}`}>{t}</button>
          ))}
          {filter && <button onClick={()=>setFilter(null)} className="text-[11px] text-mut px-2">clear ×</button>}
        </div>
      </div>

      <GraphTimeline live={state.live} graph={graph} selectNode={selectNode} />

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="xl:col-span-3">
          <Card pad={false} className="overflow-hidden">
            <div className="h-[560px] bg-[#070b14]">
              <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView
                fitViewOptions={{ padding: 0.2 }} minZoom={0.3} maxZoom={1.6}
                nodesDraggable selectionOnDrag>
                <Background color="#16233f" gap={24} />
                <Controls position="bottom-left" />
              </ReactFlow>
            </div>
          </Card>
          <LegendRow graph={graph} />
        </div>

        <div className="space-y-4">
          <Card title="Node Inspector" subtitle="Selected asset">
            {sel ? <NodeDetail node={sel} asset={assets[sel.id]} /> :
              <div className="flex flex-col items-center justify-center py-10 text-mut">
                <Network size={30} className="mb-2 opacity-50" />
                <div className="text-[12px] text-center">Click any node to inspect its risk, compromise probability and reachable neighbours.</div>
              </div>}
          </Card>
          <Card title="Highlights" accent="#ff5d6c">
            <Highlight color="#ff3b52" label="COMPROMISED" desc="Asset currently controlled by attacker." />
            <Highlight color="#ff7a4d" label="CURRENT ATTACKER POSITION" desc="Where the attacker sits right now." />
            <Highlight color="#ff5d6c" label="PREDICTED NEXT TARGET" desc="Highest-confidence next reachable impact target." />
            <Highlight color="#ffb454" label="CRITICAL ASSETS" desc="Criticality of file/ERP/LMS/backup servers." />
            <Highlight color="#ff7a4d" label="POTENTIAL BLAST RADIUS" desc="Reachable hosts if propagation is unchecked." />
          </Card>
          <Card title="Blast Radius" right={<span className="text-lg font-black text-white">{state.live?.blast_radius?.potential_affected_count||0}</span>}>
            <div className="text-[11px] text-mut">Current affected: <b className="text-white">{state.live?.blast_radius?.current_affected_count||0}</b> · Critical exposed: <b className="text-warn">{state.live?.blast_radius?.critical_exposed_count||0}</b> · Backup exposure: <SevChip level={state.live?.blast_radius?.backup_exposure==='HIGH'?'critical':'ok'}>{state.live?.blast_radius?.backup_exposure}</SevChip></div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function NodeDetail({ node, asset }) {
  const { state } = useSim()
  const neighbors = []
  const graph = state.live?.graph || { edges: [] }
  graph.edges.filter(e=>e.source===node.id||e.target===node.id).forEach(e=>neighbors.push(e.source===node.id?e.target:e.source))
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-bold mono text-white">{node.id}</div>
          <div className="text-[11px] text-mut">{asset?.role || node.sub}</div>
        </div>
        <span className="chip mono" style={{ color: node.state==='COMPROMISED'?'#ff3b52':node.state==='CONTAINED'?'#4ea1ff':'#3dd68c', background:'rgba(255,255,255,.05)' }}>{node.state}</span>
      </div>
      <div className="mt-3 space-y-2">
        <KeyVal k="Asset type" v={node.type} />
        <KeyVal k="Criticality" v={node.criticality} vColor={node.criticality==='Critical'?'#ff3b52':node.criticality==='High'?'#ffb454':'#3dd68c'} />
        <KeyVal k="Risk score" v={`${Math.round(node.risk||0)}/100`} />
        <KeyVal k="Compromise probability" v={`${Math.round((node.compromise_probability||0)*100)}%`} vColor="#ff7a4d" />
        <KeyVal k="IP" v={asset?.ip || '—'} mono />
        <KeyVal k="OS" v={asset?.os || '—'} />
      </div>
      <div className="mt-3">
        <div className="text-[10px] uppercase text-mut mb-1">Reachable neighbours ({neighbors.length})</div>
        <div className="flex flex-wrap gap-1">
          {[...new Set(neighbors)].map(n=><span key={n} className="chip bg-white/5 text-[10px] mono">{n}</span>)}
        </div>
      </div>
    </div>
  )
}

function LegendRow({ graph }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 pt-2 text-[10px] text-mut">
      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-danger glow-dot"/>Compromised</span>
      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#ff7a4d]"/>Attacker position</span>
      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#ff3b52]"/>Predicted next</span>
      <span className="flex items-center gap-1"><span className="w-5 h-0.5 rounded bg-[#ff3b52]"/>Lateral movement (animated)</span>
      <span className="flex items-center gap-1"><span className="w-5 h-0.5 rounded bg-[#273a5e]"/>Can access</span>
      <span className="ml-auto">{graph.nodes?.length} nodes · {graph.edges?.length} edges</span>
    </div>
  )
}

function GraphTimeline({ live, graph, selectNode }) {
  const events = live?.events_so_far || []
  if (!events.length) return null
  const nodeIds = new Set((graph?.nodes || []).map(n => n.id))
  const attacker = live?.attacker_position
  const seen = {}
  const hops = []
  ;(events || []).forEach(e => {
    const si = stageIndexFor(e.event_type)
    if (si < 0 || seen[si]) return
    seen[si] = true
    const targetId = nodeIds.has(e.asset) ? e.asset : nodeIds.has(attacker) ? attacker : null
    hops.push({ si, stage: KILLCHAIN[si], ts: e.timestamp, asset: e.asset, nodeId: targetId })
  })
  if (!hops.length) return null
  const selectTarget = (n) => {
    const node = (graph?.nodes || []).find(x => x.id === n.nodeId) || (graph?.nodes || []).find(x => x.id === (live?.attacker_position))
    if (node) selectNode(node)
  }
  return (
    <div className="panel rounded-xl px-3 py-2">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-mut mb-1.5">
        <ChevronRight size={11} className="text-accent"/> Log → Stage → Graph
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {hops.map((h, i) => (
          <React.Fragment key={h.si}>
            <button onClick={() => selectTarget(h)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] mono hover:bg-accent/10 focus-visible:outline-accent"
              style={{ borderColor: i === hops.length - 1 ? 'rgba(255,59,82,.5)' : 'rgba(255,180,84,.4)', background: i === hops.length - 1 ? 'rgba(255,59,82,.1)' : 'rgba(255,180,84,.06)' }}>
              <span className="text-mut">{h.ts}</span>
              <span className="text-white/85">{h.stage}</span>
              {h.nodeId && <span className="text-accent">{h.nodeId}</span>}
            </button>
            {i < hops.length - 1 && <span className="text-mut/40 text-[10px]">→</span>}
          </React.Fragment>
        ))}
      </div>
      <div className="mt-1 text-[9px] text-mut">Click any stage to highlight its node in the graph and open the Node Inspector.</div>
    </div>
  )
}

function Highlight({ color, label, desc }) {
  return (
    <div className="flex gap-2 py-1.5 border-b border-edge/40 last:border-0">
      <span className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: color }} />
      <div>
        <div className="text-[11px] font-semibold text-white">{label}</div>
        <div className="text-[10px] text-mut">{desc}</div>
      </div>
    </div>
  )
}
