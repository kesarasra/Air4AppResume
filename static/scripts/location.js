let validTreeIDs = [];
let zoneToLinesMap = {};

document.getElementById('location-form').addEventListener('submit', async e => {
  e.preventDefault();

  const phase = document.getElementById('phase').value.trim();
  const zone = document.getElementById('zone').value.trim();
  const line = document.getElementById('line').value.trim();
  const treeID = document.getElementById('treeID').value.trim().toUpperCase();

  // Validate Tree ID (can be submitted alone)
  if (treeID) {
    const isValidTree = validTreeIDs.includes(treeID);
    if (!isValidTree) {
      alert('รหัสต้นไม้ไม่ถูกต้อง กรุณาตรวจสอบข้อมูลที่กรอก');
      return;
    }
    saveToSession('treeID', treeID);
    saveToSession('phase', '');
    saveToSession('zone', '');
    saveToSession('line', '');
    window.location.href = 'activity.html';
    return;
  }

  // If Tree ID is not provided, do Phase-Zone-Line validation
  if (!phase && !zone && !line) {
    alert('กรุณากรอกอย่างน้อยช่วงแปลง หรือ ช่วงแปลง + โซน หรือ ช่วงแปลง + โซน + สาย หรือกรอกรหัสต้นไม้ที่ถูกต้อง');
    return;
  }

  if (!phase && zone) {
    alert('โซนต้องระบุร่วมกับช่วงแปลง');
    return;
  }

  if (line && (!zone || !phase)) {
    alert('สายต้องระบุร่วมกับทั้งโซนและช่วงแปลง');
    return;
  }

  // Passed validation
  saveToSession('treeID', '');
  saveToSession('phase', phase);
  saveToSession('zone', zone);
  saveToSession('line', line);

  window.location.href = 'activity.html';
});

window.onload = async () => {
  const phaseSelect = document.getElementById('phase');
  const zoneSelect = document.getElementById('zone');
  const lineSelect = document.getElementById('line');

  try {
    const [treeRes, metaRes] = await Promise.all([
      fetch('/api/tree-ids'),
      fetch('/api/phases-zones')
    ]);

    if (!treeRes.ok || !metaRes.ok) throw new Error('Failed to fetch data');

    const treeData = await treeRes.json();
    const metaData = await metaRes.json();

    validTreeIDs = treeData.treeIDs || [];
    zoneToLinesMap = treeData.zoneToLinesMap || {};
    const phaseZoneMap = metaData.phaseZoneMap || {};

    // Populate Phase
    (metaData.phases || []).forEach(p => {
      const option = document.createElement('option');
      option.value = p;
      option.textContent = p;
      phaseSelect.appendChild(option);
    });

    // When Phase changes, update Zone options
    phaseSelect.addEventListener('change', () => {
      const selectedPhase = phaseSelect.value;
      const zones = phaseZoneMap[selectedPhase] || [];

      zoneSelect.innerHTML = '<option value="">-- เลือกโซน --</option>';
      lineSelect.innerHTML = '<option value="">-- เลือกสาย --</option>'; // reset Line

      zones.forEach(z => {
        const option = document.createElement('option');
        option.value = z;
        option.textContent = z;
        zoneSelect.appendChild(option);
      });
    });

    // When Zone changes, update Line options
    zoneSelect.addEventListener('change', () => {
      const selectedZone = zoneSelect.value;
      const lines = zoneToLinesMap[selectedZone] || [];

      lineSelect.innerHTML = '<option value="">-- เลือกสาย --</option>';
      lines.forEach(l => {
        const option = document.createElement('option');
        option.value = l;
        option.textContent = l;
        lineSelect.appendChild(option);
      });
    });

  } catch (err) {
    console.error('Error loading data:', err);
    alert('Error loading tree database. Please try again later.');
  }

  // Welcome message
  const workerName = getFromSession('workerName');
  const lastWelcomed = getFromSession('lastWelcomedWorker');
  if (workerName && workerName !== lastWelcomed) {
    showPopup(`ยินดีต้อนรับ, ${workerName}!`, {
      className: 'welcome',
      duration: 3000,
      sound: 'sounds/welcome.wav'
    });
    saveToSession('lastWelcomedWorker', workerName);
  }
};
