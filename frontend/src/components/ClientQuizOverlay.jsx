import { useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { Button } from './ui.jsx';

export default function ClientQuizOverlay({ quiz, customerName, onSubmit, onDismiss }) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);

  if (!quiz) return null;

  function selectAnswer(questionId, optionId) {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }

  function handleSubmit() {
    onSubmit(answers, (grade) => {
      setSubmitted(true);
      setResult(grade);
    });
  }

  const allAnswered = quiz.questions.every((q) => answers[q.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-slide-in">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-brand-50">
          <div>
            <div className="text-sm font-bold text-slate-800">{quiz.title}</div>
            <div className="text-[11px] text-slate-500">2 quick questions — no pressure!</div>
          </div>
          {!submitted && (
            <button type="button" onClick={onDismiss} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {!submitted ? (
            <>
              <p className="text-xs text-slate-600">{quiz.intro}</p>
              {quiz.questions.map((q, idx) => (
                <div key={q.id}>
                  <p className="text-sm font-medium text-slate-800 mb-2">
                    {idx + 1}. {q.text}
                  </p>
                  <div className="space-y-1.5">
                    {q.options.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => selectAnswer(q.id, opt.id)}
                        className={`w-full text-left text-xs rounded-xl border px-3 py-2.5 transition-colors ${
                          answers[q.id] === opt.id
                            ? 'border-brand-400 bg-brand-50 text-brand-800'
                            : 'border-slate-200 hover:border-brand-200 text-slate-600'
                        }`}
                      >
                        {opt.text}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <Button className="w-full" disabled={!allAnswered} onClick={handleSubmit}>
                Submit answers
              </Button>
            </>
          ) : (
            <div className="text-center space-y-3 py-2">
              <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
              <div className="text-lg font-bold text-slate-800">
                {result?.score}/{result?.total} correct
              </div>
              {result?.aiFeedback && <p className="text-sm text-slate-600">{result.aiFeedback}</p>}
              <p className="text-xs text-slate-400">Your representative will walk through anything you'd like to explore.</p>
              <Button variant="outline" className="w-full" onClick={onDismiss}>
                Back to call
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
