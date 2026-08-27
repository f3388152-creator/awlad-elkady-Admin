self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { body: event.data?.text() || '' }; }
  const title = String(data.title || 'إشعار جديد من معرض أولاد القاضي');
  const options = {
    body: String(data.body || 'لديك تحديث جديد في لوحة الإدارة.'),
    icon: '/assets/images/logo.png',
    badge: '/assets/images/logo.png',
    dir: 'rtl',
    lang: 'ar',
    tag: String(data.tag || data.notificationId || 'admin-notification'),
    renotify: true,
    data: { url: String(data.url || '/#overview') }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/#overview', self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const existing = list.find(client => client.url.startsWith(self.location.origin));
    if (existing) { existing.focus(); existing.navigate(target); return; }
    return clients.openWindow(target);
  }));
});
