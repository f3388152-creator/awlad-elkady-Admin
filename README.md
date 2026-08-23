# لوحة الإدارة الجديدة

اللوحة دي معمولة من الصفر على Supabase REST من غير `localStorage` للداتا الأساسية.

## التشغيل

1. شغّل المشروع من جذر الريبو على سيرفر محلي أو Vercel Dev.
2. افتح `Admin/index.html`.
3. تأكد إن `/api/config` بيرجع القيم الصحيحة.

## متغيرات البيئة المطلوبة

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` `admin-media` افتراضي
- `BOSTA_API_KEY`
- `BOSTA_CREATE_LABEL_URL`

## ملاحظات مهمة

- تسجيل المدير يعتمد على صف موجود في جدول `employees` فيه `role=manager` أو `role=admin` وكلمة السر في `password` أو `manager_password`.
- تسجيل الموظف يعتمد على رقم الموبايل في جدول `employees`.
- الـ PIN السري للمالك مضبوط على `500900` من `Admin/index.html` و `Admin/js/config.js`.
- طلبات الأمان محفوظة كـ JSON داخل `site_settings` تحت المفتاح `security_requests`.
