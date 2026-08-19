========================================
  Todo UI + Sync + SW — جاهز للرفع
========================================

انسخ الملفات لمكانها:

1) api/todos.js                          → api/todos.js  (جديد)
2) public/sw.js                          → public/sw.js  (استبدال)
3) src/components/todo/TodoPage.jsx      → استبدال
4) src/components/layout/ToolShell.jsx   → استبدال

الجديد في Todo:
- التايتل سطر واحد فقط (حد 70 حرف) — الزائد يروح للنوت تلقائي
- Responsive: موبايل مضغوط / تابلت متوسط / كمبيوتر أوسع شوية
- شرح قابل للطي (دوس على المهمة)
- مزامنة: مهام + done + وقت الشغل

بعد النسخ: Commit + Deploy
تأكد Redis env vars موجودة (نفس الـ push)
