#!/usr/bin/env python3
"""يتحقّق أن الأيقونة داخل APK المبنيّ هي أيقونتنا فعلاً لا أيقونة Capacitor الافتراضية.
المقارنة بمتوسط اللون: أيقونتنا خضراء/ذهبية، والافتراضية زرقاء/بيضاء."""
import sys, zipfile, io, pathlib
from PIL import Image

apk = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "android/app/build/outputs/apk/debug/app-debug.apk")
ref = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "resources/android/mipmap-xxxhdpi/ic_launcher.png")

if not apk.exists(): sys.exit(f"لم يُعثر على {apk}")
if not ref.exists(): sys.exit(f"لم يُعثر على {ref}")

def mean_rgb(im):
    im = im.convert("RGBA").resize((32, 32))
    px = list(im.convert("RGBA").tobytes())
    px = [tuple(px[i:i+4]) for i in range(0, len(px), 4)]
    vis = [p for p in px if p[3] > 40] or px
    return tuple(round(sum(p[i] for p in vis) / len(vis)) for i in range(3))

want = mean_rgb(Image.open(ref))

with zipfile.ZipFile(apk) as z:
    names = [n for n in z.namelist() if "ic_launcher" in n and n.endswith(".png")]
    if not names: sys.exit("لا توجد أيقونات ic_launcher داخل الـ APK")
    cands = [n for n in names if "foreground" not in n and "background" not in n and "monochrome" not in n]
    target = max(cands or names, key=lambda n: z.getinfo(n).file_size)
    got = mean_rgb(Image.open(io.BytesIO(z.read(target))))

dist = sum(abs(a - b) for a, b in zip(want, got))
print(f"  المرجع {want} | داخل الـAPK {got} ({target}) | الفارق {dist}")
print(f"  عدد ملفات الأيقونة في الـAPK: {len(names)}")
if dist > 90:
    sys.exit("✘ الأيقونة داخل الـAPK ليست أيقونتنا — البناء يحمل أيقونة افتراضية")
print("✔ الأيقونة داخل الـAPK هي أيقونة Dama Tahiro")
