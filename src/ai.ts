// ╔══════════════════════════════════════════════════════════════════════╗
//  DAMA TAHIRO — AI BRIDGE  (وسيط المحرّك)
//
//  نقطة واحدة تطلب منها حركةً فتأتيك، ولا يهمّك من حسبها:
//    • الطريق المعتاد: خيط منفصل (Web Worker) — الواجهة تبقى حيّة.
//    • الطريق البديل: الخيط الرئيسي — إن لم يُتَح الخيط أو أخفق.
//
//  مبدأ التصميم: الارتداد لا الانهيار.
//    لا نفترض أن الـWorker يعمل. أجهزة قديمة، WebView مقيَّد، ذاكرة
//    ممتلئة، خطأ في البناء — كلّها أسباب واقعية. وفي كلٍّ منها يُحسَب
//    الموضع في الخيط الرئيسي: تجمّدٌ لحظيّ كما كان قبل هذه الوحدة، لا
//    لعبةٌ لا يتحرّك فيها الخصم. والأسوأ من بطء الواجهة خصمٌ لا يلعب.
//
//  الـWorker يُدمَج في الحزمة (?worker&inline) ليبقى التطبيق ملفاً واحداً
//  كما يتطلّب vite-plugin-singlefile.
// ╚══════════════════════════════════════════════════════════════════════╝

import EngineWorker from './engine.worker?worker&inline';
import { getBestMove, aiResetGameMemory, AI_LEVELS, type BoardType, type Move } from './engine';
import type { EngineRequest, EngineResponse } from './engine.worker';

let worker: Worker | null = null;
let disabled = false;            // أخفق الخيط نهائياً ⇒ لا نحاوله هذه الجلسة
let strikes = 0;                 // مهلات متتابعة
let seq = 0;
let lastMs = 0;
let usedWorker = false;

const MAX_STRIKES = 2;

type Waiter = { resolve: (m: Move | null) => void; timer: ReturnType<typeof setTimeout> };
const waiting = new Map<number, Waiter>();

/**
 * يُسقط الخيط ويُحرّر كل منتظر إلى الحساب المحلّي.
 *
 * التمييز مهمّ: خطأ بنيويّ (الـWorker لا يُنشأ، أو postMessage يفشل) يعني
 * أن الخيط غير متاح أصلاً، فنتوقّف عن محاولته. أما انتهاء المهلة فسببه
 * الأرجح أن الهاتف نام أو خُفِّض التطبيق أثناء البحث — وهذا يحدث كثيراً
 * ولا يعني أن الخيط معطوب. تعطيلُه من أول مهلة يُعيد التطبيق إلى التجمّد
 * بلا سبب، فنمنحه فرصة ثانية ولا نعطّله إلا بعد مهلتين متتابعتين.
 */
function dropWorker(kind: 'fatal' | 'timeout'): void {
  if (kind === 'fatal') disabled = true;
  else if (++strikes >= MAX_STRIKES) disabled = true;

  const w = worker;
  worker = null;
  try { w?.terminate(); } catch { /* ignore */ }
  for (const [, waiter] of waiting) {
    clearTimeout(waiter.timer);
    waiter.resolve(null);         // null ⇒ الطالب يحسب محلياً
  }
  waiting.clear();
}

function ensureWorker(): Worker | null {
  if (disabled) return null;
  if (worker) return worker;
  try {
    const w: Worker = new EngineWorker();
    w.onmessage = (e: MessageEvent<EngineResponse>) => {
      const { id, move, ms, error } = e.data;
      const waiter = waiting.get(id);
      if (!waiter) return;        // وصل بعد انتهاء المهلة — نتجاهله
      waiting.delete(id);
      clearTimeout(waiter.timer);
      lastMs = ms;
      strikes = 0;              // جواب سليم ⇒ نمحو سجلّ المهلات
      if (error) { waiter.resolve(null); return; }
      waiter.resolve(move);
    };
    w.onerror = () => dropWorker('fatal');
    w.onmessageerror = () => dropWorker('fatal');
    worker = w;
    return w;
  } catch {
    disabled = true;
    return null;
  }
}

/** سقف الانتظار: ميزانية المستوى + هامش للأجهزة البطيئة.
 *  لو تجاوزه الخيط فهو عاطل عملياً، فنُسقطه ونحسب محلياً. */
function budgetFor(level: number): number {
  const lv = AI_LEVELS[Math.max(0, Math.min(AI_LEVELS.length - 1, level - 1))];
  const base = typeof lv?.time === 'number' ? lv.time : 1000;
  return Math.max(2500, base * 3 + 1500);
}

/**
 * أفضل حركة للموضع. لا تُلقي استثناءً أبداً: أسوأ الحالات حركة محسوبة
 * محلياً، أو null إن لم تكن هناك حركة شرعية.
 */
export async function requestMove(
  board: BoardType, whiteToMove: boolean, level: number
): Promise<Move | null> {
  const w = ensureWorker();

  if (w) {
    const id = ++seq;
    const got = await new Promise<Move | null>(resolve => {
      const timer = setTimeout(() => {
        waiting.delete(id);
        dropWorker('timeout');
        resolve(null);
      }, budgetFor(level));
      waiting.set(id, { resolve, timer });
      const req: EngineRequest = { kind: 'move', id, board, whiteToMove, level };
      try { w.postMessage(req); }
      catch {
        clearTimeout(timer);
        waiting.delete(id);
        dropWorker('fatal');
        resolve(null);
      }
    });
    if (got) { usedWorker = true; return got; }
    // الخيط لم يُجب أو أخفق — نُكمل بالحساب المحلّي أدناه
  }

  usedWorker = false;
  try { return getBestMove(board, whiteToMove, level); }
  catch { return null; }
}

/** تصفير ذاكرة التكرار في بداية كل مباراة — في الخيطين معاً.
 *  الخيط يحمل نسخته الخاصة من الوحدة، فتصفير المحلّي وحده لا يكفي. */
export function resetMemory(): void {
  try { aiResetGameMemory(); } catch { /* ignore */ }
  const w = worker;
  if (!w) return;
  try { w.postMessage({ kind: 'reset', id: ++seq } as EngineRequest); }
  catch { dropWorker('fatal'); }
}

/** يُنهي الخيط — يُستدعى عند مغادرة اللعبة لتحرير الذاكرة. */
export function releaseWorker(): void {
  const w = worker;
  worker = null;
  for (const [, waiter] of waiting) clearTimeout(waiter.timer);
  waiting.clear();
  try { w?.terminate(); } catch { /* ignore */ }
}

/** للتشخيص: هل الحركة الأخيرة حُسبت في خيط منفصل، وكم استغرقت؟ */
export function lastSearch(): { inWorker: boolean; ms: number } {
  return { inWorker: usedWorker, ms: Math.round(lastMs) };
}
