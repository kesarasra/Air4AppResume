function saveToSession(key, value) {
  sessionStorage.setItem(key, JSON.stringify(value));
}

function getFromSession(key) {
  const item = sessionStorage.getItem(key);
  return item ? JSON.parse(item) : null;
}

function goBack(page) {
  window.location.href = page;
}

// --- Popup Utility Function ---
function showPopup(message, options = {}) {
  const popup = document.createElement('div');
  popup.className = 'custom-popup';

  // Optional class for styling (e.g., goodbye message)
  if (options.className) {
    popup.classList.add(options.className);
  }
  popup.innerHTML = message.replace(/\n/g, '<br>');
  document.body.appendChild(popup);

  if (options.sound) {
    const audio = new Audio(options.sound);
    audio.play().catch(err => {
      console.warn('Sound failed to play:', err);
    });
  }
  
  // Auto remove after delay
  setTimeout(() => {
    popup.remove();
  }, options.duration || 3000); // default to 3 seconds
}
