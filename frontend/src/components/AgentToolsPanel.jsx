import { useEffect, useState } from 'react';
import { BookOpenCheck, Calculator, Coffee, GitCompare, ShieldAlert, ShieldCheck, Sparkles, BarChart3, ClipboardList, Lightbulb, CalendarDays, Compass } from 'lucide-react';
import CustomerPlanPanel from './CustomerPlanPanel.jsx';
import GameSurveyPanel from './gameSurvey/GameSurveyPanel.jsx';
import AppointmentScheduler from './AppointmentScheduler.jsx';
import api from '../api/client';
import FinancialCalculator from './FinancialCalculator.jsx';
import InsuranceComparison from './InsuranceComparison.jsx';
import PolicyComparison from './PolicyComparison.jsx';
import ProductFitGuide from './ProductFitGuide.jsx';
import GuidancePanel from './GuidancePanel.jsx';
import ObjectionBusterPanel from './ObjectionBusterPanel.jsx';
import ComplianceGuardTextarea from './ComplianceGuardTextarea.jsx';
import PlainEnglishInfographic from './PlainEnglishInfographic.jsx';
import { Badge, Button, Card } from './ui.jsx';

const TABS = [
  { key: 'guidance', label: 'Guidance', icon: Sparkles },
  { key: 'objections', label: 'Objections', icon: ShieldAlert },
  { key: 'compliance', label: 'Compliance', icon: ShieldCheck },
  { key: 'explain', label: 'Explain', icon: BarChart3 },
  { key: 'calculator', label: 'Calculator', icon: Calculator },
  { key: 'fit', label: 'Fit Guide', icon: Compass },
  { key: 'compare', label: 'Compare', icon: GitCompare },
  { key: 'quiz', label: 'Quiz', icon: BookOpenCheck },
  { key: 'gameSurvey', label: 'Insights', icon: Lightbulb },
  { key: 'plan', label: 'Plan', icon: ClipboardList },
  { key: 'meet', label: 'Meet', icon: Coffee },
  { key: 'schedule', label: 'Schedule', icon: CalendarDays },
];

export default function AgentToolsPanel({
  conversationId,
  productType,
  customerName,
  customerId,
  agentId,
  agentName,
  socket,
  history,
  guidanceError,
  isSupported,
  interimText,
  isListening,
  onSpeak,
}) {
  const [tab, setTab] = useState('guidance');
  const [templates, setTemplates] = useState([]);
  const [quizPreview, setQuizPreview] = useState(null);
  const [quizResult, setQuizResult] = useState(null);
  const [inviteSent, setInviteSent] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [draftMessage, setDraftMessage] = useState('');

  useEffect(() => {
    api.get('/tools/meeting-templates').then((res) => setTemplates(res.data.templates)).catch(() => {});
    api.get('/tools/quiz', { params: { productType } }).then((res) => setQuizPreview(res.data.quiz)).catch(() => {});
  }, [productType]);

  useEffect(() => {
    if (!socket) return undefined;
    const handleQuizResult = ({ grade }) => setQuizResult(grade);
    socket.on('quiz-result', handleQuizResult);
    return () => socket.off('quiz-result', handleQuizResult);
  }, [socket]);

  function sendQuiz() {
    socket?.emit('quiz-start', { conversationId, productType });
    setTab('quiz');
  }

  function sendInvite(template) {
    socket?.emit('coffee-chat-invite', { conversationId, template, agentName });
    setSelectedTemplate(template);
    setInviteSent(true);
    if (template.suggestQuiz) sendQuiz();
  }

  function shareCalculator(result) {
    socket?.emit('share-calculator', { conversationId, result });
  }

  return (
    <Card className="p-4 max-h-[85vh] overflow-y-auto">
      <div className="flex flex-wrap gap-1 mb-3 border-b border-slate-100 pb-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium ${
              tab === key ? 'bg-brand-100 text-brand-700' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {tab === 'guidance' && (
        <>
          <p className="text-[11px] text-slate-400 mb-3">Visible to you only — never shown to the customer.</p>
          {!isSupported && (
            <p className="text-[11px] text-rose-600 mb-2">Speech recognition is not supported in this browser. Use Chrome on desktop.</p>
          )}
          {guidanceError && <p className="text-[11px] text-rose-600 mb-2">{guidanceError}</p>}

          {/* Live transcription — words appear as they're spoken, so the rep can
              see the mic is working before a full sentence triggers guidance. */}
          {isListening && (
            <div className="mb-3 rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-2">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Listening</span>
              </div>
              <p className="text-[11px] text-slate-500 italic min-h-[15px]">
                {interimText ? interimText : <span className="text-slate-300">Speak — words appear here live…</span>}
              </p>
            </div>
          )}

          <GuidancePanel history={history} onSpeak={onSpeak} />
        </>
      )}

      {tab === 'objections' && (
        <ObjectionBusterPanel embedded productType={productType} customerName={customerName} />
      )}

      {tab === 'compliance' && (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-500">Draft a client message — risky phrases highlight in red with compliant rewrites.</p>
          <ComplianceGuardTextarea
            value={draftMessage}
            onChange={(e) => setDraftMessage(e.target.value)}
            productType={productType}
            placeholder="Type a draft reply to your client…"
            rows={4}
          />
        </div>
      )}

      {tab === 'explain' && (
        <div className="space-y-3">
          <PlainEnglishInfographic productType={productType} onShare={() => {}} />
          <InsuranceComparison productType={productType} />
        </div>
      )}

      {tab === 'calculator' && <FinancialCalculator onShare={shareCalculator} />}


      {tab === 'fit' && <ProductFitGuide customerId={customerId} onSpeak={onSpeak} />}

      {tab === 'compare' && (
        <div className="space-y-4">
          <PolicyComparison />
          <div className="border-t border-slate-100 pt-3">
            <InsuranceComparison productType={productType} />
          </div>
        </div>
      )}

      {tab === 'quiz' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BookOpenCheck size={14} className="text-brand-600" />
            <h3 className="text-sm font-semibold text-slate-700">First-meetup quiz</h3>
          </div>
          <p className="text-[11px] text-slate-500">
            Send 2 warm-up questions to {customerName || 'your client'}. AI marks answers and gives feedback you can discuss together.
          </p>
          {quizPreview && (
            <div className="rounded-xl border border-slate-100 p-3 space-y-2 bg-slate-50/50">
              <div className="text-xs font-semibold text-slate-700">{quizPreview.title}</div>
              {quizPreview.questions.map((q, i) => (
                <div key={q.id} className="text-[11px] text-slate-600">
                  <span className="font-medium text-brand-600">Q{i + 1}.</span> {q.text}
                </div>
              ))}
            </div>
          )}
          <Button size="sm" onClick={sendQuiz} className="w-full">
            Send quiz to client
          </Button>

          {quizResult && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800">Quiz submitted</span>
                <Badge tone="success">
                  {quizResult.score}/{quizResult.total}
                </Badge>
              </div>
              {quizResult.results?.map((r) => (
                <div key={r.questionId} className="text-[11px]">
                  <span className={r.isCorrect ? 'text-emerald-700' : 'text-amber-700'}>{r.isCorrect ? '✓' : '○'}</span>{' '}
                  {r.questionText.slice(0, 50)}…
                  {!r.isCorrect && <p className="text-slate-500 ml-3 mt-0.5">{r.explanation}</p>}
                </div>
              ))}
              {quizResult.aiFeedback && (
                <p className="text-xs text-slate-700 bg-white rounded-lg p-2 border border-emerald-100">{quizResult.aiFeedback}</p>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'plan' && (
        <CustomerPlanPanel customerId={customerId} embedded />
      )}

      {tab === 'gameSurvey' && (
        <GameSurveyPanel
          conversationId={conversationId}
          productType={productType}
          customerName={customerName}
          socket={socket}
        />
      )}

      {tab === 'meet' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Coffee size={14} className="text-brand-600" />
            <h3 className="text-sm font-semibold text-slate-700">First meeting & coffee chat</h3>
          </div>
          <p className="text-[11px] text-slate-500">Send a warm invite with icebreakers and agenda — great for prospects or first virtual meet-ups.</p>
          <div className="space-y-2">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => sendInvite(t)}
                className="w-full text-left rounded-xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50/40 p-3 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{t.icon}</span>
                  <div>
                    <div className="text-xs font-semibold text-slate-800">{t.label}</div>
                    <div className="text-[10px] text-slate-400">{t.subject}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {inviteSent && selectedTemplate && (
            <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-3 text-[11px] text-brand-800">
              Sent "{selectedTemplate.label}" to {customerName || 'client'}.
              {selectedTemplate.suggestQuiz && ' Quiz was also shared.'}
            </div>
          )}
        </div>
      )}

      {tab === 'schedule' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CalendarDays size={14} className="text-brand-600" />
            <h3 className="text-sm font-semibold text-slate-700">Book or block date</h3>
          </div>
          <p className="text-[11px] text-slate-500">
            Schedule a follow-up with {customerName || 'this client'} or block a day you are unavailable. Shows on their profile and your dashboard calendar.
          </p>
          {agentId ? (
            <AppointmentScheduler
              agentId={agentId}
              customerId={customerId}
              customerName={customerName}
              compact
            />
          ) : (
            <p className="text-[11px] text-rose-600">Sign in again to schedule appointments.</p>
          )}
        </div>
      )}
    </Card>
  );
}
