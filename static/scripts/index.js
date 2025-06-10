document.getElementById('step1-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('workerName').value;
  const date = document.getElementById('logDate').value;
  saveToSession('workerName', name);
  saveToSession('lastWelcomedWorker', null); // ✅ Reset welcome state when new user selected
  saveToSession('logDate', date);
  window.location.href = 'location.html';
});

window.onload = async () => {
  const dropdown = document.getElementById('workerName');
  document.getElementById('logDate').valueAsDate = new Date();

  try {
    const response = await fetch('/api/worker-names');
    if (!response.ok) throw new Error('Failed to fetch worker names');

    const names = await response.json();
    names.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      dropdown.appendChild(option);
    });
  } catch (err) {
    console.error('Error loading worker names:', err);
    // fallback
    const fallbackNames = ['Alice', 'Bob', 'Charlie'];
    fallbackNames.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      dropdown.appendChild(option);
    });
  }
};
