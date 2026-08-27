(() => {
  'use strict';

  const state = { initializedFor: null, refreshTimer: null, registration: null, publicKey: null };
  const $ = id => document.getElementById(id);
  const escapeText = value => String(value ?? '');

  async function api(action, body) {
    const response = await fetch(`/api/admin?action=${encodeURIComponent(action)}`, {
      method: body ? 'POST' : 'GET',
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'تعذر تحميل الإشعارات.');
    return data;
  }

  function notificationNode(item) {
    const wrapper = document.createElement('button');
    wrapper.type = 'button';
    wrapper.className = `notification-item${item.read_at ? '' : ' unread'}`;
    wrapper.dataset.notificationId = String(item.id || '');
    const title = document.createElement('strong');
    title.textContent = escapeText(item.title || 'إشعار جديد');
    const body = document.createElement('span');
    body.textContent = escapeText(item.body || '');
    const date = document.createElement('small');
    date.textContent = item.created_at ? new Date(item.created_at).toLocaleString('ar-EG') : '';
    wrapper.append(title, body, date);
    wrapper.addEventListener('click', async () => {
      try { await api('notification_mark_read', { id: item.id }); } catch (_) {}
      if (item.url) window.location.hash = item.url.replace(/^.*#/, '#');
      wrapper.classList.remove('unread');
      updateBadge();
    });
    return wrapper;
  }

  function updateBadge(unread = null) {
    const badge = $('notifications-badge');
    if (!badge) return;
    if (unread === null) unread = document.querySelectorAll('.notification-item.unread').length;
    badge.textContent = String(unread);
    badge.hidden = unread < 1;
  }

  async function refreshNotifications() {
    if (!state.initializedFor || document.getElementById('dashboard')?.classList.contains('hidden')) return;
    try {
      const data = await api('notification_list');
      const list = $('notifications-list');
      if (!list) return;
      list.replaceChildren();
      const rows = Array.isArray(data.notifications) ? data.notifications : [];
      if (!rows.length) {
        const empty = document.createElement('p');
        empty.className = 'notifications-empty';
        empty.textContent = 'مفيش إشعارات جديدة لحسابك حالياً.';
        list.appendChild(empty);
      } else rows.forEach(row => list.appendChild(notificationNode(row)));
      updateBadge(Number(data.unread || 0));
    } catch (error) {
      console.warn('[notifications-list]', error.message);
    }
  }

  function base64ToUint8Array(value) {
    const padding = '='.repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from(raw, char => char.charCodeAt(0));
  }

  function setPushStatus(text, kind = '') {
    const status = $('push-notifications-status');
    if (status) { status.textContent = text; status.dataset.kind = kind; }
  }

  async function enablePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setPushStatus('المتصفح لا يدعم إشعارات الموبايل.', 'error');
      return;
    }
    try {
      if (Notification.permission === 'denied') {
        setPushStatus('الإشعارات مرفوضة من إعدادات Chrome؛ فعّلها من إعدادات الموقع.', 'error');
        return;
      }
      state.registration ||= await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
      const config = await api('push_config');
      if (!config.enabled || !config.public_key) {
        setPushStatus('إعدادات الإشعارات لم تُفعّل على السيرفر بعد.', 'error');
        return;
      }
      state.publicKey = config.public_key;
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushStatus('لم يتم السماح بإشعارات Chrome.', 'error');
        return;
      }
      let subscription = await state.registration.pushManager.getSubscription();
      if (!subscription) subscription = await state.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToUint8Array(state.publicKey) });
      await api('push_subscribe', { subscription: subscription.toJSON() });
      setPushStatus('إشعارات الموبايل مفعّلة للحساب ده.', 'success');
      const button = $('enable-push-notifications');
      if (button) button.textContent = 'الإشعارات مفعّلة';
    } catch (error) {
      console.error('[push-enable]', error);
      setPushStatus(error.message || 'تعذر تفعيل الإشعارات حالياً.', 'error');
    }
  }

  function initUi() {
    const bell = $('notifications-bell');
    const panel = $('notifications-panel');
    const pushButton = $('enable-push-notifications');
    bell?.addEventListener('click', async () => {
      if (!panel) return;
      panel.hidden = !panel.hidden;
      if (!panel.hidden) await refreshNotifications();
    });
    document.addEventListener('click', event => {
      if (panel && !panel.hidden && !panel.contains(event.target) && event.target !== bell && !bell?.contains(event.target)) panel.hidden = true;
    });
    pushButton?.addEventListener('click', enablePush);
  }

  function detectSession() {
    const session = window.ADMIN_SESSION;
    const sessionId = session?.user_id || (session?.owner ? 'owner' : session?.display_name || null);
    const dashboard = $('dashboard');
    if (sessionId && dashboard && !dashboard.classList.contains('hidden') && state.initializedFor !== sessionId) {
      state.initializedFor = sessionId;
      $('notifications-bell')?.removeAttribute('hidden');
      $('enable-push-notifications')?.removeAttribute('hidden');
      refreshNotifications();
      clearInterval(state.refreshTimer);
      state.refreshTimer = setInterval(refreshNotifications, 45000);
    }
    if (!sessionId && state.initializedFor) {
      state.initializedFor = null;
      clearInterval(state.refreshTimer);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initUi();
    setInterval(detectSession, 1000);
  });
})();
