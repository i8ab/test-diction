# مزامنة الحذف – التحديثات

## ما تم تنفيذه

### 1. مزامنة مسح رسائل التذكير
- عند مسح قائمة الرسائل من الإعدادات → تتمسح من السيرفر.
- أي جهاز تاني لنفس الأكونت لما يعمل fetch هيلقى القائمة فاضية.

استخدم في الواجهة:
```js
import { clearReminderMessages, savePushPrefs } from "../lib/state/push";

// مسح كل الرسائل
await clearReminderMessages(code);

// أو حفظ قائمة جديدة (فارغة أو معدّلة)
await savePushPrefs(code, { messages: [] });
```

### 2. مزامنة الـ Inbox (الجرس)
- الـ Inbox بقى مخزن في Redis (`inbox:{code}`).
- كل إشعار بيبعت (تذكير / تجريبي / بث) بيتحط تلقائي في الـ Inbox.
- مسح إشعار واحد أو مسح الكل أو تعليم كمقروء → بيحصل على السيرفر.
- باقي الأجهزة بتشوف التغيير بعد ثواني (أو لما تعمل focus / refresh).

الملفات المعدّلة / الجديدة:

```
lib/pushSubs.js
api/push-subscribe.js
api/push-send-reminders.js
api/push-test.js
api/push-broadcast.js
src/lib/state/inbox.js
src/lib/state/push.js
src/components/layout/InboxBell.jsx
```

## طريقة الاستخدام
1. فك الضغط فوق مجلد المشروع.
2. تأكد إن `InboxBell` مستخدم في الهيدر وبيستقبل `code` (رقم الأكونت).
3. في شاشة الإشعارات / الإعدادات:
   - زرار مسح الرسائل يستدعي `clearReminderMessages(code)` أو `savePushPrefs(code, { messages: [] })`.
4. Deploy على Vercel.

## ملاحظات
- الـ Inbox بيحتفظ بآخر 50 إشعار فقط لكل أكونت.
- لو عايز تزيد العدد عدّل `MAX_INBOX` في `lib/pushSubs.js`.
- بعد الـ deploy جرّب:
  1. من جهاز → امسح كل الإشعارات من الجرس.
  2. افتح من الجهاز التاني → لازم تكون القائمة فاضية.
  3. امسح رسائل التذكير من الإعدادات → الجهاز التاني لما يفتح الإعدادات هيلقى الرسائل اختفت.
