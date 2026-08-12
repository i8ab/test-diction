# Bacaloria Community

قاموس مفردات ثنائي اللغة + أدوات دراسة متكاملة (عربي ⇄ إنجليزي)، مع واجهة تدعم العربية والإنجليزية والألمانية والفرنسية.

تطبيق ويب تقدمي (PWA) يعمل offline، مع مزامنة سحابية، نظام تكرار متباعد (SRS)، XP وإنجازات، مؤقت دراسة، تقويم، وإشعارات.

---

## التشغيل المحلي

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # ينتج مجلد dist جاهز للنشر
npm run preview  # معاينة نسخة الإنتاج محليًا
```

### النشر على Vercel

ارفع المشروع كما هو. Vercel يكتشف Vite تلقائيًا ويبني، ويُفعّل ملفات `api/*.js` كـ serverless functions.

**متغيرات البيئة المطلوبة (حسب ما تستخدم):**

| المتغير | الوصف |
|---------|--------|
| `JSONBIN_BIN_ID` / `JSONBIN_MASTER_KEY` | إذا كنت تستخدم JSONBin |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` (أو `SUPABASE_KEY`) | إذا انتقلت لـ Supabase |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | لإشعارات Web Push |
| `CRON_SECRET` | لحماية endpoint التذكيرات المجدولة |

---

## البنية الأساسية

```
├── api/                    # Vercel serverless functions
│   ├── jsonbin.js          # قراءة/كتابة البيانات السحابية
│   ├── cambridge-audio.js  # صوت النطق من Cambridge
│   ├── tts.js
│   ├── push-*.js           # إدارة الإشعارات
│   └── login.js            # (متقاعد — الدخول باليوزر/باسورد فقط)
├── public/
│   ├── sw.js               # Service Worker (offline + cache strategy)
│   ├── manifest.json
│   └── icons/
├── src/
│   ├── main.jsx            # نقطة الدخول
│   ├── App.jsx             # المكوّن الجذري (حالة التطبيق + مصادقة + مزامنة)
│   ├── index.css           # التنسيقات الرئيسية
│   ├── components/
│   │   ├── MainView.jsx    # الواجهة الرئيسية للقاموس
│   │   ├── auth/           # شاشات التسجيل والدخول
│   │   ├── layout/         # الهيدر، القوائم، البنرات
│   │   ├── modals/         # كل النوافذ المنبثقة (Quiz, Flashcards, ...)
│   │   ├── timer/          # مؤقت المذاكرة
│   │   ├── calendar/       # تقويم الدراسة
│   │   ├── todo/           # قائمة المهام
│   │   ├── goals/
│   │   ├── dashboard/
│   │   └── common/         # مكوّنات مشتركة (أيقونات، بطاقات، ...)
│   └── lib/
│       ├── config/         # i18n, theme, sections
│       ├── state/          # إدارة الحالة (XP, achievements, storage, push, ...)
│       └── utils/          # helpers (SRS, speech, auth, dictionary API, ...)
├── lib/                    # كود مشترك بين الـ API functions (redis, webpush)
├── vite.config.js
└── vercel.json             # Cron للتذكيرات اليومية
```

---

## الميزات الرئيسية

### القاموس والدراسة
- بحث سريع + إضافة كلمات يدوية
- تعريفات وأمثلة تلقائية (dictionaryapi.dev + ترجمة عند الحاجة)
- نظام SRS (تكرار متباعد) مبني على SM-2 مبسط
- اختبارات متعددة الأنواع، بطاقات فلاش، إملاء، مراجعة سريعة
- استخراج كلمات من نص
- نطق (TTS + Cambridge audio) + تدريب نطق اختياري (Whisper في المتصفح)

### التحفيز والتقدم
- نظام XP مع حدود يومية ومكافآت
- إنجازات ومستويات وشارات وإطارات
- سلسلة أيام (streak)
- أهداف وتحديات
- لوحة متصدرين ومقارنة تقدم

### أدوات مساعدة
- **مؤقت مذاكرة**: عد تنازلي / ساعة، تخصيص كامل، فقاعة عائمة، Picture-in-Picture على الديسكتوب، Screen Wake Lock
- **تقويم دراسة**: عرض شهري بكثافة لونية + streak + ودجت عائم
- قائمة مهام
- وضع امتحان مع إعدادات أدمن

### التقنية
- PWA كامل (manifest + service worker محسّن)
- offline-first مع cache ذكي (network-first للـ shell، cache-first للأصول المُجزأة)
- مزامنة سحابية مع معالجة تعارض الإصدارات
- دعم RTL والثيمات وتكبير الواجهة
- إشعارات Push مجدولة

---

## ملاحظات معمارية مهمة

1. **الكود الكبير**: `App.jsx` و `MainView.jsx` وبعض الملفات الأخرى ما زالت كبيرة. يُفضّل استخراج hooks ومنطق الأعمال تدريجيًا.
2. **الأمان**: المصادقة حاليًا تعتمد على hash في الواجهة وتخزين الحسابات في السحابة. مناسبة لمجتمع صغير؛ تحتاج تعزيز لاحقًا.
3. **Whisper / transformers.js**: يُحمّل ديناميكيًا فقط عند الحاجة (لا يدخل الحزمة الرئيسية).
4. **الموبايل أولًا**: أي ميزة جديدة يجب أن تُختبر على عرض ≤ 768px قبل اعتبارها جاهزة. تجنب `window.open` على الموبايل.

---

## قواعد التعديل (مهمة)

- اختبر على الموبايل قبل اعتبار الميزة منتهية.
- لا تعتمد على popups صغيرة على الموبايل.
- حافظ على مساحات لمس كافية (≥ ~40px).
- استخدم `min/max/clamp` و `100dvh` و `env(safe-area-inset-*)` عند الحاجة.
- أي تغيير في منطق الحفظ السحابي أو الـ SRS يجب أن يحافظ على التوافق مع البيانات الموجودة.

---

## التحسينات في هذا الإصدار (1.1.0)

- حذف ملف `src/components/TimerPage.jsx` المكرر (كان ميتًا وغير مستخدم).
- حذف ملف Windows shortcut غير مستخدم (`lib/Documents.lnk`).
- تحسين `vite.config.js` بـ manual chunks أفضل (فصل React، الـ modals، أدوات الدراسة، وtransformers).
- توثيق أوضح وأشمل يغطي البنية والميزات ومتغيرات البيئة.
- تحديث اسم الحزمة والوصف في `package.json`.
- **تقسيم الكود (مكتمل هيكليًا — مراحل 1–20)**:
  - `App.jsx` → ~1438 (كان ~2797, ≈ **−49%**)
  - `MainView.jsx` → ~1065 (كان ~2190, ≈ **−51%**)
    - `MainViewOverlays` · `ToolShell` · `WordListPanel` · `EntryFiltersBar`
    - `MobileBottomNav` · `AccountRequestsModal`
  - `HeaderMenu.jsx` → ~349 (كان ~2193, ≈ **−84%**)

  **وحدات المنطق:** `entryMutations` · `adminLifecycle` · `cloudFlush` · `cloudQueue` ·
  `vaultSession` · `authFlow` · `entryProgress` · hooks (`useEntrySearch`, `useStudyShortcuts`, …)

---

## المساهمة / التعديلات القادمة المقترحة

1. **الأمان** (مؤجّل بطلب المستخدم): مراجعة صلاحيات الأدمن، الجلسات، والـ API.
2. اختبار يدوي شامل للمسارات الرئيسية.
3. إضافة اختبارات وحدة لـ `quizHelpers`, `authUtils`, `xp`.
4. تعزيز المصادقة (لاحقًا حسب الطلب).
5. تحسينات أداء إضافية حسب الحاجة.

لو حصلت على أي خطأ أثناء `npm run build` أو التشغيل، أرسل رسالة الخطأ كاملة.
