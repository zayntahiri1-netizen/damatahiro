// ╔══════════════════════════════════════════════════════════════════════╗
//  DAMA TAHIRO — نظام اللغات (i18n)
//
//  أربع لغات: العربية · English · Español · 中文
//
//  الكشف التلقائي عند أول تشغيل (بحسب طلب المستخدم):
//    • الدول العربية            → العربية
//    • إسبانيا وأمريكا اللاتينية → الإسبانية
//    • الصين وتايوان وهونغ كونغ  → الصينية
//    • باقي دول العالم           → الإنجليزية
//
//  ► التصميم: القاموس مفتاحه هو **النص العربي نفسه** (نمط gettext).
//    فائدته أن العربية تبقى كما هي حرفياً بلا أي خطر انحراف، وأي نص
//    غير مترجم يعود تلقائياً إلى العربية بدل أن يظهر مفتاحاً مكسوراً.
// ╚══════════════════════════════════════════════════════════════════════╝

import { useEffect, useState } from 'react';

export type Lang = 'ar' | 'en' | 'es' | 'zh';

export const LANGS: { code: Lang; native: string; flag: string; dir: 'rtl' | 'ltr' }[] = [
  { code: 'ar', native: 'العربية',  flag: '🇲🇦', dir: 'rtl' },
  { code: 'en', native: 'English',  flag: '🇬🇧', dir: 'ltr' },
  { code: 'es', native: 'Español',  flag: '🇪🇸', dir: 'ltr' },
  { code: 'zh', native: '中文',      flag: '🇨🇳', dir: 'ltr' },
];

// ── مناطق الكشف التلقائي ──────────────────────────────────────────────
const AR_REGIONS = ['MA','DZ','TN','LY','EG','SD','SA','AE','QA','BH','KW','OM','YE',
                    'JO','LB','SY','IQ','PS','MR','SO','DJ','KM','EH','TD'];
const ES_REGIONS = ['ES','MX','AR','CO','CL','PE','VE','EC','GT','CU','BO','DO','HN',
                    'PY','SV','NI','CR','PA','UY','PR','GQ'];
const ZH_REGIONS = ['CN','TW','HK','MO','SG'];

// مناطق زمنية تُستعمل كإشارة ثانية إن لم يحمل الـ locale رمز دولة
const TZ_HINTS: Record<string, Lang> = {
  'Africa/Casablanca': 'ar', 'Africa/Algiers': 'ar', 'Africa/Tunis': 'ar',
  'Africa/Tripoli': 'ar', 'Africa/Cairo': 'ar', 'Africa/Khartoum': 'ar',
  'Asia/Riyadh': 'ar', 'Asia/Dubai': 'ar', 'Asia/Qatar': 'ar', 'Asia/Kuwait': 'ar',
  'Asia/Baghdad': 'ar', 'Asia/Amman': 'ar', 'Asia/Beirut': 'ar', 'Asia/Damascus': 'ar',
  'Europe/Madrid': 'es', 'Atlantic/Canary': 'es', 'America/Mexico_City': 'es',
  'America/Bogota': 'es', 'America/Lima': 'es', 'America/Santiago': 'es',
  'America/Argentina/Buenos_Aires': 'es', 'America/Caracas': 'es',
  'Asia/Shanghai': 'zh', 'Asia/Chongqing': 'zh', 'Asia/Harbin': 'zh',
  'Asia/Taipei': 'zh', 'Asia/Hong_Kong': 'zh', 'Asia/Macau': 'zh',
};

const STORAGE_KEY = 'damaLang';

function regionOf(tag: string): string {
  const m = /-([A-Za-z]{2})(?:-|$)/.exec(tag);
  return m ? m[1].toUpperCase() : '';
}

function langFromTag(tag: string): Lang | null {
  const base = tag.toLowerCase().split('-')[0];
  if (base === 'ar') return 'ar';
  if (base === 'es') return 'es';
  if (base === 'zh') return 'zh';
  if (base === 'en') return 'en';
  return null;
}

/** الكشف التلقائي: الدولة أولاً (كما طُلب)، ثم لغة الجهاز، ثم المنطقة الزمنية. */
export function detectLang(): Lang {
  try {
    const tags: string[] = [];
    const nav: any = typeof navigator !== 'undefined' ? navigator : null;
    if (nav?.languages?.length) tags.push(...nav.languages);
    if (nav?.language) tags.push(nav.language);

    // 1) رمز الدولة له الأولوية: en-SA ⇒ عربية، fr-MA ⇒ عربية
    for (const tag of tags) {
      const r = regionOf(String(tag));
      if (!r) continue;
      if (AR_REGIONS.includes(r)) return 'ar';
      if (ES_REGIONS.includes(r)) return 'es';
      if (ZH_REGIONS.includes(r)) return 'zh';
    }

    // 2) المنطقة الزمنية كإشارة ثانية
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && TZ_HINTS[tz]) return TZ_HINTS[tz];
    } catch { /* ignore */ }

    // 3) لغة الجهاز نفسها
    for (const tag of tags) {
      const l = langFromTag(String(tag));
      if (l) return l;
    }
  } catch { /* ignore */ }
  return 'en';   // باقي دول العالم
}

// ── الحالة العامة ─────────────────────────────────────────────────────
let current: Lang = (() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ar' || saved === 'en' || saved === 'es' || saved === 'zh') return saved;
  } catch { /* ignore */ }
  return detectLang();
})();

const listeners = new Set<(l: Lang) => void>();

export function getLang(): Lang { return current; }

export function dirOf(l: Lang): 'rtl' | 'ltr' { return l === 'ar' ? 'rtl' : 'ltr'; }

export function getDir(): 'rtl' | 'ltr' { return dirOf(current); }

export function setLang(l: Lang): void {
  if (l === current) return;
  current = l;
  try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  applyDocument();
  listeners.forEach(fn => { try { fn(l); } catch { /* ignore */ } });
}

/** يضبط lang/dir على عنصر <html> — مهم للاتجاه ولقارئات الشاشة. */
export function applyDocument(): void {
  try {
    const el = document.documentElement;
    el.lang = current;
    el.dir = dirOf(current);
    document.title = TITLES[current];
  } catch { /* ignore */ }
}

/** خطّاف React: يُعيد الترجمة والاتجاه ويُعيد الرسم عند تغيير اللغة. */
export function useLang() {
  const [lang, setLangState] = useState<Lang>(current);
  useEffect(() => {
    applyDocument();
    const fn = (l: Lang) => setLangState(l);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return {
    lang,
    dir: dirOf(lang),
    setLang,
    t,
  };
}

// ── القاموس: المفتاح هو النص العربي ───────────────────────────────────
type Tr = { en: string; es: string; zh: string };

const DICT: Record<string, Tr> = {
  // ══════════ تسجيل الدخول ══════════
  'الاسم المستعار':            { en: 'Nickname',           es: 'Apodo',              zh: '昵称' },
  'أدخل اسمك هنا...':          { en: 'Enter your name...', es: 'Escribe tu nombre...', zh: '请输入你的名字…' },
  'رمز الإحالة (اختياري)':      { en: 'Referral code (optional)', es: 'Código de invitación (opcional)', zh: '邀请码（可选）' },
  'دخول الميدان':              { en: 'Enter the Arena',    es: 'Entrar en la arena', zh: '进入战场' },

  // ══════════ شريط التنقّل ══════════
  'الرئيسية':                  { en: 'Home',      es: 'Inicio',      zh: '首页' },
  'الأصدقاء':                  { en: 'Friends',   es: 'Amigos',      zh: '好友' },
  'مباشر':                     { en: 'Live',      es: 'En vivo',     zh: '直播' },
  'المتصدرين':                 { en: 'Leaders',   es: 'Ranking',     zh: '排行榜' },
  'حسابي':                     { en: 'Profile',   es: 'Perfil',      zh: '我的' },

  // ══════════ اللوبي ══════════
  'الضامة التنافسية':           { en: 'Competitive Checkers', es: 'Damas competitivas', zh: '竞技跳棋' },
  'أتحدى العالم':              { en: 'Challenge the World',  es: 'Desafía al mundo',   zh: '挑战世界' },
  'مباراة سريعة':              { en: 'Quick Match',   es: 'Partida rápida',   zh: '快速对局' },
  'سلسلة المباريات':            { en: 'Match Series',  es: 'Serie de partidas', zh: '系列赛' },
  'تدريب الجنرالات':            { en: 'Generals Training', es: 'Entrenamiento de generales', zh: '将军训练' },
  'العب مع صديق':              { en: 'Play with a Friend', es: 'Jugar con un amigo', zh: '与好友对战' },
  'المتجر':                    { en: 'Store',     es: 'Tienda',      zh: '商店' },
  'إحصائياتك':                 { en: 'Your Stats', es: 'Tus estadísticas', zh: '你的战绩' },
  'فوز':                       { en: 'Wins',      es: 'Victorias',   zh: '胜' },
  'خسارة':                     { en: 'Losses',    es: 'Derrotas',    zh: '负' },
  'تعادل':                     { en: 'Draws',     es: 'Empates',     zh: '平' },
  'المستوى':                   { en: 'Level',     es: 'Nivel',       zh: '等级' },
  'الرهان':                    { en: 'Stake',     es: 'Apuesta',     zh: '投注' },
  'لعب فوري':                  { en: 'Instant Play', es: 'Juego instantáneo', zh: '立即开始' },
  'مشاهدة':                    { en: 'Watch',     es: 'Ver',         zh: '观战' },
  'تدريب':                     { en: 'Training',  es: 'Entrenar',    zh: '训练' },
  'اختيار الميدان':             { en: 'Choose the Field', es: 'Elige el campo', zh: '选择战场' },
  'اشتباك فوري مباشر في الحلبة': { en: 'A direct clash in the arena', es: 'Un choque directo en la arena', zh: '竞技场上的直接对决' },
  'أثبت جدارتك في 7 جولات نارية': { en: 'Prove yourself in 7 fiery rounds', es: 'Demuéstralo en 7 rondas de fuego', zh: '在七轮激战中证明自己' },
  'اصقل مهاراتك ضد أقوى الأنظمة': { en: 'Sharpen your skills against the toughest engines', es: 'Afina tus habilidades contra los motores más duros', zh: '与最强引擎切磋技艺' },
  'ابدأ المعركة':              { en: 'Start the Battle', es: 'Comenzar la batalla', zh: '开始战斗' },
  'ابدأ التدريب':              { en: 'Start Training',   es: 'Comenzar entrenamiento', zh: '开始训练' },
  'اختر الرهان وطريقة اللعب':    { en: 'Choose stake and mode', es: 'Elige apuesta y modo', zh: '选择投注与模式' },
  'اختر مستوى الصعوبة':         { en: 'Choose difficulty', es: 'Elige la dificultad', zh: '选择难度' },
  'طريقة اللعب':               { en: 'Game Mode',  es: 'Modo de juego', zh: '游戏模式' },
  'الفائز يحصل على:':           { en: 'Winner receives:', es: 'El ganador recibe:', zh: '获胜者获得：' },
  'إلغاء':                     { en: 'Cancel',     es: 'Cancelar',    zh: '取消' },
  'دخول التحدي':               { en: 'Enter Challenge', es: 'Entrar al desafío', zh: '进入挑战' },
  'دعوة من قائمة الأصدقاء':      { en: 'Invite from friends list', es: 'Invitar desde amigos', zh: '从好友列表邀请' },
  'إدخال رمز الغرفة':           { en: 'Enter room code', es: 'Introducir código', zh: '输入房间号' },
  'أدخل رمز الغرفة للانضمام':    { en: 'Enter the room code to join', es: 'Introduce el código para unirte', zh: '输入房间号以加入' },
  'رمز الغرفة يتكون من 6 أحرف':  { en: 'Room code is 6 characters', es: 'El código tiene 6 caracteres', zh: '房间号为 6 位' },
  'رصيدك غير كافٍ!':            { en: 'Not enough coins!', es: '¡Monedas insuficientes!', zh: '金币不足！' },
  'المتجر سيكون متاحاً قريباً!':  { en: 'The store is coming soon!', es: '¡La tienda llegará pronto!', zh: '商店即将上线！' },
  'متصل بالإنترنت':             { en: 'Online',     es: 'En línea',    zh: '已连接' },
  'جاري الاتصال...':            { en: 'Connecting...', es: 'Conectando...', zh: '正在连接…' },
  'غير متصل':                   { en: 'Offline',    es: 'Sin conexión', zh: '离线' },
  'مبتدئ':                     { en: 'Beginner',   es: 'Principiante', zh: '新手' },
  'متقدم':                     { en: 'Advanced',   es: 'Avanzado',    zh: '进阶' },
  'خبير':                      { en: 'Expert',     es: 'Experto',     zh: '高手' },
  'أسطورة':                    { en: 'Legend',     es: 'Leyenda',     zh: '传奇' },

  // ══════════ البحث عن منافس ══════════
  'البحث عن منافس':             { en: 'Finding an opponent', es: 'Buscando rival', zh: '正在寻找对手' },
  'جاري البحث عن لاعبين حول العالم...': { en: 'Searching for players worldwide...', es: 'Buscando jugadores en todo el mundo...', zh: '正在全球范围内寻找玩家…' },
  'توسيع نطاق البحث الجغرافي...': { en: 'Widening the search area...', es: 'Ampliando el área de búsqueda...', zh: '正在扩大搜索范围…' },
  'جاري الاتصال بأقرب منافس متاح...': { en: 'Connecting to the closest available opponent...', es: 'Conectando con el rival más cercano...', zh: '正在连接最近的可用对手…' },

  // ══════════ المكافأة اليومية ══════════
  'مكافأة يومية':               { en: 'Daily Reward', es: 'Recompensa diaria', zh: '每日奖励' },
  'عملة مجانية':               { en: 'free coins',  es: 'monedas gratis', zh: '免费金币' },
  'استلام المكافأة 💎':          { en: 'Claim Reward 💎', es: 'Reclamar 💎', zh: '领取奖励 💎' },
  '🎬 شاهد فيديو واحصل على 1500 بدلاً من 500': { en: '🎬 Watch a video and get 1500 instead of 500', es: '🎬 Mira un vídeo y recibe 1500 en vez de 500', zh: '🎬 观看视频，获得 1500（而非 500）' },
  'جاري تحميل الفيديو...':       { en: 'Loading video...', es: 'Cargando vídeo...', zh: '正在加载视频…' },
  'لم يكتمل الفيديو — لم تُمنح المكافأة': { en: 'Video not completed — no reward granted', es: 'Vídeo no completado — sin recompensa', zh: '视频未看完——未发放奖励' },

  // ══════════ الملف الشخصي والإعدادات ══════════
  '⚙️ الإعدادات':               { en: '⚙️ Settings', es: '⚙️ Ajustes',  zh: '⚙️ 设置' },
  'الإشعارات':                 { en: 'Notifications', es: 'Notificaciones', zh: '通知' },
  'تفعيل/تعطيل الإشعارات داخل اللعبة': { en: 'Enable/disable in-game notifications', es: 'Activar/desactivar notificaciones', zh: '开启/关闭游戏内通知' },
  'الخصوصية':                  { en: 'Privacy',    es: 'Privacidad',  zh: '隐私' },
  'إخفاء حالة الاتصال عن الأصدقاء': { en: 'Hide online status from friends', es: 'Ocultar tu estado a los amigos', zh: '对好友隐藏在线状态' },
  'الأصوات':                   { en: 'Sounds',     es: 'Sonidos',     zh: '音效' },
  'مؤثرات الأكل، الحركة، والأنيميشن': { en: 'Capture, move and animation effects', es: 'Efectos de captura, movimiento y animación', zh: '吃子、移动与动画音效' },
  'الاهتزاز':                  { en: 'Vibration',  es: 'Vibración',   zh: '振动' },
  'الاهتزاز عند التنبيهات المهمة': { en: 'Vibrate on important alerts', es: 'Vibrar en alertas importantes', zh: '重要提示时振动' },
  'التحليلات':                 { en: 'Analytics',  es: 'Analíticas',  zh: '数据分析' },
  'مساعدة في تحسين اللعبة (بيانات مجهولة)': { en: 'Help improve the game (anonymous data)', es: 'Ayuda a mejorar el juego (datos anónimos)', zh: '帮助改进游戏（匿名数据）' },
  '🗑️ تسجيل الخروج':            { en: '🗑️ Sign out', es: '🗑️ Cerrar sesión', zh: '🗑️ 退出登录' },

  // ══════════ الخصوصية والبيانات ══════════
  '🛡️ الخصوصية والبيانات':      { en: '🛡️ Privacy & Data', es: '🛡️ Privacidad y datos', zh: '🛡️ 隐私与数据' },
  'سياسة الخصوصية':             { en: 'Privacy Policy', es: 'Política de privacidad', zh: '隐私政策' },
  'ما نجمعه من بيانات وكيف نحميه': { en: 'What we collect and how we protect it', es: 'Qué recogemos y cómo lo protegemos', zh: '我们收集什么以及如何保护' },
  'حذف الحساب والبيانات':        { en: 'Delete Account & Data', es: 'Eliminar cuenta y datos', zh: '删除账号与数据' },
  'اطلب حذف حسابك وجميع بياناتك':  { en: 'Request deletion of your account and all data', es: 'Solicita eliminar tu cuenta y datos', zh: '申请删除你的账号及全部数据' },
  'الدعم والتواصل':             { en: 'Support & Contact', es: 'Soporte y contacto', zh: '支持与联系' },
  'إعدادات خصوصية الإعلانات':    { en: 'Ad Privacy Settings', es: 'Privacidad de anuncios', zh: '广告隐私设置' },
  'تعديل موافقتك على الإعلانات المخصّصة': { en: 'Change your consent for personalized ads', es: 'Cambia tu consentimiento de anuncios', zh: '更改个性化广告同意设置' },
  'تعذّر فتح الرابط — تحقّق من الاتصال': { en: 'Could not open the link — check your connection', es: 'No se pudo abrir el enlace — revisa tu conexión', zh: '无法打开链接——请检查网络' },

  'إلغاء البحث ✕':                { en: 'Cancel search ✕',          es: 'Cancelar búsqueda ✕',       zh: '取消搜索 ✕' },
  'دعوة الأصدقاء (اكسب 1000 💰)':  { en: 'Invite friends (earn 1000 💰)', es: 'Invita amigos (gana 1000 💰)', zh: '邀请好友（赚 1000 💰）' },
  'نسخ':                          { en: 'Copy',                     es: 'Copiar',                    zh: '复制' },
  'تفعيل':                        { en: 'Activate',                 es: 'Activar',                   zh: '激活' },
  '🔴 مباشر':                      { en: '🔴 LIVE',                  es: '🔴 EN VIVO',                zh: '🔴 直播' },
  '← رجوع للمباريات':              { en: '← Back to matches',        es: '← Volver a las partidas',   zh: '← 返回对局列表' },
  '{0} قطعة':                     { en: '{0} pieces',               es: '{0} fichas',                zh: '{0} 枚棋子' },
  'دور {0}':                      { en: '{0} to move',               es: 'Turno de {0}',              zh: '{0} 的回合' },
  '# {0} عالمياً':                { en: '# {0} worldwide',          es: '# {0} mundial',             zh: '全球第 {0} 名' },
  'إغلاق':                        { en: 'Close',                    es: 'Cerrar',                    zh: '关闭' },
  'إلغاء الانتظار':                { en: 'Stop waiting',             es: 'Dejar de esperar',          zh: '停止等待' },
  'إلغاء الدعوة ✕':               { en: 'Cancel invite ✕',          es: 'Cancelar invitación ✕',     zh: '取消邀请 ✕' },
  'تأكيد':                        { en: 'Confirm',                  es: 'Confirmar',                 zh: '确认' },
  'تحدي ⚔️':                      { en: 'Challenge ⚔️',             es: 'Desafiar ⚔️',               zh: '挑战 ⚔️' },
  'دخول الغرفة':                   { en: 'Join room',                es: 'Entrar a la sala',          zh: '加入房间' },
  'رفض ❌':                        { en: 'Decline ❌',                es: 'Rechazar ❌',                zh: '拒绝 ❌' },
  'قبول ✅':                       { en: 'Accept ✅',                 es: 'Aceptar ✅',                 zh: '接受 ✅' },
  'قبول 🤝':                       { en: 'Accept 🤝',                 es: 'Aceptar 🤝',                 zh: '接受 🤝' },
  'لقد حصلت على مكافأتك اليومية لتسجيل الدخول! عد غداً لمزيد من الجوائز.': { en: 'You have claimed your daily login reward! Come back tomorrow for more prizes.', es: '¡Ya has recibido tu recompensa diaria! Vuelve mañana por más premios.', zh: '你已领取今日登录奖励！明天再来领取更多奖励。' },
  'ننتظر عودته... إذا لم يعد سيُعتبر مستسلماً تلقائياً وتفوز بالمباراة 🏆': { en: 'Waiting for them to return... if they do not, they forfeit and you win the match 🏆', es: 'Esperando su regreso... si no vuelve, se rendirá y ganarás la partida 🏆', zh: '正在等待对手返回……若未返回，将判其认输，你将获胜 🏆' },
  '⏱️ {0}ث':                       { en: '⏱️ {0}s',                   es: '⏱️ {0}s',                    zh: '⏱️ {0} 秒' },
  '⚡ تلقائي':                     { en: '⚡ Auto',                   es: '⚡ Automático',              zh: '⚡ 自动' },
  '✅ الأصدقاء ({0})':             { en: '✅ Friends ({0})',          es: '✅ Amigos ({0})',            zh: '✅ 好友（{0}）' },
  '✅ تم القبول!':                 { en: '✅ Accepted!',              es: '✅ ¡Aceptado!',              zh: '✅ 已接受！' },
  '✅ صديقك بالفعل':               { en: '✅ Already your friend',    es: '✅ Ya es tu amigo',          zh: '✅ 已是好友' },
  '🏆 المباراة التالية ({0}-{1})':  { en: '🏆 Next match ({0}-{1})',   es: '🏆 Siguiente partida ({0}-{1})', zh: '🏆 下一局（{0}-{1}）' },
  '🏠 الرئيسية':                   { en: '🏠 Home',                   es: '🏠 Inicio',                  zh: '🏠 主页' },
  '🏳️ استسلام':                    { en: '🏳️ Resign',                 es: '🏳️ Rendirse',                zh: '🏳️ 认输' },
  '👥 إضافة صديق':                 { en: '👥 Add friend',             es: '👥 Añadir amigo',            zh: '👥 添加好友' },
  '📤 صادرة ({0})':                { en: '📤 Sent ({0})',             es: '📤 Enviadas ({0})',          zh: '📤 已发送（{0}）' },
  '🔄 جاري الاتصال...':             { en: '🔄 Connecting...',          es: '🔄 Conectando...',           zh: '🔄 连接中…' },
  '🚫 ترك السلسلة':                { en: '🚫 Leave the series',       es: '🚫 Abandonar la serie',      zh: '🚫 退出系列赛' },
  '🤝 تعادل':                      { en: '🤝 Draw',                   es: '🤝 Empate',                  zh: '🤝 和棋' },
  // ══════════ قوالب بمتغيرات (تُستدعى عبر tf) ══════════
  '👋 طلب صداقة جديد من {0}!':      { en: '👋 New friend request from {0}!',        es: '👋 ¡Nueva solicitud de amistad de {0}!',   zh: '👋 来自 {0} 的新好友请求！' },
  '📨 دعوة لعب من {0}!':            { en: '📨 Game invite from {0}!',                es: '📨 ¡Invitación de partida de {0}!',        zh: '📨 来自 {0} 的对战邀请！' },
  '🌍 تم إيجاد منافس حقيقي: {0}!':  { en: '🌍 Live opponent found: {0}!',            es: '🌍 ¡Rival real encontrado: {0}!',          zh: '🌍 已找到真人对手：{0}！' },
  '{0} قبل طلب صداقتك ✅':          { en: '{0} accepted your friend request ✅',     es: '{0} aceptó tu solicitud de amistad ✅',    zh: '{0} 接受了你的好友请求 ✅' },
  '✅ {0} قبل الدعوة!':             { en: '✅ {0} accepted the invite!',             es: '✅ ¡{0} aceptó la invitación!',            zh: '✅ {0} 接受了邀请！' },
  'يفكر... {0}ث':                   { en: 'Thinking... {0}s',                       es: 'Pensando... {0}s',                        zh: '思考中… {0} 秒' },
  '🏆 ربحت +{0} 💰':                { en: '🏆 You won +{0} 💰',                     es: '🏆 Ganaste +{0} 💰',                      zh: '🏆 你赢得 +{0} 💰' },
  '💔 خسرت {0} 💰':                 { en: '💔 You lost {0} 💰',                     es: '💔 Perdiste {0} 💰',                      zh: '💔 你输掉 {0} 💰' },
  'الرهان الإجمالي: {0} 💰 • {1}/{2}': { en: 'Total stake: {0} 💰 • {1}/{2}',       es: 'Apuesta total: {0} 💰 • {1}/{2}',         zh: '总押注：{0} 💰 • {1}/{2}' },
  'فُز بـ 100 مباراة — لديك {0} انتصار': { en: 'Win 100 matches — you have {0}',    es: 'Gana 100 partidas — tienes {0}',          zh: '赢下 100 局 — 你已有 {0} 胜' },
  'قطعة {0} في صف {1} عمود {2}':    { en: '{0} piece at row {1}, column {2}',        es: 'Ficha {0} en fila {1}, columna {2}',      zh: '{0}棋子，第 {1} 行第 {2} 列' },
  'حرك هنا: صف {0} عمود {1}':       { en: 'Move here: row {0}, column {1}',          es: 'Mover aquí: fila {0}, columna {1}',       zh: '移动到此：第 {0} 行第 {1} 列' },

  // ══════════ اللغة ══════════
  'اللغة':                     { en: 'Language',   es: 'Idioma',      zh: '语言' },
  'اختر اللغة':                 { en: 'Choose language', es: 'Elige el idioma', zh: '选择语言' },

  // ══════════ إكمال الترجمة — احترافي (155 نصاً) ══════════
  '؟': { en: '?', es: '?', zh: '？' },
  'أنت': { en: 'You', es: 'Tú', zh: '你' },
  ' ملك': { en: ' King', es: ' dama', zh: ' 王' },
  'أسرت': { en: 'Captured', es: 'Capturadas', zh: '已吃' },
  'الآن': { en: 'Now', es: 'Ahora', zh: '刚刚' },
  'قطعك': { en: 'Your pieces', es: 'Tus fichas', zh: '你的棋子' },
  'بيضاء': { en: 'white', es: 'blanca', zh: '白' },
  'تحديث': { en: 'Refresh', es: 'Actualizar', zh: '刷新' },
  'تغيير': { en: 'Change', es: 'Cambiar', zh: '更改' },
  'ثانية': { en: 'sec', es: 's', zh: '秒' },
  'سوداء': { en: 'black', es: 'negra', zh: '黑' },
  'لاعب_': { en: 'Player_', es: 'Jugador_', zh: '玩家_' },
  'متوسط': { en: 'Intermediate', es: 'Intermedio', zh: '中级' },
  'مجاني': { en: 'Free', es: 'Gratis', zh: '免费' },
  'منافس': { en: 'Opponent', es: 'Rival', zh: '对手' },
  'هزيمة': { en: 'Defeat', es: 'Derrota', zh: '失败' },
  'انتصار': { en: 'Victory', es: 'Victoria', zh: '胜利' },
  'فوز! 🎉': { en: 'You win! 🎉', es: '¡Victoria! 🎉', zh: '你赢了！🎉' },
  '🟢 متصل': { en: '🟢 Online', es: '🟢 En línea', zh: '🟢 在线' },
  'الرمز: ': { en: 'Code: ', es: 'Código: ', zh: '代码：' },
  'دعوة ⚔️': { en: 'Invite ⚔️', es: 'Invitar ⚔️', zh: '邀请 ⚔️' },
  '✅ مكتمل': { en: '✅ Completed', es: '✅ Completado', zh: '✅ 已完成' },
  '🎯 تدريب': { en: '🎯 Training', es: '🎯 Entrenar', zh: '🎯 训练' },
  '👤 حسابي': { en: '👤 Profile', es: '👤 Perfil', zh: '👤 我的' },
  'منذ ساعة': { en: '1 hour ago', es: 'hace 1 hora', zh: '1 小时前' },
  '💰 الرهان': { en: '💰 Stake', es: '💰 Apuesta', zh: '💰 押注' },
  'الاستسلام': { en: 'Resign', es: 'Rendirse', zh: '认输' },
  'طلب تعادل': { en: 'Offer draw', es: 'Ofrecer empate', zh: '提议和棋' },
  'في مباراة': { en: 'In a match', es: 'En partida', zh: '对战中' },
  'قطع الخصم': { en: 'Opponent pieces', es: 'Fichas del rival', zh: '对手棋子' },
  'متصل الآن': { en: 'Online now', es: 'En línea ahora', zh: '现在在线' },
  'منذ دقائق': { en: 'Minutes ago', es: 'Hace unos minutos', zh: '几分钟前' },
  'اختر دولتك': { en: 'Choose your country', es: 'Elige tu país', zh: '选择你的国家' },
  'اختر صورتك': { en: 'Choose your avatar', es: 'Elige tu avatar', zh: '选择你的头像' },
  'اكتساح تام': { en: 'Perfect sweep', es: 'Barrido perfecto', zh: '完胜' },
  'الفائز هو:': { en: 'Winner:', es: 'Ganador:', zh: '胜者：' },
  'نسبة الفوز': { en: 'Win rate', es: 'Tasa de victorias', zh: '胜率' },
  '⚫ غير متصل': { en: '⚫ Offline', es: '⚫ Desconectado', zh: '⚫ 离线' },
  '🎯 100 تحدي': { en: '🎯 100 challenges', es: '🎯 100 retos', zh: '🎯 100 项挑战' },
  '👥 الأصدقاء': { en: '👥 Friends', es: '👥 Amigos', zh: '👥 好友' },
  '📨 دعوة لعب': { en: '📨 Game invite', es: '📨 Invitación de partida', zh: '📨 对战邀请' },
  'الهدف: 2500': { en: 'Target: 2500', es: 'Meta: 2500', zh: '目标：2500' },
  'رجل المليون': { en: 'Millionaire', es: 'Millonario', zh: '百万富翁' },
  'سيد السلاسل': { en: 'Series master', es: 'Maestro de series', zh: '系列赛大师' },
  'على التحدي.': { en: 'to the challenge.', es: 'al reto.', zh: '接受挑战。' },
  '⚡ وصول سريع': { en: '⚡ Quick access', es: '⚡ Acceso rápido', zh: '⚡ 快速入口' },
  '🎮 في مباراة': { en: '🎮 In a match', es: '🎮 En partida', zh: '🎮 对战中' },
  '🎮 يلعب الآن': { en: '🎮 Playing now', es: '🎮 Jugando ahora', zh: '🎮 正在游戏' },
  '🏆 100 إنجاز': { en: '🏆 100 achievements', es: '🏆 100 logros', zh: '🏆 100 项成就' },
  '🏆 المتصدرين': { en: '🏆 Leaderboard', es: '🏆 Clasificación', zh: '🏆 排行榜' },
  '📊 إحصائياتك': { en: '📊 Your stats', es: '📊 Tus estadísticas', zh: '📊 你的数据' },
  'اقتراح تعادل': { en: 'Offer a draw', es: 'Proponer empate', zh: '提议和棋' },
  'تم رفض الطلب': { en: 'Request declined', es: 'Solicitud rechazada', zh: '请求已被拒绝' },
  'خسرت السلسلة': { en: 'You lost the series', es: 'Perdiste la serie', zh: '你输掉了系列赛' },
  'أسطورة العالم': { en: 'World legend', es: 'Leyenda mundial', zh: '世界传奇' },
  'فزت بالسلسلة!': { en: 'You won the series!', es: '¡Ganaste la serie!', zh: '你赢得了系列赛！' },
  '🎮 طريقة اللعب': { en: '🎮 Game mode', es: '🎮 Modo de juego', zh: '🎮 游戏模式' },
  '👥 لعب مع صديق': { en: '👥 Play with a friend', es: '👥 Jugar con un amigo', zh: '👥 与好友对战' },
  '🔴 وضع offline': { en: '🔴 Offline mode', es: '🔴 Modo sin conexión', zh: '🔴 离线模式' },
  'تم إلغاء الطلب': { en: 'Request cancelled', es: 'Solicitud cancelada', zh: '请求已取消' },
  'دعوة أُرسلت لـ': { en: 'Invite sent to', es: 'Invitación enviada a', zh: '邀请已发送给' },
  'طلب جولة جديدة': { en: 'Request a new round', es: 'Pedir una nueva ronda', zh: '请求新一轮' },
  'مرحباً، أنت! 👋': { en: 'Welcome! 👋', es: '¡Bienvenido! 👋', zh: '欢迎！👋' },
  '⚡ مباراة سريعة': { en: '⚡ Quick match', es: '⚡ Partida rápida', zh: '⚡ 快速对局' },
  'أدخل رمز الغرفة': { en: 'Enter room code', es: 'Introduce el código', zh: '输入房间号' },
  'انتهت المباراة!': { en: 'Match over!', es: '¡Partida terminada!', zh: '对局结束！' },
  '✅ تم نسخ الرمز!': { en: '✅ Code copied!', es: '✅ ¡Código copiado!', zh: '✅ 代码已复制！' },
  'جاري الانضمام...': { en: 'Joining...', es: 'Uniéndose...', zh: '正在加入…' },
  'رفضت طلب التعادل': { en: 'You declined the draw', es: 'Rechazaste el empate', zh: '你拒绝了和棋' },
  'في انتظار موافقة': { en: 'Waiting for approval from', es: 'Esperando la aprobación de', zh: '等待同意：' },
  '❌ الرمز غير صالح': { en: '❌ Invalid code', es: '❌ Código no válido', zh: '❌ 代码无效' },
  '❌ الرمز غير صحيح': { en: '❌ Wrong code', es: '❌ Código incorrecto', zh: '❌ 代码错误' },
  '💰 استرجاع الرهان': { en: '💰 Stake refunded', es: '💰 Apuesta devuelta', zh: '💰 押注已退回' },
  'التحديات المكتملة': { en: 'Completed challenges', es: 'Retos completados', zh: '已完成挑战' },
  'المُدمّر المتسلسل': { en: 'Chain destroyer', es: 'Destructor en cadena', zh: '连环终结者' },
  'خبير اللعب السريع': { en: 'Blitz expert', es: 'Experto en rápidas', zh: '快棋专家' },
  'رصيدك غير كافٍ! ❌': { en: 'Not enough coins! ❌', es: '¡Saldo insuficiente! ❌', zh: '金币不足！❌' },
  'يريد إضافتك كصديق': { en: 'wants to add you as a friend', es: 'quiere añadirte como amigo', zh: '想添加你为好友' },
  '🏆 سلسلة المباريات': { en: '🏆 Match series', es: '🏆 Serie de partidas', zh: '🏆 系列赛' },
  'الإنجازات المكتملة': { en: 'Completed achievements', es: 'Logros completados', zh: '已完成成就' },
  'التقدم والاحترافية': { en: 'Progress & mastery', es: 'Progreso y maestría', zh: '进阶与精通' },
  'ستخسر هذه المباراة': { en: 'You will lose this match', es: 'Perderás esta partida', zh: '你将输掉这一局' },
  'سيرد خلال لحظات...': { en: 'Will reply in a moment...', es: 'Responderá en un momento...', zh: '稍后回复…' },
  'لا يوجد أصدقاء بعد': { en: 'No friends yet', es: 'Aún no tienes amigos', zh: '还没有好友' },
  '📨 تم إرسال الدعوة!': { en: '📨 Invite sent!', es: '📨 ¡Invitación enviada!', zh: '📨 邀请已发送！' },
  'الانسحاب من السلسلة': { en: 'Withdraw from the series', es: 'Retirarse de la serie', zh: '退出系列赛' },
  'الجيش الذي لا يُقهر': { en: 'The unbeatable army', es: 'El ejército invencible', zh: '无敌之师' },
  'الخصم رفض التعادل ❌': { en: 'Opponent declined the draw ❌', es: 'El rival rechazó el empate ❌', zh: '对手拒绝和棋 ❌' },
  'رفضت الجولة التالية': { en: 'You declined the next round', es: 'Rechazaste la siguiente ronda', zh: '你拒绝了下一轮' },
  'فشل الانضمام للغرفة': { en: 'Failed to join the room', es: 'No se pudo unir a la sala', zh: '加入房间失败' },
  'لا توجد طلبات صادرة': { en: 'No outgoing requests', es: 'Sin solicitudes enviadas', zh: '没有发出的请求' },
  'لا توجد طلبات واردة': { en: 'No incoming requests', es: 'Sin solicitudes recibidas', zh: '没有收到的请求' },
  '⏳ انتظار المنافس...': { en: '⏳ Waiting for opponent...', es: '⏳ Esperando al rival...', zh: '⏳ 等待对手…' },
  '⏳ في انتظار الرد...': { en: '⏳ Waiting for a reply...', es: '⏳ Esperando respuesta...', zh: '⏳ 等待回应…' },
  'تم إرسال طلب الصداقة': { en: 'Friend request sent', es: 'Solicitud de amistad enviada', zh: '好友请求已发送' },
  'دعوة صديق من القائمة': { en: 'Invite a friend from the list', es: 'Invitar a un amigo de la lista', zh: '从列表邀请好友' },
  'هل أنت مستعد للتحدي؟': { en: 'Ready for the challenge?', es: '¿Listo para el reto?', zh: '准备好挑战了吗？' },
  '⏳ بانتظار المنافس...': { en: '⏳ Waiting for opponent...', es: '⏳ Esperando al rival...', zh: '⏳ 等待对手…' },
  '⏳ في انتظار الموافقة': { en: '⏳ Waiting for approval', es: '⏳ Esperando aprobación', zh: '⏳ 等待同意' },
  'تم قبول طلب الصداقة ✅': { en: 'Friend request accepted ✅', es: 'Solicitud de amistad aceptada ✅', zh: '好友请求已接受 ✅' },
  'صل إلى تصنيف 2500 ELO': { en: 'Reach a 2500 ELO rating', es: 'Alcanza 2500 de ELO', zh: '达到 2500 ELO 等级分' },
  'البث المباشر للمباريات': { en: 'Live match streaming', es: 'Partidas en directo', zh: '对局直播' },
  'في انتظار رد اللاعب...': { en: 'Waiting for the player...', es: 'Esperando al jugador...', zh: '等待玩家回应…' },
  '⚠️ انقطع اتصال المنافس': { en: '⚠️ Opponent disconnected', es: '⚠️ El rival se desconectó', zh: '⚠️ 对手已断线' },
  '⚡ اتصال مباشر P2P نشط!': { en: '⚡ Direct P2P connection active!', es: '⚡ ¡Conexión P2P directa activa!', zh: '⚡ P2P 直连已启用！' },
  '✅ تم نسخ رمز الإحالة: ': { en: '✅ Referral code copied: ', es: '✅ Código de referido copiado: ', zh: '✅ 推荐码已复制：' },
  '🤝 منافسك يطلب التعادل!': { en: '🤝 Your opponent offers a draw!', es: '🤝 ¡Tu rival propone empate!', zh: '🤝 对手提议和棋！' },
  'جاري تحميل المتصدرين...': { en: 'Loading leaderboard...', es: 'Cargando clasificación...', zh: '正在加载排行榜…' },
  '⚠️ انقطع الاتصال المباشر': { en: '⚠️ Direct connection lost', es: '⚠️ Conexión directa perdida', zh: '⚠️ 直连已中断' },
  'الخصم وافق على التعادل! 🤝': { en: 'Opponent accepted the draw! 🤝', es: '¡El rival aceptó el empate! 🤝', zh: '对手同意和棋！🤝' },
  'قم بأسر 6 قطع بضربة واحدة': { en: 'Capture 6 pieces in a single move', es: 'Captura 6 fichas en un solo movimiento', zh: '一步吃掉 6 枚棋子' },
  '❌ رفض المنافس طلب التعادل': { en: '❌ Opponent declined the draw', es: '❌ El rival rechazó el empate', zh: '❌ 对手拒绝了和棋' },
  '🔑 جاري الانضمام للغرفة...': { en: '🔑 Joining the room...', es: '🔑 Uniéndose a la sala...', zh: '🔑 正在加入房间…' },
  '🟢 متصل — بحث عبر الإنترنت': { en: '🟢 Online — worldwide search', es: '🟢 En línea — búsqueda global', zh: '🟢 在线 — 全球匹配' },
  'تمت إضافة 500 💰 إلى رصيدك!': { en: '500 💰 added to your balance!', es: '¡500 💰 añadidas a tu saldo!', zh: '已向你的余额加入 500 💰！' },
  'طلبنا تأكيد الجولة التالية': { en: 'We requested the next round', es: 'Hemos pedido la siguiente ronda', zh: '已请求下一轮' },
  'قائمة أصدقائك فارغة حالياً': { en: 'Your friends list is empty', es: 'Tu lista de amigos está vacía', zh: '你的好友列表为空' },
  '❌ الرمز يجب أن يكون 6 أحرف': { en: '❌ The code must be 6 characters', es: '❌ El código debe tener 6 caracteres', zh: '❌ 代码必须为 6 位' },
  'أدخل رمز إحالة صديقك هنا...': { en: 'Enter your friend referral code...', es: 'Introduce el código de tu amigo...', zh: '在此输入好友的推荐码…' },
  'تمت إضافة 1500 💰 إلى رصيدك!': { en: '1500 💰 added to your balance!', es: '¡1500 💰 añadidas a tu saldo!', zh: '已向你的余额加入 1500 💰！' },
  '🤝 وافق المنافس على التعادل!': { en: '🤝 Opponent accepted the draw!', es: '🤝 ¡El rival aceptó el empate!', zh: '🤝 对手同意和棋！' },
  '(غير متصل - يعمل محلياً فقط)': { en: '(Offline — local play only)', es: '(Sin conexión — solo local)', zh: '（离线 — 仅本地）' },
  'جاري تحميل باقي الإنجازات...': { en: 'Loading more achievements...', es: 'Cargando más logros...', zh: '正在加载更多成就…' },
  'عرض الـ 93 إنجاز المتبقية...': { en: 'Show the remaining 93 achievements...', es: 'Ver los 93 logros restantes...', zh: '查看其余 93 项成就…' },
  '✅ المنافس متصل (عبر السيرفر)': { en: '✅ Opponent connected (via server)', es: '✅ Rival conectado (vía servidor)', zh: '✅ 对手已连接（通过服务器）' },
  '❌ رفض المنافس الجولة التالية': { en: '❌ Opponent declined the next round', es: '❌ El rival rechazó la siguiente ronda', zh: '❌ 对手拒绝了下一轮' },
  '🎉 تم تفعيل الرمز! +1000 عملة': { en: '🎉 Code activated! +1000 coins', es: '🎉 ¡Código activado! +1000 monedas', zh: '🎉 代码已激活！+1000 金币' },
  'المتجر سيكون متاحاً قريباً! 🛒': { en: 'The store is coming soon! 🛒', es: '¡La tienda llegará pronto! 🛒', zh: '商店即将开放！🛒' },
  '🎁 مكافأة الإحالة: +1000 عملة!': { en: '🎁 Referral bonus: +1000 coins!', es: '🎁 ¡Bono de referido: +1000 monedas!', zh: '🎁 推荐奖励：+1000 金币！' },
  'أدخل الرمز الذي أرسله لك صديقك': { en: 'Enter the code your friend sent you', es: 'Introduce el código que te envió tu amigo', zh: '输入好友发给你的代码' },
  'إنجازات صعبة للغاية (Hardcore)': { en: 'Extremely hard achievements (Hardcore)', es: 'Logros muy difíciles (Hardcore)', zh: '极难成就（硬核）' },
  'سيوافق تلقائياً خلال 5 ثوانٍ ⏳': { en: 'Will auto-accept in 5 seconds ⏳', es: 'Aceptará automáticamente en 5 s ⏳', zh: '5 秒后自动接受 ⏳' },
  'سيتم إرسال اقتراح التعادل للخصم': { en: 'A draw offer will be sent to your opponent', es: 'Se enviará una propuesta de empate al rival', zh: '将向对手发送和棋提议' },
  '⏱️ انتهت مهلة انتظار رد المنافس': { en: '⏱️ Timed out waiting for the opponent', es: '⏱️ Se agotó el tiempo de espera del rival', zh: '⏱️ 等待对手回应超时' },
  '⚠️ انقطع اتصال المنافس بالسيرفر': { en: '⚠️ Opponent lost connection to the server', es: '⚠️ El rival perdió la conexión al servidor', zh: '⚠️ 对手与服务器断开连接' },
  '⚠️ لقد استخدمت رمز إحالة من قبل': { en: '⚠️ You have already used a referral code', es: '⚠️ Ya has usado un código de referido', zh: '⚠️ 你已使用过推荐码' },
  'جاري تحضير بث جديد من البداية...': { en: 'Preparing a new stream from the start...', es: 'Preparando una nueva transmisión...', zh: '正在准备新的直播…' },
  '🏆 انسحب المنافس، فوز بالاستسلام!': { en: '🏆 Opponent withdrew — win by resignation!', es: '🏆 El rival se retiró — ¡victoria por rendición!', zh: '🏆 对手退出 — 认输获胜！' },
  '🔄 المنافس يطلب المباراة التالية!': { en: '🔄 Opponent requests the next match!', es: '🔄 ¡El rival pide la siguiente partida!', zh: '🔄 对手请求下一局！' },
  '🤝 تم إرسال طلب التعادل للمنافس...': { en: '🤝 Draw offer sent to your opponent...', es: '🤝 Propuesta de empate enviada al rival...', zh: '🤝 和棋提议已发送给对手…' },
  'أرسل هذا الرمز لصديقك ليدخل الغرفة': { en: 'Send this code to your friend so they can join the room', es: 'Envía este código a tu amigo para que entre a la sala', zh: '把此代码发给好友以加入房间' },
  'اجمع 1,000,000 عملة ذهبية في رصيدك': { en: 'Collect 1,000,000 gold coins', es: 'Acumula 1.000.000 de monedas de oro', zh: '累积 1,000,000 金币' },
  'ستخسر السلسلة بالكامل وتفقد الرهان': { en: 'You will lose the entire series and your stake', es: 'Perderás toda la serie y la apuesta', zh: '你将输掉整个系列赛与押注' },
  'فُز بـ 10 مباريات خلال أول دقيقتين': { en: 'Win 10 matches within the first two minutes', es: 'Gana 10 partidas en los dos primeros minutos', zh: '在前两分钟内赢下 10 局' },
  'فُز بـ 50 سلسلة مباريات بنتيجة 4-0': { en: 'Win 50 series by 4-0', es: 'Gana 50 series por 4-0', zh: '以 4-0 赢下 50 个系列赛' },
  'منافسك يعرض إنهاء المباراة بالتعادل': { en: 'Your opponent offers to end the match in a draw', es: 'Tu rival propone terminar la partida en empate', zh: '对手提议以和棋结束对局' },
  '💔 خسرت السلسلة! الرهان ذهب للمنافس.': { en: '💔 You lost the series! The stake went to your opponent.', es: '💔 ¡Perdiste la serie! La apuesta fue para el rival.', zh: '💔 你输掉了系列赛！押注归对手。' },
  'شارك الرمز أو ادعُ صديقاً من القائمة': { en: 'Share the code or invite a friend from the list', es: 'Comparte el código o invita a un amigo de la lista', zh: '分享代码或从列表邀请好友' },
  '✅ وافق المنافس، بدأت الجولة التالية!': { en: '✅ Opponent accepted — the next round has started!', es: '✅ El rival aceptó — ¡comienza la siguiente ronda!', zh: '✅ 对手已同意，下一轮开始！' },
  '⚠️ تم رفض حركة غير قانونية من المنافس': { en: '⚠️ An illegal move from the opponent was rejected', es: '⚠️ Se rechazó un movimiento ilegal del rival', zh: '⚠️ 已拒绝对手的非法走子' },
  'فُز بمباراة دون أن تفقد أي قطعة من قطعك': { en: 'Win a match without losing a single piece', es: 'Gana una partida sin perder ninguna ficha', zh: '不失一子赢下一局' },
  '⏳ بانتظار موافقة المنافس على الجولة التالية...': { en: '⏳ Waiting for the opponent to accept the next round...', es: '⏳ Esperando que el rival acepte la siguiente ronda...', zh: '⏳ 等待对手同意下一轮…' },
  'قسم التحديات اليومية والأسبوعية يفتح في التحديث القادم': { en: 'Daily and weekly challenges arrive in the next update', es: 'Los retos diarios y semanales llegan en la próxima actualización', zh: '每日与每周挑战将在下次更新开放' },
  'شارك رمزك مع أصدقائك، وعندما يسجلون به ستحصلان معاً على 1000 عملة ذهبية!': { en: 'Share your code with friends — when they sign up with it, you both get 1000 gold coins!', es: '¡Comparte tu código con tus amigos: cuando se registren con él, ambos recibiréis 1000 monedas de oro!', zh: '把你的代码分享给好友 — 他们用它注册后，你们双方各得 1000 金币！' },
};

/** الترجمة: تُعيد النص العربي كما هو إن كانت اللغة عربية أو لا ترجمة له. */
export function t(ar: string): string {
  if (current === 'ar') return ar;
  const row = DICT[ar];
  if (!row) return ar;
  return row[current] ?? ar;
}


/** ترجمة قالب بمتغيرات: tf('يفكر... {0}ث', timer) */
export function tf(ar: string, ...args: (string | number | undefined | null)[]): string {
  return t(ar).replace(/\{(\d+)\}/g, (_m, i) => String(args[Number(i)] ?? ''));
}



/** عنوان الصفحة بحسب اللغة (يظهر في تبويب المتصفح وفي مشاركة الرابط). */
const TITLES: Record<Lang, string> = {
  ar: '🎮 Dama Tahiro | الضامة التنافسية',
  en: '🎮 Dama Tahiro | Competitive Spanish Checkers',
  es: '🎮 Dama Tahiro | Damas españolas competitivas',
  zh: '🎮 Dama Tahiro | 竞技西班牙跳棋',
};

/** لغة تنسيق الأرقام لكل لغة — أرقام لاتينية دائماً وفواصل بعرف كل لغة. */
const NUM_LOCALE: Record<Lang, string> = {
  ar: 'ar-MA',   // 1.234.567 — عرف المغرب والمغرب العربي (أرقام لاتينية)
  en: 'en-US',   // 1,234,567
  es: 'es-ES',   // 1.234.567
  zh: 'zh-CN',   // 1,234,567
};

/** تنسيق رقم بحسب اللغة المختارة — لا بحسب لغة الجهاز. */
export function fmtNum(n: number): string {
  try { return n.toLocaleString(NUM_LOCALE[current]); }
  catch { return String(n); }
}

/** لتشخيص التغطية أثناء التطوير. */
export function dictSize(): number { return Object.keys(DICT).length; }

applyDocument();
