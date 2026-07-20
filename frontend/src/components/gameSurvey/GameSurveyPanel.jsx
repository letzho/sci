import { useEffect, useState } from 'react';
import { Lightbulb, Send, Sparkles } from 'lucide-react';
import api from '../../api/client';
import { Badge, Button, Card } from '../ui.jsx';

const GAME_LABELS = {
  minesweeper: 'Minesweeper',
  snake: 'Snake',
  candy_crush: 'Candy Crush',
  pop_blast: 'Pop Blast',
  tetris: 'Tetris',
};

/**
 * Rep-side panel for the "Did You Know?" insight cards: preview what the
 * client may see, send it, and see when they've played. No answers to review —
 * this is a rapport/education moment, not a data-collection form. Cards skew
 * toward cover the client does not already hold, which surfaces cross-sell
 * openings without the tool ever recommending anything.
 */
export default function GameSurveyPanel({ conversationId, productType, customerName, socket, compact = false, initialResult = null }) {
  const [deckPreview, setDeckPreview] = useState(null);
  const [surveyResult, setSurveyResult] = useState(initialResult);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    api.get('/tools/game-flashcards', { params: { productType } }).then((res) => setDeckPreview(res.data.deck)).catch(() => {});
  }, [productType]);

  useEffect(() => {
    if (!socket) return undefined;
    const handleResult = ({ result }) => setSurveyResult(result);
    socket.on('game-survey-result', handleResult);
    return () => socket.off('game-survey-result', handleResult);
  }, [socket]);

  function sendSurvey() {
    socket?.emit('game-survey-start', { conversationId, productType });
    setSent(true);
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex items-center gap-2">
        <Lightbulb size={14} className="text-violet-600" />
        <h3 className="text-sm font-semibold text-slate-700">Did You Know? insights</h3>
      </div>
      <p className="text-[11px] text-slate-500">
        Send {customerName || 'your client'} a relaxing mini-game — short insurance insights pop up as they play, picked at random and weighted toward cover they don't have yet. Nothing to answer, and a natural opening for what to discuss next.
      </p>

      {deckPreview && (
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-2">
          <div className="text-xs font-semibold text-slate-700">{deckPreview.title}</div>
          <div className="flex flex-wrap gap-1">
            {(deckPreview.games || []).map((g) => (
              <Badge key={g.id} tone="neutral">
                {g.emoji} {g.label}
              </Badge>
            ))}
          </div>
          <div className="flex items-start gap-1 text-[10px] text-slate-400 pt-0.5">
            <Sparkles size={10} className="mt-0.5 shrink-0" />
            <span>A fresh random mix each time — e.g. {deckPreview.cards?.slice(0, 3).map((c) => c.title).join(', ')}…</span>
          </div>
        </div>
      )}

      <Button size="sm" className="w-full" onClick={sendSurvey} disabled={!socket || !conversationId}>
        <Send size={14} /> Send game to client
      </Button>
      {sent && surveyResult && (
        <p className="text-[10px] text-slate-400 text-center">Send again for a fresh set of insights.</p>
      )}

      {sent && !surveyResult && (
        <p className="text-[11px] text-brand-600">Waiting for {customerName || 'client'} to pick a game…</p>
      )}

      {surveyResult && (
        <Card className="p-3 border-emerald-200 bg-emerald-50/40 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800">
              {surveyResult.customerName || customerName || 'They'} played {GAME_LABELS[surveyResult.gameChoice] || surveyResult.gameChoice || 'a mini-game'}
            </span>
            <Badge tone="success">{surveyResult.cardsViewed || 0} insights</Badge>
          </div>
          <p className="text-[11px] text-slate-600">A relaxed moment before you continue the conversation.</p>
        </Card>
      )}
    </div>
  );
}
