import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Gamepad2, X } from 'lucide-react';
import api from '../../api/client';
import { Button } from '../ui.jsx';
import { GAME_COMPONENTS } from './MiniGames.jsx';

export default function GameSurveyOverlay({ survey: surveyProp, customerName, onSubmit, onDismiss }) {
  const [survey, setSurvey] = useState(surveyProp);
  const [phase, setPhase] = useState('pick');
  const [gameId, setGameId] = useState(null);
  const [paused, setPaused] = useState(false);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(null);
  const [answers, setAnswers] = useState({});
  const [complete, setComplete] = useState(false);
  const nextQuestionRef = useRef(0);
  const questionsRef = useRef([]);

  useEffect(() => {
    setSurvey(surveyProp);
  }, [surveyProp]);

  const questions = survey?.questions || [];
  questionsRef.current = questions;

  useEffect(() => {
    if (questions.length) return;
    api
      .get('/tools/needs-survey', { params: { productType: survey?.productType } })
      .then((res) => setSurvey(res.data.survey))
      .catch(() => {});
  }, [questions.length, survey?.productType]);

  const GameComponent = gameId ? GAME_COMPONENTS[gameId] : null;

  const handleMilestone = useCallback(() => {
    const qs = questionsRef.current;
    const qIndex = nextQuestionRef.current;
    if (!qs?.length || qIndex >= qs.length) return false;
    nextQuestionRef.current = qIndex + 1;
    setPaused(true);
    setActiveQuestionIndex(qIndex);
    return true;
  }, []);

  function pickGame(id) {
    setGameId(id);
    setPhase('playing');
    nextQuestionRef.current = 0;
  }

  function answerQuestion(optionId) {
    const q = questions[activeQuestionIndex];
    if (!q) return;
    const nextAnswers = { ...answers, [q.id]: optionId };
    setAnswers(nextAnswers);
    setActiveQuestionIndex(null);
    setPaused(false);

    const answeredCount = Object.keys(nextAnswers).length;
    if (answeredCount >= questions.length) {
      setComplete(true);
      setPaused(true);
      onSubmit(nextAnswers, gameId, () => {});
    }
  }

  if (!survey) return null;

  const activeQuestion = activeQuestionIndex != null ? questions[activeQuestionIndex] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-3">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-brand-50 shrink-0">
          <div className="flex items-center gap-2">
            <Gamepad2 size={18} className="text-violet-600" />
            <div>
              <div className="text-sm font-bold text-slate-800">{survey.title}</div>
              <div className="text-[10px] text-slate-500">Play &amp; answer — {questions.length} quick questions</div>
            </div>
          </div>
          {!complete && (
            <button type="button" onClick={onDismiss} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {phase === 'pick' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">{survey.intro}</p>
              <p className="text-[11px] font-semibold text-slate-700">Choose your game:</p>
              <div className="grid grid-cols-2 gap-2">
                {(survey.games || []).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => pickGame(g.id)}
                    className="rounded-xl border border-slate-200 hover:border-violet-300 hover:bg-violet-50/50 p-3 text-left transition-colors"
                  >
                    <span className="text-2xl">{g.emoji}</span>
                    <div className="text-xs font-semibold text-slate-800 mt-1">{g.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {phase === 'playing' && GameComponent && !complete && (
            <div className="space-y-3">
              <p className="text-[11px] text-center text-slate-500">
                {paused && activeQuestion
                  ? 'Game paused — answer to continue'
                  : gameId === 'tetris'
                    ? 'Use arrow keys or buttons below — questions pop up as you stack pieces'
                    : 'Keep playing — questions appear as you progress!'}
              </p>
              <GameComponent key={gameId} paused={paused} active={!complete} onMilestone={handleMilestone} />
              <p className="text-[10px] text-center text-slate-400">
                Answered {Object.keys(answers).length}/{questions.length}
                {gameId === 'snake' && ' · Eat fruit to trigger questions · swipe or use arrows'}
                {gameId === 'tetris' && ' · ← → move · Rotate · Drop — 1 question per piece placed'}
                {gameId === 'minesweeper' && ' · Reveal safe cells (every 4)'}
                {(gameId === 'candy_crush' || gameId === 'pop_blast') && ' · Match 3+ or pop connected bubbles'}
              </p>
            </div>
          )}

          {complete && (
            <div className="text-center space-y-3 py-4">
              <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
              <div className="text-lg font-bold text-slate-800">Thanks{customerName ? `, ${customerName.split(' ')[0]}` : ''}!</div>
              <p className="text-sm text-slate-600">Your preferences were shared with your representative.</p>
              <Button variant="outline" className="w-full" onClick={onDismiss}>
                Continue
              </Button>
            </div>
          )}
        </div>

        {activeQuestion && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-30">
            <div className="bg-white rounded-2xl shadow-xl p-4 w-full max-w-sm animate-slide-in">
              <div className="text-[10px] font-semibold text-violet-600 uppercase tracking-wide mb-1">
                Question {activeQuestionIndex + 1} of {questions.length}
              </div>
              <p className="text-sm font-medium text-slate-800 mb-3">{activeQuestion.text}</p>
              <div className="space-y-1.5">
                {activeQuestion.options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => answerQuestion(opt.id)}
                    className="w-full text-left text-xs rounded-xl border border-slate-200 hover:border-violet-400 hover:bg-violet-50 px-3 py-2.5 text-slate-700 transition-colors"
                  >
                    {opt.text}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
