document.getElementById('activity-form').addEventListener('submit', e => {
  e.preventDefault();

  const checked = Array.from(document.querySelectorAll('input[name="activity"]:checked'))
    .map(cb => cb.value);

  if (checked.length < 1 || checked.length > 5) {
    alert("Please select between 1 and 5 activities.");
    return;
  }

  saveToSession('activities', checked);

  // Still ensure name & date are present
  const worker = getFromSession('workerName');
  const date = getFromSession('logDate');

  if (!worker || !date) {
    alert('Worker name or date missing. Please go back to Step 1.');
    window.location.href = 'index.html';
    return;
  }

  // Redirect to confirmation
  window.location.href = 'confirm.html';
});

window.onload = () => {
  const container = document.getElementById('activity-list');
  container.innerHTML = 'Loading activities...';

  fetch('/api/activities')
    .then(response => response.json())
    .then(list => {
      container.innerHTML = ''; // Clear loading text
      if (list.length === 0) {
        container.innerHTML = '<p>No activities available.</p>';
        return;
      }

      list.forEach(({ name, description }) => {
        const div = document.createElement('div');

        // Create a checkbox with a tooltip (hover) from the description
        div.innerHTML = `
          <label>
            <input type="checkbox" name="activity" value="${name}" />
            <span class="activity-tooltip">
              ${name}
              <div class="tooltip-box">${description}</div>
            </span>
          </label>
        `;

        container.appendChild(div);
      });
    })
    .catch(err => {
      console.error('Error fetching activities:', err);
      container.innerHTML = '<p>Failed to load activities. Please try again later.</p>';
    });
};



