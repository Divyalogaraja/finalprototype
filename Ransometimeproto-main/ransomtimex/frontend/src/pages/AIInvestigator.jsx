import React, { useState } from 'react'
import { Bot, Send, Loader2, FileText, Check } from 'lucide-react'
import { useSim } from '../store/SimContext'
import { Card } from '../components/common'

const PRESETS = [
  'What is happening?',
  'Why is this risky?',
  'What evidence supports this?',
  'What will the attacker target next?',
  'What defense is recommended?',
  'Why was this defense selected?',
  'What is the blast radius?',
  'What happens if the defense fails?',
  'How did the attacker adapt?',
  'What did the system learn?',
  'Why was a playbook change proposed?',
  'Generate an incident report.',
]

export default function AIInvestigator() {
  const { state, askAI } = useSim()
  const [q, setQ] = useState('')
  const [asked, setAsked] = useState([])

  async function send(text) {
    const t = text || q
    if (!t.trim()) return
    setAsked(a => [...a, t])
    setQ('')
    await askAI(t)
  }

  const res = state.aiResult

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h1 className="text-xl font-bold text-white">AI Investigator</h1>
        <p className="text-[12px] text-mut">Ask about the simulated incident. The assistant explains decisions from real telemetry — it never invents evidence.</p></div>
        <div className="text-[10px] text-mut max-w-xs">Detection &amp; response decisions are made by the deterministic/ML engine. AI is used for explanation &amp; Q&amp;A only.</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Suggested questions" subtitle="Click to ask">
          <div className="space-y-1.5">
            {PRESETS.map(p=>(
              <button key={p} onClick={()=>send(p)} disabled={state.aiThinking}
                className="w-full text-left text-[12px] px-3 py-2 rounded-lg panel-soft hover:bg-accent/10 text-white/90 disabled:opacity-50">
                {p}
              </button>
            ))}
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <Card title="Conversation" accent="#a78bfa">
            <div className="min-h-56 max-h-[24rem] overflow-y-auto space-y-3 pr-1">
              {asked.map((a,i)=>(
                <div key={i} className="text-right"><span className="inline-block bg-accent/15 text-white rounded-lg px-3 py-1.5 text-[12px] text-left max-w-[85%]">{a}</span></div>
              ))}
              {state.aiThinking && <div className="flex items-center gap-2 text-mut text-[12px]"><Loader2 size={14} className="animate-spin"/> Assembling answer from telemetry…</div>}
              {res && !state.aiThinking && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-1"><Bot size={15} className="text-accent"/></div>
                  <div className="flex-1">
                    <div className="rounded-lg border border-accent/20 bg-panel-soft px-3 py-2 text-[13px] text-white/90 leading-relaxed whitespace-pre-wrap">{res.answer}</div>
                    {res.evidence?.length>0 && <div className="mt-2 text-[11px] text-mut flex items-start gap-1.5"><FileText size={12} className="mt-0.5 shrink-0 text-accent"/><span>{res.evidence.join(' · ')}</span></div>}
                    {res.source && <div className="mt-1 text-[10px] text-mut">Source: {res.source}</div>}
                    {res.kind && <div className="mt-1 text-[10px] uppercase tracking-wide text-accent">{res.kind}</div>}
                  </div>
                </div>
              )}
              {!asked.length && !res && !state.aiThinking && <div className="text-mut text-[12px] text-center py-10">Ask a question on the left to begin.</div>}
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-edge/60">
              <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()}
                placeholder="Ask anything about this incident…" className="flex-1 bg-[#0e1730] border border-edge rounded-lg px-3 py-2 text-[13px]"/>
              <button onClick={()=>send()} disabled={state.aiThinking||!q.trim()}
                className="px-3 py-2 rounded-lg bg-accent text-white disabled:opacity-40 hover:brightness-110"><Send size={15}/></button>
            </div>
          </Card>
        </div>
      </div>

      <Card accent="#3dd68c">
        <div className="flex flex-col md:flex-row items-start gap-3 text-[12px] text-mut">
          <Bot className="text-accent shrink-0 mt-1" size={22}/>
          <div>
            <div className="text-white font-semibold mb-1">Evidence integrity</div>
            <p>Answers are grounded in the current simulated telemetry (risk engine state, attack graph, predictions, counterfactual results). The assistant can reference things like <b className="text-white">150 file modifications, 80 rapid renames, credential access, lateral movement and a backup-access attempt</b> — but only the values the engine actually recorded, so the LLM cannot invent telemetry.</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
