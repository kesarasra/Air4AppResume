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
