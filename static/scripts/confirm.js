function goBack(url) {
  window.location.href = url;
}

window.onload = async () => {
  const locationSummary = document.getElementById('location-summary');
  const activitiesList = document.getElementById('activities-list');

  // Retrieve saved data from session storage
  const treeIDs = getFromSession('treeIDs') || [];
  const phaseZoneLineSets = getFromSession('phaseZoneLineSets') || [];
  const activities = getFromSession('activities') || [];
  const submenus = getFromSession('submenus') || {};
  const extraSubmenuLabels = {
    'submenu-7.6': '7.6 ชื่อสารเคมี',
    'submenu-7.7': '7.7 ปริมาณที่ใช้',
    'submenu-7.8': '7.8 ขนาดถัง',
    'submenu-12.5': '12.5 ชื่อสารเคมี',
    'submenu-12.6': '12.6 ปริมาณที่ใช้',
    'submenu-12.7': '12.7 ขนาดถัง'
  };

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

  // Fetch activity name -> ID map
  let activityMap = {};
  try {
    const res = await fetch('/api/activities');
    if (!res.ok) throw new Error('Failed to fetch activities');
    const activitiesData = await res.json();
    activitiesData.forEach(({ id, name }) => {
      activityMap[name] = id;
    });
  } catch (err) {
    console.error('Failed to fetch activities:', err);
  }

  // Fetch submenu question text for a given activity ID
  async function fetchSubmenuQuestions(activityId) {
    try {
      const res = await fetch(`/api/submenus/${activityId}`);
      if (!res.ok) throw new Error('Failed to fetch submenu questions');
      const data = await res.json();
      const questionMap = {};
      data.forEach(q => {
        const cleanSubNum = q.subNum.startsWith('.') ? q.subNum : '.' + q.subNum;
        questionMap[cleanSubNum] = q.question;
      });
      return questionMap;
    } catch (err) {
      console.error(`Failed to fetch submenu questions for activity ${activityId}:`, err);
      return {};
    }
  }

  // Display activities and submenu answers
  if (activities.length > 0) {
    for (const actName of activities) {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${actName}</strong>`;

      const actId = activityMap[actName];
      if (!actId) {
        console.warn(`No matching activity ID found for name: ${actName}`);
        continue;
      }

      const questionMap = await fetchSubmenuQuestions(actId);

      const submenuList = document.createElement('ul');
      const prefix = `submenu-${actId}.`;

      const matchingKeys = Object.keys(submenus).filter(k => k.startsWith(prefix));

      matchingKeys.forEach(key => {
        const subNum = key.replace(prefix, ''); // e.g., "1"
        const fullKey = prefix + subNum;  
        const questionText = extraSubmenuLabels[fullKey] || questionMap['.' + subNum] || `คำถาม ${subNum}`;
        const value = submenus[key];

        const item = document.createElement('li');
        item.textContent = `${questionText}: ${value}`;
        submenuList.appendChild(item);
      });

      if (matchingKeys.length > 0) li.appendChild(submenuList);
      activitiesList.appendChild(li);
    }
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

    // Create array of {name, id} objects for activities
    const activitiesWithIds = activities.map(name => ({
      name,
      id: activityMap[name] || null
    }));

    const payload = {
      workerName,
      logDate,
      activities: activitiesWithIds,
      locations: treeIDs.length > 0 ?
        treeIDs.map(id => ({ treeID: id })) :
        phaseZoneLineSets.map(set => ({
          phase: set.phase,
          zone: set.zone,
          line: set.line
        })),
      submenus
    };


    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to submit log');

      alert('ส่งข้อมูลสำเร็จ!');
      window.location.href = 'success.html';
    } catch (err) {
      console.error('Error submitting log:', err);
      alert('เกิดข้อผิดพลาดในการส่งข้อมูล กรุณาลองใหม่อีกครั้ง');
    }
  });
};

