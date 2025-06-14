// Utility function to go back to previous page
function goBack(url) {
  window.location.href = url;
}

window.onload = () => {
  const locationSummary = document.getElementById('location-summary');
  const activitiesList = document.getElementById('activities-list');

  // Retrieve saved data from session storage
  const treeIDs = getFromSession('treeIDs') || [];
  const phaseZoneLineSets = getFromSession('phaseZoneLineSets') || [];
  const activities = getFromSession('activities') || [];

  // Display location summary
  if (treeIDs.length > 0) {
    locationSummary.innerHTML = `<strong>รหัสต้นไม้ที่เลือก:</strong><br>${treeIDs.join(', ')}`;
  } else if (phaseZoneLineSets.length > 0) {
    locationSummary.innerHTML = `<strong>ชุดข้อมูลช่วงแปลง / โซน / เส้นที่เลือก:</strong><br>` +
      phaseZoneLineSets.map((set, idx) =>
        `ชุดที่ ${idx + 1}: เฟส ${set.phase || '-'} | โซน ${set.zone || '-'} | เส้น ${set.line || '-'}`
      ).join('<br>');
  } else {
    locationSummary.textContent = 'ไม่มีข้อมูลสถานที่ที่เลือก กรุณากลับไปเลือกสถานที่';
  }

  // Display activities summary
  if (activities.length > 0) {
    activities.forEach(act => {
      const li = document.createElement('li');
      li.textContent = act;
      activitiesList.appendChild(li);
    });
  } else {
    activitiesList.innerHTML = '<li>ไม่มีการเลือกกิจกรรม</li>';
  }

  // Confirm submit handler
  document.getElementById('confirm-submit').addEventListener('click', async () => {
    const workerName = getFromSession('workerName');
    const logDate = getFromSession('logDate');

    if (!workerName || !logDate) {
      alert('ข้อมูลคนงานหรือวันที่หายไป กรุณากลับไปหน้าแรกเพื่อกรอกใหม่');
      window.location.href = 'index.html';
      return;
    }

    // Prepare payload for submission
    const payload = {
      workerName,
      logDate,
      activities,
      locations: treeIDs.length > 0 ? 
        treeIDs.map(id => ({ treeID: id })) : 
        phaseZoneLineSets.map(set => ({
          phase: set.phase,
          zone: set.zone,
          line: set.line
        }))
    };

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to submit log');

      alert('ส่งข้อมูลสำเร็จ!');
      // Clear session data or redirect to home
      sessionStorage.clear();
      window.location.href = '/';
    } catch (err) {
      console.error('Error submitting log:', err);
      alert('เกิดข้อผิดพลาดในการส่งข้อมูล กรุณาลองใหม่อีกครั้ง');
    }
  });
};

