// ╔══════════════════════════════════════════════════════════════════════╗
//  DAMA TAHIRO — ENGINE WORKER  (خيط المحرّك)
//
//  يستقبل موضعاً فيُرجع أفضل حركة. لا شيء غير ذلك.
//
//  لماذا خيط منفصل؟
//    البحث يستغرق حتى 1850 مل في المستوى 11. في الخيط الرئيسي يعني ذلك
//    شاشةً ميتة تلك المدّة: لا لمسة تُسجَّل، ولا مؤقّت يتحرّك، ولا رسم.
//    المستخدم يظنّ التطبيق تعطّل. هنا يبحث المحرّك والواجهة حيّة تماماً.
//
//  ⚠ هذه الوحدة نسخة ثانية من محرّك اللعبة بحالتها الداخلية الخاصة
//    (جدول التحويل، ذاكرة التكرار). فذاكرة التكرار التي تُصفَّر في الخيط
//    الرئيسي لا تمسّ هذه — ولهذا توجد رسالة 'reset': بدونها كان المحرّك
//    يحمل ذكرى مباراةٍ انتهت إلى مباراةٍ جديدة.
// ╚══════════════════════════════════════════════════════════════════════╝

import { getBestMove, aiResetGameMemory, type BoardType, type Move } from './engine';

export interface EngineRequest {
  kind: 'move' | 'reset';
  id: number;
  board?: BoardType;
  whiteToMove?: boolean;
  level?: number;
}

export interface EngineResponse {
  id: number;
  move: Move | null;
  ms: number;
  error?: string;
}

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<EngineRequest>) => void) | null;
  postMessage: (m: EngineResponse) => void;
};

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

ctx.onmessage = (e: MessageEvent<EngineRequest>) => {
  const req = e.data;

  if (req.kind === 'reset') {
    try { aiResetGameMemory(); } catch { /* لا شيء يُفعَل */ }
    ctx.postMessage({ id: req.id, move: null, ms: 0 });
    return;
  }

  const t0 = now();
  try {
    const move = getBestMove(req.board!, req.whiteToMove!, req.level!);
    ctx.postMessage({ id: req.id, move, ms: now() - t0 });
  } catch (err) {
    // خطأ في الخيط لا يجوز أن يُسكت اللعبة: نُبلّغ الوسيط ليحسب محلياً
    ctx.postMessage({
      id: req.id, move: null, ms: now() - t0,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
