import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Gamepad2, X, Sparkles } from 'lucide-react';
import api from '../../api/client';
import { Button } from '../ui.jsx';
import { GAME_COMPONENTS } from './MiniGames.jsx';
import styles from './gameStyles.module.css';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];

export default function GameSurveyOverlay({ survey: surveyProp, customerName, onSubmit, onDismiss }) {
  const [survey, setSurvey] = useState(surveyProp);
  const [phase, setPhase] = useState('pick');
  const [gameId, setGameId] = useState(null);
  const [paused, setPaused] = useState(false);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(null);
  const [answers, setAnswers] = useState({});
  const [learnTip, setLearnTip] = useState(null); // { text, nextAnswers, isLast }
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

    const isLast = Object.keys(nextAnswers).length >= questions.length;

    // Reveal the "Good to know" learning tip as the reward for answering — the
    // learning payoff that makes sharing feel comfortable. Stay paused until the
    // customer taps to continue; only then resume the game / finish.
    if (q.learn) {
      setLearnTip({ text: q.learn, nextAnswers, isLast });
    } else {
      finishAnswer(nextAnswers, isLast);
    }
  }

  function finishAnswer(nextAnswers, isLast) {
    setLearnTip(null);
    if (isLast) {
      setComplete(true);
      setPaused(true);
      onSubmit(nextAnswers, gameId, () => {});
    } else {
      setPaused(false);
    }
  }

  if (!survey) return null;

  const activeQuestion = activeQuestionIndex != null ? questions[activeQuestionIndex] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-3">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-violet-100 bg-gradient-to-r from-violet-100 via-brand-50 to-white shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-brand-600 text-white flex items-center justify-center shadow-sm">
              <Gamepad2 size={18} />
            </span>
            <div>
              <div className="text-sm font-bold text-slate-800">{survey.title}</div>
              <div className="text-[10px] text-slate-500">Play, learn &amp; share — {questions.length} quick questions, each with a tip</div>
            </div>
          </div>
          {!complete && (
            <button type="button" onClick={onDismiss} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Segmented progress across all questions */}
        {phase !== 'pick' && questions.length > 0 && (
          <div className="px-4 pt-3 shrink-0">
            <div className={styles.progressRow}>
              {questions.map((q, i) => {
                const answered = i < Object.keys(answers).length;
                const isActive = activeQuestionIndex === i;
                return (
                  <span
                    key={q.id}
                    className={`${styles.progressDot} ${answered ? styles.progressDotDone : ''} ${isActive ? styles.progressDotActive : ''}`}
                  />
                );
              })}
            </div>
          </div>
        )}

        <div className="p-4 overflow-y-auto flex-1">
          {phase === 'pick' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">{survey.intro}</p>
              <p className="text-[11px] font-semibold text-slate-700">Choose your game:</p>
              <div className="grid grid-cols-2 gap-2.5">
                {(survey.games || []).map((g) => (
                  <button key={g.id} type="button" onClick={() => pickGame(g.id)} className={styles.pickCard}>
                    <span className={styles.pickEmoji}>{g.emoji}</span>
                    <div className="text-xs font-semibold text-slate-800 mt-1.5">{g.label}</div>
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
            <div className="text-center space-y-3 py-6">
              <div className={`mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg ${styles.celebrate}`}>
                <CheckCircle2 size={34} className="text-white" />
              </div>
              <div className="text-lg font-bold text-slate-800">Thanks{customerName ? `, ${customerName.split(' ')[0]}` : ''}! 🎉</div>
              <p className="text-sm text-slate-600 max-w-xs mx-auto">
                Your preferences were shared with your representative — they'll tailor the conversation to you.
              </p>
              <Button variant="primary" className="w-full" onClick={onDismiss}>
                Continue
              </Button>
            </div>
          )}
        </div>

        {activeQuestion && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-30">
            <div className="bg-white rounded-2xl shadow-2xl p-4 w-full max-w-sm animate-slide-in">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={12} className="text-violet-500" />
                <span className="text-[10px] font-semibold text-violet-600 uppercase tracking-wide">
                  Question {activeQuestionIndex + 1} of {questions.length}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-800 mb-3">{activeQuestion.text}</p>
              <div className="space-y-2">
                {activeQuestion.options.map((opt, i) => (
                  <button key={opt.id} type="button" onClick={() => answerQuestion(opt.id)} className={styles.optionRow}>
                    <span className={styles.optionBadge}>{OPTION_LETTERS[i] || '•'}</span>
                    <span>{opt.text}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Learning payoff — the "Good to know" tip shown after each answer. */}
        {learnTip && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-30">
            <div className="bg-white rounded-2xl shadow-2xl p-4 w-full max-w-sm animate-slide-in">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-lg">💡</span>
                <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">You just learned something</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed mb-3">{learnTip.text}</p>
              <Button variant="primary" className="w-full" onClick={() => finishAnswer(learnTip.nextAnswers, learnTip.isLast)}>
                {learnTip.isLast ? 'Finish' : 'Got it — keep playing'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
