import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  ENABLE_AUTH,
  ALLOWED_EMAIL_DOMAINS,
} from './config.js';

const PLACEHOLDER_URL = 'https://your-project.supabase.co';
const PLACEHOLDER_KEY = 'public-anon-key';

const DELIVERY_TIME_SLOTS = [
  { value: '10am-12pm', label: '10am – 12pm' },
  { value: '1pm-3pm', label: '1pm – 3pm' },
  { value: 'self-pickup', label: 'Self pickup' },
];

const addOrderButton = document.getElementById('addOrderButton');
const ordersList = document.getElementById('ordersList');
const clientsList = document.getElementById('clientsList');
const calendarList = document.getElementById('calendarList');
const orderDialog = document.getElementById('orderDialog');
const orderForm = document.getElementById('orderForm');
const orderFormTitle = document.getElementById('orderFormTitle');
const modalOverlay = orderDialog
  ? orderDialog.querySelector('[data-close-dialog]')
  : null;
const modalContent = orderDialog
  ? orderDialog.querySelector('.modal-content')
  : null;
const bouquetTypeSelect = document.getElementById('bouquetType');
const priceHkdInput = document.getElementById('priceHkd');
const deliveryTimeSelect = document.getElementById('deliveryTimeSlot');
const deleteOrderButton = document.getElementById('deleteOrder');
const closeDialogButton = document.getElementById('closeDialog');
const statusFilter = document.getElementById('statusFilter');
const toast = document.querySelector('.toast');
const signOutButton = document.getElementById('signOut');
const clientLinkButton = document.getElementById('clientLinkButton');
const calendarViewSelect = document.getElementById('calendarView');
const hideFulfilledCheckbox = document.getElementById('hideFulfilled');

const tabButtons = [...document.querySelectorAll('.tab-button')];
const tabPanels = [...document.querySelectorAll('.tab-panel')];
const emptyStates = [...document.querySelectorAll('.empty-state')];

// Simple passcode lock removed in favor of Supabase Email OTP

const isConfigured =
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_URL.startsWith(PLACEHOLDER_URL) &&
  SUPABASE_ANON_KEY !== PLACEHOLDER_KEY;

const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

let orders = [];
let editingOrderId = null;
let authSession = null;

function showToast(message, duration = 2400) {
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  setTimeout(() => {
    toast.hidden = true;
  }, duration);
}

function setEmptyState(panelId, isVisible) {
  const state = emptyStates.find((el) => el.dataset.for === panelId);
  if (state) {
    state.classList.toggle('visible', isVisible);
  }
}

function switchTab(targetId) {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.target === targetId;
    button.classList.toggle('active', isActive);
  });

  tabPanels.forEach((panel) => {
    panel.classList.toggle('active', panel.id === targetId);
  });

  // Ensure lists are rendered/refreshed when switching tabs
  if (targetId === 'clients') {
    renderClients();
  } else if (targetId === 'orders') {
    renderOrders();
  } else if (targetId === 'calendar') {
    renderCalendar();
  }
}

function formatDate(isoDate) {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatLongDate(isoDate) {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function ensureBouquetOption(value) {
  if (!bouquetTypeSelect || !value) return;
  const exists = [...bouquetTypeSelect.options].some(
    (option) => option.value === value
  );
  if (!exists) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    bouquetTypeSelect.appendChild(option);
  }
}

function ensureDeliveryTimeOption(value, label = value) {
  if (!deliveryTimeSelect || !value) return;
  const exists = [...deliveryTimeSelect.options].some(
    (option) => option.value === value
  );
  if (!exists) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    deliveryTimeSelect.appendChild(option);
  }
}

function formatDeliveryTimeSlot(slotValue) {
  if (!slotValue) return '';
  const match = DELIVERY_TIME_SLOTS.find((slot) => slot.value === slotValue);
  return match ? slot.label : slotValue;
}

function clearList(list) {
  while (list.firstChild) {
    list.removeChild(list.firstChild);
  }
}

function renderOrders() {
  clearList(ordersList);
  const filter = statusFilter.value;

  const filteredOrders = orders.filter((order) => {
    if (filter === 'all') return true;
    return order.status === filter;
  });

  if (filteredOrders.length === 0) {
    setEmptyState('orders', true);
    return;
  }
  setEmptyState('orders', false);

  const template = document.getElementById('orderCardTemplate');

  filteredOrders.forEach((order) => {
    const clone = template.content.firstElementChild.cloneNode(true);
    clone.querySelector('.card-title').textContent = order.client_name;
    const deliveryLine = clone.querySelector('.card-detail.delivery-date');
    const deliveryParts = [
      formatDate(order.delivery_date),
      formatDeliveryTimeSlot(order.delivery_time_slot),
    ].filter(Boolean);
    deliveryLine.textContent = `Delivery · ${
      deliveryParts.length ? deliveryParts.join(' · ') : '—'
    }`;
    clone.querySelectorAll('.card-detail')[1].textContent =
      order.card_message || '';
    clone.querySelectorAll('.card-detail')[2].textContent =
      order.delivery_address || '';

    const pill = clone.querySelector('.status-pill');
    pill.dataset.status = order.status;
    pill.textContent =
      order.status === 'fulfilled' ? 'Fulfilled' : 'Unfulfilled';

    // Toggle status directly from the list
    pill.style.cursor = 'pointer';
    pill.addEventListener('click', async (event) => {
      event.stopPropagation();
      if (!supabase) return;

      const newStatus = order.status === 'fulfilled' ? 'pending' : 'fulfilled';

      // Optimistic UI update
      order.status = newStatus;
      pill.dataset.status = newStatus;
      pill.textContent =
        newStatus === 'fulfilled' ? 'Fulfilled' : 'Unfulfilled';

      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', order.id);

      if (error) {
        // Revert on error
        order.status = newStatus === 'fulfilled' ? 'pending' : 'fulfilled';
        pill.dataset.status = order.status;
        pill.textContent =
          order.status === 'fulfilled' ? 'Fulfilled' : 'Unfulfilled';
        console.error(error);
        showToast('Could not update status.');
        return;
      }

      showToast(
        newStatus === 'fulfilled' ? 'Marked fulfilled' : 'Marked unfulfilled'
      );
    });

    const openButton = clone.querySelector('button');
    openButton.addEventListener('click', () => openOrderDialog(order));

    ordersList.appendChild(clone);
  });
}

function renderClients() {
  clearList(clientsList);
  const clientMap = new Map();

  orders.forEach((order) => {
    const key = order.client_email || order.client_phone || order.client_name;
    const codeFromOrder =
      order.clients && order.clients.client_code
        ? order.clients.client_code
        : null;
    const existing = clientMap.get(key) || {
      client_name: order.client_name,
      client_email: order.client_email,
      client_phone: order.client_phone,
      client_code: codeFromOrder,
      orders: [],
    };

    // Preserve a non-empty client_code if we encounter it later
    if (!existing.client_code && codeFromOrder) {
      existing.client_code = codeFromOrder;
    }

    existing.orders.push(order);
    clientMap.set(key, existing);
  });

  const clients = [...clientMap.values()].sort((a, b) =>
    a.client_name.localeCompare(b.client_name)
  );

  if (clients.length === 0) {
    setEmptyState('clients', true);
    return;
  }
  setEmptyState('clients', false);

  const template = document.getElementById('clientCardTemplate');

  clients.forEach((client) => {
    const clone = template.content.firstElementChild.cloneNode(true);
    const title = client.client_code
      ? `${client.client_code} · ${client.client_name}`
      : client.client_name;
    const titleEl = clone.querySelector('.card-title');
    titleEl.textContent = title;
    const details = clone.querySelectorAll('.card-detail');
    details[0].textContent = client.client_phone || '';
    details[1].textContent = client.client_email || '';
    clone.querySelector('.order-count').textContent = `${
      client.orders.length
    } order${client.orders.length === 1 ? '' : 's'}`;

    // Navigate to client details page on title click
    titleEl.style.cursor = 'pointer';
    titleEl.addEventListener('click', (event) => {
      event.stopPropagation();
      const latestOrder = [...client.orders].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      )[0];
      const clientId = latestOrder && latestOrder.client_id;
      const key =
        client.client_email || client.client_phone || client.client_name;
      const url = new URL('client.html', window.location.href);
      if (clientId) url.searchParams.set('client_id', clientId);
      if (key) url.searchParams.set('key', key);
      window.location.href = url.toString();
    });

    clientsList.appendChild(clone);
  });
}

function renderCalendar() {
  clearList(calendarList);
  const hideFulfilled = !!(
    hideFulfilledCheckbox && hideFulfilledCheckbox.checked
  );
  const view = calendarViewSelect ? calendarViewSelect.value : 'agenda';

  const baseOrders = orders.filter((order) => order.delivery_date);
  const filtered = hideFulfilled
    ? baseOrders.filter((o) => o.status !== 'fulfilled')
    : baseOrders;

  if (view === 'month') {
    renderMonthCalendar(filtered);
  } else {
    renderAgendaCalendar(filtered);
  }
}

function renderAgendaCalendar(datedOrders) {
  const sorted = [...datedOrders].sort(
    (a, b) => new Date(a.delivery_date) - new Date(b.delivery_date)
  );

  if (sorted.length === 0) {
    setEmptyState('calendar', true);
    return;
  }
  setEmptyState('calendar', false);

  sorted.forEach((order) => {
    const item = document.createElement('li');
    const time = document.createElement('time');
    time.dateTime = order.delivery_date;
    const longDate = formatLongDate(order.delivery_date);
    const timeSlotLabel = formatDeliveryTimeSlot(order.delivery_time_slot);
    const statusLabel = order.status === 'fulfilled' ? ' · Fulfilled' : '';
    time.textContent = [longDate, timeSlotLabel].filter(Boolean).join(' · ');

    const details = document.createElement('p');
    details.className = 'card-detail';
    details.textContent = `${order.client_name} · ${order.card_message || ''}`;

    const address = document.createElement('p');
    address.className = 'card-detail';
    address.textContent = order.delivery_address || '';

    const status = document.createElement('span');
    status.className = 'status-pill';
    status.dataset.status = order.status;
    status.textContent =
      order.status === 'fulfilled' ? 'Fulfilled' : 'Unfulfilled';

    item.appendChild(time);
    item.appendChild(details);
    item.appendChild(address);
    item.appendChild(status);
    calendarList.appendChild(item);
  });
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getMonthGridDays(refDate) {
  const start = startOfMonth(refDate);
  const end = endOfMonth(refDate);
  const days = [];
  const firstDay = new Date(start);
  firstDay.setDate(firstDay.getDate() - ((firstDay.getDay() + 6) % 7)); // Monday-start
  const lastDay = new Date(end);
  lastDay.setDate(lastDay.getDate() + (7 - ((lastDay.getDay() + 6) % 7) - 1));
  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
}

function renderMonthCalendar(datedOrders) {
  const now = new Date();
  const days = getMonthGridDays(now);

  // Group orders by date (YYYY-MM-DD)
  const byDate = new Map();
  datedOrders.forEach((o) => {
    const key = (o.delivery_date || '').slice(0, 10);
    if (!key) return;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(o);
  });

  if (days.length === 0) {
    setEmptyState('calendar', true);
    return;
  }
  setEmptyState('calendar', false);

  // Render as a simple 7-column grid using <li> rows
  const weekHeader = document.createElement('li');
  weekHeader.style.display = 'grid';
  weekHeader.style.gridTemplateColumns = 'repeat(7, 1fr)';
  weekHeader.style.gap = '0.5rem';
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  weekdays.forEach((wd) => {
    const div = document.createElement('div');
    div.style.fontWeight = '600';
    div.textContent = wd;
    weekHeader.appendChild(div);
  });
  calendarList.appendChild(weekHeader);

  const row = document.createElement('li');
  row.style.display = 'grid';
  row.style.gridTemplateColumns = 'repeat(7, 1fr)';
  row.style.gap = '0.5rem';

  days.forEach((day, idx) => {
    const cell = document.createElement('div');
    cell.style.background = 'var(--surface-muted, #f7f5f3)';
    cell.style.borderRadius = '12px';
    cell.style.padding = '0.5rem';
    const dateLabel = document.createElement('div');
    dateLabel.style.fontWeight = '600';
    dateLabel.style.marginBottom = '0.25rem';
    dateLabel.textContent = day.getDate().toString();
    cell.appendChild(dateLabel);

    const key = day.toISOString().slice(0, 10);
    const dayOrders = byDate.get(key) || [];
    dayOrders.slice(0, 3).forEach((o) => {
      const badge = document.createElement('div');
      badge.className = 'status-pill';
      badge.dataset.status = o.status;
      badge.textContent = o.client_name;
      badge.style.display = 'inline-block';
      badge.style.marginRight = '0.25rem';
      badge.style.marginBottom = '0.25rem';
      cell.appendChild(badge);
    });
    if (dayOrders.length > 3) {
      const more = document.createElement('div');
      more.textContent = `+${dayOrders.length - 3} more`;
      more.style.fontSize = '0.85rem';
      more.style.color = 'var(--text-muted)';
      cell.appendChild(more);
    }

    row.appendChild(cell);

    // append row every 7 cells
    if ((idx + 1) % 7 === 0) {
      calendarList.appendChild(row.cloneNode(true));
      while (row.firstChild) row.removeChild(row.firstChild);
    }
  });
}

function resetForm() {
  orderForm.reset();
  if (bouquetTypeSelect && bouquetTypeSelect.options.length) {
    bouquetTypeSelect.value = bouquetTypeSelect.options[0].value;
  }
  if (deliveryTimeSelect && deliveryTimeSelect.options.length) {
    deliveryTimeSelect.value = deliveryTimeSelect.options[0].value;
  }
  if (priceHkdInput) {
    priceHkdInput.value = '';
  }
  editingOrderId = null;
  deleteOrderButton.hidden = true;
  orderFormTitle.textContent = 'New order';
  orderForm.dataset.mode = 'create';
}

function openOrderDialog(order = null) {
  if (order) {
    editingOrderId = order.id;
    orderFormTitle.textContent = 'Update order';
    orderForm.clientName.value = order.client_name || '';
    orderForm.clientPhone.value = order.client_phone || '';
    orderForm.clientEmail.value = order.client_email || '';
    orderForm.deliveryDate.value = order.delivery_date
      ? order.delivery_date.slice(0, 10)
      : '';
    if (orderForm.bouquetType) {
      ensureBouquetOption(order.bouquet_type);
      const defaultBouquet =
        bouquetTypeSelect && bouquetTypeSelect.options.length
          ? bouquetTypeSelect.options[0].value
          : '';
      orderForm.bouquetType.value = order.bouquet_type || defaultBouquet;
    }
    if (orderForm.priceHkd) {
      orderForm.priceHkd.value = order.price_hkd || '';
    }
    if (orderForm.deliveryTimeSlot) {
      ensureDeliveryTimeOption(
        order.delivery_time_slot,
        formatDeliveryTimeSlot(order.delivery_time_slot)
      );
      const defaultSlot =
        deliveryTimeSelect && deliveryTimeSelect.options.length
          ? deliveryTimeSelect.options[0].value
          : '';
      orderForm.deliveryTimeSlot.value =
        order.delivery_time_slot || defaultSlot;
    }
    orderForm.cardMessage.value = order.card_message || '';
    orderForm.deliveryAddress.value = order.delivery_address || '';
    orderForm.orderStatus.value = order.status || 'pending';
    orderForm.notes.value = order.internal_notes || '';
    deleteOrderButton.hidden = false;
    orderForm.dataset.mode = 'update';
  } else {
    resetForm();
  }

  if (orderDialog) {
    orderDialog.hidden = false;
    document.body.classList.add('dialog-open');
    if (modalContent) {
      modalContent.scrollTop = 0;
    }
    if (orderForm.clientName) {
      orderForm.clientName.focus();
    }
  }
}

function closeOrderDialog() {
  if (orderDialog) {
    orderDialog.hidden = true;
  }
  document.body.classList.remove('dialog-open');
  resetForm();
}

async function fetchOrders() {
  if (!supabase) {
    console.warn(
      'Supabase is not configured. Update js/config.js with your project keys.'
    );
    showToast('Add your Supabase keys to start saving orders.', 4000);
    setEmptyState('orders', true);
    setEmptyState('clients', true);
    setEmptyState('calendar', true);
    return;
  }

  const { data, error } = await supabase
    .from('orders')
    .select(
      `id, client_id, client_name, client_phone, client_email, delivery_date, bouquet_type, price_hkd, delivery_time_slot, card_message, delivery_address, status, internal_notes, created_at, clients ( client_code )`
    )
    .order('delivery_date', { ascending: true, nullsFirst: false });

  if (error) {
    console.error(error);
    showToast("Couldn't load orders. Check Supabase settings.");
    return;
  }

  orders = data || [];
  renderOrders();
  renderClients();
  renderCalendar();
}

async function saveOrder(event) {
  event.preventDefault();
  if (!supabase) {
    showToast('Configure Supabase to enable saving.');
    return;
  }

  const priceValue = orderForm.priceHkd ? orderForm.priceHkd.value.trim() : '';

  const payload = {
    client_name: orderForm.clientName.value.trim(),
    client_phone: orderForm.clientPhone.value.trim(),
    client_email: orderForm.clientEmail.value.trim() || null,
    delivery_date: orderForm.deliveryDate.value || null,
    bouquet_type: orderForm.bouquetType ? orderForm.bouquetType.value : null,
    price_hkd: priceValue ? priceValue : null,
    delivery_time_slot: orderForm.deliveryTimeSlot
      ? orderForm.deliveryTimeSlot.value
      : null,
    card_message: orderForm.cardMessage.value.trim(),
    delivery_address: orderForm.deliveryAddress.value.trim(),
    status: orderForm.orderStatus.value,
    internal_notes: orderForm.notes.value.trim() || null,
  };

  let response;

  if (editingOrderId) {
    response = await supabase
      .from('orders')
      .update(payload)
      .eq('id', editingOrderId);
  } else {
    response = await supabase
      .from('orders')
      .insert({ ...payload, submission_source: 'manual' });
  }

  const { error } = response;

  if (error) {
    console.error(error);
    showToast('Could not save order. Please try again.');
    return;
  }

  closeOrderDialog();
  showToast(editingOrderId ? 'Order updated' : 'Order added');
  await fetchOrders();
}

async function deleteOrder() {
  if (!supabase || !editingOrderId) {
    closeOrderDialog();
    return;
  }

  const confirmation = confirm('Delete this order? This cannot be undone.');
  if (!confirmation) return;

  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', editingOrderId);

  if (error) {
    console.error(error);
    showToast('Could not delete order.');
    return;
  }

  closeOrderDialog();
  showToast('Order deleted');
  await fetchOrders();
}

function initTabs() {
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => switchTab(button.dataset.target));
  });
}

function initDialog() {
  addOrderButton.addEventListener('click', () => openOrderDialog());
  closeDialogButton.addEventListener('click', closeOrderDialog);
  if (modalOverlay) {
    modalOverlay.addEventListener('click', closeOrderDialog);
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && orderDialog && !orderDialog.hidden) {
      closeOrderDialog();
    }
  });
  deleteOrderButton.addEventListener('click', deleteOrder);
  orderForm.addEventListener('submit', saveOrder);
}

function initStatusFilter() {
  statusFilter.addEventListener('change', renderOrders);
}

function initCalendarControls() {
  if (calendarViewSelect) {
    calendarViewSelect.addEventListener('change', renderCalendar);
  }
  if (hideFulfilledCheckbox) {
    hideFulfilledCheckbox.addEventListener('change', renderCalendar);
  }
}

function initClientLinkCopy() {
  if (!clientLinkButton || !navigator.clipboard) return;

  clientLinkButton.addEventListener('click', async (event) => {
    event.preventDefault();
    const link = new URL('order.html', window.location.href).toString();
    try {
      await navigator.clipboard.writeText(link);
      showToast('Client link copied to clipboard');
    } catch (error) {
      console.warn(error);
      window.open('order.html', '_blank');
    }
  });
}

async function initAuth() {
  if (!ENABLE_AUTH || !supabase) {
    signOutButton.hidden = true;
    if (!supabase) {
      fetchOrders();
    }
    return;
  }

  const authContainer = document.createElement('section');
  authContainer.className = 'auth-overlay';
  authContainer.innerHTML = `
    <div class="auth-card">
      <h2>Sign in</h2>
      <p>Use your business email and password to access the dashboard.</p>
      <form id="authForm">
        <label for="authEmail">Email address</label>
        <input id="authEmail" type="email" required placeholder="you@kewgardenflowers.com" />
        <label for="authPassword">Password</label>
        <input id="authPassword" type="password" required placeholder="Password" minlength="6" />
        <button type="submit" class="primary-button">Sign in</button>
      </form>
      <p class="auth-note">Use the password you set in Supabase Auth.</p>
    </div>`;

  document.body.appendChild(authContainer);

  const authForm = authContainer.querySelector('#authForm');

  async function handleSession(session) {
    authSession = session;
    if (session) {
      authContainer.remove();
      signOutButton.hidden = false;
      await fetchOrders();
    } else {
      signOutButton.hidden = true;
    }
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  await handleSession(session);

  supabase.auth.onAuthStateChange((_event, session) => {
    handleSession(session);
  });

  authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = authForm.authEmail.value.trim();
    const password = authForm.authPassword.value;

    const domain = email.split('@').pop();
    if (
      ALLOWED_EMAIL_DOMAINS.length &&
      !ALLOWED_EMAIL_DOMAINS.includes(domain)
    ) {
      showToast('Email not allowed. Use your business email.');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      console.error(error);
      showToast('Could not send link. Try again.');
      return;
    }

    showToast('Magic link sent!', 3200);
  });

  signOutButton.addEventListener('click', async () => {
    await supabase.auth.signOut();
  });
}

function injectAuthStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .auth-overlay {
      position: fixed;
      inset: 0;
      background: rgba(47, 44, 40, 0.55);
      display: grid;
      place-items: center;
      padding: 1.5rem;
      z-index: 20;
    }
    .auth-card {
      background: var(--surface);
      padding: 2rem;
      border-radius: var(--radius);
      max-width: 360px;
      width: min(100%, 360px);
      display: grid;
      gap: 1rem;
      text-align: center;
      box-shadow: var(--shadow);
    }
    .auth-card h2 {
      margin: 0;
      font-family: "Playfair Display", serif;
    }
    .auth-card form {
      display: grid;
      gap: 0.6rem;
      text-align: left;
    }
    .auth-card label {
      display: block;
      font-weight: 500;
    }
    .auth-card input {
      padding: 0.6rem 0.75rem;
      border-radius: 12px;
      border: 1px solid rgba(47, 44, 40, 0.12);
      font: inherit;
      width: 100%;
    }
    .auth-note {
      margin: 0;
      font-size: 0.85rem;
      color: var(--text-muted);
    }
  `;
  document.head.appendChild(style);
}

function init() {
  deleteOrderButton.hidden = true;
  signOutButton.hidden = true;

  initTabs();
  initDialog();
  initStatusFilter();
  initCalendarControls();
  initClientLinkCopy();
  injectAuthStyles();

  if (ENABLE_AUTH) {
    initAuth();
  } else {
    fetchOrders();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
