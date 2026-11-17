#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════
//  ينقل بناء اللعبة إلى الموقع ليُنشَر على الإنترنت.
//
//  dist/index.html  →  site/public/play/index.html
//  فتصير اللعبة على:  https://dama-tahiro.web.app/play
//
//  لماذا مجلّد فرعي؟
//    جذر الاستضافة فيه صفحة التعريف وسياسة الخصوصية وحذف البيانات
//    وشروط الاستخدام — وروابطها مُقرَّة في Play Console. وضع اللعبة في
//    الجذر يستبدل صفحة التعريف ويكسر ما لا يجوز كسره.
//
//  البناء ملف واحد (vite-plugin-singlefile)، فالنقل نسخةٌ واحدة.
//  ويُشغَّل بـNode وحده بلا أي حزمة.
// ══════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'dist', 'index.html');
const DIR = path.join(ROOT, 'site', 'public', 'play');
const DST = path.join(DIR, 'index.html');

if (!fs.existsSync(SRC)) {
  console.error('✘ لا يوجد dist/index.html — شغّل npm run build أوّلاً،');
  console.error('  أو انسخ ملف dama-web الذي نزّلته من GitHub Actions إلى dist/index.html');
  process.exit(1);
}

// حارس: البناء يجب أن يكون ملفاً واحداً مكتفياً بنفسه. لو خرجت أصول
// منفصلة فنسخُ index.html وحده يعطي صفحةً بيضاء على الإنترنت.
const stray = fs.readdirSync(path.join(ROOT, 'dist'))
  .filter(f => /\.(js|mjs|css)$/i.test(f));
if (stray.length) {
  console.error('✘ البناء ليس ملفاً واحداً — خرجت أصول منفصلة: ' + stray.join(', '));
  console.error('  نسخ index.html وحده سينتج صفحة بيضاء. راجع vite-plugin-singlefile.');
  process.exit(1);
}

fs.mkdirSync(DIR, { recursive: true });
fs.copyFileSync(SRC, DST);

const mb = (fs.statSync(DST).size / 1048576).toFixed(2);
console.log(`✔ ${path.relative(ROOT, DST)} — ${mb} ميغابايت`);
console.log('  ستُنشر على: https://dama-tahiro.web.app/play');
