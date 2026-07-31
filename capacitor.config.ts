import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // اسم الحزمة المعتمد (لا يُغيَّر بعد النشر على Google Play)
  //    الموجود في Play Console بالضبط، وإلا سيُعتبر تطبيقاً جديداً منفصلاً.
  appId: 'com.damatahiro.app',
  appName: 'Dama Tahiro',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',   // ⇒ https://localhost داخل التطبيق: السوكيتات تعمل
  },
};

export default config;
