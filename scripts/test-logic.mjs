#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════
//  اختبارات منطق اللعبة — تعمل بلا أي حزمة مثبَّتة (Node وحده).
//
//  تستورد src/engine.ts مباشرةً، كما تستورده اللعبة نفسها. (كانت تقتطع
//  القواعد من App.tsx بمطابقة نصّية هشّة قبل أن يُستخرج المحرّك إلى
//  وحدته — والآن لا وسيط بين الاختبار وما يُشغَّل فعلاً.)
//
//  ما يُفحَص:
//    1) مسجّل المباراة: يستنبط (انطلاق، وصول، مأكولات، الطرف) من فرق
//       الرقعتين. يُقارَن بالحركة الحقيقية. أي اختلاف = خطأ.
//       منطقه يُقتطع من App.tsx لأنه جسم تأثير React لا يُستورَد.
//    2) قواعد التعادل: لا تعادل كاذب في وسط اللعب، ولا مباراة تدوم أبداً.
//    3) مُبرهِن الألغاز: كل حركة رابحة تُقبَل، وكل حركة خاسرة تُرفَض.
//
//  الاستعمال:  node scripts/test-logic.mjs [--quick]
// ══════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const QUICK = process.argv.includes('--quick');
const ENGINE = path.join(ROOT, 'src', 'engine.ts');

// استيراد TypeScript مباشرةً يحتاج تجريد الأنواع: مُفعَّل تلقائياً في
// Node الحديث، ويحتاج علَماً في الأقدم. لا نُلزم أحداً بحفظ العلَم —
// نحاول، وإن رفض Node أعدنا تشغيل أنفسنا به مرّة واحدة.
async function loadEngine() {
  try {
    return await import(ENGINE);
  } catch (err) {
    const needsFlag = err && (err.code === 'ERR_UNKNOWN_FILE_EXTENSION' ||
      /Unknown file extension|strip-types|TypeScript/i.test(String(err.message ?? '')));
    if (!needsFlag || process.env.DAMA_RELAUNCHED) throw err;
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync(
      process.execPath,
      ['--experimental-strip-types', '--no-warnings',
       fileURLToPath(import.meta.url), ...process.argv.slice(2)],
      { stdio: 'inherit', env: { ...process.env, DAMA_RELAUNCHED: '1' } }
    );
    process.exit(r.status ?? 1);
  }
}

const {
  createInitialBoard, getAllValidMoves, executeMove, getBestMove,
  checkDrawCondition, progressSignature, positionKey,
  puzzleHoldsWin, puzzleBestDefence, isWhite,
} = await loadEngine();

// منطق المسجّل يُقتطع من التأثير نفسه، فيستحيل أن يختبر الاختبارُ نسخةً
// قديمة. يُلفّ في وحدة مؤقّتة تستورد المحرّك الحقيقي — لا تجريد أنواع
// بتعبير نمطي، فالأنواع تبقى سليمة ويتكفّل Node بحذفها.
const app = fs.readFileSync(path.join(ROOT, 'src', 'App.tsx'), 'utf8');
const recMatch = app.match(
  /\/\/ الوصول أولاً:[\s\S]*?rec\.items\.push\(\{ before: prev, from, to, captures, byWhite \}\);/
);
if (!recMatch) {
  console.error('✘ لم يُعثر على منطق مسجّل المباراة في src/App.tsx');
  process.exit(1);
}
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'damatest-'));
const derivePath = path.join(tmpDir, 'derive.ts');
fs.writeFileSync(derivePath, `
import { isWhite, type BoardType } from ${JSON.stringify(ENGINE)};

export function derive(prev: BoardType, board: BoardType) {
${recMatch[0].replace(
  'rec.items.push({ before: prev, from, to, captures, byWhite });',
  'return { from, to, captures, byWhite };')}
}
`);
const { derive } = await import(derivePath);

// الألغاز
let puzzles = [];
const pzPath = path.join(ROOT, 'src', 'puzzles.ts');
if (fs.existsSync(pzPath)) {
  puzzles = [...fs.readFileSync(pzPath, 'utf8')
    .matchAll(/\{\s*id:\s*'([^']+)',\s*b:\s*'([^']+)',\s*n:\s*(\d+)/g)]
    .map(m => ({ id: m[1], b: m[2], n: Number(m[3]) }));
}
if (QUICK) puzzles = puzzles.slice(0, 25);

const GAMES_REC = QUICK ? 15 : 50;
const GAMES_DRAW = QUICK ? 10 : 30;
let failures = 0;
const fail = (m) => { failures++; console.log('   ✘ ' + m); };

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// ── 1) مسجّل المباراة ────────────────────────────────────────────────
function testRecorder() {
  let n = 0, bad = 0, skipped = 0;
  for (let g = 0; g < GAMES_REC; g++) {
    const rnd = rng(g * 7919 + 13);
    let board = createInitialBoard(), wtm = true;
    for (let ply = 0; ply < 220; ply++) {
      const legal = getAllValidMoves(board, wtm);
      if (legal.length === 0) break;
      // ننحاز للأكل المتعدّد: هو الحالة التي أخطأ فيها الاستنباط سابقاً
      const caps = legal.filter(m => m.captures.length >= 2);
      const mv = caps.length && rnd() < 0.8 ? caps[Math.floor(rnd() * caps.length)]
        : ply < 8 ? legal[Math.floor(rnd() * legal.length)]
        : getBestMove(board, wtm, 3);
      const after = executeMove(board, mv, wtm);
      const d = derive(board, after);
      n++;
      if (!d) skipped++;
      else if (d.from !== mv.from || d.to !== mv.to ||
               d.captures.length !== mv.captures.length || d.byWhite !== wtm) {
        bad++;
        if (bad <= 5) fail(`المسجّل: ${mv.from}→${mv.to} أكل ${mv.captures.length} ⇒ استُنبط ${d.from}→${d.to} أكل ${d.captures.length}`);
      }
      board = after; wtm = !wtm;
    }
  }
  console.log(`1) المسجّل: ${n} حركة — خطأ ${bad}، تُخطّيت ${skipped} (أكل دائري)`);
  if (bad > 0) fail('المسجّل غير دقيق');
  if (n < 1000) fail(`عدد الحركات المُختبَرة ضئيل (${n}) — الاختبار لم يعمل فعلاً`);
}

// ── 2) قواعد التعادل ────────────────────────────────────────────────
function testDraws() {
  let unfinished = 0, falseDraw = 0, worstPieces = 0, decided = 0, draws = 0;
  for (let g = 0; g < GAMES_DRAW; g++) {
    const rnd = rng(g * 2654435761 + 77);
    const d = { seen: new Map(), sig: '', stall: 0, lastKey: '' };
    let board = createInitialBoard(), wtm = true, msc = 0, ended = '';
    const randomPlies = 4 + (g % 9);
    for (let ply = 0; ply < 400; ply++) {
      const legal = getAllValidMoves(board, wtm);
      if (legal.length === 0) { ended = 'حُسمت'; decided++; break; }
      const mv = ply < randomPlies ? legal[Math.floor(rnd() * legal.length)]
        : getBestMove(board, wtm, 4);
      board = executeMove(board, mv, wtm);
      msc = mv.captures.length > 0 ? 0 : msc + 1;
      wtm = !wtm;
      const pieces = board.filter(p => p).length;
      const key = positionKey(board, wtm);
      if (key !== d.lastKey) {
        d.lastKey = key;
        const sig = progressSignature(board);
        if (sig !== d.sig) { d.sig = sig; d.stall = 0; d.seen.clear(); } else d.stall++;
        const t = (d.seen.get(key) ?? 0) + 1; d.seen.set(key, t);
        if (t >= 3 || d.stall >= 50) {
          ended = 'تعادل'; draws++;
          worstPieces = Math.max(worstPieces, pieces);
          // تعادل والرقعة ممتلئة = إنذار كاذب
          if (pieces > 12) { falseDraw++; fail(`تعادل كاذب: ${pieces} قطعة عند نصف-حركة ${ply}`); }
          break;
        }
      }
      if (checkDrawCondition(board, msc)) { ended = 'تعادل'; draws++; break; }
    }
    if (!ended) { unfinished++; fail(`مباراة لم تنتهِ خلال 400 نصف-حركة (بذرة ${g})`); }
  }
  console.log(`2) التعادل: ${GAMES_DRAW} مباراة — حُسمت ${decided}، تعادل ${draws}، بلا نهاية ${unfinished}، تعادل كاذب ${falseDraw}، أكثف تعادل ${worstPieces} قطعة`);
}

// ── 3) مُبرهِن الألغاز ──────────────────────────────────────────────
function testPuzzles() {
  if (puzzles.length === 0) { console.log('3) الألغاز: لا ملف ألغاز — تُخطّي'); return; }
  let solved = 0, rejected = 0;
  for (const p of puzzles) {
    let board = [...p.b].map(c => c === 'w' ? 'white' : c === 'b' ? 'black'
      : c === 'W' ? 'whiteKing' : c === 'B' ? 'blackKing' : null);
    let left = p.n, step = 0, bad = '';
    for (;;) {
      step++;
      if (step > p.n + 1) { bad = 'تجاوز ' + p.n + ' حركة'; break; }
      const moves = getAllValidMoves(board, true);
      let chosen = null, immediate = false, accepted = 0;
      for (const m of moves) {
        const b2 = executeMove(board, m, true);
        if (getAllValidMoves(b2, false).length === 0) { if (!chosen) { chosen = m; immediate = true; } accepted++; continue; }
        if (puzzleHoldsWin(b2, left - 1)) { if (!chosen) chosen = m; accepted++; }
      }
      if (!chosen) { bad = 'رُفضت كل الحركات عند الخطوة ' + step; break; }
      rejected += moves.length - accepted;
      board = executeMove(board, chosen, true);
      if (immediate) { if (step !== p.n) bad = `فاز في ${step} لا ${p.n}`; break; }
      const def = puzzleBestDefence(board, left - 1);
      if (!def) { bad = 'الدفاع عاد فارغاً'; break; }
      board = executeMove(board, def, false);
      left--;
      if (getAllValidMoves(board, true).length === 0) { bad = 'الأبيض تجمّد — الدفاع أفلت'; break; }
    }
    if (bad) fail(`لغز ${p.id}: ${bad}`); else solved++;
  }
  console.log(`3) الألغاز: ${solved}/${puzzles.length} حُلّت في n حركة بالضبط، ورُفضت ${rejected} حركة خاسرة`);
  if (solved !== puzzles.length) fail('لغز أو أكثر لا يُحلّ بمنطق الواجهة');
}

testRecorder();
testDraws();
testPuzzles();

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('');
if (failures > 0) { console.log(`✘ ${failures} إخفاق`); process.exit(1); }
console.log('✔ كل اختبارات المنطق نجحت');
