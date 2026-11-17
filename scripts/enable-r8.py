#!/usr/bin/env python3
"""
يُفعّل R8 (تصغير وتعتيم الرموز) في بناء الإصدار، بقواعد تُبقي Capacitor حيّاً.

لماذا؟
  لوحة Play تُظهر «تحسين رمز DEX» بثلاث نسب فارغة (-) لأن التصغير مطفأ.
  وGoogle حدّدت فبراير 2027 موعداً لمتطلبات جودة تتعلّق بالذاكرة والرموز.
  R8 يقلّص الحزمة ويُسرّع التحميل ويُعتّم الأسماء.

⚠ الخطر الحقيقي في تطبيقات Capacitor:
  إضافات Capacitor لا تُستدعى مباشرةً — تُكتشف بالانعكاس عبر تعليقاتها.
  وR8 في «الوضع الكامل» (الافتراضي منذ AGP 8) يحذف أنواع التعليقات نفسها
  لأن لا أحد يستعملها ظاهرياً. فتعود getPluginAnnotation() بـnull، ويطويها
  R8 ثابتاً، فيصير Bridge.getPermissionStates() رمياً لـnull — والنتيجة
  انهيارٌ عند أول فحص أذونات، لا عند البناء.

  قواعد Capacitor المشحونة تحفظ أصناف الإضافات، لكنها **لا تحفظ أنواع
  التعليقات**. ولهذا نضيفها هنا صراحةً. (أُصلح هذا في Capacitor 8.6.0،
  وهذا المشروع على 7، فالقاعدة ضرورية لا احتياطية.)

ملاحظة على AGP:
  لوحة Play تنصح بـAGP 9. لا نفعل: AGP 9 يكسر بناء إضافات Capacitor،
  وهو توصية لا شرط. النسب الثلاث تتحرّك بـR8 وحده على AGP 8.

الاستعمال:
  python3 scripts/enable-r8.py              # يفعّل
  python3 scripts/enable-r8.py --verify-only
"""
import argparse
import pathlib
import re
import sys

RULES = r"""# ══════════════════════════════════════════════════════════════════
#  قواعد R8 — مُولَّدة من scripts/enable-r8.py (لا تُحرَّر يدوياً)
# ══════════════════════════════════════════════════════════════════

# ── Capacitor: الاكتشاف بالانعكاس ─────────────────────────────────
# الإضافات تُعثر عليها عبر تعليقاتها، فحذفُها يعني إضافةً لا تُسجَّل.
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * { *; }
-keep public class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod public <methods>;
}

# ⚠ أنواع التعليقات نفسها — أهم أربعة أسطر في هذا الملف.
#   بدونها: انهيار عند أول checkPermissions()/requestPermissions().
#   (راجع ionic-team/capacitor#8589)
-keep @interface com.getcapacitor.annotation.** { *; }
-keep @interface com.getcapacitor.PluginMethod { *; }
-keep @interface com.getcapacitor.NativePlugin { *; }
-keep class com.getcapacitor.PluginHandle { *; }

# التعليقات يجب أن تبقى مقروءة في وقت التشغيل
-keepattributes *Annotation*
-keepattributes RuntimeVisibleAnnotations
-keepattributes RuntimeVisibleParameterAnnotations
-keepattributes AnnotationDefault

# ── جسور JavaScript ───────────────────────────────────────────────
# ما يُستدعى من WebView لا يراه R8 مستعمَلاً.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ── تتبّعات مقروءة في Play Console ───────────────────────────────
# بدونها تصل تقارير الأعطال بأسماء مُعتَّمة لا تُفيد.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ── ما يُشار إليه من المانيفست ────────────────────────────────────
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Application
-keep public class * extends android.content.ContentProvider
-keep public class * extends android.app.Service
-keep public class * extends android.content.BroadcastReceiver

# ── AndroidX / WebView ────────────────────────────────────────────
-keep class androidx.webkit.** { *; }
-dontwarn androidx.webkit.**

# حزمة إعلانات جوجل تشحن قواعدها الخاصة؛ لا نضيف شيئاً هنا حتى لا
# نُخفي مشكلةً حقيقية. إن اشتكى البناء من أصناف ناقصة فالتقرير في:
#   android/app/build/outputs/mapping/release/missing_rules.txt
"""

MARK = "مُولَّدة من scripts/enable-r8.py"


def android_block_span(src: str):
    """يُرجع (بداية جسم android{, نهايته) بمطابقة الأقواس."""
    m = re.search(r"^android\s*\{", src, re.M)
    if not m:
        return None
    start = m.end() - 1
    depth = 0
    for i in range(start, len(src)):
        if src[i] == "{":
            depth += 1
        elif src[i] == "}":
            depth -= 1
            if depth == 0:
                return (start + 1, i)
    return None


def release_block_span(src: str):
    """يُرجع (بداية جسم release{, نهايته) داخل buildTypes."""
    span = android_block_span(src)
    if not span:
        return None
    body_start, body_end = span
    bt = re.search(r"^\s*buildTypes\s*\{", src[body_start:body_end], re.M)
    if not bt:
        return None
    off = body_start + bt.end() - 1
    depth = 0
    bt_end = None
    for i in range(off, body_end + 1):
        if src[i] == "{":
            depth += 1
        elif src[i] == "}":
            depth -= 1
            if depth == 0:
                bt_end = i
                break
    if bt_end is None:
        return None
    rel = re.search(r"^\s*release\s*\{", src[off:bt_end], re.M)
    if not rel:
        return None
    roff = off + rel.end() - 1
    depth = 0
    for i in range(roff, bt_end + 1):
        if src[i] == "{":
            depth += 1
        elif src[i] == "}":
            depth -= 1
            if depth == 0:
                return (roff + 1, i)
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--gradle", default="android/app/build.gradle")
    ap.add_argument("--rules", default="android/app/proguard-rules.pro")
    ap.add_argument("--verify-only", action="store_true")
    a = ap.parse_args()

    g = pathlib.Path(a.gradle)
    r = pathlib.Path(a.rules)
    if not g.exists():
        sys.exit(f"لم يُعثر على {g}")

    src = g.read_text()
    span = release_block_span(src)
    if not span:
        sys.exit("لم يُعثر على buildTypes.release داخل android{} — تغيّرت بنية build.gradle")
    rs, re_ = span
    body = src[rs:re_]

    minify_on = re.search(r"minifyEnabled\s+true", body) is not None
    optimize_on = "proguard-android-optimize.txt" in body
    rules_ok = r.exists() and MARK in r.read_text()

    if a.verify_only:
        problems = []
        if not minify_on:
            problems.append("minifyEnabled ليس true في release")
        if not optimize_on:
            problems.append("ما زال يستعمل proguard-android.txt (فيه -dontoptimize)")
        if not rules_ok:
            problems.append("proguard-rules.pro ليس ملفنا المُولَّد")
        if problems:
            for p in problems:
                print("✘ " + p)
            sys.exit(1)
        print("✔ R8 مفعّل، وقواعد Capacitor في مكانها")
        return

    # ── قواعد الحفظ ──
    r.parent.mkdir(parents=True, exist_ok=True)
    r.write_text(RULES)
    print(f"✔ كُتبت {r}")

    # ── تفعيل التصغير ──
    new_body = body
    if re.search(r"minifyEnabled\s+(true|false)", new_body):
        new_body = re.sub(r"minifyEnabled\s+(true|false)", "minifyEnabled true", new_body, count=1)
    else:
        new_body = "\n            minifyEnabled true" + new_body

    # proguard-android.txt فيه -dontoptimize فيُبطل معظم التحسين
    if "proguard-android-optimize.txt" not in new_body:
        if "proguard-android.txt" in new_body:
            new_body = new_body.replace("proguard-android.txt", "proguard-android-optimize.txt")
        else:
            new_body += ("            proguardFiles getDefaultProguardFile("
                         "'proguard-android-optimize.txt'), 'proguard-rules.pro'\n")

    if new_body == body:
        print("build.gradle مضبوط سلفاً — تخطٍّ")
        return

    out = src[:rs] + new_body + src[re_:]

    # فحص سلامة: الأقواس متوازنة وما زال release قابلاً للعثور
    if out.count("{") != src.count("{") or out.count("}") != src.count("}"):
        sys.exit("✘ اختلّ توازن الأقواس — أُلغي التعديل")
    if not release_block_span(out):
        sys.exit("✘ تعذّر العثور على release بعد التعديل — أُلغي التعديل")

    g.write_text(out)
    print("✔ minifyEnabled true + proguard-android-optimize.txt")


if __name__ == "__main__":
    main()
