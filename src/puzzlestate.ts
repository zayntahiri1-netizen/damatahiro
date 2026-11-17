// ╔══════════════════════════════════════════════════════════════════════╗
//  DAMA TAHIRO — PUZZLE PROGRESS  (تقدّم الألغاز)
//
//  ملف مكتوب بيد، منفصل عن src/puzzles.ts المُولَّد آلياً — فإعادة توليد
//  الألغاز لا تمسّ تقدّم اللاعب.
//
//  يحفظ ثلاثة أشياء فقط:
//    • أيّ يوم حُلّ آخر لغز (فلا تُمنح المكافأة مرّتين)
//    • سلسلة الأيام المتتابعة
//    • مجموع ما حُلّ
//  كل شيء محلّي: لا شيء من هذا يُرسل إلى أي خادم.
// ╚══════════════════════════════════════════════════════════════════════╝

const KEY = 'damaPuzzle';

export interface PuzzleRecord {
  /** تاريخ آخر حلّ بصيغة YYYY-MM-DD (توقيت عالمي). '' = لا شيء بعد. */
  date: string;
  /** سلسلة الأيام المتتابعة. */
  streak: number;
  /** أطول سلسلة بلغها اللاعب. */
  best: number;
  /** مجموع الألغاز المحلولة. */
  total: number;
}

const EMPTY: PuzzleRecord = { date: '', streak: 0, best: 0, total: 0 };

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

export function loadPuzzleRecord(): PuzzleRecord {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      date: typeof r.date === 'string' ? r.date : '',
      streak: num(r.streak),
      best: num(r.best),
      total: num(r.total),
    };
  } catch {
    return { ...EMPTY };
  }
}

export function savePuzzleRecord(r: PuzzleRecord): void {
  try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* الحصة ممتلئة */ }
}

/** يوم أمس بصيغة YYYY-MM-DD — لمعرفة إن كانت السلسلة متصلة. */
function yesterdayKey(now: Date): string {
  return new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
}

export function solvedToday(r: PuzzleRecord, today: string): boolean {
  return r.date === today;
}

/** يسجّل حلّ اليوم ويُرجع السجل الجديد. آمن للاستدعاء مرّتين: اليوم
 *  نفسه لا يُحتسب إلا مرّة، فلا تتضخّم السلسلة بإعادة الحلّ. */
export function recordSolve(r: PuzzleRecord, now: Date = new Date()): PuzzleRecord {
  const today = now.toISOString().slice(0, 10);
  if (r.date === today) return r;
  const streak = r.date === yesterdayKey(now) ? r.streak + 1 : 1;
  return {
    date: today,
    streak,
    best: Math.max(r.best, streak),
    total: r.total + 1,
  };
}
