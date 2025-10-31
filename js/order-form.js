import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const PLACEHOLDER_URL = "https://your-project.supabase.co";
const PLACEHOLDER_KEY = "public-anon-key";

const clientOrderForm = document.getElementById("clientOrderForm");
const toast = document.querySelector(".toast");

const isConfigured =
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_URL.startsWith(PLACEHOLDER_URL) &&
  SUPABASE_ANON_KEY !== PLACEHOLDER_KEY;

const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

function showToast(message, duration = 2600) {
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  setTimeout(() => {
    toast.hidden = true;
  }, duration);
}

async function submitClientOrder(event) {
  event.preventDefault();

  if (!supabase) {
    showToast("Ordering offline. Please contact us directly.", 4000);
    return;
  }

  const submitButton = clientOrderForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "Sending...";

  const payload = {
    client_name: clientOrderForm.clientName.value.trim(),
    client_phone: clientOrderForm.clientPhone.value.trim(),
    client_email: clientOrderForm.clientEmail.value.trim() || null,
    delivery_date: clientOrderForm.deliveryDate.value || null,
    delivery_address: clientOrderForm.deliveryAddress.value.trim(),
    card_message: clientOrderForm.cardMessage.value.trim(),
    internal_notes: clientOrderForm.notes.value.trim() || null,
    status: "pending",
    submission_source: "client_form",
  };

  const { error } = await supabase.from("orders").insert(payload);

  submitButton.disabled = false;
  submitButton.textContent = "Submit order request";

  if (error) {
    console.error(error);
    showToast("Sorry, something went wrong. Please try again.");
    return;
  }

  clientOrderForm.reset();
  showToast("Thanks! We'll confirm soon.");
}

if (clientOrderForm) {
  clientOrderForm.addEventListener("submit", submitClientOrder);
}
