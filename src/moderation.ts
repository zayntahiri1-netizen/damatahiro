// ╔══════════════════════════════════════════════════════════════════════╗
//  DAMA TAHIRO — MODERATION  (الإشراف: الحظر والإبلاغ)
//
//  لماذا هذه الوحدة؟
//    اللاعبون يختارون أسماءهم بأنفسهم، وتلك الأسماء يراها بقيّة اللاعبين
//    على لوحة التصدّر وفي المباريات. هذا «محتوى من إنشاء المستخدمين»،
//    وسياسة Google Play تشترط له ثلاثة أمور: قبول الشروط قبل إنشائه،
//    ونظاماً داخل التطبيق للإبلاغ، وآخر لحظر المستخدمين.
//
//  التصميم:
//    • الحظر محلّي ويعمل بلا شبكة — فالمحظور يختفي فوراً حتى دون اتصال.
//    • البلاغ يُرسَل إلى Supabase ليراه المشرف. وإن تعذّر الإرسال يُحفظ
//      محلياً ويُعاد إرساله لاحقاً: بلاغٌ يضيع لأن الشبكة انقطعت لحظتَها
//      يعني شكوى لم تصل، وهذا أسوأ من لا نظام.
//    • لا شيء هنا يكشف هوية الطرف الآخر ولا يصنّفه.
// ╚══════════════════════════════════════════════════════════════════════╝

const BLOCK_KEY = 'damaBlocked';
const QUEUE_KEY = 'damaReportQueue';
const MAX_QUEUE = 40;

export type ReportReason = 'name' | 'cheating' | 'abuse' | 'other';

export interface PendingReport {
  reported_id: string;
  reported_name: string;
  reason: ReportReason;
  note: string;
  created_at: string;
}

// ── الحظر ─────────────────────────────────────────────────────────────

export function loadBlocked(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(BLOCK_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((x: unknown) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveBlocked(ids: string[]): void {
  try { localStorage.setItem(BLOCK_KEY, JSON.stringify(ids)); } catch { /* الحصة ممتلئة */ }
}

export function addBlock(ids: string[], id: string): string[] {
  if (!id || ids.includes(id)) return ids;
  const next = [...ids, id];
  saveBlocked(next);
  return next;
}

export function removeBlock(ids: string[], id: string): string[] {
  const next = ids.filter(x => x !== id);
  saveBlocked(next);
  return next;
}

// ── البلاغات ──────────────────────────────────────────────────────────

function loadQueue(): PendingReport[] {
  try {
    const raw = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveQueue(q: PendingReport[]): void {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE))); }
  catch { /* الحصة ممتلئة */ }
}

function enqueue(r: PendingReport): void {
  saveQueue([...loadQueue(), r]);
}

/**
 * يُرسل بلاغاً. الدالة `send` تُمرَّر من طبقة الشبكة لتبقى هذه الوحدة
 * مستقلّة عن Supabase ويسهل اختبارها.
 * تُرجع true إن وصل البلاغ الآن، وfalse إن حُفظ للإرسال لاحقاً —
 * وفي الحالتين لا يضيع.
 */
export async function submitReport(
  r: PendingReport,
  send: (r: PendingReport) => Promise<boolean>
): Promise<boolean> {
  try {
    if (await send(r)) return true;
  } catch { /* نقع إلى الحفظ */ }
  enqueue(r);
  return false;
}

/** يُعيد إرسال ما تعذّر إرساله. يُستدعى عند عودة الاتصال. */
export async function flushReports(
  send: (r: PendingReport) => Promise<boolean>
): Promise<number> {
  const q = loadQueue();
  if (q.length === 0) return 0;
  const left: PendingReport[] = [];
  let sent = 0;
  for (const r of q) {
    let ok = false;
    try { ok = await send(r); } catch { ok = false; }
    if (ok) sent++; else left.push(r);
  }
  saveQueue(left);
  return sent;
}

export function pendingReportCount(): number {
  return loadQueue().length;
}

// ── قبول الشروط ───────────────────────────────────────────────────────
// شرط Google: «يُلزم المستخدمين بقبول شروط الاستخدام قبل إنشاء المحتوى».
// نحفظ نسخة الشروط المقبولة، فلو تغيّرت جوهرياً أمكن طلب قبولٍ جديد.

const TERMS_KEY = 'damaTermsAccepted';
export const TERMS_VERSION = '2026-11-08';

export function termsAccepted(): boolean {
  try { return localStorage.getItem(TERMS_KEY) === TERMS_VERSION; }
  catch { return false; }
}

export function acceptTerms(): void {
  try { localStorage.setItem(TERMS_KEY, TERMS_VERSION); } catch { /* ignore */ }
}
