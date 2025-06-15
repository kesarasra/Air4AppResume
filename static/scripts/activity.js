document.getElementById('activity-form').addEventListener('submit', e => {
  e.preventDefault();

  const checked = Array.from(document.querySelectorAll('input[name="activity"]:checked'))
    .map(cb => cb.value);

  if (checked.length < 1 || checked.length > 5) {
    alert("Please select between 1 and 5 activities.");
    return;
  }

  saveToSession('activities', checked);

  const submenuInputs = Array.from(document.querySelectorAll('input[name^="submenu-"]'));
  const submenuAnswers = submenuInputs.reduce((acc, input) => {
    if (input.value.trim() !== '') {
      acc[input.name] = input.value.trim();
    }
    return acc;
  }, {});
  saveToSession('submenus', submenuAnswers);

  const worker = getFromSession('workerName');
  const date = getFromSession('logDate');

  if (!worker || !date) {
    alert('Worker name or date missing. Please go back to Step 1.');
    window.location.href = 'index.html';
    return;
  }

  window.location.href = 'confirm.html';
});

window.onload = () => {
  const treeIDs = getFromSession('treeIDs') || [];
  const summaryDiv = document.getElementById('tree-id-summary');
  if (treeIDs.length > 0 && summaryDiv) {
    summaryDiv.innerHTML = `<strong>รหัสต้นไม้:</strong> ${treeIDs.join(', ')}`;
  }

  const container = document.getElementById('activity-list');
  container.innerHTML = 'Loading activities...';

  fetch('/api/activities')
    .then(response => response.json())
    .then(list => {
      container.innerHTML = '';
      if (!Array.isArray(list) || list.length === 0) {
        container.innerHTML = '<p>No activities available.</p>';
        return;
      }

      list.forEach(({ id, name, description }) => {
        // 🚨 Bonus Tip: Sanitize activity ID to avoid injection
        const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '');

        const div = document.createElement('div');
        div.innerHTML = `
          <label>
            <input type="checkbox" name="activity" value="${name}" data-activity-id="${safeId}" />
            <span class="activity-tooltip">
              ${name}
              <div class="tooltip-box">${description}</div>
            </span>
          </label>
          <div class="submenu-container" id="submenu-${safeId}" style="margin-left: 20px;"></div>
        `;
        container.appendChild(div);
      });
    })
    .catch(err => {
      console.error('Error fetching activities:', err);
      container.innerHTML = '<p>Failed to load activities. Please try again later.</p>';
    });

  container.addEventListener('change', async (e) => {
    const checkbox = e.target.closest('input[name="activity"]');
    if (!checkbox) return;

    const activityId = checkbox.dataset.activityId;
    const submenuContainer = document.getElementById(`submenu-${activityId}`);

    if (checkbox.checked) {
      try {
        const res = await fetch(`/api/submenus/${activityId}`);
        const submenus = await res.json();

        submenuContainer.innerHTML = submenus.map(sub => `
          <div class="submenu-item">
            <label>
              <span class="submenu-tooltip">
                ${sub.question}
                <div class="tooltip-box">${sub.desc}</div>
              </span>
              <input type="text" name="submenu-${activityId}-${sub.subNum}" />
            </label>
          </div>
        `).join('');
      } catch (err) {
        console.error(`Failed to load submenus for Activity ID ${activityId}:`, err);
        submenuContainer.innerHTML = '<p>Error loading details.</p>';
      }
    } else {
      submenuContainer.innerHTML = '';
    }
  });
};






