// ╔══════════════════════════════════════════════════════════════════════╗
//  DAMA TAHIRO — RULES & ENGINE  (قواعد الضامة الإسبانية + محرّك البحث)
//
//  استُخرج من App.tsx بلا تغيير سطر منطقيّ واحد. لماذا؟
//    1) ليعمل في Web Worker: المحرّك يبحث حتى 1850 مل، وفي الخيط الرئيسي
//       يعني ذلك شاشةً متجمّدة — لا لمسة ولا رسم. في خيط منفصل يفكّر
//       المحرّك والواجهة حيّة.
//    2) ليُختبَر مباشرةً: اختبارات المنطق كانت تقتطع هذا القسم من App.tsx
//       بمطابقة نصّية هشّة؛ الآن تستورده كما تستورده اللعبة.
//    3) ملفّ واحد بـ4600 سطر كان يصعب العمل فيه.
//
//  ⚠ حالة داخلية على مستوى الوحدة: جدول التحويل (TT)، جدول Zobrist،
//    حركات القتل، جدول التاريخ، وذاكرة التكرار. هذه مقصودة وتبقى بين
//    الاستدعاءات — ولهذا يحتاج كل خيط نسخته الخاصة من الوحدة (وهو ما
//    يحصل تلقائياً: الـWorker يحمّلها في سياقه).
// ╚══════════════════════════════════════════════════════════════════════╝

export type PieceType = 'white' | 'black' | 'whiteKing' | 'blackKing' | null;
export type BoardType = PieceType[];

export interface Move {
  from: number;
  to: number;
  captures: number[];
  isKingPromotion: boolean;
}

// ==================== SPANISH CHECKERS ENGINE ====================
export function createInitialBoard(): BoardType {
  const board: BoardType = new Array(64).fill(null);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        board[row * 8 + col] = 'black';
      }
    }
  }
  for (let row = 5; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        board[row * 8 + col] = 'white';
      }
    }
  }
  return board;
}

// Create a random mid-game board for watching (simulate a game already in progress)
export function createRandomMidGameBoard(): { board: BoardType; turn: boolean } {
  let board = createInitialBoard();
  let turn = true;
  // Play 8-25 random moves to reach a mid-game position
  const movesToPlay = 8 + Math.floor(Math.random() * 18);
  for (let i = 0; i < movesToPlay; i++) {
    const moves = getAllValidMoves(board, turn);
    if (moves.length === 0) break;
    const move = moves[Math.floor(Math.random() * moves.length)];
    board = executeMove(board, move, turn);
    turn = !turn;
    // Make sure both sides still have pieces
    const wCount = board.filter(p => p === 'white' || p === 'whiteKing').length;
    const bCount = board.filter(p => p === 'black' || p === 'blackKing').length;
    if (wCount <= 1 || bCount <= 1) break;
  }
  return { board, turn };
}

export function getRow(pos: number): number { return Math.floor(pos / 8); }
export function getCol(pos: number): number { return pos % 8; }
function isValid(r: number, c: number): boolean { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function posOf(r: number, c: number): number { return r * 8 + c; }

export function isWhite(p: PieceType): boolean { return p === 'white' || p === 'whiteKing'; }
export function isBlack(p: PieceType): boolean { return p === 'black' || p === 'blackKing'; }
export function isKing(p: PieceType): boolean { return p === 'whiteKing' || p === 'blackKing'; }
export function isPlayerPiece(p: PieceType, isWhiteTurn: boolean): boolean {
  return isWhiteTurn ? isWhite(p) : isBlack(p);
}
function isOpponentPiece(p: PieceType, isWhiteTurn: boolean): boolean {
  return isWhiteTurn ? isBlack(p) : isWhite(p);
}

// Find all capture sequences for a piece (Spanish rules: must capture maximum)
function findCaptureSequences(
  board: BoardType,
  pos: number,
  piece: PieceType,
  isWhiteTurn: boolean,
  alreadyCaptured: number[] = []
): { moves: number[]; captures: number[] }[] {
  const results: { moves: number[]; captures: number[] }[] = [];
  const row = getRow(pos);
  const col = getCol(pos);
  const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  let foundCapture = false;

  if (isKing(piece)) {
    // King: can capture from distance (flying king)
    for (const [dr, dc] of directions) {
      let r = row + dr;
      let c = col + dc;
      // Move along diagonal until we hit something
      while (isValid(r, c) && board[posOf(r, c)] === null) {
        r += dr;
        c += dc;
      }
      // Check if we hit an opponent piece
      if (isValid(r, c)) {
        const capturedPos = posOf(r, c);
        const capturedPiece = board[capturedPos];
        if (capturedPiece && isOpponentPiece(capturedPiece, isWhiteTurn) && !alreadyCaptured.includes(capturedPos)) {
          // Check landing squares after the captured piece
          let lr = r + dr;
          let lc = c + dc;
          while (isValid(lr, lc) && board[posOf(lr, lc)] === null) {
            const landingPos = posOf(lr, lc);
            foundCapture = true;
            const newBoard = [...board];
            newBoard[pos] = null;
            newBoard[capturedPos] = null;
            newBoard[landingPos] = piece;
            const newCaptured = [...alreadyCaptured, capturedPos];

            // Try to continue capturing
            const continuations = findCaptureSequences(newBoard, landingPos, piece, isWhiteTurn, newCaptured);
            if (continuations.length > 0) {
              for (const cont of continuations) {
                results.push({
                  moves: [landingPos, ...cont.moves],
                  captures: [capturedPos, ...cont.captures]
                });
              }
            } else {
              results.push({
                moves: [landingPos],
                captures: [capturedPos]
              });
            }
            lr += dr;
            lc += dc;
          }
        }
      }
    }
  } else {
    // SPANISH RULES: Regular piece captures FORWARD ONLY (not backward!)
    const captureDirs = isWhiteTurn ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
    for (const [dr, dc] of captureDirs) {
      const midR = row + dr;
      const midC = col + dc;
      const landR = row + 2 * dr;
      const landC = col + 2 * dc;

      if (!isValid(landR, landC)) continue;

      const midPos = posOf(midR, midC);
      const landPos = posOf(landR, landC);
      const midPiece = board[midPos];

      if (midPiece && isOpponentPiece(midPiece, isWhiteTurn) && !alreadyCaptured.includes(midPos) && board[landPos] === null) {
        foundCapture = true;
        const newBoard = [...board];
        newBoard[pos] = null;
        newBoard[midPos] = null;

        // SPANISH RULES: If man reaches back rank during capture, move ENDS and man promotes to king
        if ((isWhiteTurn && landR === 0) || (!isWhiteTurn && landR === 7)) {
          const promotedPiece = isWhiteTurn ? 'whiteKing' : 'blackKing';
          newBoard[landPos] = promotedPiece;
          // Move ends here - NO continuation after promotion (official Spanish rule)
          results.push({
            moves: [landPos],
            captures: [midPos]
          });
        } else {
          newBoard[landPos] = piece;
          const newCaptured = [...alreadyCaptured, midPos];
          const continuations = findCaptureSequences(newBoard, landPos, piece, isWhiteTurn, newCaptured);
          if (continuations.length > 0) {
            for (const cont of continuations) {
              results.push({
                moves: [landPos, ...cont.moves],
                captures: [midPos, ...cont.captures]
              });
            }
          } else {
            results.push({
              moves: [landPos],
              captures: [midPos]
            });
          }
        }
      }
    }
  }

  if (!foundCapture && alreadyCaptured.length === 0) {
    return [];
  }
  return results;
}

// Get all valid moves for a player (Spanish rules: mandatory capture, max captures)
export function getAllValidMoves(board: BoardType, isWhiteTurn: boolean): Move[] {
  const allCaptures: Move[] = [];
  const allSimpleMoves: Move[] = [];

  for (let pos = 0; pos < 64; pos++) {
    const piece = board[pos];
    if (!piece || !isPlayerPiece(piece, isWhiteTurn)) continue;

    // Find captures
    const captures = findCaptureSequences(board, pos, piece, isWhiteTurn);
    for (const cap of captures) {
      const lastPos = cap.moves[cap.moves.length - 1];
      const isPromotion = !isKing(piece) && (
        (isWhiteTurn && getRow(lastPos) === 0) ||
        (!isWhiteTurn && getRow(lastPos) === 7)
      );
      allCaptures.push({
        from: pos,
        to: lastPos,
        captures: cap.captures,
        isKingPromotion: isPromotion
      });
    }

    // Find simple moves (only if no captures exist)
    if (isKing(piece)) {
      // King moves: multiple squares diagonally
      const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (const [dr, dc] of directions) {
        let r = getRow(pos) + dr;
        let c = getCol(pos) + dc;
        while (isValid(r, c) && board[posOf(r, c)] === null) {
          allSimpleMoves.push({
            from: pos,
            to: posOf(r, c),
            captures: [],
            isKingPromotion: false
          });
          r += dr;
          c += dc;
        }
      }
    } else {
      // Regular piece: move forward diagonally only
      const forwardDir = isWhiteTurn ? -1 : 1;
      for (const dc of [-1, 1]) {
        const newR = getRow(pos) + forwardDir;
        const newC = getCol(pos) + dc;
        if (isValid(newR, newC) && board[posOf(newR, newC)] === null) {
          const isPromotion = (isWhiteTurn && newR === 0) || (!isWhiteTurn && newR === 7);
          allSimpleMoves.push({
            from: pos,
            to: posOf(newR, newC),
            captures: [],
            isKingPromotion: isPromotion
          });
        }
      }
    }
  }

  // SPANISH RULES: if captures are available, they are MANDATORY
  if (allCaptures.length > 0) {
    // SPANISH RULES: Must choose capture route with MAXIMUM VALUE
    // A captured king is worth more than a man (but less than 2 men)
    // King value = 1.5, Man value = 1.0 for comparison
    const getCaptureValue = (move: Move): number => {
      let value = 0;
      for (const capPos of move.captures) {
        const piece = board[capPos];
        if (piece && isKing(piece)) {
          value += 1.5; // King is worth more than a man
        } else {
          value += 1.0;
        }
      }
      return value;
    };

    const maxValue = Math.max(...allCaptures.map(m => getCaptureValue(m)));
    const bestCaptures = allCaptures.filter(m => getCaptureValue(m) === maxValue);

    // If still tied, among sequences with same value, 
    // prefer those that capture more kings (Spanish tournament rule)
    if (bestCaptures.length > 1) {
      const countKingsInCapture = (move: Move): number => {
        return move.captures.filter(capPos => {
          const piece = board[capPos];
          return piece && isKing(piece);
        }).length;
      };
      const maxKings = Math.max(...bestCaptures.map(m => countKingsInCapture(m)));
      const kingPriority = bestCaptures.filter(m => countKingsInCapture(m) === maxKings);
      if (kingPriority.length > 0) return kingPriority;
    }

    return bestCaptures;
  }

  return allSimpleMoves;
}

export function executeMove(board: BoardType, move: Move, isWhiteTurn: boolean): BoardType {
  const newBoard = [...board];
  const piece = newBoard[move.from];

  newBoard[move.from] = null;

  // Remove captured pieces
  for (const capPos of move.captures) {
    newBoard[capPos] = null;
  }

  // Place piece and check for promotion
  if (move.isKingPromotion) {
    newBoard[move.to] = isWhiteTurn ? 'whiteKing' : 'blackKing';
  } else if (isKing(piece)) {
    newBoard[move.to] = piece;
  } else {
    // Check promotion
    if ((isWhiteTurn && getRow(move.to) === 0) || (!isWhiteTurn && getRow(move.to) === 7)) {
      newBoard[move.to] = isWhiteTurn ? 'whiteKing' : 'blackKing';
    } else {
      newBoard[move.to] = piece;
    }
  }

  return newBoard;
}

// Check draw conditions
export function checkDrawCondition(board: BoardType, moveCount: number): boolean {
  const whites = board.filter(p => isWhite(p));
  const blacks = board.filter(p => isBlack(p));
  const whiteKings = whites.filter(p => isKing(p)).length;
  const blackKings = blacks.filter(p => isKing(p)).length;

  // 1 piece vs 3 kings = draw after 12 moves
  if ((whites.length === 1 && blacks.length <= 3 && blackKings === blacks.length) ||
      (blacks.length === 1 && whites.length <= 3 && whiteKings === whites.length)) {
    if (moveCount >= 12) return true;
  }

  // 1 piece vs 2 kings = draw after 12 moves
  if ((whites.length === 1 && blacks.length === 2 && blackKings === 2) ||
      (blacks.length === 1 && whites.length === 2 && whiteKings === 2)) {
    if (moveCount >= 12) return true;
  }

  return false;
}

/** بصمة التقدّم — تتغيّر عند كل تقدّم حقيقي في المباراة:
 *   • أكل      → يتغيّر عدد القطع
 *   • تتويج    → يتغيّر عدد الجنود
 *   • حركة جندي → يتغيّر مجموع صفوف الجنود (الجنود لا تتراجع أبداً)
 *  فثبات البصمة يعني شيئاً واحداً: الملوك وحدها تراوح بلا جدوى.
 *  هذا هو التعريف الصحيح — لو اكتفينا بعدد القطع لاعتُبر المناورة
 *  الطبيعية بالجنود ركوداً، وأُعلن تعادل كاذب في وسط المباراة. */
export function progressSignature(board: BoardType): string {
  let pieces = 0, men = 0, menRows = 0;
  for (let i = 0; i < board.length; i++) {
    const p = board[i];
    if (!p) continue;
    pieces++;
    if (!isKing(p)) { men++; menRows += getRow(i); }
  }
  return pieces + ':' + men + ':' + menRows;
}

// ── مُبرهِن الألغاز ───────────────────────────────────────────────────
// يُستعمل داخل وضع الألغاز فقط. لماذا برهان في وقت التشغيل ولا سطر حلٍّ
// محفوظ؟ لأن معظم المواضع تُحلّ بأكثر من طريق، ولو قارنّا حركة اللاعب
// بحركة واحدة محفوظة لرفضنا حلولاً صحيحة. هنا نسأل السؤال الصحيح:
// «هل ما زال الفوز القسري قائماً بعد حركتك؟» — فيُقبل كل حل صائب.
// التكلفة محتملة لأن المواضع صغيرة (4-14 قطعة) والميزانية مقيَّدة.

const PZ_NODE_CAP = 120_000;

/** هل يملك صاحب الدور فوزاً قسرياً خلال n من حركاته؟ بحث AND/OR كامل. */
export function puzzleForcedWin(board: BoardType, stm: boolean, n: number, budget = { left: PZ_NODE_CAP }): boolean {
  if (n <= 0 || budget.left <= 0) return false;
  budget.left--;
  for (const m of getAllValidMoves(board, stm)) {
    const b2 = executeMove(board, m, stm);
    const replies = getAllValidMoves(b2, !stm);
    if (replies.length === 0) return true;
    if (n === 1) continue;
    let all = true;
    for (const r of replies) {
      if (!puzzleForcedWin(executeMove(b2, r, !stm), stm, n - 1, budget)) { all = false; break; }
    }
    if (all) return true;
  }
  return false;
}

/** هل يبقى الفوز القسري قائماً بعد حركة الأبيض؟
 *
 *  الرقعة هنا والدورُ للأسود، فلا يصحّ سؤال puzzleForcedWin عنها مباشرةً
 *  (يولّد حركات بيضاء في دور أسود). السؤال الصحيح: لكلّ ردّ أسود ممكن،
 *  أيبقى للأبيض فوز قسري في n من حركاته؟ إن أفلت ردٌّ واحد، أفلت الفوز.
 *  ملاحظة: الخلط بين السؤالين هو ما جعل الواجهة ترفض حلولاً صحيحة. */
export function puzzleHoldsWin(board: BoardType, n: number): boolean {
  const replies = getAllValidMoves(board, false);
  if (replies.length === 0) return true;      // لا ردّ ⇒ فاز سلفاً
  if (n <= 0) return false;
  for (const r of replies) {
    if (!puzzleForcedWin(executeMove(board, r, false), true, n)) return false;
  }
  return true;
}

/** أقصر عدد حركات يحتاجها صاحب الدور (أو 0 إن لا فوز في حدود max). */
function puzzleDistance(board: BoardType, stm: boolean, max: number): number {
  for (let n = 1; n <= max; n++) {
    if (puzzleForcedWin(board, stm, n)) return n;
  }
  return 0;
}

/** أعند دفاع للأسود: الرد الذي يُطيل مقاومة الموضع أكثر ما يمكن.
 *  الخصم في اللغز يجب أن يدافع بأفضل ما لديه، وإلا كان الحل وهماً. */
export function puzzleBestDefence(board: BoardType, max: number): Move | null {
  const moves = getAllValidMoves(board, false);
  if (moves.length === 0) return null;
  let best = moves[0], bestCost = -1;
  for (const m of moves) {
    const b2 = executeMove(board, m, false);
    // رد يُجمّد الأبيض تماماً = أفضل دفاع مطلق
    if (getAllValidMoves(b2, true).length === 0) return m;
    const cost = puzzleDistance(b2, true, max) || 99;
    if (cost > bestCost) { bestCost = cost; best = m; }
  }
  return best;
}

/** مفتاح الموضع لرصد التكرار الثلاثي (الرقعة + صاحب الدور). */
export function positionKey(board: BoardType, whiteToMove: boolean): string {
  let k = whiteToMove ? 'w' : 'b';
  for (const p of board) {
    k += !p ? '.' : p === 'white' ? 'w' : p === 'black' ? 'b' : p === 'whiteKing' ? 'W' : 'B';
  }
  return k;
}

// ==================== TAHIRO AI ENGINE v2 — Spanish Checkers ====================
// High-performance engine replacing the old fixed-depth minimax:
//   • Negamax + alpha-beta + PVS (Principal Variation Search)
//   • Iterative deepening with per-level time budgets + aspiration windows
//   • Zobrist hashing + fixed-size transposition table (typed arrays, ~512K slots)
//   • True quiescence search over forced-capture chains (kills horizon effect)
//   • Killer moves + history heuristic move ordering + forced-move extensions
//   • Strategic evaluation: material, piece-square tables, back-rank integrity,
//     runaway men, king activity/mobility, trapped kings, structure/defenders,
//     trade-down when ahead, tempo, and an endgame HUNT mode that actually
//     corners the opponent and converts winning endings instead of shuffling
//   • Game-level repetition memory: never shuffles kings back-and-forth when
//     winning; deliberately seeks repetition only when losing (draw-seeking)

const AI_WIN = 100000;
const AI_MATE_BOUND = 99000;
const AI_INF = 1000000000;
const AI_MAX_PLY = 64;

// ---------- Zobrist hashing (two 32-bit halves, deterministic seed) ----------
const Z_LO = new Int32Array(64 * 4);
const Z_HI = new Int32Array(64 * 4);
let zSideLo = 0, zSideHi = 0;
(() => {
  let s = 0x9E3779B9 | 0;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return s | 0; };
  for (let i = 0; i < 64 * 4; i++) { Z_LO[i] = rnd(); Z_HI[i] = rnd(); }
  zSideLo = rnd(); zSideHi = rnd();
})();

function pieceIdx(p: PieceType): number {
  if (p === 'white') return 0;
  if (p === 'black') return 1;
  if (p === 'whiteKing') return 2;
  return 3; // blackKing
}

let gHashLo = 0, gHashHi = 0;
function computeHash(board: BoardType, whiteToMove: boolean): void {
  let lo = 0, hi = 0;
  for (let pos = 0; pos < 64; pos++) {
    const p = board[pos];
    if (!p) continue;
    const k = pieceIdx(p) * 64 + pos;
    lo ^= Z_LO[k]; hi ^= Z_HI[k];
  }
  if (!whiteToMove) { lo ^= zSideLo; hi ^= zSideHi; }
  gHashLo = lo | 0; gHashHi = hi | 0;
}

// ---------- Transposition table ----------
const TT_BITS = 19;
const TT_SIZE = 1 << TT_BITS;
const TT_MASK = TT_SIZE - 1;
const ttKeyLo = new Int32Array(TT_SIZE);
const ttKeyHi = new Int32Array(TT_SIZE);
const ttDepth = new Int16Array(TT_SIZE);
const ttFlagA = new Int8Array(TT_SIZE);   // 0 empty, 1 exact, 2 lower, 3 upper
const ttScoreA = new Int32Array(TT_SIZE);
const ttMoveA = new Int32Array(TT_SIZE);  // from*64+to, -1 if none

function ttStore(lo: number, hi: number, depth: number, score: number, flag: number, moveCode: number, ply: number): void {
  const idx = ((lo ^ hi) >>> 0) & TT_MASK;
  // Depth-preferred replacement (small age tolerance keeps table fresh)
  if (ttFlagA[idx] !== 0 && ttDepth[idx] > depth + 3 && (ttKeyLo[idx] !== lo || ttKeyHi[idx] !== hi)) return;
  let s = score;
  if (s > AI_MATE_BOUND) s += ply; else if (s < -AI_MATE_BOUND) s -= ply;
  ttKeyLo[idx] = lo; ttKeyHi[idx] = hi;
  ttDepth[idx] = depth; ttFlagA[idx] = flag;
  ttScoreA[idx] = s | 0; ttMoveA[idx] = moveCode;
}

// ---------- Move ordering helpers ----------
const killer1 = new Int32Array(AI_MAX_PLY);
const killer2 = new Int32Array(AI_MAX_PLY);
const histTable = new Int32Array(64 * 64);

// ---------- Time management ----------
const aiNow: () => number = (typeof performance !== 'undefined' && typeof performance.now === 'function')
  ? () => performance.now() : () => Date.now();
let aiNodes = 0;
let aiStopTime = 0;
let aiAborted = false;
function aiTimeUp(): boolean {
  if (aiAborted) return true;
  if ((aiNodes & 1023) === 0 && aiNow() >= aiStopTime) aiAborted = true;
  return aiAborted;
}

// ---------- Evaluation ----------
// White-man advancement by row (row 7 = home, row 1 = one step from crowning)
const W_MAN_ROW = [0, 62, 40, 26, 16, 10, 6, 4];
const COL_CENTER = [0, 2, 5, 8, 8, 5, 2, 0];
// King centralization table
const KING_PST = new Int32Array(64);
(() => {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const dr = Math.abs(2 * r - 7), dc = Math.abs(2 * c - 7);
    const cheb = (dr > dc ? dr : dc) / 2;             // 0.5 .. 3.5
    let v = Math.round((3.5 - cheb) * 8);             // center → +24, corner → 0
    if (r === c || r + c === 7) v += 6;               // long diagonals
    KING_PST[r * 8 + c] = v;
  }
})();

const evWKp = new Int32Array(16); const evBKp = new Int32Array(16);
const evWMp = new Int32Array(16); const evBMp = new Int32Array(16);

// Static evaluation from WHITE's perspective (no move generation — fast)
export function evalWhitePOV(board: BoardType): number {
  let wMen = 0, bMen = 0, wK = 0, bK = 0;
  for (let pos = 0; pos < 64; pos++) {
    const p = board[pos];
    if (!p) continue;
    if (p === 'white') { evWMp[wMen++] = pos; }
    else if (p === 'black') { evBMp[bMen++] = pos; }
    else if (p === 'whiteKing') { evWKp[wK++] = pos; }
    else { evBKp[bK++] = pos; }
  }
  const wMat = wMen * 100 + wK * 330;
  const bMat = bMen * 100 + bK * 330;
  const matDiff = wMat - bMat;
  const total = wMen + bMen + wK + bK;
  let score = matDiff;

  // Trade down when ahead, keep pieces on when behind
  if (matDiff >= 90) score += (24 - total) * 4;
  else if (matDiff <= -90) score -= (24 - total) * 4;

  const backRankW = Math.min(bMen, 8) * 2;  // value of guarding home row decays as enemy men vanish
  const backRankB = Math.min(wMen, 8) * 2;

  let wRunaway = 0, bRunaway = 0;

  // ----- White men -----
  for (let i = 0; i < wMen; i++) {
    const pos = evWMp[i];
    const r = pos >> 3, c = pos & 7;
    score += W_MAN_ROW[r] + COL_CENTER[c];
    if (r === 7) score += backRankW;
    // defenders behind
    if (r < 7) {
      if (c > 0 && isWhite(board[pos + 7])) score += 4;
      if (c < 7 && isWhite(board[pos + 9])) score += 4;
    }
    // forward mobility
    let mob = 0;
    if (r > 0) {
      if (c > 0 && board[pos - 9] === null) mob++;
      if (c < 7 && board[pos - 7] === null) mob++;
    }
    score += mob * 2;
    // Runaway man: nothing black inside the forward cone and black has no kings
    if (bK === 0 && r <= 3 && wRunaway < 160) {
      let clear = true;
      for (let rr = r - 1; rr >= 0 && clear; rr--) {
        const spread = r - rr;
        const c0 = c - spread < 0 ? 0 : c - spread;
        const c1 = c + spread > 7 ? 7 : c + spread;
        for (let cc = c0; cc <= c1; cc++) {
          const q = board[rr * 8 + cc];
          if (q === 'black' || q === 'blackKing') { clear = false; break; }
        }
      }
      if (clear) { const b = 70 + (3 - r) * 15; wRunaway += b; score += b; }
    }
  }
  // ----- Black men (mirrored) -----
  for (let i = 0; i < bMen; i++) {
    const pos = evBMp[i];
    const r = pos >> 3, c = pos & 7;
    score -= W_MAN_ROW[7 - r] + COL_CENTER[c];
    if (r === 0) score -= backRankB;
    if (r > 0) {
      if (c > 0 && isBlack(board[pos - 9])) score -= 4;
      if (c < 7 && isBlack(board[pos - 7])) score -= 4;
    }
    let mob = 0;
    if (r < 7) {
      if (c > 0 && board[pos + 7] === null) mob++;
      if (c < 7 && board[pos + 9] === null) mob++;
    }
    score -= mob * 2;
    if (wK === 0 && r >= 4 && bRunaway < 160) {
      let clear = true;
      for (let rr = r + 1; rr <= 7 && clear; rr++) {
        const spread = rr - r;
        const c0 = c - spread < 0 ? 0 : c - spread;
        const c1 = c + spread > 7 ? 7 : c + spread;
        for (let cc = c0; cc <= c1; cc++) {
          const q = board[rr * 8 + cc];
          if (q === 'white' || q === 'whiteKing') { clear = false; break; }
        }
      }
      if (clear) { const b = 70 + (r - 4) * 15; bRunaway += b; score -= b; }
    }
  }
  // ----- Kings: centralization + sliding mobility, trapped-king penalty -----
  for (let i = 0; i < wK; i++) {
    const pos = evWKp[i];
    score += KING_PST[pos];
    score += kingSlideScore(board, pos);
  }
  for (let i = 0; i < bK; i++) {
    const pos = evBKp[i];
    score -= KING_PST[pos];
    score -= kingSlideScore(board, pos);
  }

  // ----- Endgame HUNT: corner the enemy and close in to convert the win -----
  if (total <= 8 && (matDiff >= 100 || matDiff <= -100)) {
    const whiteWinning = matDiff > 0;
    const huntKn = whiteWinning ? wK : bK;
    const huntKp = whiteWinning ? evWKp : evBKp;
    const preyMn = whiteWinning ? bMen : wMen;
    const preyMp = whiteWinning ? evBMp : evWMp;
    const preyKn = whiteWinning ? bK : wK;
    const preyKp = whiteWinning ? evBKp : evWKp;
    let hunt = 0;
    for (let i = 0; i < huntKn; i++) {
      const hr = huntKp[i] >> 3, hc = huntKp[i] & 7;
      let minD = 14;
      for (let j = 0; j < preyMn; j++) {
        const d = chebDist(hr, hc, preyMp[j] >> 3, preyMp[j] & 7);
        if (d < minD) minD = d;
      }
      for (let j = 0; j < preyKn; j++) {
        const d = chebDist(hr, hc, preyKp[j] >> 3, preyKp[j] & 7);
        if (d < minD) minD = d;
      }
      hunt += (10 - minD) * 6;   // close the distance
    }
    // push prey to the edge/corner (kings included)
    for (let j = 0; j < preyMn; j++) {
      const r = preyMp[j] >> 3, c = preyMp[j] & 7;
      hunt += chebFromCenter(r, c) * 5;
    }
    for (let j = 0; j < preyKn; j++) {
      const r = preyKp[j] >> 3, c = preyKp[j] & 7;
      hunt += chebFromCenter(r, c) * 5;
    }
    score += whiteWinning ? hunt : -hunt;
  }
  return score;
}

function chebDist(r1: number, c1: number, r2: number, c2: number): number {
  const dr = r1 > r2 ? r1 - r2 : r2 - r1;
  const dc = c1 > c2 ? c1 - c2 : c2 - c1;
  return dr > dc ? dr : dc;
}
function chebFromCenter(r: number, c: number): number {
  const dr = Math.abs(2 * r - 7), dc = Math.abs(2 * c - 7);
  return ((dr > dc ? dr : dc) - 1) >> 1;   // 0 center .. 3 corner
}

function kingSlideScore(board: BoardType, pos: number): number {
  const r = pos >> 3, c = pos & 7;
  let cnt = 0;
  // NW
  for (let rr = r - 1, cc = c - 1; rr >= 0 && cc >= 0 && board[rr * 8 + cc] === null; rr--, cc--) { if (++cnt >= 8) break; }
  // NE
  if (cnt < 8) for (let rr = r - 1, cc = c + 1; rr >= 0 && cc <= 7 && board[rr * 8 + cc] === null; rr--, cc++) { if (++cnt >= 8) break; }
  // SW
  if (cnt < 8) for (let rr = r + 1, cc = c - 1; rr <= 7 && cc >= 0 && board[rr * 8 + cc] === null; rr++, cc--) { if (++cnt >= 8) break; }
  // SE
  if (cnt < 8) for (let rr = r + 1, cc = c + 1; rr <= 7 && cc <= 7 && board[rr * 8 + cc] === null; rr++, cc++) { if (++cnt >= 8) break; }
  if (cnt === 0) return -45;               // trapped king
  return cnt * 3;
}

function evalSide(board: BoardType, whiteToMove: boolean): number {
  const s = evalWhitePOV(board);
  return (whiteToMove ? s : -s) + 8;       // tempo for the side to move
}

// ---------- Lightweight existence scanners (avoid full move generation) ----------
function sideHasCapture(board: BoardType, whiteToMove: boolean): boolean {
  for (let pos = 0; pos < 64; pos++) {
    const p = board[pos];
    if (!p || !isPlayerPiece(p, whiteToMove)) continue;
    const r = pos >> 3, c = pos & 7;
    if (isKing(p)) {
      // flying king: first piece on each diagonal; enemy + empty square beyond = capture
      for (let d = 0; d < 4; d++) {
        const dr = d < 2 ? -1 : 1, dc = (d & 1) === 0 ? -1 : 1;
        let rr = r + dr, cc = c + dc;
        while (rr >= 0 && rr <= 7 && cc >= 0 && cc <= 7 && board[rr * 8 + cc] === null) { rr += dr; cc += dc; }
        if (rr >= 0 && rr <= 7 && cc >= 0 && cc <= 7) {
          const q = board[rr * 8 + cc];
          if (q && isOpponentPiece(q, whiteToMove)) {
            const lr = rr + dr, lc = cc + dc;
            if (lr >= 0 && lr <= 7 && lc >= 0 && lc <= 7 && board[lr * 8 + lc] === null) return true;
          }
        }
      }
    } else {
      // man: forward captures only (Spanish rules)
      const dr = whiteToMove ? -1 : 1;
      for (let s2 = -1; s2 <= 1; s2 += 2) {
        const mr = r + dr, mc = c + s2, lr = r + 2 * dr, lc = c + 2 * s2;
        if (lr < 0 || lr > 7 || lc < 0 || lc > 7) continue;
        const mid = board[mr * 8 + mc];
        if (mid && isOpponentPiece(mid, whiteToMove) && board[lr * 8 + lc] === null) return true;
      }
    }
  }
  return false;
}

function sideHasQuiet(board: BoardType, whiteToMove: boolean): boolean {
  for (let pos = 0; pos < 64; pos++) {
    const p = board[pos];
    if (!p || !isPlayerPiece(p, whiteToMove)) continue;
    const r = pos >> 3, c = pos & 7;
    if (isKing(p)) {
      if (r > 0 && c > 0 && board[pos - 9] === null) return true;
      if (r > 0 && c < 7 && board[pos - 7] === null) return true;
      if (r < 7 && c > 0 && board[pos + 7] === null) return true;
      if (r < 7 && c < 7 && board[pos + 9] === null) return true;
    } else {
      const dr = whiteToMove ? -1 : 1;
      const nr = r + dr;
      if (nr >= 0 && nr <= 7) {
        if (c > 0 && board[nr * 8 + c - 1] === null) return true;
        if (c < 7 && board[nr * 8 + c + 1] === null) return true;
      }
    }
  }
  return false;
}

// ---------- Quiescence: resolve full forced-capture chains ----------
function qsearch(board: BoardType, alpha: number, beta: number, whiteToMove: boolean, ply: number): number {
  aiNodes++;
  if (aiTimeUp()) return 0;
  if (!sideHasCapture(board, whiteToMove)) {
    if (!sideHasQuiet(board, whiteToMove)) return -(AI_WIN - ply);   // no moves at all — loss
    return evalSide(board, whiteToMove);   // quiet position — stand on evaluation
  }
  if (ply >= AI_MAX_PLY - 1) return evalSide(board, whiteToMove);
  const moves = getAllValidMoves(board, whiteToMove);
  if (moves.length === 0) return -(AI_WIN - ply);
  // Captures are mandatory: no stand-pat, search every forced line
  if (moves.length > 1) {
    moves.sort((a, b) => (b.captures.length * 100 + (b.isKingPromotion ? 50 : 0))
                        - (a.captures.length * 100 + (a.isKingPromotion ? 50 : 0)));
  }
  let best = -AI_INF;
  for (let i = 0; i < moves.length; i++) {
    const child = executeMove(board, moves[i], whiteToMove);
    const sc = -qsearch(child, -beta, -alpha, !whiteToMove, ply + 1);
    if (aiAborted) return 0;
    if (sc > best) best = sc;
    if (sc > alpha) alpha = sc;
    if (alpha >= beta) break;
  }
  return best;
}

// ---------- Main search: Negamax + PVS + TT ----------
const ordScores = new Float64Array(128);

function orderMoves(moves: Move[], ttMoveCode: number, ply: number): void {
  const n = moves.length;
  for (let i = 0; i < n; i++) {
    const m = moves[i];
    const code = m.from * 64 + m.to;
    let s: number;
    if (code === ttMoveCode) s = 10000000;
    else if (m.captures.length > 0) {
      s = 5000000 + m.captures.length * 2000 + (m.isKingPromotion ? 900 : 0) + histTable[code];
    } else {
      if (code === killer1[ply]) s = 900000;
      else if (code === killer2[ply]) s = 800000;
      else s = histTable[code];
      if (m.isKingPromotion) s += 700000;
    }
    ordScores[i] = s;
  }
  // insertion sort (move lists are short)
  for (let i = 1; i < n; i++) {
    const mv = moves[i]; const sc = ordScores[i];
    let j = i - 1;
    while (j >= 0 && ordScores[j] < sc) { moves[j + 1] = moves[j]; ordScores[j + 1] = ordScores[j]; j--; }
    moves[j + 1] = mv; ordScores[j + 1] = sc;
  }
}

function aiSearch(board: BoardType, depth: number, alpha: number, beta: number, whiteToMove: boolean, ply: number): number {
  aiNodes++;
  if (aiTimeUp()) return 0;

  computeHash(board, whiteToMove);
  const hLo = gHashLo, hHi = gHashHi;
  const idx = ((hLo ^ hHi) >>> 0) & TT_MASK;
  let ttMoveCode = -1;
  if (ttFlagA[idx] !== 0 && ttKeyLo[idx] === hLo && ttKeyHi[idx] === hHi) {
    ttMoveCode = ttMoveA[idx];
    if (ttDepth[idx] >= depth) {
      let sc = ttScoreA[idx];
      if (sc > AI_MATE_BOUND) sc -= ply; else if (sc < -AI_MATE_BOUND) sc += ply;
      const f = ttFlagA[idx];
      if (f === 1) return sc;
      if (f === 2) { if (sc > alpha) alpha = sc; }
      else if (f === 3) { if (sc < beta) beta = sc; }
      if (alpha >= beta) return sc;
    }
  }

  if (depth <= 0 || ply >= AI_MAX_PLY - 2) {
    return qsearch(board, alpha, beta, whiteToMove, ply);   // qsearch handles mate/quiet itself
  }

  const moves = getAllValidMoves(board, whiteToMove);
  if (moves.length === 0) return -(AI_WIN - ply);

  let d = depth;
  if (moves.length === 1 && ply < AI_MAX_PLY - 8) d += 1;   // forced-move extension (free ply)

  orderMoves(moves, ttMoveCode, ply);

  const alphaOrig = alpha;
  let best = -AI_INF;
  let bestCode = -1;
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    const child = executeMove(board, m, whiteToMove);
    let sc: number;
    if (i === 0) {
      sc = -aiSearch(child, d - 1, -beta, -alpha, !whiteToMove, ply + 1);
    } else {
      // Late Move Reductions: search late quiet moves shallower first
      let red = 0;
      if (d >= 3 && i >= 3 && m.captures.length === 0 && !m.isKingPromotion) {
        red = (d >= 5 && i >= 6) ? 2 : 1;
      }
      sc = -aiSearch(child, d - 1 - red, -alpha - 1, -alpha, !whiteToMove, ply + 1);   // null window
      if (red > 0 && sc > alpha && !aiAborted) {
        sc = -aiSearch(child, d - 1, -alpha - 1, -alpha, !whiteToMove, ply + 1);       // verify at full depth
      }
      if (sc > alpha && sc < beta && !aiAborted) {
        sc = -aiSearch(child, d - 1, -beta, -alpha, !whiteToMove, ply + 1);            // full re-search
      }
    }
    if (aiAborted) return 0;
    if (sc > best) { best = sc; bestCode = m.from * 64 + m.to; }
    if (sc > alpha) alpha = sc;
    if (alpha >= beta) {
      if (m.captures.length === 0) {
        const code = m.from * 64 + m.to;
        if (killer1[ply] !== code) { killer2[ply] = killer1[ply]; killer1[ply] = code; }
        histTable[code] += d * d;
        if (histTable[code] > 400000) { for (let h = 0; h < histTable.length; h++) histTable[h] >>= 1; }
      }
      break;
    }
  }

  if (!aiAborted) {
    const flag = best <= alphaOrig ? 3 : (best >= beta ? 2 : 1);
    ttStore(hLo, hHi, d, best, flag, bestCode, ply);
  }
  return best;
}

// ---------- Game-level repetition memory (anti-shuffle) ----------
let memLo: number[] = [];
let memHi: number[] = [];
let memPieceCount = -1;

export function aiResetGameMemory(): void {
  memLo = []; memHi = []; memPieceCount = -1;
}

function aiRemember(board: BoardType, whiteToMove: boolean): void {
  computeHash(board, whiteToMove);
  memLo.push(gHashLo); memHi.push(gHashHi);
  if (memLo.length > 200) { memLo.shift(); memHi.shift(); }
}

function aiTimesSeen(board: BoardType, whiteToMove: boolean): number {
  computeHash(board, whiteToMove);
  const lo = gHashLo, hi = gHashHi;
  let n = 0;
  for (let i = 0; i < memLo.length; i++) if (memLo[i] === lo && memHi[i] === hi) n++;
  return n;
}

// ---------- Level configuration ----------
// time = thinking budget (ms), maxDepth = iterative-deepening cap,
// blunder = probability of a deliberate 2nd-best move (human-like, low levels only),
// jitter = randomness window among near-equal best moves (variety; 0 = fully deterministic)
export const AI_LEVELS = [
  { time: 0,    maxDepth: 0,  blunder: 0,    jitter: 0 },   // unused (index 0)
  { time: 60,   maxDepth: 2,  blunder: 0.32, jitter: 60 },  // 1
  { time: 90,   maxDepth: 3,  blunder: 0.20, jitter: 45 },  // 2
  { time: 140,  maxDepth: 4,  blunder: 0.12, jitter: 30 },  // 3
  { time: 220,  maxDepth: 6,  blunder: 0.06, jitter: 22 },  // 4
  { time: 340,  maxDepth: 8,  blunder: 0.03, jitter: 16 },  // 5
  { time: 480,  maxDepth: 12, blunder: 0,    jitter: 12 },  // 6
  { time: 650,  maxDepth: 14, blunder: 0,    jitter: 10 },  // 7
  { time: 880,  maxDepth: 17, blunder: 0,    jitter: 8 },   // 8
  { time: 1150, maxDepth: 20, blunder: 0,    jitter: 6 },   // 9
  { time: 1450, maxDepth: 24, blunder: 0,    jitter: 3 },   // 10
  { time: 1850, maxDepth: 30, blunder: 0,    jitter: 0 },   // 11 — full strength
];

function countPieces(board: BoardType): number {
  let n = 0;
  for (let i = 0; i < 64; i++) if (board[i] !== null) n++;
  return n;
}

// ---------- Root: iterative deepening + aspiration + repetition control ----------
export function getBestMove(board: BoardType, isWhiteTurn: boolean, level: number): Move | null {
  const moves = getAllValidMoves(board, isWhiteTurn);
  if (moves.length === 0) return null;

  // Auto-detect a new game (piece count can never increase within one game)
  const pc = countPieces(board);
  if (memPieceCount >= 0 && pc > memPieceCount) aiResetGameMemory();
  memPieceCount = pc;
  aiRemember(board, isWhiteTurn);

  const noteChosen = (m: Move): Move => {
    const after = executeMove(board, m, isWhiteTurn);
    aiRemember(after, !isWhiteTurn);
    memPieceCount = countPieces(after);
    return m;
  };

  if (moves.length === 1) return noteChosen(moves[0]);   // forced — play instantly

  const lv = level < 1 ? 1 : (level > 11 ? 11 : Math.round(level));
  const cfg = AI_LEVELS[lv];

  aiNodes = 0;
  aiAborted = false;
  aiStopTime = aiNow() + cfg.time;
  killer1.fill(-1); killer2.fill(-1);
  for (let h = 0; h < histTable.length; h++) histTable[h] >>= 1;   // soft decay between moves

  // Root move list + running scores.
  // Repetition control is applied INSIDE the loop so it participates in
  // alpha/PVS consistently: winning/equal → penalize repeating a position
  // we've already seen this game; clearly losing → mildly reward it
  // (legitimate draw-seeking). This is what stops king-shuffling.
  orderMoves(moves, -1, 0);
  const n = moves.length;
  const scores = new Float64Array(n).fill(-AI_INF);
  const repAdj = new Float64Array(n);
  const exact = new Uint8Array(n);            // 1 = full-window exact score (PVS gives bounds otherwise)
  for (let i = 0; i < n; i++) {
    const after = executeMove(board, moves[i], isWhiteTurn);
    const seen = aiTimesSeen(after, !isWhiteTurn);
    repAdj[i] = seen;                          // stored as count; sign decided per-iteration
  }
  let bestIdx = 0;
  let bestScore = -AI_INF;
  let lastFullScore = -AI_INF;

  for (let depth = 1; depth <= cfg.maxDepth && !aiAborted; depth++) {
    let alpha0 = -AI_INF, beta0 = AI_INF;
    if (depth >= 4 && lastFullScore > -AI_INF) { alpha0 = lastFullScore - 70; beta0 = lastFullScore + 70; }
    const repSign = (lastFullScore > -AI_INF && lastFullScore < -140) ? 25 : -60;

    let done = false;
    while (!done && !aiAborted) {
      let iterBest = -AI_INF, iterBestIdx = -1;
      let alpha = alpha0;
      let firstDone = false;
      for (let i = 0; i < n; i++) {
        const rep = repAdj[i] * repSign;
        const child = executeMove(board, moves[i], isWhiteTurn);
        let sc: number;
        let isExact = 0;
        if (i === 0) {
          sc = -aiSearch(child, depth - 1, -(beta0 - rep), -(alpha - rep), !isWhiteTurn, 1) + rep;
          isExact = 1;
        } else {
          sc = -aiSearch(child, depth - 1, -(alpha - rep) - 1, -(alpha - rep), !isWhiteTurn, 1) + rep;
          if (sc > alpha && sc < beta0 && !aiAborted) {
            sc = -aiSearch(child, depth - 1, -(beta0 - rep), -(alpha - rep), !isWhiteTurn, 1) + rep;
            isExact = 1;
          }
        }
        if (aiAborted) break;
        scores[i] = sc; exact[i] = isExact;
        if (i === 0) firstDone = true;
        if (sc > iterBest) { iterBest = sc; iterBestIdx = i; }
        if (sc > alpha) alpha = sc;
      }
      if (aiAborted) {
        // Partial iteration: adopt only if the previous best was re-searched first
        // and a later move already proved strictly better at this deeper depth.
        if (firstDone && iterBestIdx > 0 && iterBest > scores[0]) {
          bestIdx = iterBestIdx; bestScore = iterBest;
        }
        break;
      }
      if (iterBest <= alpha0 && alpha0 > -AI_INF) { alpha0 = -AI_INF; continue; }   // fail low → widen
      if (iterBest >= beta0 && beta0 < AI_INF)   { beta0 = AI_INF;  continue; }     // fail high → widen
      done = true;
      bestIdx = iterBestIdx; bestScore = iterBest; lastFullScore = iterBest;
      // Re-sort root moves by this iteration's scores (best first for the next depth)
      const order = Array.from({ length: n }, (_, k) => k).sort((a, b) => scores[b] - scores[a]);
      const mCopy = order.map(k => moves[k]);
      const sCopy = order.map(k => scores[k]);
      const rCopy = order.map(k => repAdj[k]);
      const eCopy = order.map(k => exact[k]);
      for (let k = 0; k < n; k++) { moves[k] = mCopy[k]; scores[k] = sCopy[k]; repAdj[k] = rCopy[k]; exact[k] = eCopy[k]; }
      bestIdx = 0;
    }
    if (bestScore > AI_WIN - 200) break;   // forced win found — no need to think longer
  }

  // ----- Human-like inaccuracy for low levels -----
  // (upper-bound scores are fine here — imperfection is the point)
  if (cfg.blunder > 0 && Math.random() < cfg.blunder) {
    let secondIdx = -1, secondSc = -AI_INF;
    for (let i = 0; i < n; i++) {
      if (i === bestIdx) continue;
      if (scores[i] > secondSc) { secondSc = scores[i]; secondIdx = i; }
    }
    if (secondIdx >= 0 && secondSc > bestScore - 320) return noteChosen(moves[secondIdx]);
  }

  // ----- Variety among near-equal best moves (EXACT scores only) -----
  // PVS null-window results are upper bounds, not true values; only moves that
  // were re-searched with a full window may enter the random pool.
  if (cfg.jitter > 0) {
    const pool: number[] = [];
    for (let i = 0; i < n; i++) if (exact[i] === 1 && scores[i] >= bestScore - cfg.jitter) pool.push(i);
    if (pool.length > 1) return noteChosen(moves[pool[Math.floor(Math.random() * pool.length)]]);
  }

  return noteChosen(moves[bestIdx]);
}

