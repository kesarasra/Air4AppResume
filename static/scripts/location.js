let validTreeIDs = [];
let zoneToLinesMap = {};

document.getElementById('location-form').addEventListener('submit', async e => {
  e.preventDefault();

  const phase = document.getElementById('phase').value.trim();
  const zone = document.getElementById('zone').value.trim();
  const line = document.getElementById('line').value.trim();
  const treeID = document.getElementById('treeID').value.trim();

  let filledCount = 0;
  if (phase) filledCount++;
  if (zone && !line) filledCount++;
  if (zone && line) filledCount++;
  if (treeID) filledCount++;

  if (filledCount !== 1) {
    alert('Please fill exactly one of the following: Phase OR Zone (with or without Line) OR Tree ID.');
    return;
  }

  if (line && !zone) {
    alert('Please enter Zone number when entering a Line number.');
    return;
  }

  if (treeID) {
    const isValidTree = validTreeIDs.includes(treeID.toUpperCase());
    if (!isValidTree) {
      alert('Invalid Tree ID. Please check your input.');
      return;
    }
    saveToSession('treeID', treeID.toUpperCase());
  } else {
    saveToSession('treeID', '');
  }

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

    // Populate Phase
    (metaData.phases || []).forEach(p => {
      const option = document.createElement('option');
      option.value = p;
      option.textContent = p;
      phaseSelect.appendChild(option);
    });

    // Populate Zone
    (metaData.zones || []).forEach(z => {
      const option = document.createElement('option');
      option.value = z;
      option.textContent = z;
      zoneSelect.appendChild(option);
    });

    // When Zone is selected, update Line options
    zoneSelect.addEventListener('change', () => {
      const selectedZone = zoneSelect.value;
      const lines = zoneToLinesMap[selectedZone] || [];

      // Clear previous Line options
      lineSelect.innerHTML = '<option value="">-- Select Line (optional) --</option>';
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

  // Welcome
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

