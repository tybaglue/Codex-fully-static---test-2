import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const titleEl = document.getElementById('clientTitle');
const form = document.getElementById('clientForm');
const ordersList = document.getElementById('ordersList');
const toast = document.querySelector('.toast');

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

async function loadClientAndOrders() {
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('client_id');
  const key = params.get('key');

  if (!supabase) {
    setEmptyState(true);
    return;
  }

  let client = null;
  if (clientId) {
    const { data, error } = await supabase
      .from('clients')
      .select(
        'id, client_code, name:client_name, phone:client_phone, email:client_email'
      )
      .eq('id', clientId)
      .single();
    if (!error) client = data;
  }

  // Fallback to derive client from latest order if only key is provided
  const { data: orders, error: orderErr } = await supabase
    .from('orders')
    .select(
      'id, client_id, client_name, client_phone, client_email, delivery_date, card_message, delivery_address, status'
    )
    .or(
      key
        ? `client_email.eq.${key},client_phone.eq.${key},client_name.eq.${key}`
        : clientId
        ? `client_id.eq.${clientId}`
        : 'id.gt.0'
    )
    .order('delivery_date', { ascending: false, nullsFirst: false });

  if (orderErr) {
    console.error(orderErr);
    showToast("Couldn't load client orders");
    return;
  }

  if (!client && orders && orders.length) {
    const latest = orders[0];
    client = {
      id: latest.client_id,
      name: latest.client_name,
      phone: latest.client_phone,
      email: latest.client_email,
    };
  }

  if (client) {
    titleEl.textContent = client.name || 'Client';
    form.clientName.value = client.name || '';
    form.clientPhone.value = client.phone || '';
    form.clientEmail.value = client.email || '';
  }

  renderOrders(orders || []);
}

function renderOrders(clientOrders) {
  clearList(ordersList);
  if (!clientOrders.length) {
    setEmptyState(true);
    return;
  }
  setEmptyState(false);

  const template = document.getElementById('orderCardTemplate');
  clientOrders.forEach((order) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector('.card-title').textContent = order.client_name;
    node.querySelector('.status-pill').dataset.status = order.status;
    node.querySelector('.status-pill').textContent =
      order.status === 'fulfilled' ? 'Fulfilled' : 'Unfulfilled';
    const deliveryLine = node.querySelector('.delivery-date');
    deliveryLine.textContent = `Delivery · ${formatDate(order.delivery_date)}`;
    node.querySelectorAll('.card-detail')[1].textContent =
      order.card_message || '';
    node.querySelectorAll('.card-detail')[2].textContent =
      order.delivery_address || '';
    ordersList.appendChild(node);
  });
}

async function saveClient(event) {
  event.preventDefault();
  if (!supabase) return;

  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('client_id');
  const payload = {
    client_name: form.clientName.value.trim(),
    client_phone: form.clientPhone.value.trim(),
    client_email: form.clientEmail.value.trim() || null,
  };

  if (clientId) {
    const { error } = await supabase
      .from('clients')
      .update(payload)
      .eq('id', clientId);
    if (error) {
      console.error(error);
      showToast('Could not save client');
      return;
    }
    showToast('Client updated');
  } else {
    // If there is no client row, create it for future linking
    const { error } = await supabase.from('clients').insert(payload);
    if (error) {
      console.error(error);
      showToast('Could not create client');
      return;
    }
    showToast('Client saved');
  }
}

function init() {
  form.addEventListener('submit', saveClient);
  loadClientAndOrders();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

