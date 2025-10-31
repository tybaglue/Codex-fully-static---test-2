import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, ENABLE_AUTH } from './config.js';

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const addBouquetButton = document.getElementById('addBouquetButton');
const bouquetsList = document.getElementById('bouquetsList');
const bouquetDialog = document.getElementById('bouquetDialog');
const bouquetForm = document.getElementById('bouquetForm');
const bouquetFormTitle = document.getElementById('bouquetFormTitle');
const closeBouquetDialog = document.getElementById('closeBouquetDialog');
const deleteBouquetButton = document.getElementById('deleteBouquet');
const toast = document.querySelector('.toast');
const emptyState = document.querySelector('[data-for="bouquets"]');
const modalOverlay = bouquetDialog?.querySelector(
  '[data-close-bouquet-dialog]'
);

let bouquets = [];
let editingBouquetId = null;
let draggedElement = null;

function showToast(message, duration = 2400) {
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  setTimeout(() => {
    toast.hidden = true;
  }, duration);
}

function setEmptyState(isVisible) {
  if (emptyState) {
    emptyState.classList.toggle('visible', isVisible);
  }
}

function clearList(list) {
  while (list.firstChild) {
    list.removeChild(list.firstChild);
  }
}

async function fetchBouquets() {
  if (!supabase) {
    showToast('Configure Supabase to manage bouquets.', 3000);
    setEmptyState(true);
    return;
  }

  const { data, error } = await supabase
    .from('bouquet_types')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error(error);
    showToast("Couldn't load bouquet types.");
    return;
  }

  bouquets = data || [];
  renderBouquets();
}

function renderBouquets() {
  clearList(bouquetsList);

  if (bouquets.length === 0) {
    setEmptyState(true);
    return;
  }
  setEmptyState(false);

  const template = document.getElementById('bouquetCardTemplate');

  bouquets.forEach((bouquet, index) => {
    const clone = template.content.firstElementChild.cloneNode(true);

    clone.dataset.bouquetId = bouquet.id;
    clone.dataset.sortOrder = bouquet.sort_order;

    clone.querySelector('.card-title').textContent = bouquet.name;

    const pill = clone.querySelector('.status-pill');
    if (bouquet.is_active) {
      pill.textContent = 'Active';
      pill.dataset.status = 'fulfilled';
    } else {
      pill.textContent = 'Inactive';
      pill.dataset.status = 'pending';
    }

    const priceEl = clone.querySelector('.bouquet-price');
    if (bouquet.price_hkd) {
      priceEl.textContent = `Default price: HKD ${parseFloat(
        bouquet.price_hkd
      ).toFixed(2)}`;
    } else {
      priceEl.textContent = 'No default price';
      priceEl.style.color = 'var(--text-muted)';
    }

    const descEl = clone.querySelector('.bouquet-description');
    if (bouquet.description) {
      descEl.textContent = bouquet.description;
    } else {
      descEl.remove();
    }

    // Edit button
    const editBtn = clone.querySelector('.btn-edit');
    editBtn.addEventListener('click', () => openBouquetDialog(bouquet));

    // Toggle active/inactive button
    const toggleBtn = clone.querySelector('.btn-toggle');
    toggleBtn.textContent = bouquet.is_active ? 'Deactivate' : 'Activate';
    toggleBtn.addEventListener('click', () => toggleBouquetStatus(bouquet));

    // Drag and drop handlers
    clone.addEventListener('dragstart', handleDragStart);
    clone.addEventListener('dragover', handleDragOver);
    clone.addEventListener('drop', handleDrop);
    clone.addEventListener('dragend', handleDragEnd);

    bouquetsList.appendChild(clone);
  });
}

// Drag and drop functions
function handleDragStart(e) {
  draggedElement = e.currentTarget;
  e.currentTarget.style.opacity = '0.4';
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
}

function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  }

  if (draggedElement !== e.currentTarget) {
    // Swap the dragged element with the drop target
    const allCards = Array.from(bouquetsList.querySelectorAll('.bouquet-card'));
    const draggedIndex = allCards.indexOf(draggedElement);
    const targetIndex = allCards.indexOf(e.currentTarget);

    if (draggedIndex < targetIndex) {
      e.currentTarget.parentNode.insertBefore(
        draggedElement,
        e.currentTarget.nextSibling
      );
    } else {
      e.currentTarget.parentNode.insertBefore(draggedElement, e.currentTarget);
    }

    // Update sort order in database
    updateSortOrder();
  }

  return false;
}

function handleDragEnd(e) {
  e.currentTarget.style.opacity = '1';
}

async function updateSortOrder() {
  const cards = Array.from(bouquetsList.querySelectorAll('.bouquet-card'));
  const updates = cards.map((card, index) => ({
    id: card.dataset.bouquetId,
    sort_order: index,
  }));

  for (const update of updates) {
    await supabase
      .from('bouquet_types')
      .update({ sort_order: update.sort_order })
      .eq('id', update.id);
  }

  // Refresh bouquets to reflect new order
  await fetchBouquets();
  showToast('Order updated');
}

async function toggleBouquetStatus(bouquet) {
  if (!supabase) return;

  const newStatus = !bouquet.is_active;

  const { error } = await supabase
    .from('bouquet_types')
    .update({ is_active: newStatus })
    .eq('id', bouquet.id);

  if (error) {
    console.error(error);
    showToast('Could not update status.');
    return;
  }

  showToast(newStatus ? 'Bouquet activated' : 'Bouquet deactivated');
  await fetchBouquets();
}

function openBouquetDialog(bouquet = null) {
  if (bouquet) {
    editingBouquetId = bouquet.id;
    bouquetFormTitle.textContent = 'Edit bouquet type';
    bouquetForm.bouquetName.value = bouquet.name || '';
    bouquetForm.bouquetPrice.value = bouquet.price_hkd || '';
    bouquetForm.bouquetDescription.value = bouquet.description || '';
    bouquetForm.bouquetActive.value = bouquet.is_active ? 'true' : 'false';
    deleteBouquetButton.hidden = false;
  } else {
    resetForm();
  }

  if (bouquetDialog) {
    bouquetDialog.hidden = false;
    document.body.classList.add('dialog-open');
    bouquetForm.bouquetName.focus();
  }
}

function closeBouquetDialogFn() {
  if (bouquetDialog) {
    bouquetDialog.hidden = true;
  }
  document.body.classList.remove('dialog-open');
  resetForm();
}

function resetForm() {
  bouquetForm.reset();
  editingBouquetId = null;
  deleteBouquetButton.hidden = true;
  bouquetFormTitle.textContent = 'New bouquet type';
}

async function saveBouquet(event) {
  event.preventDefault();
  if (!supabase) {
    showToast('Configure Supabase to save bouquets.');
    return;
  }

  const payload = {
    name: bouquetForm.bouquetName.value.trim(),
    price_hkd: bouquetForm.bouquetPrice.value
      ? parseFloat(bouquetForm.bouquetPrice.value)
      : null,
    description: bouquetForm.bouquetDescription.value.trim() || null,
    is_active: bouquetForm.bouquetActive.value === 'true',
  };

  let response;

  if (editingBouquetId) {
    response = await supabase
      .from('bouquet_types')
      .update(payload)
      .eq('id', editingBouquetId);
  } else {
    // Set sort_order to the end
    const maxSortOrder =
      bouquets.length > 0
        ? Math.max(...bouquets.map((b) => b.sort_order || 0))
        : -1;
    payload.sort_order = maxSortOrder + 1;

    response = await supabase.from('bouquet_types').insert(payload);
  }

  const { error } = response;

  if (error) {
    console.error(error);
    if (error.code === '23505') {
      showToast('A bouquet with this name already exists.');
    } else {
      showToast('Could not save bouquet. Please try again.');
    }
    return;
  }

  closeBouquetDialogFn();
  showToast(editingBouquetId ? 'Bouquet updated' : 'Bouquet added');
  await fetchBouquets();
}

async function deleteBouquet() {
  if (!supabase || !editingBouquetId) {
    closeBouquetDialogFn();
    return;
  }

  const confirmation = confirm(
    'Delete this bouquet type? This cannot be undone.'
  );
  if (!confirmation) return;

  const { error } = await supabase
    .from('bouquet_types')
    .delete()
    .eq('id', editingBouquetId);

  if (error) {
    console.error(error);
    showToast('Could not delete bouquet.');
    return;
  }

  closeBouquetDialogFn();
  showToast('Bouquet deleted');
  await fetchBouquets();
}

function initDialog() {
  addBouquetButton.addEventListener('click', () => openBouquetDialog());
  closeBouquetDialog.addEventListener('click', closeBouquetDialogFn);
  if (modalOverlay) {
    modalOverlay.addEventListener('click', closeBouquetDialogFn);
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && bouquetDialog && !bouquetDialog.hidden) {
      closeBouquetDialogFn();
    }
  });
  deleteBouquetButton.addEventListener('click', deleteBouquet);
  bouquetForm.addEventListener('submit', saveBouquet);
}

function init() {
  deleteBouquetButton.hidden = true;
  initDialog();
  fetchBouquets();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

