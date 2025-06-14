let validTreeIDs = [];
let zoneToLinesMap = {};

document.getElementById('location-form').addEventListener('submit', async e => {
  e.preventDefault();

  // Collect all tree IDs entered
  const treeInputs = Array.from(document.querySelectorAll('.tree-id-input'));
  const treeIDs = treeInputs.map(input => input.value.trim().toUpperCase()).filter(Boolean);

  if (treeIDs.length > 0) {
    // Validate all Tree IDs
    const invalid = treeIDs.filter(id => !validTreeIDs.includes(id));
    if (invalid.length > 0) {
      alert(`รหัสต้นไม้ไม่ถูกต้อง: ${invalid.join(', ')}`);
      return;
    }

    // Save list of Tree IDs and clear other location inputs
    saveToSession('treeIDs', treeIDs);
    saveToSession('phase', '');
    saveToSession('zone', '');
    saveToSession('line', '');
    window.location.href = 'activity.html';
    return;
  }

  // If no Tree ID provided, validate Phase-Zone-Line fallback
  const phase = document.getElementById('phase').value.trim();
  const zone = document.getElementById('zone').value.trim();
  const line = document.getElementById('line').value.trim();

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
  saveToSession('treeIDs', []);
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

    // Populate Phase dropdown
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
      lineSelect.innerHTML = '<option value="">-- เลือกสาย --</option>';

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

// Dynamically add a new Tree ID field when typing starts in the last field
document.getElementById('tree-id-container').addEventListener('input', e => {
  if (e.target.classList.contains('tree-id-input')) {
    const inputs = document.querySelectorAll('.tree-id-input');
    const lastInput = inputs[inputs.length - 1];

    // Only add a new input when typing starts in the last input
    if (e.target === lastInput && lastInput.value.length === 1) {
      addNewTreeIdInput();
    }
  }
});

function addNewTreeIdInput() {
  const newInput = document.createElement('input');
  newInput.type = 'text';
  newInput.name = 'treeID';
  newInput.classList.add('tree-id-input');
  newInput.placeholder = 'Enter Tree ID';
  newInput.autocomplete = 'off';

  document.getElementById('tree-id-container').appendChild(newInput);
}
