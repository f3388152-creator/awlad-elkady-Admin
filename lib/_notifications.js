const webpush = require('web-push');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const VAPID_PUBLIC_KEY = String(process.env.VAPID_PUBLIC_KEY || '').trim();
const VAPID_PRIVATE_KEY = String(process.env.VAPID_PRIVATE_KEY || '').trim();
const VAPID_SUBJECT = String(process.env.VAPID_SUBJECT || 'mailto:admin@awladelkady.local').trim();

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

async function supabase(path, method = 'GET', body, prefer = 'return=minimal') {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVER_ENV_MISSING');
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: prefer
    },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {})
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  if (!response.ok) {
    const error = new Error('NOTIFICATION_DB_FAILED');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function cleanText(value, max, fallback = '') {
  return String(value ?? fallback).trim().slice(0, max);
}

function normalizeEvent(event = {}) {
  const scope = ['permission', 'all_admins', 'user'].includes(event.recipient_scope) ? event.recipient_scope : 'permission';
  const permission = cleanText(event.required_permission, 80) || null;
  const userId = cleanText(event.recipient_user_id, 80) || null;
  return {
    event_type: cleanText(event.event_type, 80, 'system'),
    title: cleanText(event.title, 120, 'إشعار جديد'),
    body: cleanText(event.body, 500, 'لديك تحديث جديد في لوحة الإدارة.'),
    url: cleanText(event.url, 300) || '/#overview',
    required_permission: scope === 'permission' ? permission : null,
    required_permissions: scope === 'permission' && Array.isArray(event.required_permissions) ? [...new Set(event.required_permissions.map(value => cleanText(value, 80)).filter(Boolean))] : [],
    recipient_user_id: scope === 'user' ? userId : null,
    recipient_scope: scope,
    data: event.data && typeof event.data === 'object' && !Array.isArray(event.data) ? event.data : {},
    expires_at: event.expires_at || null
  };
}

function canStaffReceive(subscription, staffRows, requiredPermission, requiredPermissions = []) {
  if (subscription.is_owner) return true;
  const required = [...new Set([requiredPermission, ...(Array.isArray(requiredPermissions) ? requiredPermissions : [])].filter(Boolean))];
  if (!required.length) return false;
  const staff = staffRows.find(row => String(row.auth_user_id) === String(subscription.user_id));
  return Boolean(staff?.is_active !== false && required.some(permission => staff?.permissions?.[permission] === true));
}

async function sendPush(notification) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return { enabled: false, sent: 0, failed: 0 };
  const subscriptions = await supabase(`/rest/v1/admin_push_subscriptions?is_active=eq.true&select=id,user_id,is_owner,endpoint,p256dh,auth`, 'GET', undefined, 'return=minimal') || [];
  if (!subscriptions.length) return { enabled: true, sent: 0, failed: 0 };
  const staffRows = notification.required_permission
    ? (await supabase('/rest/v1/staff_accounts?select=auth_user_id,is_active,permissions&is_active=eq.true&limit=1000', 'GET', undefined, 'return=minimal') || [])
    : [];
  const recipients = subscriptions.filter(subscription => {
    if (notification.recipient_scope === 'user') return String(subscription.user_id) === String(notification.recipient_user_id);
    if (notification.recipient_scope === 'all_admins') return Boolean(subscription.is_owner);
    return canStaffReceive(subscription, staffRows, notification.required_permission, notification.required_permissions);
  });
  let sent = 0;
  let failed = 0;
  const payload = JSON.stringify({ title: notification.title, body: notification.body, url: notification.url, tag: notification.event_type, notificationId: notification.id });
  for (const subscription of recipients) {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, { TTL: 300 });
      sent += 1;
    } catch (error) {
      failed += 1;
      const status = Number(error.statusCode || 0);
      if (status === 404 || status === 410) {
        await supabase(`/rest/v1/admin_push_subscriptions?id=eq.${encodeURIComponent(String(subscription.id))}`, 'PATCH', { is_active: false });
      }
      console.error('[push-send]', status || error.message);
    }
  }
  return { enabled: true, sent, failed };
}

async function createNotification(event) {
  const payload = normalizeEvent(event);
  const rows = await supabase('/rest/v1/admin_notifications', 'POST', payload, 'return=representation');
  const notification = Array.isArray(rows) ? rows[0] : rows;
  if (notification?.id) {
    try { await sendPush(notification); } catch (error) { console.error('[push-dispatch]', error.message); }
  }
  return notification;
}

async function getNotificationForUser(id, user) {
  const rows = await supabase(`/rest/v1/admin_notifications?id=eq.${encodeURIComponent(String(id))}&select=*&limit=1`, 'GET', undefined, 'return=minimal');
  const notification = rows?.[0];
  if (!notification) return null;
  if (user?.app_metadata?.role === 'admin') return notification;
  if (notification.recipient_scope === 'user') return String(notification.recipient_user_id) === String(user?.id) ? notification : null;
  if (notification.recipient_scope === 'all_admins') return null;
  const permissions = [...new Set([notification.required_permission, ...(Array.isArray(notification.required_permissions) ? notification.required_permissions : [])].filter(Boolean))];
  return permissions.some(permission => user?.app_metadata?.permissions?.[permission] === true) ? notification : null;
}

module.exports = {
  createNotification,
  getNotificationForUser,
  canStaffReceive,
  supabase,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  sendPush
};
