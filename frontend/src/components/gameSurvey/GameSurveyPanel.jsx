import { useEffect, useState } from 'react';
import { Gamepad2, Send, Sparkles } from 'lucide-react';
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
 * Rep-side panel: preview the flash-card deck, send it to the client, see
 * when they've played. No answers to review — this is a rapport/engagement
 * moment, not a data-collection form (see gameFlashcards.js for why).
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
        <Gamepad2 size={14} className="text-violet-600" />
        <h3 className="text-sm font-semibold text-slate-700">Play &amp; learn</h3>
      </div>
      <p className="text-[11px] text-slate-500">
        Send {customerName || 'your client'} a relaxing mini-game — quick, interesting insurance facts pop up as they play. No quiz, nothing to answer, just a nice break in the conversation.
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
          <div className="flex items-center gap-1 text-[10px] text-slate-400 pt-0.5">
            <Sparkles size={10} /> Facts include: {deckPreview.cards?.slice(0, 3).map((c) => c.title).join(', ')}…
          </div>
        </div>
      )}

      <Button size="sm" className="w-full" onClick={sendSurvey} disabled={!socket || !conversationId}>
        <Send size={14} /> Send game to client
      </Button>

      {sent && !surveyResult && (
        <p className="text-[11px] text-brand-600">Waiting for {customerName || 'client'} to pick a game…</p>
      )}

      {surveyResult && (
        <Card className="p-3 border-emerald-200 bg-emerald-50/40 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800">
              {surveyResult.customerName || customerName || 'They'} played {GAME_LABELS[surveyResult.gameChoice] || surveyResult.gameChoice || 'a mini-game'}
            </span>
            <Badge tone="success">{surveyResult.cardsViewed || 0} facts</Badge>
          </div>
          <p className="text-[11px] text-slate-600">A relaxed moment before you continue the conversation.</p>
        </Card>
      )}
    </div>
  );
}
