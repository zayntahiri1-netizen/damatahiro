#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════
//  يتحقّق من src/puzzles.ts بمُبرهِن مستقل.
//
//  لماذا مُبرهِن ثانٍ؟
//    المولّد أثبت الألغاز ببحث AND/OR منطقي (هل يوجد فوز؟ نعم/لا).
//    هذا الفاحص يحسب شيئاً مختلفاً: «أقصر مسافة حتى الفوز» بتبادل
//    صغرى/عظمى — صيغة أخرى وخطأ آخر لو كان فيها خطأ. اتفاقُهما برهان؛
//    اعتمادُ المولّد على نفسه ليس برهاناً. وقد أمسك هذا الفاحص فعلاً
//    16 لغزاً مكتوباً «يفوز في 2» وهو يُحسم بحركة واحدة.
//
//  يفحص أيضاً شرعية بنية كل موضع: مربعات داكنة فقط، ولا جنديّ في صف
//  تتويجه (موضع مستحيل في مباراة حقيقية).
//
//  يُشغَّل بلا أي حزمة.    node scripts/verify-puzzles.mjs
// ══════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

// استيراد TypeScript مباشرةً يحتاج تجريد الأنواع: مُفعَّل تلقائياً في Node
// الحديث، ويحتاج علَماً في الأقدم. نحاول، وإن رفض أعدنا التشغيل بالعلَم.
async function loadEngine(enginePath) {
  try {
    return await import(enginePath);
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

const { getAllValidMoves, executeMove, getRow, getCol } =
  await loadEngine(path.join(ROOT, 'src', 'engine.ts'));

const rows = [...fs.readFileSync(path.join(ROOT, 'src', 'puzzles.ts'), 'utf8')
  .matchAll(/\{\s*id:\s*'([^']+)',\s*b:\s*'([^']+)',\s*n:\s*(\d+),\s*reward:\s*(\d+)\s*\}/g)]
  .map(m => ({ id: m[1], b: m[2], n: Number(m[3]), reward: Number(m[4]) }));
if (rows.length === 0) { console.error('✘ لم يُقرأ أي لغز من src/puzzles.ts'); process.exit(1); }

const INF = 99;

const decode = s => [...s].map(c =>
  c === 'w' ? 'white' : c === 'b' ? 'black' : c === 'W' ? 'whiteKing' : c === 'B' ? 'blackKing' : null);

/** أقصر عدد حركات يحتاجها الأبيض لإنهاء اللعبة، بأفضل دفاع من الأسود. */
function dtwWhite(board, budget) {
  if (budget <= 0) return INF;
  let best = INF;
  for (const m of getAllValidMoves(board, true)) {
    const b2 = executeMove(board, m, true);
    const replies = getAllValidMoves(b2, false);
    const cost = replies.length === 0 ? 1 : 1 + dtwBlack(b2, budget - 1);
    if (cost < best) best = cost;
    if (best === 1) break;
  }
  return best;
}

/** الأسود يدافع: يختار الرد الذي يُطيل أكثر ما يمكن (أو يُفلت تماماً). */
function dtwBlack(board, budget) {
  const moves = getAllValidMoves(board, false);
  if (moves.length === 0) return INF;      // لا رد ⇒ اللعبة انتهت سلفاً
  let worst = 0;
  for (const m of moves) {
    const b2 = executeMove(board, m, false);
    if (getAllValidMoves(b2, true).length === 0) return INF;   // الأبيض تجمّد
    const c = dtwWhite(b2, budget);
    if (c >= INF) return INF;
    if (c > worst) worst = c;
  }
  return worst;
}

function structure(enc) {
  if (enc.length !== 64) return 'الطول ' + enc.length + ' لا 64';
  let w = 0, b = 0;
  for (let i = 0; i < 64; i++) {
    const c = enc[i];
    if (!'.wbWB'.includes(c)) return 'حرف غريب: ' + c;
    if (c === '.') continue;
    if ((getRow(i) + getCol(i)) % 2 !== 1) return 'قطعة على مربع فاتح عند ' + i;
    if (c === 'w' && getRow(i) === 0) return 'جنديّ أبيض في صف التتويج';
    if (c === 'b' && getRow(i) === 7) return 'جنديّ أسود في صف التتويج';
    if (c === 'w' || c === 'W') w++; else b++;
  }
  if (w === 0 || b === 0) return 'طرف بلا قطع';
  return null;
}

let ok = 0;
const bad = [];
const ids = new Set();
for (const p of rows) {
  if (ids.has(p.id)) { bad.push(p.id + ': معرّف مكرّر'); continue; }
  ids.add(p.id);
  const st = structure(p.b);
  if (st) { bad.push(p.id + ': ' + st); continue; }
  const board = decode(p.b);
  if (getAllValidMoves(board, true).length < 2) { bad.push(p.id + ': حركة واحدة ممكنة'); continue; }
  const d = dtwWhite(board, p.n);
  if (d !== p.n) {
    bad.push(`${p.id}: n=${p.n} لكن المسافة الحقيقية ${d >= INF ? '∞ (لا فوز قسري)' : d}`);
    continue;
  }
  const want = p.n === 2 ? 300 : p.n === 3 ? 600 : 1000;
  if (p.reward !== want) { bad.push(`${p.id}: مكافأة ${p.reward} بدل ${want}`); continue; }
  ok++;
}

console.log(`ألغاز: ${rows.length}  ✔ مُبرهَنة: ${ok}  ✘ فاشلة: ${bad.length}`);
if (bad.length) {
  for (const b of bad.slice(0, 25)) console.log('   ' + b);
  if (bad.length > 25) console.log(`   … و${bad.length - 25} أخرى`);
  process.exit(1);
}
console.log('✔ كل لغز أثبته مُبرهِنان مستقلّان: الأبيض يفوز في n حركة بالضبط');
