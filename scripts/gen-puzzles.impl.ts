// ══════════════════════════════════════════════════════════════════════
//  مولّد الألغاز — وحدة حقيقية تستورد محرّك اللعبة نفسه.
//  تُشغَّل عبر scripts/gen-puzzles.mjs (هو من يكتب الملف).
//
//  ما نبحث عنه: موضع يفوز فيه الأبيض فوزاً قسرياً في n حركة بالضبط،
//  أي: لأيّ دفاع يلعبه الأسود، يملك الأبيض رداً يُنهي اللعبة في حدود
//  ميزانيته. هذا بحث AND/OR كامل العرض — لا تشذيب ولا تقدير — فنتيجته
//  برهان لا تخمين. لغز خاطئ أسوأ من لا لغز.
// ══════════════════════════════════════════════════════════════════════

import {
  createInitialBoard, getAllValidMoves, executeMove, getBestMove,
  getRow, getCol, type BoardType,
} from '../src/engine.ts';

const ENC = { white: 'w', black: 'b', whiteKing: 'W', blackKing: 'B' } as const;

function encode(board: BoardType): string {
  let s = '';
  for (const p of board) s += p ? ENC[p] : '.';
  return s;
}

let nodes = 0;
const BUDGET = 400_000;        // سقف عُقد لكل استعلام — يمنع الانفجار

/** هل يملك صاحب الدور فوزاً قسرياً خلال n من حركاته؟ */
function hasForcedWin(board: BoardType, stm: boolean, n: number): boolean {
  if (n <= 0) return false;
  if (++nodes > BUDGET) return false;
  for (const m of getAllValidMoves(board, stm)) {
    const b2 = executeMove(board, m, stm);
    const replies = getAllValidMoves(b2, !stm);
    if (replies.length === 0) return true;             // لا حركة للخصم ⇒ فوز
    if (n === 1) continue;                             // نفدت الميزانية
    let all = true;
    for (const r of replies) {
      if (!hasForcedWin(executeMove(b2, r, !stm), stm, n - 1)) { all = false; break; }
    }
    if (all) return true;
  }
  return false;
}

/** عدد الحركات الأولى التي تؤدي إلى فوز قسري — 1 يعني لغزاً وحيد الحل. */
function winningFirstMoves(board: BoardType, stm: boolean, n: number): number {
  let count = 0;
  for (const m of getAllValidMoves(board, stm)) {
    const b2 = executeMove(board, m, stm);
    const replies = getAllValidMoves(b2, !stm);
    if (replies.length === 0) { count++; continue; }
    if (n === 1) continue;
    let all = true;
    for (const r of replies) {
      if (!hasForcedWin(executeMove(b2, r, !stm), stm, n - 1)) { all = false; break; }
    }
    if (all) count++;
  }
  return count;
}

interface Found { b: string; n: number; unique: boolean; pieces: number }

let found = new Map<string, Found>();

/** يفحص موضعاً واحداً ويضيفه إن كان لغزاً صالحاً. */
function consider(board: BoardType) {
  const pieces = board.filter(p => p).length;
  if (pieces < 4 || pieces > 14) return;
  const legal = getAllValidMoves(board, true);
  if (legal.length < 2) return;            // حركة واحدة = لا لغز
  const enc = encode(board);
  if (found.has(enc)) return;

  /** يُجيب بثقة أو يعترف بالجهل — لا نبني لغزاً على نتيجة نفدت ميزانيتها. */
  const win = (k: number): boolean | null => {
    nodes = 0;
    const r = hasForcedWin(board, true, k);
    return nodes > BUDGET ? null : r;
  };

  // «فوز في حركة واحدة» ليس لغزاً: الموضع محسوم بالنظر. نرفضه أولاً.
  const inOne = win(1);
  if (inOne === null || inOne) return;

  for (const n of [2, 3]) {
    const atN = win(n);
    if (atN === null) return;
    if (!atN) continue;
    // «بالضبط في n» يعني: يوجد فوز في n ولا يوجد في n-1. كل n يُفحَص،
    // بما فيها n=2 ضدّ n=1 — وإغفال هذا هو ما أنتج 16 لغزاً خاطئاً.
    if (n > 1) {
      const shorter = win(n - 1);
      if (shorter === null || shorter) return;
    }
    nodes = 0;
    const ways = winningFirstMoves(board, true, n);
    if (nodes > BUDGET) return;
    found.set(enc, { b: enc, n, unique: ways === 1, pieces });
    return;
  }
}

// ── المصدر الأول: مواضع من مباريات حقيقية ────────────────────────────
function harvestGames(games: number) {
  for (let g = 0; g < games; g++) {
    let s = (g * 2654435761 + 12345) >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    let board = createInitialBoard(), wtm = true;
    const randomPlies = 6 + Math.floor(rnd() * 10);
    for (let ply = 0; ply < 260; ply++) {
      if (wtm) consider(board);
      const legal = getAllValidMoves(board, wtm);
      if (legal.length === 0) break;
      const mv = ply < randomPlies
        ? legal[Math.floor(rnd() * legal.length)]
        : (rnd() < 0.25 ? legal[Math.floor(rnd() * legal.length)] : getBestMove(board, wtm, 4)!);
      board = executeMove(board, mv, wtm);
      wtm = !wtm;
    }
    if ((g + 1) % 20 === 0) {
      console.error(`   مباراة ${g + 1}/${games} — ${found.size} لغزاً`);
    }
  }
}

// ── المصدر الثاني: نهايات مُركَّبة عشوائياً ───────────────────────────
function harvestEndgames(tries: number) {
  let s = 99991;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const darks: number[] = [];
  for (let i = 0; i < 64; i++) if ((getRow(i) + getCol(i)) % 2 === 1) darks.push(i);

  for (let k = 0; k < tries; k++) {
    const board: BoardType = new Array(64).fill(null);
    const nW = 2 + Math.floor(rnd() * 4);
    const nB = 2 + Math.floor(rnd() * 4);
    const pool = darks.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    let at = 0, ok = true;
    const place = (kind: 'w' | 'b') => {
      if (at >= pool.length) { ok = false; return; }
      const sq = pool[at++], row = getRow(sq);
      // الجنود لا توضع في صف التتويج — موضع مستحيل في لعبة حقيقية
      const king = rnd() < 0.45 || (kind === 'w' && row === 0) || (kind === 'b' && row === 7);
      board[sq] = kind === 'w' ? (king ? 'whiteKing' : 'white') : (king ? 'blackKing' : 'black');
    };
    for (let i = 0; i < nW && ok; i++) place('w');
    for (let i = 0; i < nB && ok; i++) place('b');
    if (!ok) continue;
    // الموضع يجب أن يكون شرعياً: للأسود حركة (وإلا فاللعبة منتهية سلفاً)
    if (getAllValidMoves(board, false).length === 0) continue;
    consider(board);
    if ((k + 1) % 400 === 0) console.error(`   نهاية ${k + 1}/${tries} — ${found.size} لغزاً`);
  }
}

// ── التشغيل ───────────────────────────────────────────────────────────
export function generate(): string {
const GAMES     = Number(process.env.PZ_GAMES ?? 60);
const ENDGAMES  = Number(process.env.PZ_ENDGAMES ?? 2500);
const WANT      = Number(process.env.PZ_WANT ?? 120);

found = new Map<string, Found>();
  console.error('حصاد مواضع من مباريات…');
harvestGames(GAMES);
console.error('حصاد نهايات مُركَّبة…');
harvestEndgames(ENDGAMES);

// وحيد الحل أولاً، ثم الأقل قطعاً (أنظف بصرياً وأسهل قراءة على الهاتف)
const all = [...found.values()].sort((a, b) =>
  (a.unique === b.unique ? a.pieces - b.pieces : (a.unique ? -1 : 1)));
const picked = all.slice(0, WANT);

const reward = (n: number) => (n === 2 ? 300 : n === 3 ? 600 : 1000);

const lines = picked.map((p, i) =>
  `  { id: 'p${String(i + 1).padStart(3, '0')}', b: '${p.b}', n: ${p.n}, reward: ${reward(p.n)} },`);

const header = `// ╔══════════════════════════════════════════════════════════════════════╗
//  DAMA TAHIRO — DAILY PUZZLES  (الألغاز اليومية)
//
//  مُولَّد آلياً — لا يُحرَّر يدوياً.
//    أعِد التوليد بـ:  node scripts/gen-puzzles.mjs
//
//  كل لغز مُبرهَن: بحث AND/OR كامل العرض أثبت أن الأبيض يفوز فوزاً
//  قسرياً في n حركة بالضبط، لأيّ دفاع يلعبه الأسود. ولأن البرهان كامل
//  لا تقديري، لا وجود لـ«لغز بلا حل» هنا.
//
//  الترميز: 64 حرفاً — '.' فراغ، 'w' جندي أبيض، 'b' جندي أسود،
//           'W' ملك أبيض، 'B' ملك أسود. الأبيض هو صاحب الدور دائماً.
//
//  وُلِّد: ${new Date().toISOString().slice(0, 10)}
//  العدد: ${picked.length} لغزاً (${picked.filter(p => p.unique).length} منها وحيد الحل)
// ╚══════════════════════════════════════════════════════════════════════╝

export interface Puzzle {
  /** ثابت — يُستعمل مفتاحاً لتسجيل أن اللاعب حلّه. */
  id: string;
  /** الرقعة بالترميز أعلاه. */
  b: string;
  /** عدد حركات الأبيض حتى انتهاء اللعبة. */
  n: number;
  reward: number;
}

export const PUZZLES: Puzzle[] = [
${lines.join('\n')}
];

/** لغز اليوم — يُحسب بالتوقيت العالمي، فيحصل لاعبو العالم كلهم على
 *  اللغز نفسه في اليوم نفسه، ولا تتقدّم خانة منطقة زمنية على أخرى. */
export function puzzleOfDay(now: Date = new Date()): Puzzle {
  const day = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86_400_000);
  return PUZZLES[((day % PUZZLES.length) + PUZZLES.length) % PUZZLES.length];
}

/** معرّف يوم اليوم — مفتاح تخزين «حُلّ اليوم». */
export function todayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** يفكّ الترميز إلى رقعة. يُستدعى من App.tsx. */
export function decodeBoard(s: string): (('white' | 'black' | 'whiteKing' | 'blackKing') | null)[] {
  return [...s].map(c =>
    c === 'w' ? 'white' : c === 'b' ? 'black' : c === 'W' ? 'whiteKing' : c === 'B' ? 'blackKing' : null);
}
`;

console.error(`\n✔ ${picked.length} لغزاً (${picked.filter(p => p.unique).length} وحيد الحل) — ` +
  `توزيع n: ${[2, 3].map(n => `${n}→${picked.filter(p => p.n === n).length}`).join('، ')}`);
  return header;
}
