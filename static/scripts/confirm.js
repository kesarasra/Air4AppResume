window.onload = () => {
  const data = {
    worker: getFromSession('workerName'),
    date: getFromSession('logDate'),
    phase: getFromSession('phase'),
    zone: getFromSession('zone'),
    line: getFromSession('line'),
    treeID: getFromSession('treeID'),
    activities: getFromSession('activities'),
  };

  const summary = document.getElementById('review-data');
  summary.innerHTML = `
    <p><strong>คนงาน:</strong> ${data.worker}</p>
    <p><strong>วันที่:</strong> ${data.date}</p>
    ${data.phase ? `<p><strong>เฟส:</strong> ${data.phase}</p>` : ''}
    ${data.zone ? `<p><strong>โซน:</strong> ${data.zone}</p>` : ''}
    ${data.line ? `<p><strong>เส้น:</strong> ${data.line}</p>` : ''}
    ${data.treeID ? `<p><strong>รหัสต้นไม้:</strong> ${data.treeID}</p>` : ''}
    <p><strong>กิจกรรม:</strong> ${data.activities.join(', ')}</p>
  `;

  document.getElementById('confirm-btn').addEventListener('click', async () => {
    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        // Go to success page
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
