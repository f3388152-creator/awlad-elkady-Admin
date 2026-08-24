/**
 * ==========================================
 *  Awlad El-Kady — Supabase Configuration
 *  ⚠️  ضع بيانات Supabase الحقيقية هنا
 * ==========================================
 */
const SUPABASE_CONFIG = {
  url:    'https://nppwfhrzxwjsnnpsavzw.supabase.co',
  anonKey: 'sb_publishable_Yt0AMwrH7jstWy2aUuIz5g_aDhQh88j'
};

// معرف الجداول في Supabase
const TABLES = {
  products: 'products',
  orders:   'orders',
  categories: 'categories',
  product_categories: 'product_categories',
  shipping_rates: 'shipping_rates',
  complaints: 'complaints',
  site_settings: 'site_settings'
};

// محافظات مصر ومناطق الشحن (تُستخدم فقط للقائمة المنسدلة الأولية)
const EGYPT_GOVS = [
  'القاهرة','الجيزة','الإسكندرية','الدقهلية','البحر الأحمر',
  'البحيرة','الفيوم','الغربية','الإسماعيلية','مطروح',
  'المنيا','المنوفية','الوادي الجديد','السويس','أسوان',
  'أسيوط','بني سويف','بورسعيد','دمياط','جنوب سيناء',
  'كفر الشيخ','قنا','شمال سيناء','الشرقية','سوهاج',
  'الأقصر','عين شمس','حلوان','مدينة نصر'
];

window.liveShippingRates = []; // سيتم ملؤها من قاعدة البيانات

// دالة حساب الشحن (تعتمد على liveShippingRates بدلاً من الأرقام الثابتة)
function calculateShipping(governorate, bostaSizeParam, subtotal = 0) {
  const settings = window.siteSettings || {};
  if (settings.free_shipping_enabled === true && subtotal >= (Number(settings.free_shipping_threshold) || 1000)) return 0;
  if (settings.shipping_custom === true) {
    return settings.shipping_type === 'free' ? 0 : Number(settings.shipping_flat_rate) || 0;
  }
  const rateItem = window.liveShippingRates.find(r => r.governorate === governorate);
  const baseRate = rateItem ? parseFloat(rateItem.base_fee) : 55;
  const extraSizeFee = parseFloat(bostaSizeParam) || 0;
  return baseRate + extraSizeFee;
}
