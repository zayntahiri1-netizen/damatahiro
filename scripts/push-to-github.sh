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

# عقد هذا السكربت: الشجرة المحلية هي المرجع. ما ليس فيها يجب أن يزول
# من المستودع البعيد. ولهذا نُقارن الشجرتين لا الالتزامين.
#
# ⚠ لماذا لا rebase هنا؟
#   المستودع يُعاد إنشاؤه عند كل تسليم (rm -rf ثم unzip ثم git init)،
#   فالتزامه الوحيد جذريّ ومحتواه «أضِف هذه الملفات». وعند rebase فوق
#   المستودع البعيد تكون الرقعة فارغةً إن كانت الملفات موجودة هناك
#   بمحتواها نفسه، فيُسقط git الالتزام بوصفه مُطبَّقاً سلفاً، ويصير
#   HEAD مطابقاً للبعيد، ويقول الدفع «Everything up-to-date» — ولا
#   يُرفع شيء. والملفات الزائدة في البعيد لا تزول أبداً، لأن حذفها
#   غيابٌ لا تُعبّر عنه رقعةُ التزامٍ جذري. (وقع هذا فعلاً.)
git fetch -q origin "$BRANCH" 2>/dev/null || true

if git rev-parse --verify -q "origin/$BRANCH" >/dev/null 2>&1; then
  LOCAL_TREE=$(git rev-parse "HEAD^{tree}")
  REMOTE_TREE=$(git rev-parse "origin/$BRANCH^{tree}")
  if [ "$LOCAL_TREE" = "$REMOTE_TREE" ]; then
    echo "  لا فرق بين شجرتك والمستودع البعيد — لا شيء يُرفع."
  else
    git push -u origin "$BRANCH" 2>/dev/null \
      || git push -u origin "$BRANCH" --force-with-lease 2>/dev/null \
      || git push -u origin "$BRANCH" --force
    echo "  ✔ تم الرفع"
  fi
else
  git push -u origin "$BRANCH"
  echo "  ✔ تم الرفع"
fi

# حارس أخير: لا نُعلن النجاح إلا إذا صار البعيد مطابقاً لشجرتنا فعلاً
git fetch -q origin "$BRANCH" 2>/dev/null || true
if git rev-parse --verify -q "origin/$BRANCH" >/dev/null 2>&1 \
   && [ "$(git rev-parse "HEAD^{tree}")" != "$(git rev-parse "origin/$BRANCH^{tree}")" ]; then
  echo "  ✘ المستودع البعيد ما زال مختلفاً عن شجرتك — لم يكتمل الرفع"
  exit 1
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
