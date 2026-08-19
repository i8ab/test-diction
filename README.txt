========================================
  Todo Sync + SW + UI fixes — جاهز للرفع
========================================

فك الضغط وانسخ الملفات لمكانها في المشروع:

1) api/todos.js
   → حط الملف في:  api/todos.js
   (مسار جديد — تزامن التودو فقط عبر Redis)

2) public/sw.js
   → استبدل الملف الموجود:  public/sw.js
   (إشعارات أقوى + CACHE_VERSION v18)

3) src/components/todo/TodoPage.jsx
   → استبدل الملف الموجود:  src/components/todo/TodoPage.jsx
   (ترقيم تلقائي + إصلاح الكتابة + تزامن سحابي)

4) src/components/layout/ToolShell.jsx
   → استبدل الملف الموجود:  src/components/layout/ToolShell.jsx
   (تمرير accountCode للتودو)

بعد النسخ:
- اعمل Commit + Deploy على Vercel كالعادة.
- تأكد إن UPSTASH_REDIS_REST_URL و UPSTASH_REDIS_REST_TOKEN موجودين في Environment Variables
  (نفس اللي مستخدمين في الـ push).

ملاحظات:
- التودو بيتزامن لكل أكاونت على حدة.
- مش بيحمّل مع القاموس — مسار مستقل.
- الـ timer (Start/Stop) محلي لكل جهاز.
