#!/usr/bin/env bash
# ══════════════════════════════════════════════════════
#  Dama Tahiro — رفع المشروع إلى GitHub بأمر واحد
#  الاستعمال:  ./scripts/push-to-github.sh ["وصف التغيير"]
# ══════════════════════════════════════════════════════
set -e
cd "$(dirname "$0")/.."

DEFAULT_USER="zayntahiri1-netizen"
DEFAULT_REPO="damatahiro"
BRANCH="main"
MSG="${1:-Update $(date '+%Y-%m-%d %H:%M')}"

echo "════════════════════════════════════════"
echo "   Dama Tahiro — رفع إلى GitHub"
echo "════════════════════════════════════════"

# REPO_URL يتخطى الأسئلة (للأتمتة)
if [ -z "${REPO_URL:-}" ]; then
  read -r -p "  اسم المستخدم (username) [$DEFAULT_USER]: " GH_USER
  GH_USER="${GH_USER:-$DEFAULT_USER}"
  read -r -p "  اسم الـ Repository [$DEFAULT_REPO]: " GH_REPO
  GH_REPO="${GH_REPO:-$DEFAULT_REPO}"
  REPO_URL="https://github.com/${GH_USER}/${GH_REPO}.git"
else
  GH_USER="$(echo "$REPO_URL" | sed -E 's#.*/([^/]+)/[^/]+$#\1#')"
  GH_REPO="$(basename "$REPO_URL" .git)"
fi
echo "  ← $REPO_URL"
echo

# هوية Git وحفظ بيانات الدخول
git config --global user.name  >/dev/null 2>&1 || git config --global user.name  "$GH_USER"
git config --global user.email >/dev/null 2>&1 || git config --global user.email "zayntahiri1@gmail.com"
git config --global credential.helper store

[ -d .git ] || git init -q
git branch -M "$BRANCH" 2>/dev/null || git symbolic-ref HEAD "refs/heads/$BRANCH"

if git remote | grep -q '^origin$'; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi

echo "→ تجهيز الملفات..."
git add -A

# حارس: الأيقونات يجب أن تكون مُتتبَّعة، وإلا خرج بناء بأيقونة افتراضية
if ! git ls-files --error-unmatch resources/android/mipmap-xxxhdpi/ic_launcher.png >/dev/null 2>&1; then
  echo "  ✘ أيقونات التطبيق غير مُتتبَّعة في git — تحقّق من .gitignore"
  exit 1
fi
if git diff --cached --quiet && git rev-parse HEAD >/dev/null 2>&1; then
  echo "  لا توجد تغييرات جديدة."
else
  git commit -q -m "$MSG"
  echo "  ✔ commit: $MSG"
fi

echo "→ الرفع (سيطلب username و token عند أول مرة)..."
if git push -u origin "$BRANCH" 2>/dev/null; then
  echo "  ✔ تم الرفع"
else
  echo "  ⚠ المستودع البعيد يحتوي محتوى مختلفاً — محاولة الدمج..."
  git fetch -q origin "$BRANCH" 2>/dev/null || true
  if git rebase "origin/$BRANCH" >/dev/null 2>&1; then
    git push -u origin "$BRANCH"
    echo "  ✔ تم الدمج والرفع"
  else
    git rebase --abort >/dev/null 2>&1 || true
    echo "  ⚠ تاريخ منفصل — فرض الرفع (النسخة المحلية هي المرجع)"
    git push -u origin "$BRANCH" --force-with-lease || git push -u origin "$BRANCH" --force
    echo "  ✔ تم الرفع"
  fi
fi

echo
echo "════════════════════════════════════════"
echo "  ✅ تم! تابع البناء هنا:"
echo "  https://github.com/${GH_USER}/${GH_REPO}/actions"
echo
echo "  بعد ~10 دقائق ستجد في Artifacts:"
echo "    dama-debug-apk    → تثبيت مباشر للتجربة"
echo "    dama-release-apk  → APK موقّع"
echo "    dama-release-aab  → رفع على Play Store"
echo "    dama-web          → اللعبة في ملف HTML واحد"
echo "════════════════════════════════════════"
