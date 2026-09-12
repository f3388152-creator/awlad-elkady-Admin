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
  site_settings: 'site_settings',
  faqs: 'faqs',
  socials: 'socials'
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
  const sizeClassByFee = {
    140: 'small_medium', 145: 'large_l', 150: 'xl', 155: 'xxl', 240: 'large_shipment', 994: 'huge_shipment'
  };
  const numericSize = Number(bostaSizeParam);
  const sizeClass = sizeClassByFee[numericSize] || '';
  const rateItem = window.liveShippingRates.find(rate =>
    String(rate.governorate || '') === String(governorate || '') &&
    (!sizeClass || String(rate.size_class || '') === sizeClass)
  );
  // bosta_size هو فئة سعر، وليس مبلغاً يُضاف فوق base_fee.
  return rateItem ? Number(rateItem.base_fee) || 0 : 55;
}
