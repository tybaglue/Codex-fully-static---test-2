import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  ENABLE_AUTH,
  ALLOWED_EMAIL_DOMAINS,
} from "./config.js";

const PLACEHOLDER_URL = "https://your-project.supabase.co";
const PLACEHOLDER_KEY = "public-anon-key";

const addOrderButton = document.getElementById("addOrderButton");
const ordersList = document.getElementById("ordersList");
const clientsList = document.getElementById("clientsList");
const calendarList = document.getElementById("calendarList");
const orderDialog = document.getElementById("orderDialog");
const orderForm = document.getElementById("orderForm");
const orderFormTitle = document.getElementById("orderFormTitle");
const deleteOrderButton = document.getElementById("deleteOrder");
const closeDialogButton = document.getElementById("closeDialog");
const statusFilter = document.getElementById("statusFilter");
const toast = document.querySelector(".toast");
const signOutButton = document.getElementById("signOut");
const clientLinkButton = document.getElementById("clientLinkButton");

const tabButtons = [...document.querySelectorAll(".tab-button")];
const tabPanels = [...document.querySelectorAll(".tab-panel")];
const emptyStates = [...document.querySelectorAll(".empty-state")];

const isConfigured =
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_URL.startsWith(PLACEHOLDER_URL) &&
  SUPABASE_ANON_KEY !== PLACEHOLDER_KEY;

const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
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
    state.classList.toggle("visible", isVisible);
  }
}

function switchTab(targetId) {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.target === targetId;
    button.classList.toggle("active", isActive);
  });

  tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === targetId);
  });
}

function formatDate(isoDate) {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatLongDate(isoDate) {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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
    if (filter === "all") return true;
    return order.status === filter;
  });

  if (filteredOrders.length === 0) {
    setEmptyState("orders", true);
    return;
  }
  setEmptyState("orders", false);

  const template = document.getElementById("orderCardTemplate");

  filteredOrders.forEach((order) => {
    const clone = template.content.firstElementChild.cloneNode(true);
    clone.querySelector(".card-title").textContent = order.client_name;
    clone.querySelector(
      ".card-detail.delivery-date"
    ).textContent = `Delivery · ${formatDate(order.delivery_date)}`;
    clone.querySelectorAll(".card-detail")[1].textContent = order.order_details || "";
    clone.querySelectorAll(".card-detail")[2].textContent = order.delivery_address || "";

    const pill = clone.querySelector(".status-pill");
    pill.dataset.status = order.status;
    pill.textContent = order.status === "fulfilled" ? "Fulfilled" : "Unfulfilled";

    const openButton = clone.querySelector("button");
    openButton.addEventListener("click", () => openOrderDialog(order));

    ordersList.appendChild(clone);
  });
}

function renderClients() {
  clearList(clientsList);
  const clientMap = new Map();

  orders.forEach((order) => {
    const key = order.client_email || order.client_phone || order.client_name;
    const existing = clientMap.get(key) || {
      client_name: order.client_name,
      client_email: order.client_email,
      client_phone: order.client_phone,
      orders: [],
    };

    existing.orders.push(order);
    clientMap.set(key, existing);
  });

  const clients = [...clientMap.values()].sort((a, b) =>
    a.client_name.localeCompare(b.client_name)
  );

  if (clients.length === 0) {
    setEmptyState("clients", true);
    return;
  }
  setEmptyState("clients", false);

  const template = document.getElementById("clientCardTemplate");

  clients.forEach((client) => {
    const clone = template.content.firstElementChild.cloneNode(true);
    clone.querySelector(".card-title").textContent = client.client_name;
    const details = clone.querySelectorAll(".card-detail");
    details[0].textContent = client.client_phone || "";
    details[1].textContent = client.client_email || "";
    clone.querySelector(
      ".order-count"
    ).textContent = `${client.orders.length} order${client.orders.length === 1 ? "" : "s"}`;

    clone.addEventListener("click", () => {
      const latestOrder = [...client.orders].sort((a, b) =>
        new Date(b.created_at) - new Date(a.created_at)
      )[0];
      if (latestOrder) {
        openOrderDialog(latestOrder);
      }
    });

    clientsList.appendChild(clone);
  });
}

function renderCalendar() {
  clearList(calendarList);

  const datedOrders = orders
    .filter((order) => order.delivery_date)
    .sort((a, b) => new Date(a.delivery_date) - new Date(b.delivery_date));

  if (datedOrders.length === 0) {
    setEmptyState("calendar", true);
    return;
  }
  setEmptyState("calendar", false);

  datedOrders.forEach((order) => {
    const item = document.createElement("li");
    const time = document.createElement("time");
    time.dateTime = order.delivery_date;
    time.textContent = formatLongDate(order.delivery_date);

    const details = document.createElement("p");
    details.className = "card-detail";
    details.textContent = `${order.client_name} · ${order.order_details || ""}`;

    const address = document.createElement("p");
    address.className = "card-detail";
    address.textContent = order.delivery_address || "";

    item.appendChild(time);
    item.appendChild(details);
    item.appendChild(address);
    calendarList.appendChild(item);
  });
}

function resetForm() {
  orderForm.reset();
  editingOrderId = null;
  deleteOrderButton.hidden = true;
  orderFormTitle.textContent = "New order";
  orderForm.dataset.mode = "create";
}

function openOrderDialog(order = null) {
  if (order) {
    editingOrderId = order.id;
    orderFormTitle.textContent = "Update order";
    orderForm.clientName.value = order.client_name || "";
    orderForm.clientPhone.value = order.client_phone || "";
    orderForm.clientEmail.value = order.client_email || "";
    orderForm.deliveryDate.value = order.delivery_date
      ? order.delivery_date.slice(0, 10)
      : "";
    orderForm.orderDetails.value = order.order_details || "";
    orderForm.deliveryAddress.value = order.delivery_address || "";
    orderForm.orderStatus.value = order.status || "pending";
    orderForm.notes.value = order.internal_notes || "";
    deleteOrderButton.hidden = false;
    orderForm.dataset.mode = "update";
  } else {
    resetForm();
  }

  orderDialog.showModal();
  document.body.classList.add("dialog-open");
}

function closeOrderDialog() {
  orderDialog.close();
  document.body.classList.remove("dialog-open");
  resetForm();
}

async function fetchOrders() {
  if (!supabase) {
    console.warn(
      "Supabase is not configured. Update js/config.js with your project keys."
    );
    showToast("Add your Supabase keys to start saving orders.", 4000);
    setEmptyState("orders", true);
    setEmptyState("clients", true);
    setEmptyState("calendar", true);
    return;
  }

  const { data, error } = await supabase
    .from("orders")
    .select(
      `id, client_name, client_phone, client_email, delivery_date, order_details, delivery_address, status, internal_notes, created_at`
    )
    .order("delivery_date", { ascending: true, nullsFirst: false });

  if (error) {
    console.error(error);
    showToast("Couldn't load orders. Check Supabase settings.");
    return;
  }

  orders = data ?? [];
  renderOrders();
  renderClients();
  renderCalendar();
}

async function saveOrder(event) {
  event.preventDefault();
  if (!supabase) {
    showToast("Configure Supabase to enable saving.");
    return;
  }

  const payload = {
    client_name: orderForm.clientName.value.trim(),
    client_phone: orderForm.clientPhone.value.trim(),
    client_email: orderForm.clientEmail.value.trim() || null,
    delivery_date: orderForm.deliveryDate.value || null,
    order_details: orderForm.orderDetails.value.trim(),
    delivery_address: orderForm.deliveryAddress.value.trim(),
    status: orderForm.orderStatus.value,
    internal_notes: orderForm.notes.value.trim() || null,
  };

  let response;

  if (editingOrderId) {
    response = await supabase.from("orders").update(payload).eq("id", editingOrderId);
  } else {
    response = await supabase
      .from("orders")
      .insert({ ...payload, submission_source: "manual" });
  }

  const { error } = response;

  if (error) {
    console.error(error);
    showToast("Could not save order. Please try again.");
    return;
  }

  closeOrderDialog();
  showToast(editingOrderId ? "Order updated" : "Order added");
  await fetchOrders();
}

async function deleteOrder() {
  if (!supabase || !editingOrderId) {
    closeOrderDialog();
    return;
  }

  const confirmation = confirm("Delete this order? This cannot be undone.");
  if (!confirmation) return;

  const { error } = await supabase.from("orders").delete().eq("id", editingOrderId);

  if (error) {
    console.error(error);
    showToast("Could not delete order.");
    return;
  }

  closeOrderDialog();
  showToast("Order deleted");
  await fetchOrders();
}

function initTabs() {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.target));
  });
}

function initDialog() {
  addOrderButton.addEventListener("click", () => openOrderDialog());
  closeDialogButton.addEventListener("click", closeOrderDialog);
  orderDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeOrderDialog();
  });
  deleteOrderButton.addEventListener("click", deleteOrder);
  orderForm.addEventListener("submit", saveOrder);
}

function initStatusFilter() {
  statusFilter.addEventListener("change", renderOrders);
}

function initClientLinkCopy() {
  if (!clientLinkButton || !navigator.clipboard) return;

  clientLinkButton.addEventListener("click", async (event) => {
    event.preventDefault();
    const link = new URL("order.html", window.location.href).toString();
    try {
      await navigator.clipboard.writeText(link);
      showToast("Client link copied to clipboard");
    } catch (error) {
      console.warn(error);
      window.open("order.html", "_blank");
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

  const authContainer = document.createElement("section");
  authContainer.className = "auth-overlay";
  authContainer.innerHTML = `
    <div class="auth-card">
      <h2>Sign in</h2>
      <p>Use your business email to access the dashboard.</p>
      <form id="authForm">
        <label for="authEmail">Email address</label>
        <input id="authEmail" type="email" required placeholder="you@kewgardenflowers.com" />
        <button type="submit" class="primary-button">Send magic link</button>
      </form>
      <p class="auth-note">Check your inbox for a login link.</p>
    </div>`;

  document.body.appendChild(authContainer);

  const authForm = authContainer.querySelector("#authForm");

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

  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = authForm.authEmail.value.trim();

    const domain = email.split("@").pop();
    if (ALLOWED_EMAIL_DOMAINS.length && !ALLOWED_EMAIL_DOMAINS.includes(domain)) {
      showToast("Email not allowed. Use your business email.");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      console.error(error);
      showToast("Could not send link. Try again.");
      return;
    }

    showToast("Magic link sent!", 3200);
  });

  signOutButton.addEventListener("click", async () => {
    await supabase.auth.signOut();
  });
}

function injectAuthStyles() {
  const style = document.createElement("style");
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
    .auth-card input {
      padding: 0.6rem 0.75rem;
      border-radius: 12px;
      border: 1px solid rgba(47, 44, 40, 0.12);
      font: inherit;
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
  initClientLinkCopy();
  injectAuthStyles();

  if (ENABLE_AUTH) {
    initAuth();
  } else {
    fetchOrders();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
