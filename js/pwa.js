// PWA Service Worker Registration and Install Prompt

let deferredPrompt = null;

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('[PWA] Service Worker registered:', registration.scope);

      // Check for updates periodically
      setInterval(() => {
        registration.update();
      }, 60000); // Check every minute

      // Listen for service worker updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (
            newWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            // New service worker available
            showUpdateNotification();
          }
        });
      });
    } catch (error) {
      console.error('[PWA] Service Worker registration failed:', error);
    }
  });
}

// Show update notification
function showUpdateNotification() {
  const toast = document.querySelector('.toast');
  if (toast) {
    toast.textContent = 'New version available. Refresh to update.';
    toast.hidden = false;
    toast.style.cursor = 'pointer';
    toast.addEventListener('click', () => {
      window.location.reload();
    });
  }
}

// Capture beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (event) => {
  console.log('[PWA] Install prompt available');
  event.preventDefault();
  deferredPrompt = event;

  // Show custom install prompt
  showInstallPrompt();
});

// Show install prompt UI
function showInstallPrompt() {
  // Check if already installed
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return;
  }

  // Check if user has dismissed the prompt before
  const dismissed = localStorage.getItem('pwa-install-dismissed');
  if (dismissed) {
    return;
  }

  const promptDiv = document.createElement('div');
  promptDiv.className = 'pwa-install-prompt';
  promptDiv.innerHTML = `
    <p>Install this app on your device for quick access!</p>
    <button class="primary-button" id="pwa-install-btn">Install</button>
    <button class="ghost-button" id="pwa-dismiss-btn" style="padding: 0.5rem;">✕</button>
  `;

  document.body.appendChild(promptDiv);

  // Install button handler
  document
    .getElementById('pwa-install-btn')
    .addEventListener('click', async () => {
      if (!deferredPrompt) return;

      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('[PWA] User choice:', outcome);

      deferredPrompt = null;
      promptDiv.remove();
    });

  // Dismiss button handler
  document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
    localStorage.setItem('pwa-install-dismissed', 'true');
    promptDiv.remove();
  });
}

// Log if app is running as installed PWA
if (window.matchMedia('(display-mode: standalone)').matches) {
  console.log('[PWA] Running as installed app');
}

// Handle app install
window.addEventListener('appinstalled', () => {
  console.log('[PWA] App installed successfully');
  deferredPrompt = null;

  const promptDiv = document.querySelector('.pwa-install-prompt');
  if (promptDiv) {
    promptDiv.remove();
  }
});

