import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, ENABLE_AUTH } from './config.js';

const PLACEHOLDER_URL = 'https://your-project.supabase.co';
const PLACEHOLDER_KEY = 'public-anon-key';

const isConfigured =
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_URL.startsWith(PLACEHOLDER_URL) &&
  SUPABASE_ANON_KEY !== PLACEHOLDER_KEY;

// Create Supabase client with same auth config as app.js to ensure sessions persist
const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// DOM Elements
const titleEl = document.getElementById('clientTitle');
const form = document.getElementById('clientForm');
const ordersList = document.getElementById('ordersList');
const toast = document.querySelector('.toast');
const orderDialog = document.getElementById('orderDialog');
const orderForm = document.getElementById('orderForm');
const orderFormTitle = document.getElementById('orderFormTitle');
const closeDialogButton = document.getElementById('closeDialog');
const deleteOrderButton = document.getElementById('deleteOrder');
const orderStatusFilter = document.getElementById('orderStatusFilter');
const orderDateFilter = document.getElementById('orderDateFilter');
const customDateRange = document.getElementById('customDateRange');
const dateFrom = document.getElementById('dateFrom');
const dateTo = document.getElementById('dateTo');
const clientSummary = document.getElementById('clientSummary');
const backButton = document.getElementById('backButton');

// State
let allOrders = [];
let currentClient = null;
let editingOrderId = null;
let bouquetTypes = [];

// Initialize tab state persistence
if (backButton) {
  backButton.addEventListener('click', () => {
    localStorage.setItem('lastActiveTab', 'clients');
  });
}

function showToast(message, duration = 2400) {
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  setTimeout(() => (toast.hidden = true), duration);
}

function setEmptyState(visible) {
  const state = document.querySelector('[data-for="client-orders"]');
  if (state) state.classList.toggle('visible', visible);
}

function clearList(list) {
  while (list.firstChild) list.removeChild(list.firstChild);
}

function formatDate(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatDeliveryTimeSlot(slotValue) {
  if (!slotValue) return '';
  const slots = {
    '10am-12pm': '10am – 12pm',
    '1pm-3pm': '1pm – 3pm',
    '3pm-5pm': '3pm – 5pm',
    'self-pickup': 'Self pickup',
  };
  return slots[slotValue] || slotValue;
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

function populateBouquetDropdown() {
  const select = document.getElementById('orderBouquetType');
  if (!select) return;

  select.innerHTML = '';
  bouquetTypes.forEach((bouquet) => {
    const option = document.createElement('option');
    option.value = bouquet.name;
    option.textContent = bouquet.name;
    select.appendChild(option);
  });

  // If no bouquet types loaded, use defaults
  if (bouquetTypes.length === 0) {
    const defaults = [
      'Peony Sunrise',
      'Lavender Mist',
      'Autumn Ember',
      'Emerald Cascade',
      'Rose Quartz',
    ];
    defaults.forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
  }
}

function ensureBouquetOption(value) {
  const select = document.getElementById('orderBouquetType');
  if (!select || !value) return;

  const exists = [...select.options].some((option) => option.value === value);
  if (!exists) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
}

async function loadClientAndOrders() {
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('client_id');
  const key = params.get('key');

  if (!supabase) {
    setEmptyState(true);
    return;
  }

  // Load client if we have an ID
  if (clientId) {
    const { data, error } = await supabase
      .from('clients')
      .select('id, client_code, client_name, client_phone, client_email')
      .eq('id', clientId)
      .single();
    if (!error && data) {
      currentClient = {
        id: data.id,
        name: data.client_name,
        phone: data.client_phone,
        email: data.client_email,
        code: data.client_code,
      };
    }
  }

  // Load all orders for this client (more detailed)
  let query = supabase
    .from('orders')
    .select(
      'id, client_id, client_name, client_phone, client_email, delivery_date, delivery_time_slot, bouquet_type, price_hkd, card_message, delivery_address, status, internal_notes, created_at'
    );

  // Priority: client_id > key > currentClient
  if (clientId) {
    query = query.eq('client_id', clientId);
  } else if (key) {
    // Build OR condition for key matching
    const orConditions = [
      `client_email.eq.${key}`,
      `client_phone.eq.${key}`,
      `client_name.eq.${key}`,
    ].filter(Boolean);
    if (orConditions.length > 0) {
      query = query.or(orConditions.join(','));
    }
  } else if (currentClient) {
    // Build OR condition from current client data
    const orConditions = [];
    if (currentClient.email)
      orConditions.push(`client_email.eq.${currentClient.email}`);
    if (currentClient.phone)
      orConditions.push(`client_phone.eq.${currentClient.phone}`);
    if (currentClient.name)
      orConditions.push(`client_name.eq.${currentClient.name}`);
    if (orConditions.length > 0) {
      query = query.or(orConditions.join(','));
    } else {
      query = query.limit(0); // No results if we can't identify the client
    }
  } else {
    query = query.limit(0); // No results if we can't identify the client
  }

  const { data: orders, error: orderErr } = await query.order('delivery_date', {
    ascending: false,
    nullsFirst: false,
  });

  if (orderErr) {
    console.error('Error loading orders:', orderErr);
    showToast("Couldn't load client orders");
    return;
  }

  allOrders = orders || [];

  // Derive client from orders if we don't have one
  if (!currentClient && allOrders.length > 0) {
    const latest = allOrders[0];
    currentClient = {
      id: latest.client_id,
      name: latest.client_name,
      phone: latest.client_phone,
      email: latest.client_email,
    };
  }

  // Update UI with client info
  if (currentClient) {
    titleEl.textContent = currentClient.name || 'Client';
    form.clientName.value = currentClient.name || '';
    form.clientPhone.value = currentClient.phone || '';
    form.clientEmail.value = currentClient.email || '';

    // Update summary
    updateClientSummary();
  }

  // Render filtered orders
  renderOrders();

  // Load bouquet types for the order form
  await loadBouquetTypes();
}

function updateClientSummary() {
  if (!currentClient || !clientSummary) return;

  const totalOrders = allOrders.length;
  const totalSpent = allOrders.reduce((sum, o) => {
    return sum + (parseFloat(o.price_hkd) || 0);
  }, 0);
  const outstanding = allOrders.filter((o) => o.status === 'pending').length;

  // Update stats
  const totalOrdersStat = document.getElementById('totalOrdersStat');
  const totalSpentStat = document.getElementById('totalSpentStat');
  const outstandingStat = document.getElementById('outstandingStat');

  if (totalOrdersStat) totalOrdersStat.textContent = totalOrders;
  if (totalSpentStat)
    totalSpentStat.textContent = `HKD ${totalSpent.toFixed(2)}`;
  if (outstandingStat) outstandingStat.textContent = outstanding;

  // Update contact chips
  const phoneChip = document.getElementById('phoneChip');
  const emailChip = document.getElementById('emailChip');
  const phoneValue = document.getElementById('phoneValue');
  const emailValue = document.getElementById('emailValue');

  if (currentClient.phone && phoneChip && phoneValue) {
    phoneValue.textContent = currentClient.phone;
    phoneChip.style.display = 'flex';
  } else if (phoneChip) {
    phoneChip.style.display = 'none';
  }

  if (currentClient.email && emailChip && emailValue) {
    emailValue.textContent = currentClient.email;
    emailChip.style.display = 'flex';
  } else if (emailChip) {
    emailChip.style.display = 'none';
  }

  // Show summary if we have data
  clientSummary.style.display =
    currentClient.phone || currentClient.email || totalOrders > 0
      ? 'block'
      : 'none';
}

function getFilteredOrders() {
  let filtered = [...allOrders];

  // Status filter
  const statusFilter = orderStatusFilter?.value || 'all';
  if (statusFilter !== 'all') {
    filtered = filtered.filter((o) => o.status === statusFilter);
  }

  // Date filter
  const dateFilter = orderDateFilter?.value || 'all';
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (dateFilter === 'today') {
    const today = now.toISOString().split('T')[0];
    filtered = filtered.filter((o) => {
      if (!o.delivery_date) return false;
      return o.delivery_date.startsWith(today);
    });
  } else if (dateFilter === 'week') {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    filtered = filtered.filter((o) => {
      if (!o.delivery_date) return false;
      const orderDate = new Date(o.delivery_date);
      return orderDate >= weekAgo;
    });
  } else if (dateFilter === 'month') {
    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    filtered = filtered.filter((o) => {
      if (!o.delivery_date) return false;
      const orderDate = new Date(o.delivery_date);
      return orderDate >= monthAgo;
    });
  } else if (dateFilter === 'custom') {
    const from = dateFrom?.value;
    const to = dateTo?.value;
    if (from) {
      filtered = filtered.filter((o) => {
        if (!o.delivery_date) return false;
        return o.delivery_date >= from;
      });
    }
    if (to) {
      filtered = filtered.filter((o) => {
        if (!o.delivery_date) return false;
        return o.delivery_date <= to;
      });
    }
  }

  return filtered;
}

function renderOrders() {
  clearList(ordersList);
  const filtered = getFilteredOrders();

  if (filtered.length === 0) {
    setEmptyState(true);
    return;
  }
  setEmptyState(false);

  const template = document.getElementById('orderCardTemplate');

  filtered.forEach((order) => {
    const node = template.content.firstElementChild.cloneNode(true);

    // Title (bouquet type or "Order")
    const title = node.querySelector('.card-title');
    title.textContent = order.bouquet_type || `Order #${order.id.slice(0, 8)}`;

    // Status pill
    const pill = node.querySelector('.status-pill');
    pill.dataset.status = order.status;
    pill.textContent =
      order.status === 'fulfilled' ? 'Fulfilled' : 'Unfulfilled';
    pill.style.cursor = 'pointer';
    pill.title = 'Tap to toggle status';
    pill.addEventListener('click', async (event) => {
      event.stopPropagation();
      if (!supabase) return;

      const newStatus = order.status === 'fulfilled' ? 'pending' : 'fulfilled';

      // Optimistic update
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
        console.error('Order status toggle error:', error);
        showToast('Could not update status');
        return;
      }

      showToast(
        newStatus === 'fulfilled' ? 'Marked fulfilled' : 'Marked unfulfilled'
      );

      // Re-render to respect active filters and refresh stats
      renderOrders();
      updateClientSummary();
    });

    // Delivery date and time
    const deliveryLine = node.querySelector('.delivery-date');
    const dateStr = formatDate(order.delivery_date);
    const timeStr = formatDeliveryTimeSlot(order.delivery_time_slot);
    deliveryLine.textContent = `Delivery · ${[dateStr, timeStr]
      .filter(Boolean)
      .join(' · ')}`;

    // Details: [0] is delivery date, [1] is price/message, [2] is message/address
    const details = node.querySelectorAll('.card-detail');

    // Price and bouquet info
    const priceInfo = order.price_hkd
      ? `HKD ${parseFloat(order.price_hkd).toFixed(2)}`
      : '';
    const bouquetInfo = order.bouquet_type || '';
    const priceBouquet = [bouquetInfo, priceInfo].filter(Boolean).join(' · ');

    if (details[1]) {
      details[1].textContent = priceBouquet;
    }

    // Card message
    if (details[2]) {
      details[2].textContent = order.card_message || '';
    }

    // Add delivery address if available (create new detail element)
    if (order.delivery_address) {
      const existingAddress = node.querySelector(
        '.card-detail.delivery-address'
      );
      if (existingAddress) {
        existingAddress.textContent = order.delivery_address;
      } else {
        const addressP = document.createElement('p');
        addressP.className = 'card-detail delivery-address';
        addressP.textContent = order.delivery_address;
        const footer = node.querySelector('footer');
        if (footer) {
          node.insertBefore(addressP, footer);
        } else {
          node.appendChild(addressP);
        }
      }
    }

    // Edit button (only for unfulfilled orders)
    const editButton = node.querySelector('.order-edit-button');
    if (editButton) {
      editButton.style.display = 'inline-flex';
      editButton.addEventListener('click', (e) => {
        e.stopPropagation();
        openOrderDialog(order);
      });
    }

    // Make the entire card clickable to open the dialog
    node.style.cursor = 'pointer';
    node.addEventListener('click', (e) => {
      if (e.target !== editButton) {
        openOrderDialog(order);
      }
    });

    ordersList.appendChild(node);
  });
}

function openOrderDialog(order = null) {
  if (order) {
    editingOrderId = order.id;
    orderFormTitle.textContent = 'Update order';
    orderForm.orderDeliveryDate.value = order.delivery_date
      ? order.delivery_date.slice(0, 10)
      : '';

    // Ensure bouquet type exists in dropdown before setting value
    if (order.bouquet_type) {
      ensureBouquetOption(order.bouquet_type);
      orderForm.orderBouquetType.value = order.bouquet_type;
    } else {
      orderForm.orderBouquetType.value =
        orderForm.orderBouquetType.options[0]?.value || '';
    }

    orderForm.orderPriceHkd.value = order.price_hkd || '';
    orderForm.orderDeliveryTimeSlot.value = order.delivery_time_slot || '';
    orderForm.orderCardMessage.value = order.card_message || '';
    orderForm.orderDeliveryAddress.value = order.delivery_address || '';
    orderForm.orderStatus.value = order.status || 'pending';
    orderForm.orderNotes.value = order.internal_notes || '';
    if (deleteOrderButton) deleteOrderButton.hidden = false;
  } else {
    editingOrderId = null;
    orderForm.reset();
    if (deleteOrderButton) deleteOrderButton.hidden = true;
  }

  if (orderDialog) {
    orderDialog.hidden = false;
    document.body.classList.add('dialog-open');
    const modalContent = orderDialog.querySelector('.modal-content');
    if (modalContent) modalContent.scrollTop = 0;
  }
}

function closeOrderDialog() {
  if (orderDialog) {
    orderDialog.hidden = true;
  }
  document.body.classList.remove('dialog-open');
  editingOrderId = null;
  orderForm.reset();
  if (deleteOrderButton) deleteOrderButton.hidden = true;
}

async function saveOrder(event) {
  event.preventDefault();
  if (!supabase) {
    showToast('Supabase not configured');
    return;
  }

  if (ENABLE_AUTH) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      showToast('Please sign in to save orders', 3000);
      return;
    }
  }

  const payload = {
    delivery_date: orderForm.orderDeliveryDate.value || null,
    bouquet_type: orderForm.orderBouquetType.value || null,
    price_hkd: orderForm.orderPriceHkd.value.trim() || null,
    delivery_time_slot: orderForm.orderDeliveryTimeSlot.value || null,
    card_message: orderForm.orderCardMessage.value.trim(),
    delivery_address: orderForm.orderDeliveryAddress.value.trim(),
    status: orderForm.orderStatus.value,
    internal_notes: orderForm.orderNotes.value.trim() || null,
  };

  try {
    if (editingOrderId) {
      const { error } = await supabase
        .from('orders')
        .update(payload)
        .eq('id', editingOrderId);

      if (error) {
        console.error('Order update error:', error);
        showToast(
          `Could not update order: ${error.message || 'Unknown error'}`,
          3000
        );
        return;
      }
      showToast('Order updated');
    } else {
      showToast('Cannot create orders from client page', 3000);
      return;
    }

    closeOrderDialog();
    await loadClientAndOrders();
  } catch (err) {
    console.error('Unexpected error saving order:', err);
    showToast('An unexpected error occurred', 3000);
  }
}

async function deleteOrder() {
  if (!supabase || !editingOrderId) {
    closeOrderDialog();
    return;
  }

  const confirmation = confirm('Delete this order? This cannot be undone.');
  if (!confirmation) return;

  try {
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', editingOrderId);

    if (error) {
      console.error('Order delete error:', error);
      showToast('Could not delete order.');
      return;
    }

    closeOrderDialog();
    showToast('Order deleted');
    await loadClientAndOrders();
  } catch (err) {
    console.error('Unexpected error deleting order:', err);
    showToast('An unexpected error occurred', 3000);
  }
}

async function saveClient(event) {
  event.preventDefault();
  if (!supabase) {
    showToast('Supabase not configured');
    return;
  }

  // Check for authenticated session if auth is enabled
  if (ENABLE_AUTH) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      showToast('Please sign in to save client details', 3000);
      return;
    }
  }

  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('client_id');
  const payload = {
    client_name: form.clientName.value.trim(),
    client_phone: form.clientPhone.value.trim(),
    client_email: form.clientEmail.value.trim() || null,
  };

  // Validate required fields
  if (!payload.client_name || !payload.client_phone) {
    showToast('Name and phone are required', 2400);
    return;
  }

  try {
    if (clientId) {
      const { error } = await supabase
        .from('clients')
        .update(payload)
        .eq('id', clientId);
      if (error) {
        console.error('Client update error:', error);
        showToast(
          `Could not save client: ${error.message || 'Unknown error'}`,
          3000
        );
        return;
      }
      showToast('Client updated');
      // Reload to refresh UI
      currentClient = {
        ...currentClient,
        name: payload.client_name,
        phone: payload.client_phone,
        email: payload.client_email,
      };
      updateClientSummary();
    } else {
      // If there is no client row, create it for future linking
      const { data, error } = await supabase
        .from('clients')
        .insert(payload)
        .select();
      if (error) {
        console.error('Client create error:', error);
        showToast(
          `Could not create client: ${error.message || 'Unknown error'}`,
          3000
        );
        return;
      }
      // Update URL to include client_id for future edits
      if (data && data[0]) {
        const url = new URL(window.location.href);
        url.searchParams.set('client_id', data[0].id);
        window.history.replaceState({}, '', url);
        currentClient = {
          id: data[0].id,
          name: payload.client_name,
          phone: payload.client_phone,
          email: payload.client_email,
        };
        updateClientSummary();
      }
      showToast('Client saved');
    }
  } catch (err) {
    console.error('Unexpected error saving client:', err);
    showToast('An unexpected error occurred', 3000);
  }
}

// Initialize copy buttons
function initCopyButtons() {
  const copyButtons = document.querySelectorAll('.copy-button');
  copyButtons.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const type = btn.dataset.copy;
      let text = '';
      if (type === 'phone' && currentClient) {
        text = currentClient.phone;
      } else if (type === 'email' && currentClient) {
        text = currentClient.email;
      }

      if (text && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(text);
          showToast('Copied to clipboard');
        } catch (err) {
          console.error('Failed to copy:', err);
          showToast('Failed to copy');
        }
      }
    });
  });
}

function initFilters() {
  if (orderStatusFilter) {
    orderStatusFilter.addEventListener('change', renderOrders);
  }

  if (orderDateFilter) {
    orderDateFilter.addEventListener('change', () => {
      if (orderDateFilter.value === 'custom') {
        if (customDateRange) customDateRange.style.display = 'flex';
      } else {
        if (customDateRange) customDateRange.style.display = 'none';
      }
      renderOrders();
    });
  }

  if (dateFrom) {
    dateFrom.addEventListener('change', renderOrders);
  }

  if (dateTo) {
    dateTo.addEventListener('change', renderOrders);
  }
}

function initOrderDialog() {
  if (!orderForm || !closeDialogButton) return;

  orderForm.addEventListener('submit', saveOrder);
  closeDialogButton.addEventListener('click', closeOrderDialog);

  if (deleteOrderButton) {
    deleteOrderButton.addEventListener('click', deleteOrder);
  }

  const modalOverlay = orderDialog?.querySelector('[data-close-dialog]');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', closeOrderDialog);
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && orderDialog && !orderDialog.hidden) {
      closeOrderDialog();
    }
  });
}

function init() {
  form.addEventListener('submit', saveClient);
  initFilters();
  initOrderDialog();
  loadClientAndOrders().then(() => {
    // Initialize copy buttons after client loads
    initCopyButtons();
    // Re-init on summary updates
    const observer = new MutationObserver(() => {
      initCopyButtons();
    });
    if (clientSummary) {
      observer.observe(clientSummary, { childList: true, subtree: true });
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
