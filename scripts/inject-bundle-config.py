#!/usr/bin/env python3
"""
يحقن كتلة bundle{} في android/app/build.gradle لتعطيل الحزم المرافقة (splits).

لماذا؟
  عند بناء AAB يقسّم Google Play التطبيق إلى: حزمة أساس + حزم مرافقة
  (لغة / كثافة شاشة / معمارية المعالج). إذا وصل الجهاز حزمةَ الأساس وحدها —
  بعد استعادة نسخة احتياطية، أو نقل بين جهازين، أو تنزيل ناقص، أو مدير
  تطبيقات صارم — يعتبر النظام التثبيت ناقصاً ويمنع فتح التطبيق بنافذة
  "Something went wrong / Check that Google Play is enabled...".

المنطق:
  بتعطيل الأنواع الثلاثة لا تُولَّد حزم مرافقة أصلاً، فيستحيل أن تنقص واحدة،
  والشرط الذي يُطلق النافذة لا يتحقق أبداً.

الثمن:
  حجم تنزيل أكبر قليلاً (كل اللغات والكثافات والمعماريات في ملف واحد).
  لتطبيق بحجم ~4 ميغابايت هذا مقبول تماماً مقابل ضمان الفتح.
"""
import argparse
import pathlib
import re
import sys

BUNDLE_BLOCK = """    // تعطيل الحزم المرافقة: يضمن ألا يُعتبر التثبيت ناقصاً أبداً
    // (راجع scripts/inject-bundle-config.py للتفاصيل)
    bundle {
        language { enableSplit = false }
        density  { enableSplit = false }
        abi      { enableSplit = false }
    }
"""


def android_block_span(src: str):
    """يُرجع (بداية جسم android{, نهايته) بمطابقة الأقواس."""
    m = re.search(r"^android\s*\{", src, re.M)
    if not m:
        return None
    start = m.end() - 1          # موضع '{'
    depth = 0
    for i in range(start, len(src)):
        if src[i] == "{":
            depth += 1
        elif src[i] == "}":
            depth -= 1
            if depth == 0:
                return (start + 1, i)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gradle", default="android/app/build.gradle")
    ap.add_argument("--verify-only", action="store_true",
                    help="يتحقق فقط ولا يعدّل — يفشل إن لم تكن الكتلة موجودة")
    a = ap.parse_args()

    p = pathlib.Path(a.gradle)
    if not p.exists():
        sys.exit(f"لم يُعثر على {p}")
    src = p.read_text()

    span = android_block_span(src)
    if not span:
        sys.exit(f"لم يُعثر على كتلة android {{ }} في {p}")
    body_start, body_end = span
    body = src[body_start:body_end]

    # هل الكتلة موجودة سلفاً داخل android{} ؟ (تشغيل متكرر لا يُكرّرها)
    already = re.search(r"^\s*bundle\s*\{", body, re.M) is not None

    if a.verify_only:
        if not already:
            sys.exit("✘ كتلة bundle{} غير موجودة — الحزم المرافقة ما زالت مفعّلة")
        for kind in ("language", "density", "abi"):
            if not re.search(rf"{kind}\s*\{{\s*enableSplit\s*=\s*false", body):
                sys.exit(f"✘ {kind} غير معطّل في كتلة bundle{{}}")
        print("✔ الحزم المرافقة معطّلة (language + density + abi)")
        return

    if already:
        print("كتلة bundle{} موجودة سلفاً — تخطٍّ")
        return

    # نُدرج قبل buildTypes إن وُجد، وإلا في نهاية جسم android{}
    anchor = re.search(r"^\s*buildTypes\s*\{", body, re.M)
    if anchor:
        at = body_start + anchor.start()
    else:
        at = body_end
        if not src[:at].endswith("\n"):
            at = src.rindex("\n", 0, body_end) + 1

    new = src[:at] + BUNDLE_BLOCK + src[at:]

    # فحص سلامة: الأقواس متوازنة والكتلة صارت داخل android{}
    if new.count("{") - new.count("}") != src.count("{") - src.count("}"):
        sys.exit("✘ اختلّ توازن الأقواس بعد الحقن — أُلغي التعديل")
    span2 = android_block_span(new)
    if not span2 or not re.search(r"^\s*bundle\s*\{", new[span2[0]:span2[1]], re.M):
        sys.exit("✘ الكتلة لم تقع داخل android{} — أُلغي التعديل")

    p.write_text(new)
    print("✔ أُضيفت bundle{}: language + density + abi معطّلة")


if __name__ == "__main__":
    main()
