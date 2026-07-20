import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Gamepad2, X, Sparkles } from 'lucide-react';
import api from '../../api/client';
import { Button } from '../ui.jsx';
import { GAME_COMPONENTS } from './MiniGames.jsx';
import styles from './gameStyles.module.css';

// How many flash cards to reveal in one play session — enough to feel like a
// rewarding little "learn as you play" experience without dragging on.
const MAX_CARDS = 4;

/**
 * Play & Learn: the customer picks a mini-game; every so often play pauses to
 * reveal a short, interesting insurance fact — pure information, never a
 * question. Replaces the old milestone Q&A survey (see
 * backend/src/data/gameFlashcards.js for why: questions during play felt
 * like an interrogation and undermined trust; no answers are collected here).
 */
export default function GameSurveyOverlay({ deck: deckProp, customerName, onSubmit, onDismiss }) {
  const [deck, setDeck] = useState(deckProp);
  const [phase, setPhase] = useState('pick');
  const [gameId, setGameId] = useState(null);
  const [paused, setPaused] = useState(false);
  const [activeCard, setActiveCard] = useState(null);
  const [cardsShown, setCardsShown] = useState(0);
  const [complete, setComplete] = useState(false);
  const nextCardRef = useRef(0);
  const cardsRef = useRef([]);

  useEffect(() => {
    setDeck(deckProp);
  }, [deckProp]);

  const cards = deck?.cards || [];
  cardsRef.current = cards;

  useEffect(() => {
    if (cards.length) return;
    api
      .get('/tools/game-flashcards', { params: { productType: deck?.productType } })
      .then((res) => setDeck(res.data.deck))
      .catch(() => {});
  }, [cards.length, deck?.productType]);

  const GameComponent = gameId ? GAME_COMPONENTS[gameId] : null;

  const handleMilestone = useCallback(() => {
    const list = cardsRef.current;
    const i = nextCardRef.current;
    if (!list?.length || i >= MAX_CARDS) return false;
    nextCardRef.current = i + 1;
    setPaused(true);
    setActiveCard(list[i % list.length]);
    return true;
  }, []);

  function pickGame(id) {
    setGameId(id);
    setPhase('playing');
    nextCardRef.current = 0;
  }

  function dismissCard() {
    const shown = cardsShown + 1;
    setCardsShown(shown);
    setActiveCard(null);

    if (shown >= MAX_CARDS) {
      setComplete(true);
      setPaused(true);
      onSubmit(gameId, shown);
    } else {
      setPaused(false);
    }
  }

  if (!deck) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-3">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-violet-100 bg-gradient-to-r from-violet-100 via-brand-50 to-white shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-brand-600 text-white flex items-center justify-center shadow-sm">
              <Gamepad2 size={18} />
            </span>
            <div>
              <div className="text-sm font-bold text-slate-800">{deck.title}</div>
              <div className="text-[10px] text-slate-500">Just play — a quick fact pops up along the way</div>
            </div>
          </div>
          {!complete && (
            <button type="button" onClick={onDismiss} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Segmented progress across the cards to be revealed */}
        {phase !== 'pick' && (
          <div className="px-4 pt-3 shrink-0">
            <div className={styles.progressRow}>
              {Array.from({ length: MAX_CARDS }, (_, i) => (
                <span
                  key={i}
                  className={`${styles.progressDot} ${i < cardsShown ? styles.progressDotDone : ''} ${activeCard && i === cardsShown ? styles.progressDotActive : ''}`}
                />
              ))}
            </div>
          </div>
        )}

        <div className="p-4 overflow-y-auto flex-1">
          {phase === 'pick' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">{deck.intro}</p>
              <p className="text-[11px] font-semibold text-slate-700">Choose your game:</p>
              <div className="grid grid-cols-2 gap-2.5">
                {(deck.games || []).map((g) => (
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
                {paused && activeCard
                  ? 'Game paused — check out this fact'
                  : gameId === 'tetris'
                    ? 'Use arrow keys or buttons below — a fact pops up as you stack pieces'
                    : 'Keep playing — a quick fact will pop up along the way!'}
              </p>
              <GameComponent key={gameId} paused={paused} active={!complete} onMilestone={handleMilestone} />
              <p className="text-[10px] text-center text-slate-400">
                {cardsShown}/{MAX_CARDS} facts discovered
                {gameId === 'snake' && ' · Eat fruit to trigger a fact · swipe or use arrows'}
                {gameId === 'tetris' && ' · ← → move · Rotate · Drop'}
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
                Hope that was fun! Your representative is right here if you have any questions.
              </p>
              <Button variant="primary" className="w-full" onClick={onDismiss}>
                Continue
              </Button>
            </div>
          )}
        </div>

        {/* Flash card — pure information, nothing to answer. */}
        {activeCard && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-30">
            <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-sm animate-slide-in text-center">
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <Sparkles size={12} className="text-violet-500" />
                <span className="text-[10px] font-semibold text-violet-600 uppercase tracking-wide">Did you know?</span>
              </div>
              <div className="text-4xl mb-2">{activeCard.emoji}</div>
              <p className="text-sm font-bold text-slate-800 mb-1.5">{activeCard.title}</p>
              <p className="text-[13px] text-slate-600 leading-relaxed mb-4">{activeCard.fact}</p>
              <Button variant="primary" className="w-full" onClick={dismissCard}>
                {cardsShown + 1 >= MAX_CARDS ? 'Nice — finish up' : 'Neat — keep playing'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
