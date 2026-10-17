#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════
//  يولّد src/puzzles.ts — ألغاز يومية مُبرهَنة.
//
//  لا يُعيد كتابة القواعد: المولّد (scripts/gen-puzzles.impl.ts) يستورد
//  src/engine.ts نفسه الذي تشتغل به اللعبة. فمهما تغيّرت القواعد تغيّرت
//  معها الألغاز، ولا يمكن أن يُولَّد لغز بقواعد قديمة.
//
//  يُشغَّل بلا أي حزمة مثبَّتة — Node وحده يكفي.
//  الاستعمال:  node scripts/gen-puzzles.mjs
//  متغيّرات:   PZ_GAMES  PZ_ENDGAMES  PZ_WANT
//
//  بعده شغّل دائماً:  node scripts/verify-puzzles.mjs
//  (مُبرهِن مستقل — لا تثق بمولّد يصحّح نفسه)
// ══════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, 'src', 'puzzles.ts');

// استيراد TypeScript مباشرةً يحتاج تجريد الأنواع: مُفعَّل تلقائياً في Node
// الحديث، ويحتاج علَماً في الأقدم. نحاول، وإن رفض أعدنا التشغيل بالعلَم.
async function loadImpl() {
  const impl = path.join(HERE, 'gen-puzzles.impl.ts');
  try {
    return await import(impl);
  } catch (err) {
    const needsFlag = err && (err.code === 'ERR_UNKNOWN_FILE_EXTENSION' ||
      /Unknown file extension|strip-types|TypeScript/i.test(String(err.message ?? '')));
    if (!needsFlag || process.env.DAMA_RELAUNCHED) throw err;
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync(
      process.execPath,
      ['--experimental-strip-types', '--no-warnings',
       fileURLToPath(import.meta.url), ...process.argv.slice(2)],
      { stdio: 'inherit', env: { ...process.env, DAMA_RELAUNCHED: '1' } }
    );
    process.exit(r.status ?? 1);
  }
}

const { generate } = await loadImpl();
const text = generate();

if (!text || !text.includes('export const PUZZLES')) {
  console.error('✘ المخرج لا يحتوي PUZZLES — أُلغيت الكتابة');
  process.exit(1);
}

fs.writeFileSync(OUT, text);
console.error(`✔ كُتب ${path.relative(ROOT, OUT)}`);
console.error('  الآن شغّل:  node scripts/verify-puzzles.mjs');
