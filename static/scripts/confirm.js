window.onload = () => {
  const data = {
    worker: getFromSession('workerName'),
    date: getFromSession('logDate'),
    phase: getFromSession('phase'),
    zone: getFromSession('zone'),
    line: getFromSession('line'),
    treeIDs: getFromSession('treeIDs') || [], // plural
    treeID: getFromSession('treeID'),         // fallback single
    activities: getFromSession('activities'),
  };

  const summary = document.getElementById('review-data');

  // Create a Tree ID display (handle both single and multiple)
  const treeIDDisplay = data.treeIDs.length > 0
    ? data.treeIDs.map(id => `<li>${id}</li>`).join('')
    : `<li>${data.treeID}</li>`;

  summary.innerHTML = `
    <p><strong>คนงาน:</strong> ${data.worker}</p>
    <p><strong>วันที่:</strong> ${data.date}</p>
    ${data.phase ? `<p><strong>เฟส:</strong> ${data.phase}</p>` : ''}
    ${data.zone ? `<p><strong>โซน:</strong> ${data.zone}</p>` : ''}
    ${data.line ? `<p><strong>เส้น:</strong> ${data.line}</p>` : ''}
    <p><strong>รหัสต้นไม้:</strong></p>
    <ul>${treeIDDisplay}</ul>
    <p><strong>กิจกรรม:</strong> ${data.activities.join(', ')}</p>
  `;

  document.getElementById('confirm-btn').addEventListener('click', async () => {
    const treeIDsToSubmit = data.treeIDs.length > 0 ? data.treeIDs : [data.treeID];

    const payload = treeIDsToSubmit.map(treeID => ({
      worker: data.worker,
      date: data.date,
      phase: data.phase,
      zone: data.zone,
      line: data.line,
      treeID,
      activities: data.activities
    }));

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload) // sending array of logs
      });

      if (response.ok) {
        window.location.href = 'success.html';
      } else {
        alert('Failed to submit data. Please try again.');
      }
    } catch (err) {
      alert('Error submitting data.');
      console.error(err);
    }
  });
};

