import { useEffect, useState } from 'react';
import { MessageSquare, Plane, Send, Trophy, X } from 'lucide-react';
import api from '../api/client';
import { useGamificationBonus } from '../context/GamificationBonusContext.jsx';
import { Badge, Button, Card } from './ui.jsx';

/**
 * FEATURE 2: AI "Flight Simulator" Roleplay
 * Practice pitch with a persona before the live call. Scorecard after 3 turns + XP burst.
 */
export default function FlightSimulatorModal({ customer, productType, onClose, onStartLiveCall }) {
  const { awardPracticeXp } = useGamificationBonus();
  const [persona, setPersona] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [input, setInput] = useState('');
  const [turn, setTurn] = useState(0);
  const [loading, setLoading] = useState(false);
  const [scorecard, setScorecard] = useState(null);
  const [xpClaimed, setXpClaimed] = useState(false);

  useEffect(() => {
    const personaId = customer?.name?.toLowerCase().includes('mary') ? 'price_millennial' : 'skeptical_parent';
    api.get('/tools/simulator/personas').then((res) => {
      const p = res.data.personas.find((x) => x.id === personaId) || res.data.personas[0];
      setPersona(p);
      setTranscript([{ role: 'customer', text: p.opener }]);
    });
  }, [customer]);

  async function sendMessage() {
    if (!input.trim() || loading || scorecard) return;
    const agentText = input.trim();
    setInput('');
    const nextTranscript = [...transcript, { role: 'agent', text: agentText }];
    setTranscript(nextTranscript);
    setLoading(true);

    try {
      const res = await api.post('/tools/simulator/reply', {
        personaId: persona?.id,
        turn,
        agentMessage: agentText,
        productType,
      });
      const withReply = [...nextTranscript, { role: 'customer', text: res.data.reply }];
      setTranscript(withReply);
      const newTurn = turn + 1;
      setTurn(newTurn);

      if (res.data.done || newTurn >= 3) {
        const scoreRes = await api.post('/tools/simulator/scorecard', {
          personaId: persona?.id,
          transcript: withReply,
        });
        setScorecard(scoreRes.data.scorecard);
      }
    } catch (err) {
      console.error('Simulator error:', err);
    } finally {
      setLoading(false);
    }
  }

  function claimXp() {
    if (xpClaimed) return;
    awardPracticeXp(scorecard?.xpAward || 50, `+${scorecard?.xpAward || 50} XP`);
    setXpClaimed(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border-brand-100">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 brand-gradient text-white">
          <div className="flex items-center gap-2">
            <Plane size={18} />
            <div>
              <div className="text-sm font-bold">Flight Simulator</div>
              <div className="text-[10px] text-white/80">Sandbox practice — {customer?.name}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {!scorecard ? (
          <>
            <div className="px-4 py-2 bg-brand-50/50 border-b border-brand-100 flex items-center gap-2">
              <span className="text-xl">{persona?.emoji}</span>
              <div>
                <div className="text-xs font-bold text-brand-800">{persona?.label}</div>
                <div className="text-[10px] text-slate-500">{persona?.description}</div>
              </div>
              <Badge tone="neutral" className="ml-auto">
                Turn {Math.min(turn + 1, 3)}/3
              </Badge>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[240px] max-h-[360px]">
              {transcript.map((line, i) => (
                <div
                  key={i}
                  className={`flex ${line.role === 'agent' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                      line.role === 'agent' ? 'bg-brand-600 text-white rounded-br-md' : 'bg-slate-100 text-slate-700 rounded-bl-md'
                    }`}
                  >
                    {line.text}
                  </div>
                </div>
              ))}
              {loading && <p className="text-xs text-slate-400 animate-pulse">Customer is thinking…</p>}
            </div>

            <div className="p-3 border-t border-slate-100 flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type your pitch…"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
              <Button onClick={sendMessage} disabled={loading || !input.trim()}>
                <Send size={15} />
              </Button>
            </div>
          </>
        ) : (
          <div className="p-5 space-y-4 overflow-y-auto">
            <div className="text-center">
              <Trophy size={36} className="mx-auto text-amber-500 mb-2" />
              <h3 className="text-lg font-bold text-slate-800">Simulation complete</h3>
              <p className="text-xs text-slate-500">vs {scorecard.persona}</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Empathy', value: scorecard.scores.empathy, color: 'bg-rose-400' },
                { label: 'Clarity', value: scorecard.scores.clarity, color: 'bg-brand-500' },
                { label: 'Product knowledge', value: scorecard.scores.productKnowledge, color: 'bg-emerald-500' },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-slate-100 p-3 text-center bg-white">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">{s.label}</div>
                  <div className="text-xl font-bold text-slate-800 mt-1">{s.value}</div>
                  <div className="h-1.5 rounded-full bg-slate-100 mt-2 overflow-hidden">
                    <div className={`h-full rounded-full ${s.color}`} style={{ width: `${s.value}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-100">{scorecard.summary}</p>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={claimXp} disabled={xpClaimed}>
                {xpClaimed ? 'XP claimed!' : `Claim +${scorecard.xpAward} XP`}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => onStartLiveCall?.(customer)}>
                <MessageSquare size={14} /> Start live call
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
