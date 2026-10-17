# Dama Tahiro — دامة طاهيرو

Spanish Checkers with a Moroccan-Andalusian identity. Built by **Tahiro**.

## Structure | البنية
- `src/App.tsx` — game source with **TAHIRO AI ENGINE v2** (negamax + PVS, transposition table, Zobrist hashing, iterative deepening, 11 difficulty levels).
- `src/network.ts` — **TAHIRO NET HYPER v5**: exactly-once multiplayer over P2P + Ably + PubNub + Supabase Realtime, dual-path matchmaking.
- `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json` — Vite + Tailwind platform (single-file build).
- `site/` — official website (Firebase Hosting): privacy policy, data deletion, `app-ads.txt`.
  - Live: https://dama-tahiro.web.app
- `scripts/push-to-github.sh` — one-command push to this repository. Re-run it after any change.

## Build | البناء
```bash
npm install          # أول مرة فقط
npm run build        # ينتج dist/index.html — ملف واحد كامل
npm run android:sync # يبني ويزامن مشروع أندرويد محلياً (اختياري)
```

## CI — GitHub Actions
عند كل `push` يبني GitHub أربعة مخرجات (تبويب **Actions** ← آخر تشغيل ← **Artifacts**):

| Artifact | الاستخدام |
|---|---|
| `dama-debug-apk` | تثبيت مباشر للتجربة |
| `dama-release-apk` | APK موقّع |
| `dama-release-aab` | رفع على Play Store |
| `dama-web` | اللعبة في ملف HTML واحد |

**أسرار التوقيع** (Settings → Secrets and variables → Actions) — بدونها يُبنى APK التجربة فقط:
`KEYSTORE_BASE64` (ناتج `base64 -w0 my.jks`)، `KEYSTORE_PASSWORD`، `KEY_ALIAS`، `KEY_PASSWORD`.

`versionCode` يُضبط تلقائياً من رقم تشغيل الـ workflow.


© 2026 Tahiro — All rights reserved. contact: zayntahiri1@gmail.com
