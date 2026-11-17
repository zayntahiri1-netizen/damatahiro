#!/usr/bin/env python3
"""
يتحقّق أن كل نص معروض في التطبيق مترجَم إلى اللغات الأربع.

لماذا سكربت ولا فحص بالعين؟
  المفتاح في نظامنا هو النص العربي نفسه، فالنص غير المترجَم لا يُسبّب خطأ —
  يُعرض بالعربية في واجهة إنجليزية بهدوء. العين تمرّ عليه، والسكربت لا.

ما يفحصه:
  1) كل t('…') و tf('…', …) في ملفات src/ له مدخل في القاموس.
  2) كل مدخل في القاموس له ترجمة فعلية (غير فارغة) في en و es و zh.
  3) قوالب tf: عدد المتغيّرات {0}{1}… متطابق في اللغات الأربع — متغيّر
     ضائع في الترجمة يعني نصاً ناقصاً على الشاشة.
  4) أسماء أطقم المتجر وثقافاتها في cosmetics.ts (تُمرَّر إلى t عند العرض،
     فلا يراها فحص (1) لأنها ليست مكتوبة داخل t).
  5) مفاتيح لم تُستعمل — ليست خطأً، لكنها تُبلَّغ للتنظيف.

الخروج بـ1 عند أي نقص، ليُفشل البناء في GitHub Actions.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
LANGS = ("en", "es", "zh")


# نص بعلامة مفردة أو مزدوجة — المدخل الذي فيه فاصلة عليا (today's)
# يُكتب بالمزدوجة قانوناً، وفاحص لا يقرأها يُبلّغ عن نقص وهمي.
STR = r"""(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")"""


def _pick(m: re.Match, first: int) -> str:
    """يُرجع المجموعة غير الفارغة من بديلَي علامة التنصيص."""
    return m.group(first) if m.group(first) is not None else (m.group(first + 1) or "")


def unescape(s: str) -> str:
    return s.replace("\\'", "'").replace('\\"', '"').replace("\\\\", "\\")


def dict_entries(text: str) -> dict[str, dict[str, str]]:
    """يستخرج مدخلات DICT: المفتاح العربي ← {en, es, zh}."""
    start = text.find("const DICT")
    if start < 0:
        sys.exit("لم يُعثر على DICT في i18n.ts")
    body = text[start:]
    out: dict[str, dict[str, str]] = {}
    pat = re.compile(rf"^\s*{STR}\s*:\s*\{{(.*?)\}},?\s*$", re.M | re.S)
    for m in pat.finditer(body):
        key = unescape(_pick(m, 1))
        vals = m.group(3)
        tr = {}
        for lang in LANGS:
            v = re.search(rf"\b{lang}\s*:\s*{STR}", vals)
            if v:
                tr[lang] = unescape(_pick(v, 1))
        out[key] = tr
    return out


def used_keys(paths) -> tuple[set[str], list[str]]:
    """كل مفتاح يُطلب فعلاً عبر t/tf، مع تقرير بالاستدعاءات غير المفهومة."""
    keys: set[str] = set()
    unparsed: list[str] = []
    lit = re.compile(rf"\btf?\(\s*{STR}")
    for p in paths:
        src = p.read_text(encoding="utf-8")
        for m in lit.finditer(src):
            keys.add(unescape(_pick(m, 1)))
        # أي استدعاء t( لا يبدأ بنص حرفي: مفتاح محسوب، نُبلّغ عنه
        for m in re.finditer(r"""\btf?\(\s*(?!['"])""", src):
            line = src.count("\n", 0, m.start()) + 1
            snippet = src[m.start():m.start() + 60].split("\n")[0]
            unparsed.append(f"{p.name}:{line}  {snippet}")
    return keys, unparsed


# حقول تُخزّن نصاً عربياً ثم يُمرَّر إلى t() عبر متغيّر — t(it.name) و
# t(ui.label) — فلا يراها الفحص الحرفي. نجمعها من كل الملفات.
COMPUTED_FIELDS = ("name", "culture", "label")


def computed_keys(text: str) -> set[str]:
    """نصوص عربية مخزَّنة في حقول تُعرض لاحقاً عبر t(<متغيّر>)."""
    out: set[str] = set()
    for field in COMPUTED_FIELDS:
        for m in re.finditer(rf"\b{field}:\s*{STR}", text):
            v = unescape(_pick(m, 1))
            # عربي فقط: الحقول الإنجليزية (معرّفات، أصناف CSS) ليست مفاتيح
            if any("؀" <= c <= "ۿ" for c in v):
                out.add(v)
    return out


def slots(s: str) -> set[str]:
    return set(re.findall(r"\{(\d+)\}", s))


def main() -> None:
    i18n = (SRC / "i18n.ts").read_text(encoding="utf-8")
    entries = dict_entries(i18n)

    sources = sorted(p for p in SRC.glob("*.ts*") if p.name != "i18n.ts")
    used, unparsed = used_keys(sources)

    comp: set[str] = set()
    for q in sources + [SRC / "i18n.ts"]:
        if q.exists() and q.name != "i18n.ts":
            comp |= computed_keys(q.read_text(encoding="utf-8"))
    used |= comp

    errors: list[str] = []

    # 1) مفاتيح مستعملة وغير موجودة في القاموس
    missing = sorted(k for k in used if k not in entries)
    for k in missing:
        errors.append(f"مفتاح مستعمل وغير مترجَم: {k!r}")

    # 2) مدخلات ناقصة الترجمة
    for k, tr in sorted(entries.items()):
        for lang in LANGS:
            if not tr.get(lang, "").strip():
                errors.append(f"ترجمة {lang} ناقصة: {k!r}")

    # 3) تطابق المتغيّرات
    for k, tr in sorted(entries.items()):
        want = slots(k)
        for lang in LANGS:
            got = slots(tr.get(lang, ""))
            if got != want:
                errors.append(
                    f"متغيّرات غير متطابقة في {lang}: {k!r} "
                    f"(العربية {sorted(want) or '—'} / {lang} {sorted(got) or '—'})"
                )

    unused = sorted(k for k in entries if k not in used)

    print(f"القاموس: {len(entries)} مدخلاً × {len(LANGS)} لغة")
    print(f"مفاتيح مستعملة: {len(used)}  (منها {len(comp)} عبر حقول محسوبة)")
    if unparsed:
        print(f"\nاستدعاءات بمفتاح محسوب ({len(unparsed)}) — راجعها يدوياً:")
        for u in unparsed[:12]:
            print("   " + u)
        if len(unparsed) > 12:
            print(f"   … و{len(unparsed) - 12} أخرى")
    if unused:
        print(f"\nمفاتيح غير مستعملة ({len(unused)}) — ليست خطأً:")
        for k in unused[:10]:
            print(f"   {k!r}")
        if len(unused) > 10:
            print(f"   … و{len(unused) - 10} أخرى")

    if errors:
        print(f"\n✘ {len(errors)} مشكلة:")
        for e in errors[:40]:
            print("   " + e)
        if len(errors) > 40:
            print(f"   … و{len(errors) - 40} أخرى")
        sys.exit(1)

    print("\n✔ كل نص معروض مترجَم إلى اللغات الأربع، ومتغيّرات القوالب متطابقة")


if __name__ == "__main__":
    main()
