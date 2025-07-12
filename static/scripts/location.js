let validTreeIDs = [];
let zoneToLinesMap = {};
let phaseZoneMap = {};

document.getElementById('location-form').addEventListener('submit', async e => {
  e.preventDefault();

  // Collect Tree IDs
  const treeInputs = Array.from(document.querySelectorAll('.tree-id-input'));
  const treeIDs = treeInputs.map(input => input.value.trim().toUpperCase()).filter(Boolean);

  // Collect Phase/Zone/Line sets (will validate later)
  const pzSets = Array.from(document.querySelectorAll('.pz-set'));
  const hasAnyPZL = pzSets.some(set => {
    const phase = set.querySelector('.phase-select').value.trim();
    const zone = set.querySelector('.zone-select').value.trim();
    const line = set.querySelector('.line-select').value.trim();
    return phase || zone || line;
  });

  // 🔒 Check for both types entered
  if (treeIDs.length > 0 && hasAnyPZL) {
    alert('โปรดเลือกวิธีการระบุตำแหน่งเพียงแบบเดียว: รหัสต้นไม้ หรือ ข้อมูลเฟส/โซน/ไลน์');
    return;
  }

  // If using Tree ID
  if (treeIDs.length > 0) {
    const invalid = treeIDs.filter(id => !validTreeIDs.includes(id));
    if (invalid.length > 0) {
      alert(`รหัสต้นไม้ไม่ถูกต้อง: ${invalid.join(', ')}`);
      return;
    }

    saveToSession('treeIDs', treeIDs);
    saveToSession('phaseZoneLineSets', []); // Clear PZL
    window.location.href = 'activity.html';
    return;
  }

  // No tree ID — collect all Phase/Zone/Line sets
  const collectedSets = [];

  for (const set of pzSets) {
    const phase = set.querySelector('.phase-select').value.trim();
    const zone = set.querySelector('.zone-select').value.trim();
    const line = set.querySelector('.line-select').value.trim();

    // If all empty, skip this set
    if (!phase && !zone && !line) continue;

    // Validation per rules:
    if (!phase && zone) {
      alert('โซนต้องระบุร่วมกับช่วงแปลง');
      return;
    }
    if (line && (!zone || !phase)) {
      alert('สายต้องระบุร่วมกับทั้งโซนและช่วงแปลง');
      return;
    }
    if (!phase && !zone && !line) {
      alert('กรุณากรอกข้อมูลสถานที่ให้ครบหรือกรอกรหัสต้นไม้');
      return;
    }

    collectedSets.push({ phase, zone, line });
  }

  if (collectedSets.length === 0) {
    alert('กรุณากรอกอย่างน้อยช่วงแปลง หรือ ช่วงแปลง + โซน หรือ ช่วงแปลง + โซน + สาย หรือกรอกรหัสต้นไม้ที่ถูกต้อง');
    return;
  }

  // Passed validation: save sets and clear treeIDs
  saveToSession('phaseZoneLineSets', collectedSets);
  saveToSession('treeIDs', []);

  window.location.href = 'activity.html';
});

window.onload = async () => {
  const pzContainer = document.getElementById('pz-container');
  const addBtn = document.getElementById('add-pz-set-btn');

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
    phaseZoneMap = metaData.phaseZoneMap || {};
    
    // Populate first pz-set selects
    const firstSet = pzContainer.querySelector('.pz-set');
    populatePhaseOptions(firstSet.querySelector('.phase-select'));

    // Setup listeners for first pz-set
    setupCascadingListeners(firstSet);

    // Add button handler to add new pz-set
    addBtn.addEventListener('click', () => {
      const newSet = createPZSet();
      pzContainer.appendChild(newSet);
      populatePhaseOptions(newSet.querySelector('.phase-select'));
      setupCascadingListeners(newSet);
      updateRemoveButtons();
    });

    updateRemoveButtons();

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

// Utility: Populate Phase dropdown options
function populatePhaseOptions(phaseSelect) {
  phaseSelect.innerHTML = '<option value="">-- เลือกช่วงแปลง --</option>';
  Object.keys(phaseZoneMap).forEach(p => {
    const option = document.createElement('option');
    option.value = p;
    option.textContent = p;
    phaseSelect.appendChild(option);
  });
}

// Utility: Populate Zone dropdown based on Phase
function populateZoneOptions(zoneSelect, phase) {
  zoneSelect.innerHTML = '<option value="">-- เลือกโซน --</option>';
  if (!phase) return;
  const zones = phaseZoneMap[phase] || [];
  zones.forEach(z => {
    const option = document.createElement('option');
    option.value = z;
    option.textContent = z;
    zoneSelect.appendChild(option);
  });
}

// Utility: Populate Line dropdown based on Zone
function populateLineOptions(lineSelect, zone) {
  lineSelect.innerHTML = '<option value="">-- เลือกสาย --</option>';
  if (!zone) return;
  const lines = zoneToLinesMap[zone] || [];
  lines.forEach(l => {
    const option = document.createElement('option');
    option.value = l;
    option.textContent = l;
    lineSelect.appendChild(option);
  });
}

// Setup cascading listeners on one pz-set div
function setupCascadingListeners(pzSet) {
  const phaseSelect = pzSet.querySelector('.phase-select');
  const zoneSelect = pzSet.querySelector('.zone-select');
  const lineSelect = pzSet.querySelector('.line-select');

  phaseSelect.addEventListener('change', () => {
    populateZoneOptions(zoneSelect, phaseSelect.value);
    lineSelect.innerHTML = '<option value="">-- เลือกสาย --</option>';
  });

  zoneSelect.addEventListener('change', () => {
    populateLineOptions(lineSelect, zoneSelect.value);
  });

  // Remove button
  const removeBtn = pzSet.querySelector('.remove-pz-set');
  removeBtn.addEventListener('click', () => {
    pzSet.remove();
    updateRemoveButtons();
  });
}

// Create a new Phase/Zone/Line set div with selects and remove button
function createPZSet() {
  const div = document.createElement('div');
  div.className = 'pz-set';

  div.innerHTML = `
    <label>เฟส #</label>
    <select class="phase-select" name="phase">
      <option value="">-- เลือกช่วงแปลง --</option>
    </select>

    <label>โซน #</label>
    <select class="zone-select" name="zone">
      <option value="">-- เลือกโซน --</option>
    </select>

    <label>เส้น #</label>
    <select class="line-select" name="line">
      <option value="">-- เลือกสาย --</option>
    </select>

    <button type="button" class="remove-pz-set" title="ลบ">✕</button>
  `;

  return div;
}

// Show/hide remove buttons: only show if more than one pz-set
function updateRemoveButtons() {
  const pzSets = document.querySelectorAll('.pz-set');
  pzSets.forEach((set, i) => {
    const btn = set.querySelector('.remove-pz-set');
    if (pzSets.length > 1) {
      btn.style.display = 'inline-block';
    } else {
      btn.style.display = 'none';
    }
  });
}

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

