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

// Invoice-related elements
const createInvoiceButton = document.getElementById('createInvoiceButton');
const invoicesList = document.getElementById('invoicesList');
const invoiceDialog = document.getElementById('invoiceDialog');
const invoiceForm = document.getElementById('invoiceForm');
const invoiceFormTitle = document.getElementById('invoiceFormTitle');
const closeInvoiceDialogButton = document.getElementById('closeInvoiceDialog');
const deleteInvoiceButton = document.getElementById('deleteInvoice');
const invoiceStatusFilter = document.getElementById('invoiceStatusFilter');
const invoiceOrdersList = document.getElementById('invoiceOrdersList');
const invoiceClientSelect = document.getElementById('invoiceClient');

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
let invoices = [];
let bouquetTypes = [];
let editingOrderId = null;
let editingInvoiceId = null;
let authSession = null;
let selectedOrdersForInvoice = new Set();
let activeTab = localStorage.getItem('lastActiveTab') || 'orders';
let fetchOrdersPromise = null;

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
  activeTab = targetId;
  try {
    localStorage.setItem('lastActiveTab', targetId);
  } catch (error) {
    console.warn('Unable to persist active tab:', error);
  }
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
  } else if (targetId === 'invoices') {
    renderInvoices();
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
  for (const entry of DELIVERY_TIME_SLOTS) {
    if (entry.value === slotValue) {
      return entry.label;
    }
  }
  return slotValue;
}

// Load bouquet types from database
async function loadBouquetTypes() {
  if (!supabase) return;

  const { data, error } = await supabase
    .from('bouquet_types')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error loading bouquet types:', error);
    return;
  }

  bouquetTypes = data || [];
  populateBouquetDropdown();
}

// Populate bouquet type dropdown
function populateBouquetDropdown() {
  if (!bouquetTypeSelect) return;

  // Clear existing options
  bouquetTypeSelect.innerHTML = '';

  bouquetTypes.forEach((bouquet) => {
    const option = document.createElement('option');
    option.value = bouquet.name;
    option.textContent = bouquet.name;
    option.dataset.price = bouquet.price_hkd || '';
    bouquetTypeSelect.appendChild(option);
  });

  // Auto-fill price when bouquet is selected
  bouquetTypeSelect.addEventListener('change', function () {
    const selectedOption = this.options[this.selectedIndex];
    if (selectedOption && selectedOption.dataset.price && priceHkdInput) {
      priceHkdInput.value = selectedOption.dataset.price;
    }
  });
}

function clearList(list) {
  while (list.firstChild) {
    list.removeChild(list.firstChild);
  }
}

function renderOrders() {
  if (!ordersList) return;
  clearList(ordersList);

  const filter = statusFilter ? statusFilter.value : 'all';

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
  if (!template) {
    console.warn('Order card template not found.');
    return;
  }

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
      const oldStatus = order.status;

      // Optimistic UI update
      order.status = newStatus;

      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', order.id);

      if (error) {
        // Revert on error
        order.status = oldStatus;
        console.error(error);
        showToast('Could not update status.');
        renderOrders();
        return;
      }

      showToast(
        newStatus === 'fulfilled' ? 'Marked fulfilled' : 'Marked unfulfilled'
      );

      // Re-render to respect current filter
      renderOrders();
    });

    const openButton = clone.querySelector('button');
    openButton.addEventListener('click', () => openOrderDialog(order));

    ordersList.appendChild(clone);
  });
}

function renderClients() {
  clearList(clientsList);
  const clientMap = new Map();

  // Get sorting and search preferences
  const sortBy = document.getElementById('clientSortBy')?.value || 'name';
  const searchTerm =
    document.getElementById('clientSearch')?.value.toLowerCase() || '';

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
      totalSpent: 0,
      lastOrderDate: null,
    };

    // Preserve a non-empty client_code if we encounter it later
    if (!existing.client_code && codeFromOrder) {
      existing.client_code = codeFromOrder;
    }

    existing.orders.push(order);

    // Calculate total spent
    if (order.price_hkd) {
      existing.totalSpent += parseFloat(order.price_hkd);
    }

    // Track last order date
    if (order.created_at) {
      const orderDate = new Date(order.created_at);
      if (!existing.lastOrderDate || orderDate > existing.lastOrderDate) {
        existing.lastOrderDate = orderDate;
      }
    }

    clientMap.set(key, existing);
  });

  let clients = [...clientMap.values()];

  // Apply search filter
  if (searchTerm) {
    clients = clients.filter(
      (client) =>
        client.client_name.toLowerCase().includes(searchTerm) ||
        (client.client_email &&
          client.client_email.toLowerCase().includes(searchTerm)) ||
        (client.client_phone &&
          client.client_phone.toLowerCase().includes(searchTerm))
    );
  }

  // Apply sorting
  clients.sort((a, b) => {
    switch (sortBy) {
      case 'orders':
        return b.orders.length - a.orders.length;
      case 'total':
        return b.totalSpent - a.totalSpent;
      case 'recent':
        return (b.lastOrderDate || 0) - (a.lastOrderDate || 0);
      case 'name':
      default:
        return a.client_name.localeCompare(b.client_name);
    }
  });

  // Update client stats
  const statsDiv = document.getElementById('clientStats');
  const totalClientsEl = document.getElementById('totalClients');
  const totalRevenueEl = document.getElementById('totalRevenue');

  if (clients.length > 0 && statsDiv) {
    statsDiv.style.display = 'flex';
    if (totalClientsEl) totalClientsEl.textContent = clients.length;

    const totalRevenue = clients.reduce(
      (sum, client) => sum + client.totalSpent,
      0
    );
    if (totalRevenueEl)
      totalRevenueEl.textContent = `HKD ${totalRevenue.toFixed(2)}`;
  } else if (statsDiv) {
    statsDiv.style.display = 'none';
  }

  if (clients.length === 0) {
    setEmptyState('clients', true);
    return;
  }
  setEmptyState('clients', false);

  const template = document.getElementById('clientCardTemplate');
  if (!template) {
    console.warn('Client card template not found.');
    return;
  }

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

    const orderCount = clone.querySelector('.order-count');
    orderCount.textContent = `${client.orders.length} order${
      client.orders.length === 1 ? '' : 's'
    }`;

    // Add total spent info
    if (client.totalSpent > 0) {
      orderCount.textContent += ` · HKD ${client.totalSpent.toFixed(2)}`;
    }

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

function initClientControls() {
  const sortBy = document.getElementById('clientSortBy');
  const search = document.getElementById('clientSearch');

  if (sortBy) {
    sortBy.addEventListener('change', renderClients);
  }

  if (search) {
    search.addEventListener('input', renderClients);
  }
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
  if (fetchOrdersPromise) {
    return fetchOrdersPromise;
  }

  if (!supabase) {
    console.warn(
      'Supabase is not configured. Update js/config.js with your project keys.'
    );
    showToast('Add your Supabase keys to start saving orders.', 4000);
    setEmptyState('orders', true);
    setEmptyState('clients', true);
    setEmptyState('calendar', true);
    setEmptyState('invoices', true);
    return Promise.resolve();
  }

  fetchOrdersPromise = supabase
    .from('orders')
    .select(
      `id, client_id, client_name, client_phone, client_email, delivery_date, bouquet_type, price_hkd, delivery_time_slot, card_message, delivery_address, status, internal_notes, created_at, clients ( client_code )`
    )
    .order('delivery_date', { ascending: true, nullsFirst: false })
    .then(async ({ data, error }) => {
      if (error) {
        console.error(error);
        showToast("Couldn't load orders. Check Supabase settings.");
        return;
      }

      orders = data || [];
      renderOrders();
      renderClients();
      renderCalendar();

      // Re-render the currently active tab to ensure latest data appears
      if (activeTab) {
        switchTab(activeTab);
      }

      // Also load invoices and bouquet types
      await fetchInvoices();
      await loadBouquetTypes();
    })
    .finally(() => {
      fetchOrdersPromise = null;
    });

  return fetchOrdersPromise;
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

// ============= INVOICE MANAGEMENT =============

async function fetchInvoices() {
  if (!supabase) {
    setEmptyState('invoices', true);
    return;
  }

  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .order('invoice_date', { ascending: false });

  if (error) {
    console.error(error);
    showToast("Couldn't load invoices.");
    return;
  }

  invoices = data || [];
  renderInvoices();
}

function renderInvoices() {
  if (!invoicesList) return;

  clearList(invoicesList);
  const filter = invoiceStatusFilter ? invoiceStatusFilter.value : 'all';

  const filteredInvoices = invoices.filter((invoice) => {
    if (filter === 'all') return true;
    return invoice.status === filter;
  });

  if (filteredInvoices.length === 0) {
    setEmptyState('invoices', true);
    return;
  }
  setEmptyState('invoices', false);

  const template = document.getElementById('invoiceCardTemplate');
  if (!template) {
    console.warn('Invoice card template not found.');
    return;
  }

  filteredInvoices.forEach((invoice) => {
    const clone = template.content.firstElementChild.cloneNode(true);

    clone.querySelector(
      '.card-title'
    ).textContent = `${invoice.invoice_number} · ${invoice.client_name}`;

    const pill = clone.querySelector('.status-pill');
    pill.dataset.status = invoice.status;
    pill.textContent =
      invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1);

    const details = clone.querySelectorAll('.card-detail');
    details[0].textContent = `Date: ${formatDate(invoice.invoice_date)}`;
    details[1].textContent = invoice.due_date
      ? `Due: ${formatDate(invoice.due_date)}`
      : '';

    const amountEl = clone.querySelector('.invoice-amount');
    amountEl.textContent = `HKD ${parseFloat(invoice.total || 0).toFixed(2)}`;

    // View button
    const viewBtn = clone.querySelector('.btn-view');
    viewBtn.addEventListener('click', () => openInvoiceDialog(invoice));

    // Download PDF button
    const downloadBtn = clone.querySelector('.btn-download');
    downloadBtn.addEventListener('click', () => downloadInvoicePDF(invoice));

    invoicesList.appendChild(clone);
  });
}

async function openInvoiceDialog(invoice = null) {
  // Populate client dropdown
  await populateClientDropdown();

  if (invoice) {
    editingInvoiceId = invoice.id;
    invoiceFormTitle.textContent = 'View/Edit invoice';
    invoiceForm.invoiceNumber.value = invoice.invoice_number || '';
    invoiceForm.invoiceDate.value = invoice.invoice_date || '';
    invoiceForm.invoiceDueDate.value = invoice.due_date || '';
    invoiceForm.invoiceNotes.value = invoice.notes || '';
    invoiceForm.invoiceSubtotal.value = `HKD ${parseFloat(
      invoice.subtotal || 0
    ).toFixed(2)}`;
    invoiceForm.invoiceTotal.value = `HKD ${parseFloat(
      invoice.total || 0
    ).toFixed(2)}`;

    // Load invoice items
    await loadInvoiceItems(invoice.id);

    if (deleteInvoiceButton) {
      deleteInvoiceButton.hidden = false;
    }
  } else {
    resetInvoiceForm();
    // Generate new invoice number
    const invoiceNumber = await generateInvoiceNumber();
    invoiceForm.invoiceNumber.value = invoiceNumber;
    invoiceForm.invoiceDate.value = new Date().toISOString().split('T')[0];
  }

  if (invoiceDialog) {
    invoiceDialog.hidden = false;
    document.body.classList.add('dialog-open');
  }
}

function closeInvoiceDialog() {
  if (invoiceDialog) {
    invoiceDialog.hidden = true;
  }
  document.body.classList.remove('dialog-open');
  resetInvoiceForm();
}

function resetInvoiceForm() {
  invoiceForm.reset();
  editingInvoiceId = null;
  selectedOrdersForInvoice.clear();
  if (deleteInvoiceButton) {
    deleteInvoiceButton.hidden = true;
  }
  invoiceFormTitle.textContent = 'Create invoice';
  invoiceForm.invoiceSubtotal.value = 'HKD 0.00';
  invoiceForm.invoiceTotal.value = 'HKD 0.00';
  if (invoiceOrdersList) {
    invoiceOrdersList.innerHTML =
      '<p style="color: var(--text-muted); font-size: 0.9rem;">Select a client to see their orders</p>';
  }
}

async function populateClientDropdown() {
  if (!invoiceClientSelect) return;

  // Get unique clients from orders
  const clientMap = new Map();
  orders.forEach((order) => {
    const key = order.client_email || order.client_phone || order.client_name;
    if (!clientMap.has(key)) {
      clientMap.set(key, {
        name: order.client_name,
        email: order.client_email,
        phone: order.client_phone,
        id: order.client_id,
      });
    }
  });

  invoiceClientSelect.innerHTML = '<option value="">Select client...</option>';

  Array.from(clientMap.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((client) => {
      const option = document.createElement('option');
      option.value = JSON.stringify(client);
      option.textContent = client.name;
      invoiceClientSelect.appendChild(option);
    });

  // Listen for client selection change
  invoiceClientSelect.removeEventListener('change', loadClientOrders);
  invoiceClientSelect.addEventListener('change', loadClientOrders);
}

async function loadClientOrders() {
  if (!invoiceClientSelect || !invoiceClientSelect.value) {
    if (invoiceOrdersList) {
      invoiceOrdersList.innerHTML =
        '<p style="color: var(--text-muted); font-size: 0.9rem;">Select a client to see their orders</p>';
    }
    return;
  }

  const client = JSON.parse(invoiceClientSelect.value);

  selectedOrdersForInvoice.clear();
  if (invoiceForm) {
    invoiceForm.invoiceSubtotal.value = 'HKD 0.00';
    invoiceForm.invoiceTotal.value = 'HKD 0.00';
  }

  // Filter orders for this client
  const clientOrders = orders.filter(
    (order) =>
      order.client_name === client.name &&
      order.price_hkd &&
      parseFloat(order.price_hkd) > 0
  );

  if (clientOrders.length === 0) {
    invoiceOrdersList.innerHTML =
      '<p style="color: var(--text-muted); font-size: 0.9rem;">No orders with prices for this client</p>';
    return;
  }

  // Render order checkboxes
  invoiceOrdersList.innerHTML = '';
  clientOrders.forEach((order) => {
    const div = document.createElement('div');
    div.className = 'order-checkbox-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `order-${order.id}`;
    checkbox.value = order.id;
    checkbox.dataset.price = order.price_hkd;

    const label = document.createElement('label');
    label.htmlFor = `order-${order.id}`;
    label.innerHTML = `
      ${order.bouquet_type || 'Order'} - HKD ${parseFloat(
      order.price_hkd
    ).toFixed(2)}
      <span>${formatDate(order.delivery_date)}</span>
    `;

    checkbox.addEventListener('change', updateInvoiceTotals);

    div.appendChild(checkbox);
    div.appendChild(label);
    invoiceOrdersList.appendChild(div);
  });
}

function updateInvoiceTotals() {
  const checkboxes = invoiceOrdersList.querySelectorAll(
    'input[type="checkbox"]:checked'
  );
  let subtotal = 0;

  selectedOrdersForInvoice.clear();
  checkboxes.forEach((cb) => {
    subtotal += parseFloat(cb.dataset.price || 0);
    selectedOrdersForInvoice.add(cb.value);
  });

  const total = subtotal; // Can add tax calculation here if needed

  invoiceForm.invoiceSubtotal.value = `HKD ${subtotal.toFixed(2)}`;
  invoiceForm.invoiceTotal.value = `HKD ${total.toFixed(2)}`;
}

async function generateInvoiceNumber() {
  if (!supabase) return 'INV-0001';

  const { data, error } = await supabase.rpc('generate_invoice_number');

  if (error || !data) {
    // Fallback: generate based on count
    const count = invoices.length + 1;
    const today = new Date();
    const yearMonth = today.toISOString().slice(0, 7).replace('-', '');
    return `INV-${yearMonth}-${String(count).padStart(4, '0')}`;
  }

  return data;
}

async function loadInvoiceItems(invoiceId) {
  if (!supabase) return;

  const { data, error } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoiceId);

  if (error) {
    console.error(error);
    return;
  }

  // Display items in the orders list area
  if (data && data.length > 0 && invoiceOrdersList) {
    invoiceOrdersList.innerHTML = '';
    data.forEach((item) => {
      const div = document.createElement('div');
      div.className = 'order-checkbox-item';
      div.innerHTML = `
        <label style="pointer-events: none;">
          ${item.description} - HKD ${parseFloat(item.amount).toFixed(2)}
          <span>Qty: ${item.quantity} × ${parseFloat(item.unit_price).toFixed(
        2
      )}</span>
        </label>
      `;
      invoiceOrdersList.appendChild(div);
    });
  }
}

async function saveInvoice(event) {
  event.preventDefault();
  if (!supabase) {
    showToast('Configure Supabase to enable saving.');
    return;
  }

  if (!invoiceClientSelect.value) {
    showToast('Please select a client.');
    return;
  }

  const client = JSON.parse(invoiceClientSelect.value);

  // Extract numeric values from formatted strings
  const subtotalStr = invoiceForm.invoiceSubtotal.value.replace(/[^0-9.]/g, '');
  const totalStr = invoiceForm.invoiceTotal.value.replace(/[^0-9.]/g, '');

  const subtotal = parseFloat(subtotalStr) || 0;
  const total = parseFloat(totalStr) || 0;

  if (total === 0 && selectedOrdersForInvoice.size === 0) {
    showToast('Please select at least one order or add items.');
    return;
  }

  const invoicePayload = {
    invoice_number: invoiceForm.invoiceNumber.value,
    client_id: client.id,
    client_name: client.name,
    client_email: client.email,
    client_phone: client.phone,
    invoice_date: invoiceForm.invoiceDate.value,
    due_date: invoiceForm.invoiceDueDate.value || null,
    subtotal: subtotal,
    tax: 0,
    total: total,
    status: 'draft',
    notes: invoiceForm.invoiceNotes.value.trim() || null,
  };

  let invoiceId;

  if (editingInvoiceId) {
    const { error } = await supabase
      .from('invoices')
      .update(invoicePayload)
      .eq('id', editingInvoiceId);

    if (error) {
      console.error(error);
      showToast('Could not update invoice.');
      return;
    }
    invoiceId = editingInvoiceId;
  } else {
    const { data, error } = await supabase
      .from('invoices')
      .insert(invoicePayload)
      .select();

    if (error) {
      console.error(error);
      showToast('Could not create invoice.');
      return;
    }
    invoiceId = data[0].id;

    // Create invoice items
    if (selectedOrdersForInvoice.size > 0) {
      const items = Array.from(selectedOrdersForInvoice)
        .map((orderId) => {
          // Find order by comparing as strings to handle type mismatches
          const order = orders.find((o) => String(o.id) === String(orderId));

          if (!order) {
            console.warn(`Order with ID ${orderId} not found in orders array`);
            return null;
          }

          return {
            invoice_id: invoiceId,
            order_id: order.id,
            description: `${order.bouquet_type || 'Bouquet'} - ${formatDate(
              order.delivery_date
            )}`,
            quantity: 1,
            unit_price: parseFloat(order.price_hkd) || 0,
            amount: parseFloat(order.price_hkd) || 0,
          };
        })
        .filter((item) => item !== null); // Remove any null entries

      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(items);

        if (itemsError) {
          console.error('Error creating invoice items:', itemsError);
          showToast('Invoice created but some items failed to save.');
        }
      }
    }
  }

  closeInvoiceDialog();
  showToast(editingInvoiceId ? 'Invoice updated' : 'Invoice created');
  await fetchInvoices();
}

async function deleteInvoice() {
  if (!supabase || !editingInvoiceId) {
    closeInvoiceDialog();
    return;
  }

  const confirmation = confirm('Delete this invoice? This cannot be undone.');
  if (!confirmation) return;

  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', editingInvoiceId);

  if (error) {
    console.error(error);
    showToast('Could not delete invoice.');
    return;
  }

  closeInvoiceDialog();
  showToast('Invoice deleted');
  await fetchInvoices();
}

async function downloadInvoicePDF(invoice) {
  showToast('PDF generation coming soon...', 2000);
  // TODO: Implement PDF generation using jsPDF or pdfmake
  console.log('Generate PDF for invoice:', invoice);
}

function initTabs() {
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      switchTab(button.dataset.target);
      // Persist tab selection
      localStorage.setItem('lastActiveTab', button.dataset.target);
    });
  });

  // Restore tab from URL parameter or localStorage
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab');
  const savedTab = localStorage.getItem('lastActiveTab');

  if (tabParam) {
    activeTab = tabParam;
    localStorage.setItem('lastActiveTab', tabParam);
    // Don't call switchTab yet - let fetchOrders handle rendering after data loads
  } else if (savedTab) {
    activeTab = savedTab;
    // Don't call switchTab yet - let fetchOrders handle rendering after data loads
  }

  const availableTabs = new Set(tabButtons.map((button) => button.dataset.target));
  if (!availableTabs.has(activeTab)) {
    activeTab = 'orders';
    try {
      localStorage.setItem('lastActiveTab', activeTab);
    } catch (error) {
      console.warn('Unable to persist default tab selection:', error);
    }
  }

  // Set the UI state for active tab button
  tabButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.target === activeTab);
  });

  tabPanels.forEach((panel) => {
    panel.classList.toggle('active', panel.id === activeTab);
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

function initInvoiceDialog() {
  if (!createInvoiceButton || !invoiceDialog) return;

  createInvoiceButton.addEventListener('click', () => openInvoiceDialog());
  closeInvoiceDialogButton.addEventListener('click', closeInvoiceDialog);

  const invoiceModalOverlay = invoiceDialog.querySelector(
    '[data-close-invoice-dialog]'
  );
  if (invoiceModalOverlay) {
    invoiceModalOverlay.addEventListener('click', closeInvoiceDialog);
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && invoiceDialog && !invoiceDialog.hidden) {
      closeInvoiceDialog();
    }
  });

  if (deleteInvoiceButton) {
    deleteInvoiceButton.addEventListener('click', deleteInvoice);
    deleteInvoiceButton.hidden = true;
  }

  invoiceForm.addEventListener('submit', saveInvoice);
}

function initInvoiceFilter() {
  if (invoiceStatusFilter) {
    invoiceStatusFilter.addEventListener('change', renderInvoices);
  }
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

  let authContainer = document.querySelector('.auth-overlay');
  if (!authContainer) {
    authContainer = document.createElement('section');
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
  }

  const authForm = authContainer.querySelector('#authForm');
  const authEmailInput = authForm?.querySelector('#authEmail');
  const authPasswordInput = authForm?.querySelector('#authPassword');

  function showAuthOverlay() {
    if (authForm) authForm.reset();
    authContainer.hidden = false;
    authContainer.style.display = 'grid';
    authContainer.setAttribute('aria-hidden', 'false');
  }

  function hideAuthOverlay() {
    authContainer.hidden = true;
    authContainer.style.display = 'none';
    authContainer.setAttribute('aria-hidden', 'true');
  }

  function resetDashboardState() {
    orders = [];
    invoices = [];
    if (ordersList) clearList(ordersList);
    if (clientsList) clearList(clientsList);
    if (invoicesList) clearList(invoicesList);
    if (calendarList) clearList(calendarList);
    setEmptyState('orders', true);
    setEmptyState('clients', true);
    setEmptyState('invoices', true);
    setEmptyState('calendar', true);
  }

  let isSigningIn = false;
  let lastSessionToken = null;

  async function handleSession(session) {
    const currentToken = session?.access_token || null;

    // Avoid duplicate work if the session is unchanged
    if (currentToken === lastSessionToken && session) {
      signOutButton.hidden = false;
      hideAuthOverlay();
      return;
    }

    authSession = session;

    if (session) {
      hideAuthOverlay();
      signOutButton.hidden = false;
      await fetchOrders();
    } else {
      signOutButton.hidden = true;
      resetDashboardState();
      showAuthOverlay();
    }

    lastSessionToken = currentToken;
  }

  // Display overlay while we resolve the current session
  showAuthOverlay();

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await handleSession(session);
  } catch (error) {
    console.error('Error retrieving Supabase session:', error);
    resetDashboardState();
    showAuthOverlay();
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    handleSession(session);
  });

  if (authForm) {
    authForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (isSigningIn || !authEmailInput || !authPasswordInput) return;

      const email = authEmailInput.value.trim();
      const password = authPasswordInput.value;

      const domain = email.split('@').pop();
      if (
        ALLOWED_EMAIL_DOMAINS.length &&
        !ALLOWED_EMAIL_DOMAINS.includes(domain)
      ) {
        showToast('Email not allowed. Use your business email.');
        return;
      }

      try {
        isSigningIn = true;
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.error('Supabase sign-in error:', error);
          showToast('Sign in failed. Check your credentials.');
          return;
        }

        showToast('Signed in successfully!', 2000);
      } catch (error) {
        console.error('Unexpected sign-in error:', error);
        showToast('Could not sign in. Try again.');
      } finally {
        isSigningIn = false;
      }
    });
  }

  if (signOutButton) {
    signOutButton.hidden = true;
    signOutButton.addEventListener('click', async () => {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.error('Supabase sign-out error:', error);
          showToast('Could not sign out. Try again.');
          return;
        }

        showToast('Signed out successfully');
      } catch (error) {
        console.error('Unexpected sign-out error:', error);
        showToast('Could not sign out. Try again.');
      }
    });
  }
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
  initInvoiceDialog();
  initStatusFilter();
  initInvoiceFilter();
  initCalendarControls();
  initClientControls();
  initClientLinkCopy();
  injectAuthStyles();

  if (ENABLE_AUTH) {
    initAuth();
  } else {
    fetchOrders();
  }
}

// Ensure data is refreshed when returning via browser back/forward cache
window.addEventListener('pageshow', (event) => {
  const navEntries = performance.getEntriesByType('navigation');
  const navType = navEntries && navEntries[0] ? navEntries[0].type : null;
  if (event.persisted || navType === 'back_forward') {
    fetchOrders().then(() => {
      // After fetching, ensure the active tab is re-rendered
      if (activeTab) {
        switchTab(activeTab);
      }
    });
  }
});

window.addEventListener('popstate', () => {
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get('tab');
  if (tabParam && tabParam !== activeTab) {
    switchTab(tabParam);
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
