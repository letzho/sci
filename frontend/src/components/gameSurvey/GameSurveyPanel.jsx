import { useEffect, useState } from 'react';
import { Gamepad2, Send } from 'lucide-react';
import api from '../../api/client';
import { Badge, Button, Card } from '../ui.jsx';

/**
 * Rep-side panel: preview survey, send to client, view results.
 * Used in virtual call tools and chat review sidebar.
 */
export default function GameSurveyPanel({ conversationId, productType, customerName, socket, compact = false }) {
  const [surveyPreview, setSurveyPreview] = useState(null);
  const [surveyResult, setSurveyResult] = useState(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    api.get('/tools/needs-survey', { params: { productType } }).then((res) => setSurveyPreview(res.data.survey)).catch(() => {});
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
        <h3 className="text-sm font-semibold text-slate-700">Game survey</h3>
      </div>
      <p className="text-[11px] text-slate-500">
        Engage {customerName || 'your client'} with a mini-game — needs &amp; preference questions pop up while they play (better than a plain questionnaire).
      </p>

      {surveyPreview && (
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-2">
          <div className="text-xs font-semibold text-slate-700">{surveyPreview.title}</div>
          <div className="flex flex-wrap gap-1">
            {(surveyPreview.games || []).map((g) => (
              <Badge key={g.id} tone="neutral">
                {g.emoji} {g.label}
              </Badge>
            ))}
          </div>
          {surveyPreview.questions.map((q, i) => (
            <div key={q.id} className="text-[10px] text-slate-500">
              <span className="text-violet-600 font-medium">Q{i + 1}.</span> {q.text}
            </div>
          ))}
        </div>
      )}

      <Button size="sm" className="w-full" onClick={sendSurvey} disabled={!socket || !conversationId}>
        <Send size={14} /> Send game survey to client
      </Button>

      {sent && !surveyResult && (
        <p className="text-[11px] text-brand-600">Waiting for {customerName || 'client'} to pick a game and complete questions…</p>
      )}

      {surveyResult && (
        <Card className="p-3 border-emerald-200 bg-emerald-50/40 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800">Survey completed</span>
            <Badge tone="success">{surveyResult.gameChoice}</Badge>
          </div>
          <p className="text-[11px] text-slate-700">{surveyResult.repBrief}</p>
          <ul className="space-y-1">
            {surveyResult.responses?.map((r) => (
              <li key={r.questionId} className="text-[10px] text-slate-600">
                <span className="font-medium text-slate-700">{r.question}</span>
                <br />
                → {r.answer}
              </li>
            ))}
          </ul>
          {surveyResult.insights?.length > 0 && (
            <div className="pt-2 border-t border-emerald-100">
              {surveyResult.insights.map((ins, i) => (
                <p key={i} className="text-[10px] text-emerald-800">
                  • {ins}
                </p>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
