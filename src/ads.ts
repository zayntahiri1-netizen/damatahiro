// ╔══════════════════════════════════════════════════════════════════════╗
//  DAMA TAHIRO — AD MANAGER  (AdMob + UMP consent)
//
//  المبادئ التي بُنيت عليها هذه الوحدة:
//   1) لا تعطّل اللعبة أبداً: كل استدعاء أصلي محاط بـ try/catch، وأي فشل
//      يعني «لا إعلان» فقط — لا شاشة بيضاء ولا استثناء يصل إلى React.
//   2) الويب غير متأثر: حزمة AdMob تُحمَّل ديناميكياً على الأجهزة فقط،
//      فبناء الويب (dist/index.html) يعمل كما هو.
//   3) الامتثال أولاً: لا يُطلب أي إعلان قبل حلّ الموافقة (UMP).
//      أوروبا/المملكة المتحدة تُعرض لها النافذة، وباقي الدول تُتخطّى تلقائياً.
//   4) البانر لا يغطّي شيئاً: نُبلّغ التطبيق بارتفاعه ليحجز له مساحة،
//      ولا يُعرض إطلاقاً على شاشة الرقعة.
//   5) الإعلان البيني مقيَّد بسقوف صارمة (انظر الثوابت أدناه).
// ╚══════════════════════════════════════════════════════════════════════╝

import { Capacitor } from '@capacitor/core';

// ── معرّفات الوحدات الإعلانية (Dama Tahiro) ───────────────────────────
// App ID (يُحقن في AndroidManifest عبر scripts/prepare-android.py):
//   ca-app-pub-1725525147318224~1156717263
const AD_IDS = {
  banner:       'ca-app-pub-1725525147318224/4118042662',
  interstitial: 'ca-app-pub-1725525147318224/2070609617',
  rewarded:     'ca-app-pub-1725525147318224/4712818891',
};

// ── الشاشات المسموح فيها بالبانر ──────────────────────────────────────
// شاشة 'game' و 'training' و 'live' مستثناة: الرقعة تشغل الشاشة،
// والسحب قرب الحافة السفلية يولّد نقرات عرضية (أخطر مخالفة في AdMob).
const BANNER_SCREENS = ['home', 'friends', 'leaderboard', 'profile'];

// ── إعلانات تجريبية ──
// تُفعَّل تلقائياً في بناء APK التجريبي (VITE_TEST_ADS=1) وتُطفأ في نسخة الإصدار.
// ضرورية أثناء التطوير: النقر على إعلاناتك الحقيقية = «حركة مرور غير صالحة»
// وقد يؤدي إلى تعليق حساب AdMob. كما أن تطبيقاً جديداً قد لا يتلقّى إعلانات
// حقيقية لساعات، فالإعلان التجريبي هو الطريقة الوحيدة للتأكد أن التكامل يعمل.
const TEST_ADS: boolean = (() => {
  try { return String((import.meta as any)?.env?.VITE_TEST_ADS ?? '') === '1'; }
  catch { return false; }
})();

// ── سقوف الإعلان البيني ───────────────────────────────────────────────
const INT_EVERY_N_MATCHES = 3;        // مرة كل 3 مباريات
const INT_MIN_GAP_MS      = 120_000;  // وبفارق دقيقتين على الأقل
const INT_GRACE_MS        = 90_000;   // ولا شيء في أول 90ث من الجلسة

// ── حالة داخلية ───────────────────────────────────────────────────────
let admob: any = null;
let events: { bannerSizeChanged?: string; rewarded?: string } = {};
let initStarted = false;
let ready = false;              // مُهيّأ + الموافقة محلولة + يُسمح بطلب إعلانات
let privacyRequired = false;    // هل يحتاج المستخدم زر «إعدادات الخصوصية»؟
let bannerCreated = false;
let bannerShown = false;
let heightCb: ((h: number) => void) | null = null;
let lastInterstitialAt = 0;
let matchesSinceInt = 0;
let sessionStart = Date.now();
let pendingScreen: string | null = null;

// ── مساعدات ───────────────────────────────────────────────────────────

export function isNative(): boolean {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

export function adsReady(): boolean { return ready; }

export function privacyOptionsRequired(): boolean { return privacyRequired; }

/** يُسجّل دالة تُستدعى بارتفاع البانر (0 = مخفي) لحجز مساحة له. */
export function onBannerHeight(cb: (h: number) => void): void {
  heightCb = cb;
}

function reportHeight(h: number) {
  try { heightCb?.(h > 0 ? Math.round(h) : 0); } catch { /* ignore */ }
}

/** هل يُسمح بطلب الإعلانات؟ متوافق مع اختلاف إصدارات الحزمة. */
function canRequestAds(info: any): boolean {
  if (typeof info?.canRequestAds === 'boolean') return info.canRequestAds;
  const s = String(info?.status ?? '');
  return s === 'NOT_REQUIRED' || s === 'OBTAINED';
}

/** المستخدم داخل نطاق منظَّم (أوروبا/المملكة المتحدة) ⇒ يحتاج زر إدارة الخصوصية. */
function needsPrivacyButton(info: any): boolean {
  const p = String(info?.privacyOptionsRequirementStatus ?? '');
  if (p === 'REQUIRED') return true;
  if (p === 'NOT_REQUIRED') return false;
  const s = String(info?.status ?? '');
  return s === 'REQUIRED' || s === 'OBTAINED';
}

// ── التهيئة + الموافقة ────────────────────────────────────────────────

export async function initAds(): Promise<void> {
  if (initStarted || !isNative()) return;
  initStarted = true;
  sessionStart = Date.now();

  try {
    const mod: any = await import('@capacitor-community/admob');
    admob = mod?.AdMob ?? null;
    if (!admob) return;

    // أسماء الأحداث من الحزمة نفسها — لا تخمين لنصوصها
    events.bannerSizeChanged = mod?.BannerAdPluginEvents?.SizeChanged;
    events.rewarded          = mod?.RewardAdPluginEvents?.Rewarded;

    await admob.initialize({ initializeForTesting: false });

    // ── UMP: يجب أن يسبق أي طلب إعلان ──
    let info: any = {};
    try {
      info = await admob.requestConsentInfo();
      if (info?.isConsentFormAvailable && String(info?.status) === 'REQUIRED') {
        const after = await admob.showConsentForm();
        if (after) info = { ...info, ...after };
      }
    } catch {
      // فشل قياس الموافقة ⇒ نتوقّف بأمان: لا إعلانات إطلاقاً
      ready = false;
      return;
    }

    privacyRequired = needsPrivacyButton(info);
    ready = canRequestAds(info);
    if (!ready) return;

    // مراقبة ارتفاع البانر لحجز مساحته في الواجهة
    if (events.bannerSizeChanged) {
      try {
        await admob.addListener(events.bannerSizeChanged, (size: any) => {
          reportHeight(Number(size?.height ?? 0));
        });
      } catch { /* ignore */ }
    }

    // إن طُلب عرض بانر قبل جهوزية التهيئة، نفّذه الآن
    if (pendingScreen) {
      const s = pendingScreen; pendingScreen = null;
      void showBannerFor(s);
    }
  } catch {
    ready = false;
  }
}

/** يفتح نافذة إدارة الخصوصية (زر الملف الشخصي). */
export async function openPrivacyOptions(): Promise<boolean> {
  if (!admob) return false;
  try { await admob.showPrivacyOptionsForm(); return true; }
  catch { return false; }
}

// ── البانر ────────────────────────────────────────────────────────────

export async function showBannerFor(screen: string): Promise<void> {
  if (!BANNER_SCREENS.includes(screen)) { await hideBanner(); return; }
  if (!isNative()) return;
  if (!ready || !admob) { pendingScreen = screen; return; }
  if (bannerShown) return;

  try {
    if (bannerCreated) {
      try { await admob.resumeBanner(); }
      catch {
        await admob.showBanner({
          adId: AD_IDS.banner, adSize: 'ADAPTIVE_BANNER',
          position: 'BOTTOM_CENTER', margin: 0, isTesting: TEST_ADS,
        });
      }
    } else {
      await admob.showBanner({
        adId: AD_IDS.banner, adSize: 'ADAPTIVE_BANNER',
        position: 'BOTTOM_CENTER', margin: 0, isTesting: TEST_ADS,
      });
      bannerCreated = true;
    }
    bannerShown = true;
  } catch {
    bannerShown = false;
    reportHeight(0);
  }
}

export async function hideBanner(): Promise<void> {
  reportHeight(0);           // نُحرّر المساحة فوراً قبل أي عملية أصلية
  if (!admob || !bannerShown) { bannerShown = false; return; }
  bannerShown = false;
  try { await admob.hideBanner(); } catch { /* ignore */ }
}

// ── الإعلان البيني ────────────────────────────────────────────────────

/**
 * يُستدعى عند مغادرة المباراة إلى الرئيسية — نقطة التوقف الطبيعية الوحيدة.
 * لا يُعرض أثناء اللعب، ولا في التدريب أو المشاهدة، ولا خارج السقوف.
 */
export async function maybeShowInterstitial(mode: string): Promise<void> {
  if (!ready || !admob) return;
  if (mode === 'training' || mode === 'watch') return;

  matchesSinceInt++;
  const now = Date.now();
  if (now - sessionStart   < INT_GRACE_MS)   return;
  if (matchesSinceInt      < INT_EVERY_N_MATCHES) return;
  if (now - lastInterstitialAt < INT_MIN_GAP_MS)  return;

  try {
    await admob.prepareInterstitial({ adId: AD_IDS.interstitial, isTesting: TEST_ADS });
    await admob.showInterstitial();
    lastInterstitialAt = Date.now();
    matchesSinceInt = 0;
  } catch { /* لا إعلان جاهز — نتجاهل بهدوء */ }
}

// ── الإعلان بمكافأة ───────────────────────────────────────────────────

/**
 * إعلان اختياري بمكافأة. يُرجع true فقط إذا اكتمل فعلاً —
 * الإغلاق المبكر لا يمنح شيئاً (شرط سياسة AdMob).
 */
export async function showRewarded(): Promise<boolean> {
  if (!ready || !admob) return false;

  let earned = false;
  let sub: any = null;
  try {
    if (events.rewarded) {
      try {
        sub = await admob.addListener(events.rewarded, (item: any) => {
          if (item) earned = true;
        });
      } catch { /* ignore */ }
    }
    await admob.prepareRewardVideoAd({ adId: AD_IDS.rewarded, isTesting: TEST_ADS });
    const item: any = await admob.showRewardVideoAd();
    if (item && (item.amount !== undefined || item.type !== undefined)) earned = true;
  } catch {
    /* فشل التحميل أو أُغلق مبكراً */
  } finally {
    try { await sub?.remove?.(); } catch { /* ignore */ }
  }
  return earned;
}

/** هل يستحق عرض زر «شاهد إعلاناً»؟ (لا نُظهر زراً لا يعمل) */
/** هل البناء الحالي يستعمل إعلانات تجريبية؟ (للتشخيص) */
export function usingTestAds(): boolean { return TEST_ADS; }

export function rewardedAvailable(): boolean {
  return ready && !!admob;
}
