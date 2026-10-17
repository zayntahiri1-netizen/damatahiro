#!/usr/bin/env python3
"""
مولّد صفحات موقع Dama Tahiro بأربع لغات (ar / en / es / zh).
كل النصوص في هذا الملف — عدّلها هنا ثم شغّل: python3 site/build-pages.py
"""
import pathlib

OUT = pathlib.Path(__file__).parent / "public"
UPDATED = {"ar": "30 يوليوز 2026", "en": "July 30, 2026", "es": "30 de julio de 2026", "zh": "2026年7月30日"}
LANGS = [("ar", "العربية", "rtl"), ("en", "English", "ltr"), ("es", "Español", "ltr"), ("zh", "中文", "ltr")]
MAIL = "zayntahiri1@gmail.com"

NAV = {
    "ar": ["الرئيسية", "سياسة الخصوصية", "حذف البيانات"],
    "en": ["Home", "Privacy Policy", "Data Deletion"],
    "es": ["Inicio", "Política de Privacidad", "Eliminación de Datos"],
    "zh": ["主页", "隐私政策", "数据删除"],
}
TAG = {
    "ar": "دامة طاهيرو — الدامة الإسبانية",
    "en": "Spanish Checkers",
    "es": "Damas españolas",
    "zh": "西班牙跳棋",
}
UPD = {"ar": "آخر تحديث", "en": "Last updated", "es": "Última actualización", "zh": "最后更新"}
RIGHTS = {"ar": "جميع الحقوق محفوظة", "en": "All rights reserved", "es": "Todos los derechos reservados", "zh": "版权所有"}

# ── الصفحة الرئيسية ──
HOME = {
    "ar": ("دامة طاهيرو",
           "لعبة الدامة الإسبانية بلمسة مغربية أندلسية — مباريات سريعة، سلسلة المباريات، وتدريب الجنرالات بذكاء اصطناعي من 11 مستوى، بأربع لغات. هذه الصفحة الرسمية لسياسات اللعبة والدعم.",
           [("🛡️", "سياسة الخصوصية", "ما هي البيانات التي نجمعها وكيف نستعملها ونحميها."),
            ("🗑️", "حذف الحساب والبيانات", "كيفية طلب حذف حسابك وبياناتك بالكامل.")],
           "الدعم والتواصل", "لأي سؤال أو مشكلة أو اقتراح، راسلنا على البريد الإلكتروني:"),
    "en": ("Dama Tahiro",
           "Spanish Checkers with a Moroccan-Andalusian touch — quick matches, match series, and an 11-level AI training mode, in four languages. This is the official page for the game's policies and support.",
           [("🛡️", "Privacy Policy", "What data we collect, how we use it and protect it."),
            ("🗑️", "Account & Data Deletion", "How to request full deletion of your account and data.")],
           "Support & Contact", "For any question, issue or suggestion, email us at:"),
    "es": ("Dama Tahiro",
           "Damas españolas con un toque marroquí-andalusí: partidas rápidas, series de partidas y un modo de entrenamiento con IA de 11 niveles, en cuatro idiomas. Esta es la página oficial de políticas y soporte del juego.",
           [("🛡️", "Política de Privacidad", "Qué datos recogemos, cómo los usamos y cómo los protegemos."),
            ("🗑️", "Eliminación de cuenta y datos", "Cómo solicitar la eliminación completa de tu cuenta y datos.")],
           "Soporte y contacto", "Para cualquier duda, problema o sugerencia, escríbenos a:"),
    "zh": ("Dama Tahiro",
           "融合摩洛哥-安达卢斯风格的西班牙跳棋——快速对局、系列赛，以及 11 级 AI 训练模式，支持四种语言。本页是游戏政策与支持的官方页面。",
           [("🛡️", "隐私政策", "我们收集哪些数据，如何使用并保护它们。"),
            ("🗑️", "删除账号与数据", "如何申请彻底删除你的账号与数据。")],
           "支持与联系", "如有任何问题、故障或建议，请发送邮件至："),
}

# ── سياسة الخصوصية: (العنوان، المقدمة، [(عنوان القسم، [عناصر])], ملاحظة) ──
PRIVACY = {
"ar": ("سياسة الخصوصية",
 "تشرح هذه السياسة كيف يتعامل مطوّر <strong>Tahiro</strong> («نحن») مع المعلومات داخل لعبة <strong>Dama Tahiro — دامة طاهيرو</strong> (الدامة الإسبانية) المتوفرة على Google Play. باستعمالك للعبة فأنت توافق على هذه السياسة.",
 "لا نجمع أبداً: جهات الاتصال، الرسائل، الصور، الموقع الدقيق (GPS)، أو أي بيانات مالية.",
 [("1. البيانات التي نجمعها", [
    "<strong>معلومات الملف الشخصي:</strong> اسم اللاعب (اللقب) والصورة الرمزية التي تختارها، مع معرّف لاعب داخلي.",
    "<strong>بيانات اللعب:</strong> التقييم (ELO)، الانتصارات والهزائم والتعادلات، وتاريخ آخر ظهور.",
    "<strong>بيانات محلية على جهازك فقط:</strong> الأصدقاء، الإعدادات، اللغة، رمز الإحالة، المكافآت اليومية — لا تُرفع إلى خوادمنا.",
    "<strong>تحليلات مجهولة (اختيارية):</strong> يمكنك إيقافها من <strong>الإعدادات ← التحليلات</strong>.",
    "<strong>اللعب الجماعي:</strong> بيانات اتصال عابرة (مثل عنوان IP) تُعالَج تقنياً لإنشاء المباريات.",
    "<strong>الإعلانات:</strong> يعالج Google AdMob معرّف الإعلانات وموقعاً تقريبياً مبنياً على IP لعرض الإعلانات وقياسها."]),
  ("2. كيف نستعمل البيانات", [
    "تشغيل المباريات عبر الإنترنت وحساب التقييم ولوائح الترتيب.",
    "حفظ تقدّمك وإحصائياتك وتفضيلاتك (منها اللغة).",
    "تحسين الأداء وإصلاح الأعطال عبر التحليلات المجهولة إن كانت مفعّلة.",
    "عرض الإعلانات وقياسها، ومنع الغش وإساءة الاستعمال."]),
  ("3. الخدمات الخارجية", [
    "<strong>Supabase</strong> — قاعدة البيانات والاتصال الفوري: <a href=\"https://supabase.com/privacy\" target=\"_blank\" rel=\"noopener\">سياسة الخصوصية</a>",
    "<strong>Google Play Services / AdMob</strong>: <a href=\"https://policies.google.com/privacy\" target=\"_blank\" rel=\"noopener\">سياسة الخصوصية</a> · <a href=\"https://support.google.com/admob/answer/6128543\" target=\"_blank\" rel=\"noopener\">كيف يستعمل AdMob البيانات</a>",
    "<strong>Firebase</strong> — المصادقة المجهولة وقياس الزيارات."]),
  ("4. الإعلانات والموافقة", [
    "في المناطق التي تشترط ذلك (الاتحاد الأوروبي والمملكة المتحدة) تُعرض نافذة موافقة عبر منصة Google (UMP) قبل الإعلانات المخصّصة.",
    "يمكنك تعديل اختيارك في أي وقت من <strong>حسابي ← إعدادات خصوصية الإعلانات</strong>.",
    "لا تُطلب أي إعلانات قبل حلّ الموافقة."]),
  ("5. مشاركة البيانات", ["نحن <strong>لا نبيع بياناتك أبداً</strong>. لا نشاركها إلا مع المزوّدين المذكورين أعلاه بقدر ما يلزم لتشغيل اللعبة، أو إذا ألزمنا القانون بذلك."]),
  ("6. أمان البيانات ومدة الاحتفاظ", ["تُنقل البيانات عبر اتصالات مشفّرة (HTTPS/TLS) ويُقيَّد الوصول إليها. نحتفظ ببيانات حسابك ما دام حسابك نشطاً، ونحذفها عند طلبك عبر <a href=\"/data-deletion\">صفحة حذف البيانات</a>."]),
  ("7. الأطفال", ["اللعبة موجّهة لجمهور عام (13 سنة وما فوق) ولا نجمع عن قصد بيانات شخصية من أطفال دون 13 سنة. إذا كنت وليّ أمر وتعتقد أن طفلك زوّدنا ببيانات، راسلنا لنحذفها فوراً."]),
  ("8. حقوقك", [
    "الاطّلاع على بياناتك أو تصحيحها أو حذفها — راجع <a href=\"/data-deletion\">صفحة حذف الحساب والبيانات</a>.",
    "إيقاف التحليلات من داخل اللعبة، والتحكم في تخصيص الإعلانات من إعدادات جهازك."]),
  ("9. التغييرات على هذه السياسة", ["قد نحدّث هذه السياسة من وقت لآخر. سننشر أي نسخة جديدة على هذه الصفحة مع تحديث تاريخ «آخر تحديث» أعلاه."]),
  ("10. التواصل", [f"لأي سؤال حول الخصوصية: <a href=\"mailto:{MAIL}\">{MAIL}</a>"])]),

"en": ("Privacy Policy",
 "This policy explains how the developer <strong>Tahiro</strong> (\"we\") handles information in the game <strong>Dama Tahiro</strong> (Spanish Checkers), available on Google Play. By using the game you agree to this policy.",
 "We never collect: contacts, messages, photos, precise (GPS) location, or any financial data.",
 [("1. Data We Collect", [
    "<strong>Profile information:</strong> the player name (nickname) and avatar you choose, plus an internal player ID.",
    "<strong>Game data:</strong> rating (ELO), wins, losses, draws and last-seen date.",
    "<strong>Local data on your device only:</strong> friends, settings, language, referral code, daily rewards — never uploaded to our servers.",
    "<strong>Anonymous analytics (optional):</strong> you can turn this off in <strong>Settings → Analytics</strong>.",
    "<strong>Online play:</strong> transient connection data (such as IP addresses) processed technically to establish matches.",
    "<strong>Advertising:</strong> Google AdMob processes your advertising ID and an approximate, IP-based location to serve and measure ads."]),
  ("2. How We Use Data", [
    "Running online matches, rating calculation and leaderboards.",
    "Saving your progress, statistics and preferences (including language).",
    "Improving performance and fixing crashes via anonymous analytics, if enabled.",
    "Serving and measuring ads, and preventing cheating and abuse."]),
  ("3. Third-Party Services", [
    "<strong>Supabase</strong> — database &amp; realtime: <a href=\"https://supabase.com/privacy\" target=\"_blank\" rel=\"noopener\">Privacy Policy</a>",
    "<strong>Google Play Services / AdMob</strong>: <a href=\"https://policies.google.com/privacy\" target=\"_blank\" rel=\"noopener\">Privacy Policy</a> · <a href=\"https://support.google.com/admob/answer/6128543\" target=\"_blank\" rel=\"noopener\">How AdMob uses data</a>",
    "<strong>Firebase</strong> — anonymous authentication and visit measurement."]),
  ("4. Ads &amp; Consent", [
    "In regions that require it (the EU and the UK), a consent dialog powered by Google's UMP is shown before personalized ads.",
    "You can change your choice anytime from <strong>Profile → Ad privacy settings</strong>.",
    "No ads are requested before consent is resolved."]),
  ("5. Data Sharing", ["We <strong>never sell your data</strong>. It is shared only with the providers above, to the extent needed to operate the game, or when the law requires it."]),
  ("6. Security &amp; Retention", ["Data is transferred over encrypted connections (HTTPS/TLS) and access is restricted. Account data is kept while your account is active and deleted upon your request via the <a href=\"/data-deletion\">Data Deletion page</a>."]),
  ("7. Children", ["The game targets a general audience (13+) and we do not knowingly collect personal data from children under 13. If you are a parent and believe your child provided us data, contact us and we will delete it promptly."]),
  ("8. Your Rights", [
    "Access, correct or delete your data — see the <a href=\"/data-deletion\">Account &amp; Data Deletion page</a>.",
    "Opt out of analytics in-game, and control ad personalization from your device settings."]),
  ("9. Changes to This Policy", ["We may update this policy from time to time. Any new version will be posted on this page with an updated \"Last updated\" date."]),
  ("10. Contact", [f"For any privacy question: <a href=\"mailto:{MAIL}\">{MAIL}</a>"])]),

"es": ("Política de Privacidad",
 "Esta política explica cómo el desarrollador <strong>Tahiro</strong> («nosotros») trata la información en el juego <strong>Dama Tahiro</strong> (damas españolas), disponible en Google Play. Al usar el juego aceptas esta política.",
 "Nunca recogemos: contactos, mensajes, fotos, ubicación precisa (GPS) ni datos financieros.",
 [("1. Datos que recogemos", [
    "<strong>Información de perfil:</strong> el nombre de jugador (apodo) y el avatar que elijas, más un identificador interno.",
    "<strong>Datos de juego:</strong> puntuación (ELO), victorias, derrotas, empates y última conexión.",
    "<strong>Datos locales solo en tu dispositivo:</strong> amigos, ajustes, idioma, código de referido y recompensas diarias — nunca se suben a nuestros servidores.",
    "<strong>Analíticas anónimas (opcional):</strong> puedes desactivarlas en <strong>Ajustes → Analíticas</strong>.",
    "<strong>Juego en línea:</strong> datos de conexión transitorios (como la dirección IP) tratados técnicamente para crear las partidas.",
    "<strong>Publicidad:</strong> Google AdMob trata tu identificador de publicidad y una ubicación aproximada basada en IP para mostrar y medir anuncios."]),
  ("2. Cómo usamos los datos", [
    "Gestionar las partidas en línea, calcular la puntuación y las clasificaciones.",
    "Guardar tu progreso, estadísticas y preferencias (incluido el idioma).",
    "Mejorar el rendimiento y corregir fallos mediante analíticas anónimas, si están activadas.",
    "Mostrar y medir anuncios, y prevenir trampas y abusos."]),
  ("3. Servicios de terceros", [
    "<strong>Supabase</strong> — base de datos y tiempo real: <a href=\"https://supabase.com/privacy\" target=\"_blank\" rel=\"noopener\">Política de privacidad</a>",
    "<strong>Google Play Services / AdMob</strong>: <a href=\"https://policies.google.com/privacy\" target=\"_blank\" rel=\"noopener\">Política de privacidad</a> · <a href=\"https://support.google.com/admob/answer/6128543\" target=\"_blank\" rel=\"noopener\">Cómo usa AdMob los datos</a>",
    "<strong>Firebase</strong> — autenticación anónima y medición de visitas."]),
  ("4. Publicidad y consentimiento", [
    "En las regiones que lo exigen (UE y Reino Unido) se muestra un diálogo de consentimiento mediante la plataforma UMP de Google antes de los anuncios personalizados.",
    "Puedes cambiar tu elección en cualquier momento en <strong>Perfil → Ajustes de privacidad de anuncios</strong>.",
    "No se solicita ningún anuncio antes de resolver el consentimiento."]),
  ("5. Compartir datos", ["<strong>Nunca vendemos tus datos.</strong> Solo se comparten con los proveedores indicados arriba, en la medida necesaria para operar el juego, o cuando la ley lo exige."]),
  ("6. Seguridad y conservación", ["Los datos se transmiten por conexiones cifradas (HTTPS/TLS) y el acceso está restringido. Conservamos los datos de tu cuenta mientras esté activa y los eliminamos cuando lo solicitas mediante la <a href=\"/data-deletion\">página de eliminación de datos</a>."]),
  ("7. Menores", ["El juego está dirigido a un público general (13+) y no recogemos a sabiendas datos personales de menores de 13 años. Si eres madre, padre o tutor y crees que tu hijo nos ha facilitado datos, escríbenos y los eliminaremos de inmediato."]),
  ("8. Tus derechos", [
    "Acceder, corregir o eliminar tus datos — consulta la <a href=\"/data-deletion\">página de eliminación de cuenta y datos</a>.",
    "Desactivar las analíticas dentro del juego y controlar la personalización de anuncios desde los ajustes de tu dispositivo."]),
  ("9. Cambios en esta política", ["Podemos actualizar esta política de vez en cuando. Publicaremos cualquier versión nueva en esta página con la fecha de «última actualización» renovada."]),
  ("10. Contacto", [f"Para cualquier duda sobre privacidad: <a href=\"mailto:{MAIL}\">{MAIL}</a>"])]),

"zh": ("隐私政策",
 "本政策说明开发者 <strong>Tahiro</strong>（“我们”）如何处理 Google Play 上游戏 <strong>Dama Tahiro</strong>（西班牙跳棋）中的信息。使用本游戏即表示你同意本政策。",
 "我们从不收集：通讯录、短信、照片、精确位置（GPS）或任何金融数据。",
 [("1. 我们收集的数据", [
    "<strong>个人资料：</strong>你选择的玩家名称（昵称）与头像，以及一个内部玩家标识。",
    "<strong>游戏数据：</strong>积分（ELO）、胜、负、平局记录与最近上线时间。",
    "<strong>仅存于你设备上的数据：</strong>好友、设置、语言、推荐码与每日奖励——绝不上传至我们的服务器。",
    "<strong>匿名分析（可选）：</strong>可在<strong>设置 → 分析</strong>中关闭。",
    "<strong>在线对战：</strong>用于建立对局的临时连接数据（如 IP 地址）。",
    "<strong>广告：</strong>Google AdMob 会处理你的广告标识符与基于 IP 的大致位置，用于投放与衡量广告。"]),
  ("2. 我们如何使用数据", [
    "运行在线对局、计算积分与排行榜。",
    "保存你的进度、统计数据与偏好（包括语言）。",
    "在启用匿名分析的情况下改进性能并修复崩溃。",
    "投放与衡量广告，并防止作弊与滥用。"]),
  ("3. 第三方服务", [
    "<strong>Supabase</strong> — 数据库与实时通信：<a href=\"https://supabase.com/privacy\" target=\"_blank\" rel=\"noopener\">隐私政策</a>",
    "<strong>Google Play 服务 / AdMob</strong>：<a href=\"https://policies.google.com/privacy\" target=\"_blank\" rel=\"noopener\">隐私政策</a> · <a href=\"https://support.google.com/admob/answer/6128543\" target=\"_blank\" rel=\"noopener\">AdMob 如何使用数据</a>",
    "<strong>Firebase</strong> — 匿名身份验证与访问量统计。"]),
  ("4. 广告与同意", [
    "在法规要求的地区（欧盟与英国），在展示个性化广告前会通过 Google UMP 平台显示同意对话框。",
    "你可随时在<strong>我的 → 广告隐私设置</strong>中更改选择。",
    "在同意状态确定之前不会请求任何广告。"]),
  ("5. 数据共享", ["我们<strong>绝不出售你的数据</strong>。仅在运营游戏所必需的范围内与上述服务商共享，或在法律要求时共享。"]),
  ("6. 安全与保留期限", ["数据通过加密连接（HTTPS/TLS）传输，访问受到限制。账号数据在账号有效期间保留，并在你通过<a href=\"/data-deletion\">数据删除页面</a>提出请求时删除。"]),
  ("7. 儿童", ["本游戏面向一般受众（13 岁及以上），我们不会有意收集 13 岁以下儿童的个人数据。如你是家长并认为孩子向我们提供了数据，请联系我们，我们会立即删除。"]),
  ("8. 你的权利", [
    "访问、更正或删除你的数据——请参阅<a href=\"/data-deletion\">账号与数据删除页面</a>。",
    "在游戏内关闭分析，并从设备设置中管理广告个性化。"]),
  ("9. 本政策的变更", ["我们可能不时更新本政策。任何新版本都会发布在本页面，并更新上方的“最后更新”日期。"]),
  ("10. 联系方式", [f"隐私相关问题请联系：<a href=\"mailto:{MAIL}\">{MAIL}</a>"])]),
}

# ── حذف البيانات: (العنوان، المقدمة، عنوان الزر، وصف الزر، ملاحظة، [(قسم،[عناصر])]) ──
SUBJ = "Dama%20Tahiro%20%E2%80%94%20Account%20%26%20Data%20Deletion%20Request"
DEL = {
"ar": ("حذف الحساب والبيانات",
 "هذه الصفحة خاصة بلعبة <strong>Dama Tahiro — دامة طاهيرو</strong> من تطوير <strong>Tahiro</strong>. يمكنك من هنا طلب حذف حسابك وجميع البيانات المرتبطة به، أو حذف بيانات محددة دون حذف الحساب.",
 "طلب الحذف عبر البريد الإلكتروني", "اضغط الزر التالي وسيُفتح بريد جاهز — فقط املأ اسم اللاعب الخاص بك وأرسله:", "إرسال طلب الحذف", "أو راسلنا مباشرة على:",
 "<strong>ملاحظة:</strong> إلغاء تثبيت اللعبة وحده لا يحذف بياناتك من خوادمنا — أرسل طلب الحذف بالبريد لإتمام ذلك.",
 [("خطوات الطلب", [
    f"أرسل بريداً إلكترونياً إلى <strong>{MAIL}</strong> بعنوان «طلب حذف الحساب والبيانات — Dama Tahiro».",
    "اذكر <strong>اسم اللاعب (اللقب)</strong> الذي تستعمله داخل اللعبة حتى نتمكن من إيجاد حسابك.",
    "سنؤكد لك استلام الطلب، وننفّذ الحذف خلال <strong>30 يوماً كحد أقصى</strong>، ثم نرسل لك تأكيداً بالإتمام."]),
  ("ما الذي يُحذف؟", [
    "<strong>من خوادمنا:</strong> ملفك الشخصي، تقييمك (ELO)، إحصائيات الانتصارات والهزائم والتعادلات، وسجل الحضور.",
    "<strong>من جهازك:</strong> البيانات المحلية تُحذف عبر: إعدادات الهاتف ← التطبيقات ← Dama Tahiro ← <strong>مسح البيانات</strong>، أو بإلغاء التثبيت."]),
  ("حذف جزئي دون حذف الحساب", ["إذا أردت حذف بيانات معينة فقط (مثل تصفير إحصائياتك) مع الاحتفاظ بحسابك، اذكر ذلك في نفس البريد وسننفّذه بنفس الآجال."]),
  ("ما الذي قد نحتفظ به؟", [
    "إحصاءات مجمّعة ومجهولة تماماً لا يمكن ربطها بك.",
    "سجلات محدودة تُلزمنا بها القوانين أو تلزم لمنع الغش، لمدة محدودة فقط.",
    "البيانات التي تعالجها Google لأغراض الإعلانات تخضع لسياساتها — يمكنك إدارتها من <a href=\"https://myadcenter.google.com\" target=\"_blank\" rel=\"noopener\">مركز إعلانات Google</a>."]),
  ("التواصل", [f"لأي استفسار: <a href=\"mailto:{MAIL}\">{MAIL}</a> — راجع أيضاً <a href=\"/privacy-policy\">سياسة الخصوصية</a>."])]),

"en": ("Account &amp; Data Deletion",
 "This page applies to the game <strong>Dama Tahiro</strong> (Spanish Checkers) by the developer <strong>Tahiro</strong>. From here you can request deletion of your account and all associated data, or deletion of specific data without deleting the account.",
 "Request Deletion by Email", "Tap the button below to open a ready-made email — just fill in your player name and send it:", "Send Deletion Request", "Or email us directly at:",
 "<strong>Note:</strong> uninstalling the game alone does not delete your data from our servers — send the email request to complete that.",
 [("How It Works", [
    f"Send an email to <strong>{MAIL}</strong> with the subject \"Account &amp; Data Deletion Request — Dama Tahiro\".",
    "Include the <strong>player name (nickname)</strong> you use in the game so we can locate your account.",
    "We will confirm receipt, complete the deletion within <strong>30 days at most</strong>, and send you a confirmation once done."]),
  ("What Gets Deleted?", [
    "<strong>From our servers:</strong> your profile, rating (ELO), win/loss/draw statistics, and presence history.",
    "<strong>From your device:</strong> local data is removed via Phone Settings → Apps → Dama Tahiro → <strong>Clear data</strong>, or by uninstalling."]),
  ("Partial Deletion Without Closing the Account", ["If you only want certain data deleted (for example resetting your statistics) while keeping your account, say so in the same email and we will do it within the same timeframe."]),
  ("What We May Retain", [
    "Fully aggregated, anonymous statistics that cannot be linked to you.",
    "Limited records required by law or needed to prevent cheating, kept for a limited time only.",
    "Data processed by Google for advertising is governed by Google's policies — manage it at <a href=\"https://myadcenter.google.com\" target=\"_blank\" rel=\"noopener\">Google's My Ad Center</a>."]),
  ("Contact", [f"For any question: <a href=\"mailto:{MAIL}\">{MAIL}</a> — see also our <a href=\"/privacy-policy\">Privacy Policy</a>."])]),

"es": ("Eliminación de cuenta y datos",
 "Esta página se aplica al juego <strong>Dama Tahiro</strong> (damas españolas) del desarrollador <strong>Tahiro</strong>. Desde aquí puedes solicitar la eliminación de tu cuenta y de todos los datos asociados, o de datos concretos sin cerrar la cuenta.",
 "Solicitar la eliminación por correo", "Pulsa el botón siguiente y se abrirá un correo ya preparado: solo añade tu nombre de jugador y envíalo:", "Enviar solicitud de eliminación", "O escríbenos directamente a:",
 "<strong>Nota:</strong> desinstalar el juego no elimina por sí solo tus datos de nuestros servidores — envía la solicitud por correo para completarlo.",
 [("Pasos de la solicitud", [
    f"Envía un correo a <strong>{MAIL}</strong> con el asunto «Solicitud de eliminación de cuenta y datos — Dama Tahiro».",
    "Indica el <strong>nombre de jugador (apodo)</strong> que usas en el juego para que podamos localizar tu cuenta.",
    "Confirmaremos la recepción, completaremos la eliminación en un plazo <strong>máximo de 30 días</strong> y te enviaremos una confirmación."]),
  ("¿Qué se elimina?", [
    "<strong>De nuestros servidores:</strong> tu perfil, tu puntuación (ELO), las estadísticas de victorias, derrotas y empates, y el historial de conexión.",
    "<strong>De tu dispositivo:</strong> los datos locales se borran en Ajustes → Aplicaciones → Dama Tahiro → <strong>Borrar datos</strong>, o desinstalando el juego."]),
  ("Eliminación parcial sin cerrar la cuenta", ["Si solo quieres eliminar ciertos datos (por ejemplo, reiniciar tus estadísticas) y conservar la cuenta, indícalo en el mismo correo y lo haremos en el mismo plazo."]),
  ("Qué podemos conservar", [
    "Estadísticas totalmente agregadas y anónimas que no pueden vincularse contigo.",
    "Registros limitados exigidos por la ley o necesarios para prevenir trampas, durante un tiempo limitado.",
    "Los datos que Google trata con fines publicitarios se rigen por sus políticas — puedes gestionarlos en <a href=\"https://myadcenter.google.com\" target=\"_blank\" rel=\"noopener\">Mi Centro de Anuncios de Google</a>."]),
  ("Contacto", [f"Para cualquier consulta: <a href=\"mailto:{MAIL}\">{MAIL}</a> — consulta también nuestra <a href=\"/privacy-policy\">Política de Privacidad</a>."])]),

"zh": ("删除账号与数据",
 "本页适用于开发者 <strong>Tahiro</strong> 的游戏 <strong>Dama Tahiro</strong>（西班牙跳棋）。你可以在此申请删除账号及全部关联数据，或在不注销账号的情况下删除特定数据。",
 "通过邮件申请删除", "点击下方按钮将打开一封已准备好的邮件——只需填写你的玩家名称并发送：", "发送删除申请", "或直接发送邮件至：",
 "<strong>注意：</strong>仅卸载游戏并不会删除我们服务器上的数据——请发送邮件申请以完成删除。",
 [("申请步骤", [
    f"发送邮件至 <strong>{MAIL}</strong>，主题为“删除账号与数据申请 — Dama Tahiro”。",
    "写明你在游戏中使用的<strong>玩家名称（昵称）</strong>，以便我们找到你的账号。",
    "我们会确认收到申请，并在<strong>最多 30 天内</strong>完成删除，随后向你发送完成确认。"]),
  ("会删除哪些内容？", [
    "<strong>服务器端：</strong>你的个人资料、积分（ELO）、胜负平统计与上线记录。",
    "<strong>设备端：</strong>本地数据可通过 手机设置 → 应用 → Dama Tahiro → <strong>清除数据</strong> 删除，或直接卸载游戏。"]),
  ("不注销账号的部分删除", ["如果你只想删除部分数据（例如重置统计）而保留账号，请在同一封邮件中说明，我们会在相同期限内处理。"]),
  ("我们可能保留的内容", [
    "完全聚合且匿名、无法与你关联的统计数据。",
    "法律要求或防止作弊所必需的有限记录，仅保留有限时间。",
    "Google 为广告目的处理的数据受其自身政策约束——你可在 <a href=\"https://myadcenter.google.com\" target=\"_blank\" rel=\"noopener\">Google 我的广告中心</a> 管理。"]),
  ("联系方式", [f"如有疑问：<a href=\"mailto:{MAIL}\">{MAIL}</a> — 另请参阅我们的<a href=\"/privacy-policy\">隐私政策</a>。"])]),
}

ICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230e5a4a'/%3E%3Cg fill='none' stroke='%23c9a227' stroke-width='4'%3E%3Crect x='20' y='20' width='24' height='24'/%3E%3Crect x='20' y='20' width='24' height='24' transform='rotate(45 32 32)'/%3E%3C/g%3E%3C/svg%3E")

ANALYTICS = """<script type="module">
try {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js");
  const { getAnalytics } = await import("https://www.gstatic.com/firebasejs/12.12.0/firebase-analytics.js");
  const app = initializeApp({
    apiKey: "AIzaSyBOZDqHj4lwcThY_e4XQ_Uf08NmE35YXxk",
    authDomain: "dama-tahiro.firebaseapp.com",
    projectId: "dama-tahiro",
    storageBucket: "dama-tahiro.firebasestorage.app",
    messagingSenderId: "590835413930",
    appId: "1:590835413930:web:d82e5d002e260b8ba0f1d3",
    measurementId: "G-T2C2XNCZ49"
  });
  getAnalytics(app);
} catch (e) { /* analytics is optional — never break the page */ }
</script>"""

LANG_JS = """<script>
(function(){
  var KEY='tahiroLang', CODES=['ar','en','es','zh'];
  var saved=null; try{ saved=localStorage.getItem(KEY); }catch(e){}
  var nav=((navigator.languages&&navigator.languages[0])||navigator.language||'').toLowerCase();
  var auto='en';
  if(nav.indexOf('ar')===0) auto='ar';
  else if(nav.indexOf('es')===0) auto='es';
  else if(nav.indexOf('zh')===0) auto='zh';
  else {
    var r=(/[-_]([a-z]{2})\\b/.exec(nav)||[])[1];
    if(r){ r=r.toUpperCase();
      if('MA DZ TN LY EG SD SA AE QA BH KW OM YE JO LB SY IQ PS MR'.indexOf(r)>=0) auto='ar';
      else if('ES MX AR CO CL PE VE EC GT CU BO DO HN PY SV NI CR PA UY PR'.indexOf(r)>=0) auto='es';
      else if('CN TW HK MO SG'.indexOf(r)>=0) auto='zh';
    }
  }
  apply(CODES.indexOf(saved)>=0 ? saved : auto, false);
  var btns=document.querySelectorAll('[data-lang]');
  for(var i=0;i<btns.length;i++){
    btns[i].addEventListener('click', function(){ apply(this.getAttribute('data-lang'), true); });
  }
  function apply(l, save){
    document.documentElement.lang=l;
    document.documentElement.dir=(l==='ar')?'rtl':'ltr';
    var b=document.querySelectorAll('[data-lang]');
    for(var i=0;i<b.length;i++){
      b[i].classList.toggle('active', b[i].getAttribute('data-lang')===l);
    }
    if(save){ try{ localStorage.setItem(KEY,l); }catch(e){} }
  }
})();
</script>"""


def shell(title, desc, active, body):
    switch = "".join(
        f'<button class="lang-btn" type="button" data-lang="{c}">{lbl}</button>' for c, lbl, _ in LANGS
    )
    nav = ""
    for idx, (href, key) in enumerate([("/", 0), ("/privacy-policy", 1), ("/data-deletion", 2)]):
        cls = ' class="active"' if idx == active else ""
        labels = "".join(f'<span class="l l-{c}">{NAV[c][key]}</span>' for c, _, _ in LANGS)
        nav += f'<a href="{href}"{cls}>{labels}</a>'
    subs = "".join(f'<span class="l l-{c}">{TAG[c]}</span>' for c, _, _ in LANGS)
    rights = "".join(f'<span class="l l-{c}">{RIGHTS[c]}</span>' for c, _, _ in LANGS)
    return f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="icon" href="{ICON}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
</head>
<body>

<header class="site-head">
  <div class="wrap">
    <div class="head-row">
      <a class="brand" href="/">
        <svg width="44" height="44" viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="14" fill="#0a4237"/>
          <g fill="none" stroke="#e8cd6f" stroke-width="3.5">
            <rect x="20" y="20" width="24" height="24"/>
            <rect x="20" y="20" width="24" height="24" transform="rotate(45 32 32)"/>
          </g>
        </svg>
        <span>
          <span class="brand-name">Dama Tahiro</span><br>
          <span class="brand-sub">{subs}</span>
        </span>
      </a>
      <div class="lang-switch">{switch}</div>
    </div>
    <nav class="site-nav">{nav}</nav>
  </div>
</header>

<main class="wrap">
{body}
</main>

<footer class="site-foot">
  <div class="wrap foot-row">
    <div>© 2026 Tahiro — {rights}</div>
    <div><a href="mailto:{MAIL}">{MAIL}</a></div>
  </div>
</footer>

{LANG_JS}
{ANALYTICS}
</body>
</html>
"""


def policy_body(data, updated_label):
    out = []
    for c, _, _ in LANGS:
        title, intro, note, sections = data[c]
        s = [f'<div class="l l-{c}">',
             f'<span class="badge">{UPD[c]}: {UPDATED[c]}</span>',
             f'<h1 class="page-title">{title}</h1>',
             f'<p>{intro}</p>']
        for i, (head, items) in enumerate(sections):
            s.append('<div class="card">')
            s.append(f'<h2>{head}</h2>')
            if len(items) == 1:
                s.append(f'<p>{items[0]}</p>')
            else:
                s.append('<ul>' + "".join(f'<li>{x}</li>' for x in items) + '</ul>')
            if i == 0 and note:
                s.append(f'<p class="note">{note}</p>')
            s.append('</div>')
        s.append('</div>')
        out.append("\n".join(s))
    return "\n".join(out)


def deletion_body():
    out = []
    for c, _, _ in LANGS:
        title, intro, box_h, box_p, btn, direct, note, sections = DEL[c]
        s = [f'<div class="l l-{c}">',
             f'<span class="badge">{UPD[c]}: {UPDATED[c]}</span>',
             f'<h1 class="page-title">{title}</h1>',
             f'<p>{intro}</p>',
             '<div class="card center">',
             f'<h2 style="border:none;padding:0">{box_h}</h2>',
             f'<p>{box_p}</p>',
             f'<p><a class="btn" href="mailto:{MAIL}?subject={SUBJ}">{btn}</a></p>',
             f'<p style="font-size:.88rem;color:var(--muted)">{direct} <a href="mailto:{MAIL}">{MAIL}</a></p>',
             '</div>']
        for i, (head, items) in enumerate(sections):
            s.append('<div class="card">')
            s.append(f'<h2>{head}</h2>')
            if len(items) == 1:
                s.append(f'<p>{items[0]}</p>')
            else:
                s.append('<ul>' + "".join(f'<li>{x}</li>' for x in items) + '</ul>')
            if i == 1 and note:
                s.append(f'<p class="note">{note}</p>')
            s.append('</div>')
        s.append('</div>')
        out.append("\n".join(s))
    return "\n".join(out)


def home_body():
    out = []
    for c, _, _ in LANGS:
        title, intro, cards, sup_h, sup_p = HOME[c]
        s = [f'<div class="l l-{c}">',
             f'<h1 class="page-title">{title}</h1>',
             f'<p>{intro}</p>',
             '<div class="link-grid">']
        hrefs = ["/privacy-policy", "/data-deletion"]
        for (icon, ct, cd), href in zip(cards, hrefs):
            s.append(f'<a class="link-card" href="{href}"><div class="ic">{icon}</div>'
                     f'<h3>{ct}</h3><p>{cd}</p></a>')
        s.append('</div>')
        s.append('<div class="card center">'
                 f'<h2 style="border:none;padding:0">{sup_h}</h2>'
                 f'<p>{sup_p}</p>'
                 f'<p><a class="btn" href="mailto:{MAIL}">{MAIL}</a></p>'
                 '</div>')
        s.append('</div>')
        out.append("\n".join(s))
    return "\n".join(out)


NOT_FOUND = {
    "ar": ("الصفحة غير موجودة.", "العودة إلى الرئيسية"),
    "en": ("Page not found.", "Back to home"),
    "es": ("Página no encontrada.", "Volver al inicio"),
    "zh": ("页面不存在。", "返回主页"),
}


def not_found_page():
    blocks = "".join(
        f'<div class="l l-{c}"><p style="font-size:1.05rem">{msg}</p>'
        f'<p><a class="btn" href="/">{back}</a></p></div>'
        for (c, _, _), (msg, back) in zip(LANGS, [NOT_FOUND[c] for c, _, _ in LANGS])
    )
    switch = "".join(
        f'<button class="lang-btn" type="button" data-lang="{c}">{lbl}</button>' for c, lbl, _ in LANGS
    )
    return f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>404 — Dama Tahiro</title>
<meta name="robots" content="noindex">
<link rel="icon" href="{ICON}">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
</head>
<body style="display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center">
<div class="wrap">
  <h1 style="color:var(--emerald);font-size:3.4rem;margin:0 0 6px">404</h1>
  {blocks}
  <div class="lang-switch" style="justify-content:center;margin-top:22px">{switch}</div>
</div>
{LANG_JS}
</body>
</html>
"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    pages = [
        ("index.html", "Dama Tahiro — دامة طاهيرو | Official Site",
         "Dama Tahiro (Spanish Checkers) — privacy policy, data deletion and support in 4 languages.", 0, home_body()),
        ("privacy-policy.html", "Privacy Policy — Dama Tahiro | سياسة الخصوصية",
         "Privacy Policy for Dama Tahiro (Spanish Checkers) in Arabic, English, Spanish and Chinese.", 1, policy_body(PRIVACY, UPD)),
        ("data-deletion.html", "Account & Data Deletion — Dama Tahiro | حذف الحساب والبيانات",
         "Request deletion of your Dama Tahiro account and data.", 2, deletion_body()),
    ]
    (OUT / "404.html").write_text(not_found_page(), encoding="utf-8")
    print("  \u2714 404.html")
    for name, title, desc, active, body in pages:
        (OUT / name).write_text(shell(title, desc, active, body), encoding="utf-8")
        print(f"  ✔ {name}")
    print(f"تم توليد {len(pages)} صفحات × {len(LANGS)} لغات")


if __name__ == "__main__":
    main()
