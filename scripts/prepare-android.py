#!/usr/bin/env python3
"""يضبط versionCode/versionName ويحقن إعدادات التوقيع في مشروع أندرويد المولَّد."""
import argparse, re, sys, pathlib, shutil

SIGNING_BLOCK = """    signingConfigs {
        release {
            // يُقيَّم في كل بناء (حتى debug) — لذلك يجب ألا يفشل عند غياب المفتاح
            def ksPath = System.getenv("KEYSTORE_PATH")
            if (ksPath != null && !ksPath.isEmpty() && file(ksPath).exists()) {
                storeFile file(ksPath)
                storePassword System.getenv("KEYSTORE_PASSWORD")
                keyAlias System.getenv("KEY_ALIAS")
                keyPassword System.getenv("KEY_PASSWORD")
            }
        }
    }
"""

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gradle", default="android/app/build.gradle")
    ap.add_argument("--version-code", type=int, required=True)
    ap.add_argument("--version-name", default=None)
    ap.add_argument("--sign", action="store_true")
    ap.add_argument("--manifest", default="android/app/src/main/AndroidManifest.xml")
    ap.add_argument("--res", default="android/app/src/main/res")
    ap.add_argument("--icons", default="resources/android")
    ap.add_argument("--admob-app-id", default="ca-app-pub-1725525147318224~1156717263")
    a = ap.parse_args()

    p = pathlib.Path(a.gradle)
    if not p.exists():
        sys.exit(f"لم يُعثر على {p}")
    src = p.read_text()

    # النسخة
    src, n1 = re.subn(r"versionCode\s+\d+", f"versionCode {a.version_code}", src, count=1)
    name = a.version_name or f"1.0.{a.version_code}"
    src, n2 = re.subn(r'versionName\s+"[^"]*"', f'versionName "{name}"', src, count=1)
    if not (n1 and n2):
        sys.exit("تعذّر ضبط النسخة — تغيّرت بنية build.gradle")

    # التوقيع
    if a.sign:
        if "signingConfigs" in src:
            print("signingConfigs موجود سلفاً — تخطٍّ")
        else:
            i = src.find("    buildTypes {")
            if i < 0:
                sys.exit("لم يُعثر على buildTypes")
            src = src[:i] + SIGNING_BLOCK + src[i:]
            j = src.find("    buildTypes {")
            k = src.find("release {", j)
            if k < 0:
                sys.exit("لم يُعثر على buildTypes.release")
            eol = src.find("\n", k) + 1
            src = src[:eol] + "            signingConfig signingConfigs.release\n" + src[eol:]

    p.write_text(src)

    # ── ضمان أن <application> يشير إلى أيقوناتنا ──
    mf0 = pathlib.Path(a.manifest)
    if mf0.exists():
        m0 = mf0.read_text()
        changed = False
        for attr, val in (("android:icon", "@mipmap/ic_launcher"),
                          ("android:roundIcon", "@mipmap/ic_launcher_round")):
            cur = re.search(attr + r'="([^"]*)"', m0)
            if cur is None:
                m0 = m0.replace("<application", f'<application\n        {attr}="{val}"', 1)
                changed = True
                print(f"أُضيف {attr}={val}")
            elif cur.group(1) != val:
                m0 = m0[:cur.start()] + f'{attr}="{val}"' + m0[cur.end():]
                changed = True
                print(f"صُحّح {attr}: {cur.group(1)} → {val}")
        if changed:
            mf0.write_text(m0)
        else:
            print("مراجع الأيقونة في المانيفست سليمة")

    # ── AdMob: حقن APPLICATION_ID في AndroidManifest ──
    # حزمة إعلانات جوجل تتعطّل عند الإقلاع إن غاب هذا الوسم.
    mf = pathlib.Path(a.manifest)
    if mf.exists():
        m = mf.read_text()
        if "com.google.android.gms.ads.APPLICATION_ID" in m:
            print("APPLICATION_ID موجود سلفاً — تخطٍّ")
        else:
            tag = (
                '        <meta-data\n'
                '            android:name="com.google.android.gms.ads.APPLICATION_ID"\n'
                f'            android:value="{a.admob_app_id}" />\n'
            )
            j = m.rfind("</application>")
            if j < 0:
                sys.exit("لم يُعثر على </application> في AndroidManifest")
            i = m.rfind("\n", 0, j) + 1        # بداية سطر </application> ليبقى التنسيق سليماً
            m = m[:i] + tag + m[i:]
            mf.write_text(m)
            print(f"AdMob APPLICATION_ID = {a.admob_app_id}")
    else:
        print(f"تحذير: {mf} غير موجود — تم تخطي حقن AdMob")

    # ── الأيقونات: نسخ كل الكثافات فوق أيقونات Capacitor الافتراضية ──
    icons = pathlib.Path(a.icons)
    res = pathlib.Path(a.res)
    if icons.is_dir() and res.is_dir():
        copied = 0
        for src_dir in sorted(icons.iterdir()):
            if not src_dir.is_dir():
                continue
            dst_dir = res / src_dir.name
            dst_dir.mkdir(parents=True, exist_ok=True)
            for f in sorted(src_dir.iterdir()):
                if f.is_file():
                    shutil.copy2(f, dst_dir / f.name)
                    copied += 1
        # إزالة أي تعريف تكيّفي قديم يشير إلى drawable ليبقى مرجع واحد فقط
        stale = res / "drawable" / "ic_launcher_background.xml"
        if stale.exists():
            stale.unlink()
            print("أُزيل drawable/ic_launcher_background.xml الافتراضي")
        print(f"الأيقونات: نُسخ {copied} ملفاً إلى {res}")
        # تحقّق صارم: لا نسمح ببناء يحمل أيقونة Capacitor الافتراضية
        must = ["mipmap-xxxhdpi/ic_launcher.png",
                "mipmap-xxxhdpi/ic_launcher_foreground.png",
                "mipmap-anydpi-v26/ic_launcher.xml"]
        missing = [x for x in must if not (res / x).exists()]
        if missing:
            sys.exit("فشل نسخ الأيقونات — ملفات ناقصة: " + ", ".join(missing))
    else:
        sys.exit(f"لم يُعثر على الأيقونات (icons={icons}, res={res}) — البناء سيحمل أيقونة افتراضية")

    print(f"versionCode={a.version_code} versionName={name} signed={a.sign}")

if __name__ == "__main__":
    main()
