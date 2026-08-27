-- إضافة صورة اختيارية لكل قسم.
-- لا تحذف أو تعدل أي قسم موجود؛ الصورة اليدوية لها الأولوية، والمتجر يستخدم صورة افتراضية إذا كانت فارغة.
begin;

alter table public.categories
  add column if not exists image_url text null;

commit;
