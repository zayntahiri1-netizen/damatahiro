// ╔══════════════════════════════════════════════════════════════════════╗
//  DAMA TAHIRO — COSMETICS  (مصرف العملات)
//
//  لماذا هذه الوحدة؟
//    العملات في اللعبة كانت تتراكم بلا مصرف: تربح فتزيد، ولا شيء تشتريه
//    بها، فتفقد معناها. هذا المتجر يمنحها قيمة — وكل ما فيه تجميلي محض،
//    لا يمسّ قوة اللاعب ولا نتيجة المباراة. لا «اربح بالدفع» هنا.
//
//  الهوية:
//    الأطقم مستقاة من ثقافات اللاعبين الأربع التي يدعمها التطبيق —
//    الأندلس والمغرب، إسبانيا، الصين، ومعها اليابان والصحراء — وفي صدرها
//    زليج تطوان، مدينة اللعبة.
//
//  تقنياً:
//    • لا صور إطلاقاً: كل طقم أصناف CSS ومتدرّجات، فحجم الحزمة لا يزيد.
//    • أسماء الأصناف مكتوبة كاملةً كنصوص حرفية — Tailwind يمسح هذا الملف
//      ويولّدها؛ أي بناء باسم مركّب (`'bg-' + x`) سيختفي من البناء النهائي.
//    • الحالة في localStorage تحت مفتاح واحد، ومحصّنة ضد التلف:
//      أي قراءة فاشلة تعود إلى الطقم المجاني لا إلى شاشة بيضاء.
// ╚══════════════════════════════════════════════════════════════════════╝

export type CosCat = 'board' | 'pieces' | 'backdrop';

interface BaseItem {
  id: string;
  /** الاسم بالعربية — هو مفتاح القاموس، يُمرَّر إلى t() عند العرض. */
  name: string;
  /** الثقافة التي يستلهمها الطقم — مفتاح قاموس أيضاً. */
  culture: string;
  price: number;
}

export interface BoardTheme extends BaseItem {
  dark: string;   // المربعات الداكنة (مربعات اللعب)
  light: string;  // المربعات الفاتحة
  hl: string;     // مربع آخر حركة
  frame: string;  // إطار الرقعة
  ring: string;   // لون حلقة التتبّع (آخر حركة)
}

export interface PieceTheme extends BaseItem {
  white: string;  // متدرّج + نص + حدود القطعة البيضاء
  black: string;
  glyphW: string; // رمز الجندي الأبيض ('' = قطعة صلبة بلا رمز)
  glyphB: string;
  glyphK: string; // رمز الملك
  kingRing: string;
}

export interface BackdropTheme extends BaseItem {
  shell: string;            // متدرّج الخلفية
  pattern?: string;         // نقشة CSS (backgroundImage) — بلا أي صورة
  patternSize?: string;
}

// ── الرقع ─────────────────────────────────────────────────────────────
export const BOARDS: BoardTheme[] = [
  {
    id: 'classic', name: 'الكلاسيكية', culture: 'الأصل', price: 0,
    dark: 'bg-amber-900', light: 'bg-amber-100', hl: 'bg-amber-800',
    frame: 'border-yellow-900/50', ring: 'ring-amber-300',
  },
  {
    id: 'zellij', name: 'زليج تطوان', culture: 'المغرب', price: 1500,
    dark: 'bg-teal-800', light: 'bg-stone-100', hl: 'bg-teal-600',
    frame: 'border-teal-900/60', ring: 'ring-teal-200',
  },
  {
    id: 'granada', name: 'ليل غرناطة', culture: 'الأندلس', price: 3000,
    dark: 'bg-indigo-900', light: 'bg-amber-200', hl: 'bg-indigo-700',
    frame: 'border-amber-700/50', ring: 'ring-amber-300',
  },
  {
    id: 'sahara', name: 'رمل الصحراء', culture: 'الصحراء', price: 5000,
    dark: 'bg-orange-800', light: 'bg-orange-50', hl: 'bg-orange-600',
    frame: 'border-orange-900/50', ring: 'ring-orange-200',
  },
  {
    id: 'jade', name: 'اليشم الصيني', culture: 'الصين', price: 8000,
    dark: 'bg-emerald-800', light: 'bg-lime-50', hl: 'bg-emerald-600',
    frame: 'border-red-900/60', ring: 'ring-emerald-200',
  },
  {
    id: 'sumi', name: 'خشب وحجر', culture: 'اليابان', price: 12000,
    dark: 'bg-slate-700', light: 'bg-stone-200', hl: 'bg-slate-500',
    frame: 'border-stone-800/70', ring: 'ring-slate-200',
  },
  {
    id: 'qurtuba', name: 'رخام قرطبة', culture: 'الأندلس', price: 18000,
    dark: 'bg-zinc-800', light: 'bg-zinc-100', hl: 'bg-zinc-600',
    frame: 'border-zinc-900/70', ring: 'ring-white',
  },
];

// ── القطع ─────────────────────────────────────────────────────────────
export const PIECES: PieceTheme[] = [
  {
    id: 'classic', name: 'الكلاسيكية', culture: 'الأصل', price: 0,
    white: 'bg-gradient-to-br from-yellow-200 to-yellow-400 text-yellow-800 border-yellow-500',
    black: 'bg-gradient-to-br from-gray-700 to-gray-900 text-gray-200 border-gray-500',
    glyphW: '⚪', glyphB: '⚫', glyphK: '👑', kingRing: 'ring-yellow-400',
  },
  {
    id: 'najma', name: 'النجمة الأندلسية', culture: 'الأندلس', price: 2000,
    white: 'bg-gradient-to-br from-amber-100 to-amber-300 text-teal-800 border-amber-400',
    black: 'bg-gradient-to-br from-teal-700 to-teal-900 text-amber-200 border-teal-500',
    glyphW: '✦', glyphB: '✦', glyphK: '✵', kingRing: 'ring-amber-300',
  },
  {
    id: 'aqeeq', name: 'اليشم والعقيق', culture: 'الصين', price: 3500,
    white: 'bg-gradient-to-br from-emerald-200 to-emerald-400 text-emerald-900 border-emerald-500',
    black: 'bg-gradient-to-br from-red-700 to-red-900 text-red-100 border-red-500',
    glyphW: '◉', glyphB: '◉', glyphK: '❖', kingRing: 'ring-yellow-300',
  },
  {
    id: 'gou', name: 'حجر الغو', culture: 'اليابان', price: 6000,
    white: 'bg-gradient-to-br from-stone-50 to-stone-300 text-stone-600 border-stone-400',
    black: 'bg-gradient-to-br from-neutral-800 to-black text-neutral-300 border-neutral-700',
    glyphW: '', glyphB: '', glyphK: '◆', kingRing: 'ring-stone-300',
  },
  {
    id: 'abanous', name: 'العاج والأبنوس', culture: 'الصحراء', price: 9000,
    white: 'bg-gradient-to-br from-orange-50 to-amber-200 text-amber-900 border-amber-300',
    black: 'bg-gradient-to-br from-stone-800 to-stone-950 text-amber-200 border-stone-600',
    glyphW: '❖', glyphB: '❖', glyphK: '♛', kingRing: 'ring-amber-400',
  },
  {
    id: 'dhahab', name: 'الذهب والفحم', culture: 'تطوان', price: 14000,
    white: 'bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 text-amber-900 border-yellow-200',
    black: 'bg-gradient-to-br from-zinc-700 via-zinc-900 to-black text-yellow-300 border-zinc-500',
    glyphW: '✸', glyphB: '✸', glyphK: '♚', kingRing: 'ring-yellow-200',
  },
];

// ── الخلفيات ──────────────────────────────────────────────────────────
export const BACKDROPS: BackdropTheme[] = [
  {
    id: 'classic', name: 'الكلاسيكية', culture: 'الأصل', price: 0,
    shell: 'bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900',
  },
  {
    id: 'qaws', name: 'أقواس الأندلس', culture: 'الأندلس', price: 1200,
    shell: 'bg-gradient-to-b from-slate-900 via-teal-950 to-slate-900',
    pattern: 'repeating-linear-gradient(135deg, rgba(20,184,166,.07) 0 2px, transparent 2px 14px),' +
             'repeating-linear-gradient(45deg, rgba(20,184,166,.07) 0 2px, transparent 2px 14px)',
    patternSize: '28px 28px',
  },
  {
    id: 'atlas', name: 'جبال الأطلس', culture: 'المغرب', price: 2500,
    shell: 'bg-gradient-to-b from-orange-950 via-stone-900 to-neutral-950',
    pattern: 'radial-gradient(circle at 50% 120%, rgba(251,146,60,.16), transparent 60%),' +
             'repeating-linear-gradient(60deg, rgba(251,146,60,.05) 0 1px, transparent 1px 22px)',
  },
  {
    id: 'sakura', name: 'أزهار الكرز', culture: 'اليابان', price: 4500,
    shell: 'bg-gradient-to-b from-rose-950 via-slate-900 to-slate-950',
    pattern: 'radial-gradient(circle at 18% 22%, rgba(251,113,133,.14) 0 3px, transparent 4px),' +
             'radial-gradient(circle at 72% 58%, rgba(251,113,133,.12) 0 2px, transparent 3px),' +
             'radial-gradient(circle at 44% 86%, rgba(251,113,133,.1) 0 3px, transparent 4px)',
    patternSize: '160px 160px',
  },
  {
    id: 'sahab', name: 'السحاب الصيني', culture: 'الصين', price: 7000,
    shell: 'bg-gradient-to-b from-red-950 via-stone-900 to-emerald-950',
    pattern: 'radial-gradient(ellipse at 20% 30%, rgba(251,191,36,.12), transparent 55%),' +
             'radial-gradient(ellipse at 80% 70%, rgba(16,185,129,.12), transparent 55%)',
  },
  {
    id: 'tetouan', name: 'سماء تطوان', culture: 'تطوان', price: 11000,
    shell: 'bg-gradient-to-b from-indigo-950 via-slate-900 to-teal-950',
    pattern: 'radial-gradient(circle at 12% 18%, rgba(255,255,255,.5) 0 1px, transparent 2px),' +
             'radial-gradient(circle at 62% 34%, rgba(255,255,255,.35) 0 1px, transparent 2px),' +
             'radial-gradient(circle at 34% 72%, rgba(255,255,255,.4) 0 1px, transparent 2px),' +
             'radial-gradient(circle at 86% 88%, rgba(255,255,255,.3) 0 1px, transparent 2px)',
    patternSize: '200px 200px',
  },
];

// ── الحالة المحفوظة ───────────────────────────────────────────────────

const KEY = 'damaCosmetics';

export interface CosState {
  owned: string[];                     // معرّفات مملوكة بصيغة 'board:zellij'
  board: string;
  pieces: string;
  backdrop: string;
}

const DEFAULTS: CosState = { owned: [], board: 'classic', pieces: 'classic', backdrop: 'classic' };

/** معرّف موحّد — الفئة جزء منه، فلا يتصادم 'jade' الرقعة مع 'jade' القطع. */
export function key(cat: CosCat, id: string): string { return cat + ':' + id; }

function catalog(cat: CosCat): BaseItem[] {
  return cat === 'board' ? BOARDS : cat === 'pieces' ? PIECES : BACKDROPS;
}

/** يتحقّق أن المعرّف موجود فعلاً في الفهرس — يحمي من حالة محفوظة قديمة. */
function valid(cat: CosCat, id: string): boolean {
  return catalog(cat).some(i => i.id === id);
}

export function load(): CosState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    const owned = Array.isArray(raw.owned) ? raw.owned.filter((x: unknown) => typeof x === 'string') : [];
    return {
      owned,
      board:    valid('board',    raw.board)    ? raw.board    : 'classic',
      pieces:   valid('pieces',   raw.pieces)   ? raw.pieces   : 'classic',
      backdrop: valid('backdrop', raw.backdrop) ? raw.backdrop : 'classic',
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function save(s: CosState): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* الحصة ممتلئة */ }
}

/** هل يملك اللاعب هذا الطقم؟ المجاني مملوك دائماً. */
export function owns(s: CosState, cat: CosCat, id: string): boolean {
  const item = catalog(cat).find(i => i.id === id);
  if (!item) return false;
  if (item.price === 0) return true;
  return s.owned.includes(key(cat, id));
}

export function priceOf(cat: CosCat, id: string): number {
  return catalog(cat).find(i => i.id === id)?.price ?? 0;
}

// ── المحدِّدات (دائماً تُرجع طقماً صالحاً) ────────────────────────────
export function boardOf(s: CosState): BoardTheme {
  return BOARDS.find(b => b.id === s.board) ?? BOARDS[0];
}
export function piecesOf(s: CosState): PieceTheme {
  return PIECES.find(p => p.id === s.pieces) ?? PIECES[0];
}
export function backdropOf(s: CosState): BackdropTheme {
  return BACKDROPS.find(b => b.id === s.backdrop) ?? BACKDROPS[0];
}

/** نمط inline للخلفية — تُمرَّر إلى style={} مباشرة.
 *  النوع مُصرَّح يدوياً لتبقى هذه الوحدة مستقلة عن React تماماً. */
export function backdropStyle(b: BackdropTheme): { backgroundImage?: string; backgroundSize?: string } {
  if (!b.pattern) return {};
  return { backgroundImage: b.pattern, backgroundSize: b.patternSize ?? 'auto' };
}

/** إجمالي ما تبقّى للشراء — يُعرض في المتجر ليرى اللاعب الهدف. */
export function remainingValue(s: CosState): number {
  let total = 0;
  for (const cat of ['board', 'pieces', 'backdrop'] as CosCat[]) {
    for (const i of catalog(cat)) if (i.price > 0 && !owns(s, cat, i.id)) total += i.price;
  }
  return total;
}

export function ownedCount(s: CosState): { have: number; all: number } {
  let have = 0, all = 0;
  for (const cat of ['board', 'pieces', 'backdrop'] as CosCat[]) {
    for (const i of catalog(cat)) { all++; if (owns(s, cat, i.id)) have++; }
  }
  return { have, all };
}
