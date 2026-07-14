import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './gameStyles.module.css';

const CELL = 22;
const CANDY = ['#f472b6', '#60a5fa', '#fbbf24', '#34d399', '#a78bfa'];

/** Polished control-pad button shared by Snake and Tetris. */
function Pad({ children, accent = false, className = '', ...props }) {
  return (
    <button type="button" className={`${styles.control} ${accent ? styles.controlAccent : ''} ${className}`} {...props}>
      {children}
    </button>
  );
}

function useGameLoop(callback, paused, active) {
  const cbRef = useRef(callback);
  const pausedRef = useRef(paused);
  cbRef.current = callback;
  pausedRef.current = paused;
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => {
      if (!pausedRef.current) cbRef.current();
    }, 140);
    return () => clearInterval(id);
  }, [active, paused]);
}

/** Pause game immediately when a question is accepted by the overlay. */
function useGameMilestone(onMilestone, paused, active) {
  const onMilestoneRef = useRef(onMilestone);
  const pausedRef = useRef(paused);
  onMilestoneRef.current = onMilestone;
  pausedRef.current = paused;

  useEffect(() => {
    if (!paused && active) pausedRef.current = false;
  }, [paused, active]);

  const fireMilestone = useCallback(() => {
    if (pausedRef.current || !active) return false;
    const accepted = onMilestoneRef.current?.() === true;
    if (accepted) pausedRef.current = true;
    return accepted;
  }, [active]);

  return { fireMilestone, pausedRef };
}

function findMatchSet(board) {
  const n = board.length;
  const matched = new Set();
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n - 2; c += 1) {
      const v = board[r][c];
      if (v < 0) continue;
      if (board[r][c + 1] === v && board[r][c + 2] === v) {
        let cc = c;
        while (cc < n && board[r][cc] === v) {
          matched.add(`${r},${cc}`);
          cc += 1;
        }
      }
    }
  }
  for (let c = 0; c < n; c += 1) {
    for (let r = 0; r < n - 2; r += 1) {
      const v = board[r][c];
      if (v < 0) continue;
      if (board[r + 1][c] === v && board[r + 2][c] === v) {
        let rr = r;
        while (rr < n && board[rr][c] === v) {
          matched.add(`${rr},${c}`);
          rr += 1;
        }
      }
    }
  }
  return matched;
}

function clearMatchesAndDrop(board, matched, colorCount) {
  const n = board.length;
  const next = board.map((row) => [...row]);
  matched.forEach((key) => {
    const [r, c] = key.split(',').map(Number);
    next[r][c] = -1;
  });
  for (let c = 0; c < n; c += 1) {
    const stack = [];
    for (let r = n - 1; r >= 0; r -= 1) {
      if (next[r][c] >= 0) stack.push(next[r][c]);
    }
    for (let r = n - 1; r >= 0; r -= 1) {
      next[r][c] = stack[n - 1 - r] ?? Math.floor(Math.random() * colorCount);
    }
  }
  return next;
}

function randomMatchBoard(n, colorCount) {
  let board;
  let safety = 0;
  do {
    board = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => Math.floor(Math.random() * colorCount))
    );
    safety += 1;
  } while (findMatchSet(board).size > 0 && safety < 60);
  return board;
}

function floodFillCluster(board, r, c) {
  const n = board.length;
  const color = board[r][c];
  const cluster = new Set();
  function walk(yr, xc) {
    const key = `${yr},${xc}`;
    if (yr < 0 || xc < 0 || yr >= n || xc >= n || cluster.has(key) || board[yr][xc] !== color) return;
    cluster.add(key);
    walk(yr + 1, xc);
    walk(yr - 1, xc);
    walk(yr, xc + 1);
    walk(yr, xc - 1);
  }
  walk(r, c);
  return cluster;
}

function randomPopBoard(n, colorCount) {
  const board = randomMatchBoard(n, colorCount);
  for (let i = 0; i < 10; i += 1) {
    const r = Math.floor(Math.random() * (n - 1));
    const c = Math.floor(Math.random() * (n - 1));
    const color = Math.floor(Math.random() * colorCount);
    board[r][c] = color;
    board[r][c + 1] = color;
    if (Math.random() > 0.4) board[r + 1][c] = color;
  }
  let matched = findMatchSet(board);
  let guard = 0;
  while (matched.size > 0 && guard < 20) {
    const cleared = clearMatchesAndDrop(board, matched, colorCount);
    for (let r = 0; r < n; r += 1) board[r] = [...cleared[r]];
    matched = findMatchSet(board);
    guard += 1;
  }
  return board;
}

function GameCanvas({ children }) {
  return (
    <div className="flex justify-center">
      <div className={styles.board}>
        <div className={styles.boardInner}>{children}</div>
      </div>
    </div>
  );
}

/** Snake — milestone each time food is eaten */
export function SnakeGame({ paused, active, onMilestone }) {
  const size = 12;
  const [snake, setSnake] = useState([{ x: 5, y: 6 }]);
  const [dir, setDir] = useState({ x: 1, y: 0 });
  const [food, setFood] = useState({ x: 8, y: 6 });
  const foodEatenTotal = useRef(0);
  const snakeRef = useRef([{ x: 5, y: 6 }]);
  const foodRef = useRef({ x: 8, y: 6 });
  const dirRef = useRef(dir);
  const { fireMilestone, pausedRef } = useGameMilestone(onMilestone, paused, active);

  snakeRef.current = snake;
  foodRef.current = food;
  dirRef.current = dir;

  const placeFood = useCallback((snakeBody) => {
    const body = snakeBody || snakeRef.current;
    let spot = { x: 0, y: 0 };
    for (let attempt = 0; attempt < 80; attempt += 1) {
      spot = {
        x: Math.floor(Math.random() * size),
        y: Math.floor(Math.random() * size),
      };
      if (!body.some((s) => s.x === spot.x && s.y === spot.y)) break;
    }
    foodRef.current = spot;
    setFood(spot);
  }, [size]);

  const turn = useCallback(
    (next) => {
      if (pausedRef.current || !active) return;
      const cur = dirRef.current;
      if (next.x === -cur.x && next.y === -cur.y) return;
      setDir(next);
    },
    [active]
  );

  const tick = useCallback(() => {
    if (pausedRef.current || !active) return;

    const prev = snakeRef.current;
    const head = {
      x: (prev[0].x + dirRef.current.x + size) % size,
      y: (prev[0].y + dirRef.current.y + size) % size,
    };

    if (prev.length > 1 && prev.some((s) => s.x === head.x && s.y === head.y)) {
      const reset = [{ x: 5, y: 6 }];
      snakeRef.current = reset;
      setSnake(reset);
      return;
    }

    const currentFood = foodRef.current;
    const ate = head.x === currentFood.x && head.y === currentFood.y;
    const next = [head, ...prev];

    if (ate) {
      foodEatenTotal.current += 1;
      snakeRef.current = next;
      setSnake(next);
      placeFood(next);
      fireMilestone();
      return;
    }

    next.pop();
    snakeRef.current = next;
    setSnake(next);
  }, [active, fireMilestone, placeFood, size]);

  useGameLoop(tick, paused, active);

  useEffect(() => {
    function onKey(e) {
      const map = { ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 } };
      const next = map[e.key];
      if (!next) return;
      e.preventDefault();
      turn(next);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [turn]);

  const touchStart = useRef(null);
  function onTouchStart(e) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e) {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      turn(dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 });
    } else {
      turn(dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 });
    }
  }

  const w = size * CELL;
  return (
    <div className="space-y-2">
      <GameCanvas>
        <svg
          width={w}
          height={w}
          className="touch-none select-none"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <defs>
            <linearGradient id="snakeBody" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4ade80" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <radialGradient id="snakeFood" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#fda4af" />
              <stop offset="100%" stopColor="#e11d48" />
            </radialGradient>
          </defs>
          {/* faint grid dots */}
          {Array.from({ length: size + 1 }, (_, i) => (
            <line key={`gx-${i}`} x1={i * CELL} y1={0} x2={i * CELL} y2={w} stroke="rgba(148,163,184,0.08)" strokeWidth={1} />
          ))}
          {Array.from({ length: size + 1 }, (_, i) => (
            <line key={`gy-${i}`} x1={0} y1={i * CELL} x2={w} y2={i * CELL} stroke="rgba(148,163,184,0.08)" strokeWidth={1} />
          ))}
          {snake.map((s, i) => (
            <rect
              key={i}
              x={s.x * CELL + 1}
              y={s.y * CELL + 1}
              width={CELL - 2}
              height={CELL - 2}
              rx={i === 0 ? 7 : 5}
              fill="url(#snakeBody)"
              opacity={i === 0 ? 1 : Math.max(0.55, 1 - i * 0.03)}
            />
          ))}
          {snake[0] && <circle cx={snake[0].x * CELL + CELL / 2} cy={snake[0].y * CELL + CELL / 2} r={2} fill="#052e16" />}
          <circle cx={food.x * CELL + CELL / 2} cy={food.y * CELL + CELL / 2} r={(CELL - 4) / 2} fill="url(#snakeFood)">
            <animate attributeName="r" values={`${(CELL - 6) / 2};${(CELL - 3) / 2};${(CELL - 6) / 2}`} dur="1.1s" repeatCount="indefinite" />
          </circle>
        </svg>
      </GameCanvas>
      <div className="flex flex-col items-center gap-1.5">
        <Pad disabled={paused || !active} onClick={() => turn({ x: 0, y: -1 })} aria-label="Up">↑</Pad>
        <div className="flex gap-1.5">
          <Pad disabled={paused || !active} onClick={() => turn({ x: -1, y: 0 })} aria-label="Left">←</Pad>
          <Pad disabled={paused || !active} onClick={() => turn({ x: 0, y: 1 })} aria-label="Down">↓</Pad>
          <Pad disabled={paused || !active} onClick={() => turn({ x: 1, y: 0 })} aria-label="Right">→</Pad>
        </div>
      </div>
      <p className="text-[10px] text-center text-slate-400">Swipe on the board or use the arrows below</p>
    </div>
  );
}

/** Tetris — tetrominoes with move/rotate; questions on pieces placed + line clears */
const TETROMINOES = [
  { shape: [[1, 1, 1, 1]], color: 1 }, // I
  { shape: [[1, 1], [1, 1]], color: 2 }, // O
  { shape: [[0, 1, 0], [1, 1, 1]], color: 3 }, // T
  { shape: [[0, 1, 1], [1, 1, 0]], color: 4 }, // S
  { shape: [[1, 1, 0], [0, 1, 1]], color: 5 }, // Z
  { shape: [[1, 0, 0], [1, 1, 1]], color: 6 }, // J
  { shape: [[0, 0, 1], [1, 1, 1]], color: 7 }, // L
];

const TETRIS_COLORS = ['', '#22d3ee', '#fbbf24', '#a78bfa', '#34d399', '#f87171', '#60a5fa', '#fb923c'];

function rotateShape(shape) {
  const rows = shape.length;
  const cols = shape[0].length;
  const out = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      out[c][rows - 1 - r] = shape[r][c];
    }
  }
  return out;
}

function randomPiece() {
  const t = TETROMINOES[Math.floor(Math.random() * TETROMINOES.length)];
  return { shape: t.shape.map((row) => [...row]), x: 3, y: 0, color: t.color };
}

export function TetrisGame({ paused, active, onMilestone }) {
  const cols = 10;
  const rows = 16;
  const [grid, setGrid] = useState(() => Array.from({ length: rows }, () => Array(cols).fill(0)));
  const [piece, setPiece] = useState(() => randomPiece());
  const gridRef = useRef(grid);
  const pieceRef = useRef(piece);
  const { fireMilestone, pausedRef } = useGameMilestone(onMilestone, paused, active);

  gridRef.current = grid;
  pieceRef.current = piece;

  const collide = useCallback((shape, px, py, g) => {
    for (let r = 0; r < shape.length; r += 1) {
      for (let c = 0; c < shape[r].length; c += 1) {
        if (!shape[r][c]) continue;
        const ny = py + r;
        const nx = px + c;
        if (nx < 0 || nx >= cols || ny >= rows) return true;
        if (ny >= 0 && g[ny][nx]) return true;
      }
    }
    return false;
  }, [cols, rows]);

  const lockPiece = useCallback(() => {
    const p = pieceRef.current;
    const g = gridRef.current.map((row) => [...row]);
    for (let r = 0; r < p.shape.length; r += 1) {
      for (let c = 0; c < p.shape[r].length; c += 1) {
        if (!p.shape[r][c]) continue;
        const ny = p.y + r;
        const nx = p.x + c;
        if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
          g[ny][nx] = p.color;
        }
      }
    }

    let cleared = 0;
    const afterClear = g.filter((row) => {
      if (row.every((cell) => cell > 0)) {
        cleared += 1;
        return false;
      }
      return true;
    });
    while (afterClear.length < rows) {
      afterClear.unshift(Array(cols).fill(0));
    }

    setGrid(afterClear);
    fireMilestone();
    const next = randomPiece();
    if (collide(next.shape, next.x, next.y, afterClear)) {
      // Board full — trim top rows so play can continue
      const trimmed = afterClear.slice(Math.floor(rows / 3));
      while (trimmed.length < rows) trimmed.unshift(Array(cols).fill(0));
      setGrid(trimmed);
      setPiece(randomPiece());
      return;
    }
    setPiece(next);
  }, [collide, cols, fireMilestone, rows]);

  const tryMove = useCallback(
    (dx, dy, rotatedShape) => {
      if (pausedRef.current || !active) return;
      const p = pieceRef.current;
      const shape = rotatedShape || p.shape;
      const nx = p.x + dx;
      const ny = p.y + dy;
      if (!collide(shape, nx, ny, gridRef.current)) {
        setPiece({ ...p, shape, x: nx, y: ny });
        return true;
      }
      if (dy > 0 && !rotatedShape) lockPiece();
      return false;
    },
    [active, collide, lockPiece, pausedRef]
  );

  const tick = useCallback(() => {
    tryMove(0, 1);
  }, [tryMove]);

  useGameLoop(tick, paused, active);

  useEffect(() => {
    function onKey(e) {
      if (pausedRef.current || !active) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        tryMove(-1, 0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        tryMove(1, 0);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        tryMove(0, 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const rotated = rotateShape(pieceRef.current.shape);
        tryMove(0, 0, rotated);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, tryMove]);

  const w = cols * CELL;
  const h = rows * CELL;
  const p = piece;

  return (
    <div className="space-y-2">
      <GameCanvas>
        <svg width={w} height={h}>
          {grid.map((row, y) =>
            row.map((c, x) =>
              c ? (
                <rect
                  key={`g-${x}-${y}`}
                  x={x * CELL + 1}
                  y={y * CELL + 1}
                  width={CELL - 2}
                  height={CELL - 2}
                  rx={2}
                  fill={TETRIS_COLORS[c]}
                />
              ) : null
            )
          )}
          {p.shape.map((row, r) =>
            row.map((cell, c) =>
              cell ? (
                <rect
                  key={`p-${r}-${c}`}
                  x={(p.x + c) * CELL + 1}
                  y={(p.y + r) * CELL + 1}
                  width={CELL - 2}
                  height={CELL - 2}
                  rx={2}
                  fill={TETRIS_COLORS[p.color]}
                  stroke="#fff"
                  strokeWidth={0.5}
                />
              ) : null
            )
          )}
        </svg>
      </GameCanvas>
      <div className="flex justify-center gap-1.5">
        <Pad disabled={paused || !active} onClick={() => tryMove(-1, 0)} aria-label="Left">←</Pad>
        <Pad accent disabled={paused || !active} onClick={() => tryMove(0, 0, rotateShape(pieceRef.current.shape))}>
          Rotate
        </Pad>
        <Pad disabled={paused || !active} onClick={() => tryMove(1, 0)} aria-label="Right">→</Pad>
        <Pad disabled={paused || !active} onClick={() => tryMove(0, 1)}>Drop</Pad>
      </div>
    </div>
  );
}

/** Minesweeper — milestone every 4 safe cells revealed */
export function MinesweeperGame({ paused, active, onMilestone }) {
  const n = 6;
  const mines = useRef(
    Array.from({ length: n * n }, (_, i) => i).sort(() => Math.random() - 0.5).slice(0, 6)
  );
  const [revealed, setRevealed] = useState(new Set());
  const safeRef = useRef(0);
  const { fireMilestone, pausedRef } = useGameMilestone(onMilestone, paused, active);

  function reveal(i) {
    if (pausedRef.current || !active) return;
    if (revealed.has(i) || mines.current.includes(i)) return;
    safeRef.current += 1;
    setRevealed((prev) => new Set(prev).add(i));
    if (safeRef.current % 4 === 0) fireMilestone();
  }

  return (
    <GameCanvas>
      <div className="grid gap-0.5 p-1" style={{ gridTemplateColumns: `repeat(${n}, ${CELL}px)` }}>
        {Array.from({ length: n * n }, (_, i) => (
          <button
            key={i}
            type="button"
            disabled={paused || !active}
            onClick={() => reveal(i)}
            className={`rounded text-[10px] font-bold ${revealed.has(i) ? 'bg-slate-600 text-white' : 'bg-emerald-600 hover:bg-emerald-500'}`}
            style={{ width: CELL, height: CELL }}
          >
            {revealed.has(i) ? (mines.current.includes(i) ? '💥' : '·') : ''}
          </button>
        ))}
      </div>
    </GameCanvas>
  );
}

/** Candy Crush — swap adjacent tiles to match 3+; tiles fall and refill */
export function CandyCrushGame({ paused, active, onMilestone }) {
  const n = 6;
  const colorCount = CANDY.length;
  const [board, setBoard] = useState(() => randomMatchBoard(n, colorCount));
  const boardRef = useRef(board);
  const [selected, setSelected] = useState(null);
  const { fireMilestone, pausedRef } = useGameMilestone(onMilestone, paused, active);
  boardRef.current = board;

  const resolveBoard = useCallback(
    (startBoard) => {
      let current = startBoard.map((row) => [...row]);
      let matched = findMatchSet(current);
      while (matched.size > 0) {
        current = clearMatchesAndDrop(current, matched, colorCount);
        matched = findMatchSet(current);
      }
      setBoard(current);
      return current;
    },
    [colorCount]
  );

  function swap(r1, c1, r2, c2) {
    if (pausedRef.current || !active) return;
    const prev = boardRef.current;
    const next = prev.map((row) => [...row]);
    [next[r1][c1], next[r2][c2]] = [next[r2][c2], next[r1][c1]];
    if (findMatchSet(next).size === 0) return;
    const resolved = resolveBoard(next);
    boardRef.current = resolved;
    fireMilestone();
    setSelected(null);
  }

  function tap(r, c) {
    if (pausedRef.current || !active) return;
    if (!selected) {
      setSelected({ r, c });
      return;
    }
    const dr = Math.abs(selected.r - r);
    const dc = Math.abs(selected.c - c);
    if (dr + dc === 1) swap(selected.r, selected.c, r, c);
    else setSelected({ r, c });
  }

  return (
    <div className="space-y-2">
      <GameCanvas>
        <div className="grid gap-0.5 p-1" style={{ gridTemplateColumns: `repeat(${n}, ${CELL}px)` }}>
          {board.map((row, r) =>
            row.map((c, col) => (
              <button
                key={`${r}-${col}`}
                type="button"
                disabled={paused || !active}
                onClick={() => tap(r, col)}
                className={`rounded-lg border border-white/10 transition-transform ${styles.glossTile} ${selected?.r === r && selected?.c === col ? `ring-2 ring-white ${styles.tileSelected}` : ''}`}
                style={{ width: CELL, height: CELL, backgroundColor: CANDY[c] }}
              />
            ))
          )}
        </div>
      </GameCanvas>
      <p className="text-[10px] text-center text-slate-400 px-2">Tap one candy, then tap a neighbour to swap and match 3+</p>
    </div>
  );
}

/** Pop Blast — tap connected clusters (2+); bubbles fall and refill */
export function PopBlastGame({ paused, active, onMilestone }) {
  const n = 7;
  const colorCount = CANDY.length;
  const [board, setBoard] = useState(() => randomPopBoard(n, colorCount));
  const { fireMilestone, pausedRef } = useGameMilestone(onMilestone, paused, active);

  function pop(r, c) {
    if (pausedRef.current || !active) return;
    const cluster = floodFillCluster(board, r, c);
    if (cluster.size < 2) return;
    const next = clearMatchesAndDrop(board, cluster, colorCount);
    setBoard(next);
    fireMilestone();
  }

  return (
    <div className="space-y-2">
      <GameCanvas>
        <div className="grid gap-0.5 p-1" style={{ gridTemplateColumns: `repeat(${n}, ${CELL}px)` }}>
          {board.map((row, r) =>
            row.map((c, col) => (
              <button
                key={`${r}-${col}`}
                type="button"
                disabled={paused || !active}
                onClick={() => pop(r, col)}
                className={`rounded-full border border-white/30 active:scale-90 transition-transform ${styles.glossTile}`}
                style={{ width: CELL, height: CELL, backgroundColor: CANDY[c] }}
              />
            ))
          )}
        </div>
      </GameCanvas>
      <p className="text-[10px] text-center text-slate-400 px-2">Tap 2+ connected same-color bubbles to pop them</p>
    </div>
  );
}

export const GAME_COMPONENTS = {
  snake: SnakeGame,
  tetris: TetrisGame,
  minesweeper: MinesweeperGame,
  candy_crush: CandyCrushGame,
  pop_blast: PopBlastGame,
};
