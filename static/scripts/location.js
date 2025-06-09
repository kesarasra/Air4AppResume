let validTreeIDs = [];
let validLines = [];

document.getElementById('location-form').addEventListener('submit', async e => {
  e.preventDefault();

  const phase = document.getElementById('phase').value.trim();
  const zone = document.getElementById('zone').value.trim();
  const line = document.getElementById('line').value.trim();
  const treeID = document.getElementById('treeID').value.trim();

  const filledFields = [phase, zone, line, treeID].filter(val => val !== '');

  if (filledFields.length !== 1) {
    alert('Please fill in exactly one field only.');
    return;
  }

  // TreeID validation & save uppercase
  if (treeID) {
    const isValid = validTreeIDs.some(id => id.toLowerCase() === treeID.toLowerCase());
    if (!isValid) {
      alert('Invalid Tree ID. Please check your input.');
      return;
    }
    // Always save the user's input as uppercase
    saveToSession('treeID', treeID.toUpperCase());
  } else {
    saveToSession('treeID', '');
  }

  if (line) {
    const normalizedLine = line.trim();
    const isValidLine = validLines.includes(normalizedLine);
    if (!isValidLine) {
      alert('Invalid Line number. Please enter an existing Line');
      return;
    }
  }

  // Save other fields as usual
  saveToSession('phase', phase);
  saveToSession('zone', zone);
  saveToSession('line', line);

  window.location.href = 'activity.html';
});


window.onload = async () => {
  const phases = ['4', '5'];
  const zones = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  const phaseSelect = document.getElementById('phase');
  const zoneSelect = document.getElementById('zone');

  phases.forEach(p => {
    const option = document.createElement('option');
    option.value = p;
    option.textContent = p;
    phaseSelect.appendChild(option);
  });

  zones.forEach(z => {
    const option = document.createElement('option');
    option.value = z;
    option.textContent = z;
    zoneSelect.appendChild(option);
  });

  // 🔄 Fetch valid Tree IDs from API
  try {
    const response = await fetch('/api/tree-ids');
    if (!response.ok) throw new Error('Failed to fetch Tree IDs');
    const data = await response.json();

    validTreeIDs = data.treeIDs || []; 
    validLines = data.lines || [];
  } catch (err) {
    console.error('Error fetching Tree IDs:', err);
    alert('Error loading tree database. Please try again later.');
  }
};

