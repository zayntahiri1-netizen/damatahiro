#!/usr/bin/env python3
"""
يتحقّق من البناء الناتج في dist/ قبل حزمه في التطبيق.

ثلاثة شروط يسهل أن تُنتقَض بصمت:

  1) ملفٌ واحد.
     Capacitor يحمّل dist/ كأصول التطبيق، و vite-plugin-singlefile يدمج
     كل شيء في index.html. لو خرج ملف .js أو .css منفصل فقد تُنسى نسخته
     أو يفشل تحميله، فتُفتح اللعبة على شاشة بيضاء. البناء الذي «نجح»
     وأخرج ملفين ليس نجاحاً.

  2) خيط المحرّك مُدمج.
     ai.ts يستورد الخيط بـ ?worker&inline ليُدمَج في نفس الملف. لو خرج
     الخيط ملفاً منفصلاً لفشل إنشاؤه على الجهاز — واللعبة ستعمل (الوسيط
     يرتدّ إلى الخيط الرئيسي) لكنها ستتجمّد كما كانت، والعيب لن يُلاحَظ
     إلا من شكوى مستخدم. هذا الفحص يُلاحظه قبله.

  3) الحجم معقول.
     ارتفاع مفاجئ يعني أن شيئاً كبيراً تسرّب إلى الحزمة.

الخروج بـ1 عند أي خلل، ليُفشل البناء في GitHub Actions.
"""
import argparse
import pathlib
import re
import sys

# الحدّ الأقصى: الحزمة اليوم ~1.5 ميغابايت بعد دمج الخيط. السقف فضفاض
# عن قصد — نريد إنذاراً عند تسرّب كبير، لا إزعاجاً عند نموّ طبيعي.
MAX_MB = 8.0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dist", default="dist")
    a = ap.parse_args()

    dist = pathlib.Path(a.dist)
    index = dist / "index.html"
    errors: list[str] = []

    if not index.exists():
        sys.exit(f"✘ لم يُعثر على {index} — لم يكتمل البناء")

    html = index.read_text(encoding="utf-8", errors="replace")
    size_mb = index.stat().st_size / 1_048_576

    # 1) ملفٌ واحد: لا .js ولا .css منفصل
    stray = sorted(
        p.relative_to(dist).as_posix()
        for p in dist.rglob("*")
        if p.is_file() and p.suffix.lower() in {".js", ".mjs", ".cjs", ".css"}
    )
    if stray:
        errors.append(
            "خرجت ملفات منفصلة بدل الدمج في index.html: " + ", ".join(stray[:8])
        )

    # 2) خيط المحرّك: يُنشأ من Blob أو data URI داخل الملف نفسه
    worker_inlined = bool(re.search(r"new\s+Worker\s*\(", html))
    worker_external = bool(re.search(r"new\s+Worker\s*\(\s*['\"][^'\"]*\.js", html))
    if not worker_inlined:
        errors.append(
            "لا إنشاء Worker في الحزمة — إمّا حُذف الاستيراد أو أسقطه البناء، "
            "فالمحرّك سيعمل في الخيط الرئيسي وتتجمّد الواجهة"
        )
    elif worker_external:
        errors.append(
            "الخيط يُحمَّل من ملف .js خارجي لا من داخل الحزمة — "
            "سيفشل إنشاؤه على الجهاز (راجع ?worker&inline في src/ai.ts)"
        )

    # 3) الحجم
    if size_mb > MAX_MB:
        errors.append(f"الحزمة {size_mb:.1f} ميغابايت — فوق السقف {MAX_MB}")

    others = sorted(
        p.relative_to(dist).as_posix()
        for p in dist.rglob("*") if p.is_file() and p.name != "index.html"
    )
    print(f"الحزمة: index.html — {size_mb:.2f} ميغابايت")
    print(f"خيط المحرّك: {'مُدمج ✔' if worker_inlined and not worker_external else 'غير مُدمج ✘'}")
    if others:
        print(f"ملفات أخرى في dist ({len(others)}): " + ", ".join(others[:8]))

    if errors:
        print(f"\n✘ {len(errors)} مشكلة:")
        for e in errors:
            print("   " + e)
        sys.exit(1)

    print("\n✔ ملف واحد، الخيط مُدمج فيه، والحجم في الحدّ")


if __name__ == "__main__":
    main()
