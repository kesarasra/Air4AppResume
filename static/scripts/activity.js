document.getElementById('activity-form').addEventListener('submit', e => {
  e.preventDefault();

  const checked = Array.from(document.querySelectorAll('input[name="activity"]:checked'))
    .map(cb => cb.value);

  if (checked.length < 1) {
    alert("Please select at least one activity.");
    return;
  }

  saveToSession('activities', checked);

  const submenuInputs = Array.from(document.querySelectorAll('.submenu-container input, .submenu-container textarea, .submenu-container select'));
  const submenuAnswers = {};
  submenuInputs.forEach(input => {
    if (!input.name) return;
    if (input.type === 'radio') {
      if (input.checked) {
        submenuAnswers[input.name] = input.value.trim();
      }
    } else if (input.value.trim() !== '') {
      submenuAnswers[input.name] = input.value.trim();
    }
  });


  // Collect multi-selects
  ['submenu-2.2', 'submenu-4.2', 'submenu-5.2', 'submenu-6.2', 'submenu-7.2', 'submenu-8.2', 'submenu-9.2'].forEach(name => {
    const workerInputs = document.querySelectorAll(`select[name="${name}"]`);
    const workerValues = Array.from(workerInputs).map(input => input.value.trim()).filter(Boolean);
    if (workerValues.length > 0) submenuAnswers[name] = workerValues.join(', ');
  });

  // Collect equipment multi-selects
  const equipmentKeys = ['submenu-2.7', 'submenu-4.3', 'submenu-8.5', 'submenu-9.4'];
  equipmentKeys.forEach(key => {
    const selects = Array.from(document.querySelectorAll(`select[name="${key}"]`));
    const values = selects.map(s => (s.value || '').trim()).filter(Boolean);
    if (values.length > 0) {
      submenuAnswers[key] = values.join(', ');
    }
  });

  // Handle submenu 8.6 checkboxes separately
  const cleanedCheckbox = document.querySelector('input[name="submenu-8.6.cleaned"]');
  const packagedCheckbox = document.querySelector('input[name="submenu-8.6.packaged"]');

  const cleanedChecked = cleanedCheckbox && cleanedCheckbox.checked;
  const packagedChecked = packagedCheckbox && packagedCheckbox.checked;

  let cleanedPackagedValues = [];
  if (cleanedChecked) cleanedPackagedValues.push('cleaned');
  if (packagedChecked) cleanedPackagedValues.push('packaged');

  if (cleanedPackagedValues.length > 0) {
    submenuAnswers['submenu-8.6'] = cleanedPackagedValues.join(', ');
  }

  console.log('Collected submenu answers:', submenuAnswers);
  // Now save the cleaned submenuAnswers object
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

async function populateFormulaDropdowns() {
  try {
    const res = await fetch('/api/formulas');
    if (!res.ok) throw new Error('Failed to fetch formulas');
    const data = await res.json();
    const formulas = data.formulas || [];

    // Select all dropdowns that should use formulas
    const formulaDropdowns = document.querySelectorAll('select[data-formula-dropdown]');
    formulaDropdowns.forEach(select => {
      select.innerHTML = '<option value="">-- เลือกสูตร --</option>'; // default
      formulas.forEach(f => {
        const option = document.createElement('option');
        option.value = f.id;
        option.textContent = f.name;
        option.title = f.description; // optional tooltip
        select.appendChild(option);
      });
    });
  } catch (err) {
    console.error('Error fetching formulas:', err);
  }
}

// Remove 'required' attribute from all worker select dropdowns inside worker-select-row
function disableWorkerSelectRequired() {
  document.querySelectorAll('.worker-select-row select').forEach(select => {
    select.removeAttribute('required');
  });
}


window.onload = () => {
  const treeIDs = getFromSession('treeIDs') || [];
  const summaryDiv = document.getElementById('tree-id-summary');
  if (treeIDs.length > 0 && summaryDiv) {
    summaryDiv.innerHTML = `<strong>รหัสต้นไม้:</strong> ${treeIDs.join(', ')}`;
  }

  const container = document.getElementById('activity-list');
  container.innerHTML = 'Loading activities...';

  let cachedWorkerNames = [];

  // Function to populate a single worker select with cached names
  function populateWorkerSelect(select) {
    // Remove old options except the placeholder (value="")
    select.querySelectorAll('option:not([value=""])').forEach(opt => opt.remove());

    cachedWorkerNames.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
  }

  let cachedEquipmentList = null;

  async function fetchEquipmentList() {
    if (cachedEquipmentList) return cachedEquipmentList;
    try {
      const res = await fetch('/api/equipment');
      if (!res.ok) throw new Error('Failed to load equipment');
      const list = await res.json();
      cachedEquipmentList = Array.isArray(list) ? list : [];
      return cachedEquipmentList;
    } catch (err) {
      console.error('Error fetching equipment:', err);
      cachedEquipmentList = [];
      return cachedEquipmentList;
    }
  }

  function populateEquipmentOptions(select) {
    if (!select) return;
    // remove all non-placeholder options (placeholder assumed to have value === '')
    Array.from(select.querySelectorAll('option')).forEach(opt => {
      if (opt.value !== '') opt.remove();
    });
    (cachedEquipmentList || []).forEach(item => {
      const opt = document.createElement('option');
      opt.value = item;
      opt.textContent = item;
      select.appendChild(opt);
    });
  }

  function createEquipmentRow(submenuName) {
    const row = document.createElement('div');
    row.className = 'equipment-row';
    row.innerHTML = `
      <select name="${submenuName}" class="equipment-select">
        <option value="">-- เลือกอุปกรณ์/ยานพาหนะ --</option>
      </select>
      <button type="button" class="remove-equipment-btn" title="ลบอุปกรณ์">X</button>
    `;
    return row;
  }

  /**
   * Robust init using event delegation per equipment-container.
   * - Populates existing selects
   * - Uses a single delegated click handler per container (prevents duplicate handlers)
   */
  async function initEquipmentUI(submenuContainer) {
    if (!submenuContainer) return;
    const equipmentContainers = Array.from(submenuContainer.querySelectorAll('.equipment-container'));
    if (!equipmentContainers.length) {
      // no equipment UI in this submenu - nothing to do
      // console.debug('initEquipmentUI: no containers found for', submenuContainer.id);
      return;
    }

    // ensure equipment data is loaded
    await fetchEquipmentList();

    equipmentContainers.forEach(container => {
      // populate any existing selects
      container.querySelectorAll('select.equipment-select').forEach(select => populateEquipmentOptions(select));

      // avoid attaching multiple delegated handlers
      if (container.__equipmentDelegated) return;

      container.addEventListener('click', (ev) => {
        // ADD button (delegated)
        const addBtn = ev.target.closest('.add-equipment-btn');
        if (addBtn && container.contains(addBtn)) {
          ev.preventDefault();
          const submenuName = container.dataset.submenuName;
          const newRow = createEquipmentRow(submenuName);

          // attach remove handler for the newly created row's button (local handler)
          newRow.querySelector('.remove-equipment-btn').addEventListener('click', e => {
            e.preventDefault();
            const rows = container.querySelectorAll('.equipment-row');
            if (rows.length > 1) newRow.remove();
            else newRow.querySelector('select.equipment-select').value = '';
          });

          // insert before the add button
          container.insertBefore(newRow, addBtn);
          // populate the new select
          populateEquipmentOptions(newRow.querySelector('select.equipment-select'));
          return;
        }

        // REMOVE button (delegated for rows that existed at init time)
        const remBtn = ev.target.closest('.remove-equipment-btn');
        if (remBtn && container.contains(remBtn)) {
          ev.preventDefault();
          const row = remBtn.closest('.equipment-row');
          if (!row) return;
          const rows = container.querySelectorAll('.equipment-row');
          if (rows.length > 1) {
            row.remove();
          } else {
            // only 1 row left -> clear
            const sel = row.querySelector('select.equipment-select');
            if (sel) sel.value = '';
          }
        }
      });

      container.__equipmentDelegated = true;
    });
  }


  fetch('/api/activities')
    .then(response => response.json())
    .then(list => {
      container.innerHTML = '';
      if (!Array.isArray(list) || list.length === 0) {
        container.innerHTML = '<p>No activities available.</p>';
        return;
      }

      list.forEach(({ id, name, description }) => {
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

  fetch('/api/worker-names')
    .then(res => res.json())
    .then(names => {
      cachedWorkerNames = names;
    })
    .catch(err => {
      console.error('Error fetching worker names:', err);
      cachedWorkerNames = [];
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

        submenuContainer.innerHTML = submenus.map(sub => {
          let inputField = '';
          const cleanSubNum = sub.subNum.startsWith('.') ? sub.subNum.slice(1) : sub.subNum;

          if (/เวลาเริ่ม|เวลาสิ้นสุด/.test(sub.question)) {
            // For Activity 5, these time inputs are handled below in the 5.3 block to avoid duplicates
            if (activityId !== '5') {
              inputField = `<input type="time" name="submenu-${activityId}.${cleanSubNum}" required />`;
            }
          } else if (/ระยะเวลา/.test(sub.question)) {
            if (
              (activityId === '1' && cleanSubNum === '1') ||
              (activityId === '2' && cleanSubNum === '3') ||
              (activityId === '4' && cleanSubNum === '4') ||
              (activityId === '5' && cleanSubNum === '3') ||
              (activityId === '6' && cleanSubNum === '3') ||
              (activityId === '7' && cleanSubNum === '3') ||
              (activityId === '8' && cleanSubNum === '3') ||
              (activityId === '9' && cleanSubNum === '3')
            ) {
              inputField = `
                <div style="margin-bottom: 6px;">
                  <label>เวลาเริ่ม: <input type="time" id="start-${activityId}" required/></label>
                </div>
                <div style="margin-bottom: 6px;">
                  <label>เวลาสิ้นสุด: <input type="time" id="end-${activityId}" required/></label>
                </div>
                <div style="margin-bottom: 6px;">
                  <label>ระยะเวลา (นาที): <input type="text" name="submenu-${activityId}.${cleanSubNum}" readonly placeholder="คำนวณอัตโนมัติ" required/></label>
                </div>
              `;
            } else {
              inputField = `<input type="text" name="submenu-${activityId}.${cleanSubNum}" readonly placeholder="คำนวณอัตโนมัติ" />`;
            }
          } else if (activityId === '1' && cleanSubNum === '2') {
            // Start Pressure Gauge
            inputField = `<input type="number" name="submenu-1.2" placeholder="ค่าก่อนเริ่มรดน้ำ" step="0.01" required />`;
          } else if (activityId === '1' && cleanSubNum === '3') {
            // End Pressure Gauge
            inputField = `<input type="number" name="submenu-1.3" placeholder="ค่าหลังรดน้ำ" step="0.01" required />`;
          } else if (activityId === '1' && cleanSubNum === '4') {
            // Notes
            inputField = `<input type="text" name="submenu-1.4" placeholder="บันทึกเพิ่มเติม" />`;

          } else if (activityId === '2' && cleanSubNum === '1') {
            inputField = `
              <select name="submenu-2.1" required>
                <option value="">-- เลือกวิธีการให้ปุ๋ย --</option>
                <option value="รถพ่น">รถพ่น</option>
                <option value="สายยางพื้นดิน">สายยางพื้นดิน</option>
                <option value="แทงก์ผสมในระบบน้ำ">แทงก์ผสมในระบบน้ำ</option>
                <option value="โปรยด้วยมือ">โปรยด้วยมือ</option>
              </select>
            `;
          } else if (activityId === '2' && cleanSubNum === '2') {
            inputField = `
              <div id="submenu-2-2-container">
                <div class="worker-select-row">
                  <select name="submenu-2.2" class="submenu-2-2-select">
                    <option value="">-- เลือกชื่อคนงาน --</option>
                  </select>
                  <button type="button" class="remove-btn" title="ลบคนงานนี้">X</button>
                </div>
                <button type="button" class="add-worker-btn" data-activity-id="2">+ เพิ่มชื่อคนงาน</button>
              </div>
            `;
          } else if (activityId === '2' && cleanSubNum === '4') {
            inputField = `<select name="submenu-2.4" id="submenu-2-4" required>
                              <option value="">-- เลือกรหัสสูตรปุ๋ย --</option>
                            </select>`;

            // Safe DOM polling
            const waitForElement = (id, callback, interval = 50, maxAttempts = 20) => {
              let attempts = 0;
              const timer = setInterval(() => {
                const el = document.getElementById(id);
                if (el || attempts >= maxAttempts) {
                  clearInterval(timer);
                  if (el) callback(el);
                }
                attempts++;
              }, interval);
            };

            waitForElement('submenu-2-4', (select) => {
              fetch('/api/formulas')
                .then(res => res.json())
                .then(data => {
                  const formulas = data.formulas || [];
                  select.innerHTML = '<option value="">-- เลือกรหัสสูตรปุ๋ย --</option>';
                  formulas.forEach(f => {
                    const option = document.createElement('option');
                    option.value = f.id;
                    option.textContent = f.id;
                    select.appendChild(option);
                  });
                })
                .catch(err => {
                  console.error('Failed to load formula IDs:', err);
                });
            });
          } else if (activityId === '2' && cleanSubNum === '5') {
            const treeParts = ['ใบ', 'กิ่ง', 'ผล', 'โคนต้น'];
            inputField = `
              <select name="submenu-2.5" required>
                <option value="">-- เลือกบริเวณของต้นไม้ --</option>
                ${treeParts.map(p => `<option value="${p}">${p}</option>`).join('')}
              </select>
            `;
          } else if (activityId === '2' && cleanSubNum === '6') {
            inputField = `
              <div style="display:flex; gap:10px;">
                <input type="number" name="submenu-2.6.1" placeholder="ปริมาณ" min="0" step="0.01" required />
                <select name="submenu-2.6.2" required>
                  <option value="">หน่วย</option>
                  <option value="kg">kg</option>
                  <option value="L">L</option>
                  <option value="Bottle">ขวด</option>
                  <option value="Bag">ถุง</option>
                  <option value="Tablet">เม็ด</option>
                </select>
              </div>
            `;
          } else if (activityId === '2' && cleanSubNum === '7') {
            const submenuName = `submenu-${activityId}.${cleanSubNum}`;
            inputField = `
              <div class="equipment-container" data-submenu-name="${submenuName}">
                <div class="equipment-row">
                  <select name="${submenuName}" class="equipment-select">
                    <option value="">-- เลือกอุปกรณ์/ยานพาหนะ --</option>
                  </select>
                  <button type="button" class="remove-equipment-btn" title="ลบอุปกรณ์">X</button>
                </div>
                <button type="button" class="add-equipment-btn" data-submenu="${submenuName}">+ เพิ่มอุปกรณ์อีกชิ้น</button>
              </div>
            `;
          } else if (activityId === '2' && cleanSubNum === '8') {
            inputField = `<input type="text" name="submenu-2.8" placeholder="บันทึกเพิ่มเติม" />
            `;
          } else if (activityId === '3' && cleanSubNum === '1') {
            inputField = `
              <select name="submenu-${activityId}.${cleanSubNum}" required>
                <option value="">-- เลือกปัญหาที่พบ --</option>
                <option value="โรคใบไม้">โรคใบไม้</option>
                <option value="โรคกิ่ง/ลำต้น">โรคกิ่ง/ลำต้น</option>
                <option value="โรคผลไม้">โรคผลไม้</option>
                <option value="พบแมลง">พบแมลง</option>
                <option value="พบหนอน">พบหนอน</option>
                <option value="เชื้อรา">เชื้อรา</option>
                <option value="ความเสียหายจากภัยธรรมชาติ">ความเสียหายจากภัยธรรมชาติ</option>
                <option value="ขาดธาตุอาหาร">ขาดธาตุอาหาร</option>
                <option value="ปัญหาดิน">ปัญหาดิน</option>
                <option value="ปัญหารากต้นไม้">ปัญหารากต้นไม้</option>
                <option value="ความเครียดจากน้ำ">ความเครียดจากน้ำ</option>
              </select>
            `;
          } else if (activityId === '3' && cleanSubNum === '2') {
            inputField = `
              <input type="text" name="submenu-${activityId}.${cleanSubNum}" placeholder="โปรดระบุรายละเอียดเพิ่มเติมเกี่ยวกับปัญหาที่พบ" required />
            `;
          } else if (activityId === '3' && cleanSubNum === '3') {
            inputField = `
              <div style="margin-bottom: 6px;">
                <label style="display: block; margin-bottom: 4px;">ระดับความรุนแรงของปัญหา:</label>
                <div class="radio-group">
                  <label><input type="radio" name="submenu-3.3" value="ต่ำ" required> ต่ำ</label>
                  <label><input type="radio" name="submenu-3.3" value="ปานกลาง"> ปานกลาง</label>
                  <label><input type="radio" name="submenu-3.3" value="สูง"> สูง</label>
                </div>
              </div>
            `;
          } else if (activityId === '3' && cleanSubNum === '4') {
            inputField = `
              <select name="submenu-${activityId}.${cleanSubNum}" required>
                <option value="">-- โปรดเลือก --</option>
                <option value="ใช่">ใช่</option>
                <option value="ไม่ใช่">ไม่ใช่</option>
              </select>
            `;
          } else if (activityId === '3' && cleanSubNum === '5') {
            inputField = `
              <input type="text" name="submenu-3.5" placeholder="ดำเนินการแก้ไขอย่างไร?" required />
            `;
          } else if (activityId === '4' && cleanSubNum === '1') {
            inputField = `
              <select name="submenu-4.1" id="submenu-4.1" required>
                <option value="">-- เลือกรหัสกิจกรรม --</option>
                <option value="ตัดหญ้า">GC01 - ตัดหญ้า</option>
                <option value="เก็บขยะ">GC02 - เก็บขยะ</option>
                <option value="ปรับพื้นที่">GC03 - ปรับพื้นที่</option>
                <option value="ทำความสะอาดบ่อน้ำ">GC04 - ทำความสะอาดบ่อน้ำ</option>
                <option value="ซ่อมแซมระบบน้ำ">GC05 - ซ่อมแซมระบบน้ำ</option>
                <option value="งานทั่วไป">GC06 - งานทั่วไป</option>
                <option value="พ่นสารเคมี">GC07 - พ่นสารเคมี</option>
                <option value="ดูแลทางเดิน">GC08 - ดูแลทางเดิน</option>
                <option value="อื่นๆ">GC09 - อื่นๆ</option>
              </select>
            `;
          } else if (activityId === '4' && cleanSubNum === '2') {
            inputField = `
              <div id="submenu-4-2-container">
                <div class="worker-select-row">
                  <select name="submenu-4.2" class="submenu-4-2-select">
                    <option value="">-- เลือกชื่อคนงาน --</option>
                  </select>
                  <button type="button" class="remove-btn" title="ลบคนงานนี้">X</button>
                </div>
                <button type="button" class="add-worker-btn" data-activity-id="4">+ เพิ่มชื่อคนงาน</button>
              </div>
            `;
          } else if (activityId === '4' && cleanSubNum === '3') {
            const submenuName = `submenu-${activityId}.${cleanSubNum}`;
            inputField = `
              <div class="equipment-container" data-submenu-name="${submenuName}">
                <div class="equipment-row">
                  <select name="${submenuName}" class="equipment-select">
                    <option value="">-- เลือกอุปกรณ์/ยานพาหนะ --</option>
                  </select>
                  <button type="button" class="remove-equipment-btn" title="ลบอุปกรณ์">X</button>
                </div>
                <button type="button" class="add-equipment-btn" data-submenu="${submenuName}">+ เพิ่มอุปกรณ์อีกชิ้น</button>
              </div>
            `;
          } else if (activityId === '4' && cleanSubNum === '4') {
            inputField = `
              <div style="margin-bottom: 6px;">
                <label>เวลาเริ่ม: <input type="time" id="start-4" required/></label>
              </div>
              <div style="margin-bottom: 6px;">
                <label>เวลาสิ้นสุด: <input type="time" id="end-4" required/></label>
              </div>
              <div style="margin-bottom: 6px;">
                <label>ระยะเวลา (นาที): 
                  <input type="text" name="submenu-4.4" readonly placeholder="คำนวณอัตโนมัติ" required/>
                </label>
              </div>
            `;
          } else if (activityId === '5' && cleanSubNum === '1') {
            inputField = `
              <select name="submenu-5.1" required>
                <option value="">-- เลือกประเภทงานตัดแต่ง --</option>
                <option value="ตัดกิ่งแห้ง/เสียหาย">TP01 - ตัดกิ่งแห้ง/เสียหาย</option>
                <option value="ตัดกิ่งให้โปร่ง">TP02 - ตัดกิ่งให้โปร่ง</option>
                <option value="ตัดปลายยอด">TP03 - ตัดปลายยอด</option>
                <option value="ตัดแต่งโครงสร้าง">TP04 - ตัดแต่งโครงสร้าง</option>
                <option value="ตัดฟื้นฟูต้นแก่">TP05 - ตัดฟื้นฟูต้นแก่</option>
                <option value="ตัดกิ่งล่าง">TP06 - ตัดกิ่งล่าง</option>
              </select>
            `;
          } else if (activityId === '5' && cleanSubNum === '2') {
            inputField = `
              <div id="submenu-5-2-container">
                <div class="worker-select-row">
                  <select name="submenu-5.2" class="submenu-5-2-select">
                    <option value="">-- เลือกชื่อคนงาน --</option>
                  </select>
                  <button type="button" class="remove-btn" title="ลบคนงานนี้">X</button>
                </div>
                <button type="button" class="add-worker-btn" data-activity-id="5">+ เพิ่มชื่อคนงาน</button>
              </div>
            `;
          } else if (activityId === '5' && cleanSubNum === '4') {
            inputField = `
              <input type="text" name="submenu-5.4" />
            `;
          } else if (activityId === '6') {
            if (cleanSubNum === '1') {
              const methods = ['ผสมเกสรด้วยมือ', 'ฉีดพ่นแบบแห้ง', 'ฉีดพ่นแบบเปียก'];
              inputField = `<select name="submenu-6.1" required>
                <option value="">-- เลือกวิธีผสมเกสร --</option>
                ${methods.map(m => `<option value="${m}">${m}</option>`).join('')}
              </select>`;
            } else if (cleanSubNum === '2') {
              inputField = `
                <div id="submenu-6-2-container">
                  <div class="worker-select-row">
                    <select name="submenu-6.2" class="submenu-6-2-select">
                      <option value="">-- เลือกชื่อคนงาน --</option>
                    </select>
                    <button type="button" class="remove-btn" title="ลบคนงานนี้">X</button>
                  </div>
                  <button type="button" class="add-worker-btn" data-activity-id="6">+ เพิ่มชื่อคนงาน</button>
                </div>`;
            } else if (cleanSubNum === '3') {
              inputField = `
                <div style="margin-bottom:6px;">
                  <label>เวลาเริ่ม: <input type="time" id="start-6" /></label>
                </div>
                <div style="margin-bottom:6px;">
                  <label>เวลาสิ้นสุด: <input type="time" id="end-6" /></label>
                </div>
                <div style="margin-bottom:6px;">
                  <label>ระยะเวลา (นาที): 
                    <input type="text" name="submenu-6.3" readonly placeholder="คำนวณอัตโนมัติ" />
                  </label>
                </div>`;
            } else if (cleanSubNum === '4') {
              inputField = `
                <input type="text" name="submenu-6.4" />`;
            }
          } else if (activityId === '7') {
            if (cleanSubNum === '1') {
              inputField = `
                <select name="submenu-7.1" required>
                  <option value="">-- เลือกการอนุรักษ์ผลผลิต --</option>
                  <option value="การห่อผลด้วยถุง">การห่อผลด้วยถุง</option>
                  <option value="การค้ำกิ่ง">การค้ำกิ่ง</option>
                </select>
              `;
            } else if (cleanSubNum === '2') {
              inputField = `
                <div id="submenu-7-2-container">
                  <div class="worker-select-row">
                    <select name="submenu-7.2" class="submenu-7-2-select">
                      <option value="">-- เลือกชื่อคนงาน --</option>
                    </select>
                    <button type="button" class="remove-btn" title="ลบคนงานนี้">X</button>
                  </div>
                  <button type="button" class="add-worker-btn" data-activity-id="7">+ เพิ่มชื่อคนงาน</button>
                </div>
              `;
            } else if (cleanSubNum === '3') {
              inputField = `
                <div style="margin-bottom: 6px;">
                  <label>เวลาเริ่ม: <input type="time" id="start-7" /></label>
                </div>
                <div style="margin-bottom: 6px;">
                  <label>เวลาสิ้นสุด: <input type="time" id="end-7" /></label>
                </div>
                <div style="margin-bottom: 6px;">
                  <label>ระยะเวลา (นาที): <input type="text" name="submenu-7.3" readonly placeholder="คำนวณอัตโนมัติ" /></label>
                </div>
              `;
            } else if (cleanSubNum === '4') {
              inputField = `<input type="text" name="submenu-7.4" />`;
            } else {
              inputField = `<input type="text" name="submenu-7.${cleanSubNum}" />`;
            }
          } else if (activityId === '8') {
            if (cleanSubNum === '1') {
              const methods = ['ตัดด้วยไม้เคียว', 'เก็บผลที่ร่วงเอง', 'เก็บด้วยมือ', 'รองด้วยถุงหรือผ้า'];
              inputField = `
              <select name="submenu-8.1" required>
                <option value="">-- เลือกวิธีเก็บเกี่ยว --</option>
                ${methods.map(m => `<option value="${m}">${m}</option>`).join('')}
              </select>
            `;
            } else if (cleanSubNum === '2') {
              inputField = `
              <div id="submenu-8-2-container">
                <div class="worker-select-row">
                  <select name="submenu-8.2" class="submenu-8-2-select">
                    <option value="">-- เลือกชื่อคนงาน --</option>
                  </select>
                  <button type="button" class="remove-btn" title="ลบคนงานนี้">X</button>
                </div>
                <button type="button" class="add-worker-btn" data-activity-id="8">+ เพิ่มชื่อคนงาน</button>
              </div>
            `;
            } else if (cleanSubNum === '3') {
              inputField = `
              <div style="margin-bottom:6px;">
                <label>เวลาเริ่ม: <input type="time" id="start-8" /></label>
              </div>
              <div style="margin-bottom:6px;">
                <label>เวลาสิ้นสุด: <input type="time" id="end-8" /></label>
              </div>
              <div style="margin-bottom:6px;">
                <label>ระยะเวลา (นาที): 
                  <input type="text" name="submenu-8.3" readonly placeholder="คำนวณอัตโนมัติ" />
                </label>
              </div>
            `;
            } else if (cleanSubNum === '4') {
              inputField = `<input type="number" name="submenu-8.4" placeholder="น้ำหนักรวม (กก.)" min="0" step="0.01" />`;
            } else if (cleanSubNum === '5') {
              const submenuName = `submenu-${activityId}.${cleanSubNum}`;
              inputField = `
                <div class="equipment-container" data-submenu-name="${submenuName}">
                  <div class="equipment-row">
                    <select name="${submenuName}" class="equipment-select">
                      <option value="">-- เลือกอุปกรณ์/ยานพาหนะ --</option>
                    </select>
                    <button type="button" class="remove-equipment-btn" title="ลบอุปกรณ์">X</button>
                  </div>
                  <button type="button" class="add-equipment-btn" data-submenu="${submenuName}">+ เพิ่มอุปกรณ์อีกชิ้น</button>
                </div>
              `;
            } else if (cleanSubNum === '6') {
              inputField = `
              <div>
                <label><input type="checkbox" name="submenu-8.6.cleaned" /> ผลไม้ได้รับการทำความสะอาดแล้ว</label><br/>
                <label><input type="checkbox" name="submenu-8.6.packaged" /> ผลไม้ได้รับการบรรจุแล้ว</label>
              </div>
            `;
            } else if (cleanSubNum === '7') {
              inputField = `<input type="text" name="submenu-8.7" placeholder="ข้อสังเกตที่ต้องบันทึก" />`;
            }
          } else if (activityId === '9' && cleanSubNum === '1') {
            inputField = `
            <select name="submenu-9.1" id="submenu-9.1" required>
              <option value="">-- เลือกวิธีฟื้นฟูต้นไม้ --</option>
              <option value="การตัดแต่งกิ่ง">PH01 - การตัดแต่งกิ่ง</option>
              <option value="การคลุมดิน">PH02 - การคลุมดิน</option>
              <option value="การเก็บกวาดเศษซาก">PH03 - การเก็บกวาดเศษซาก</option>
              <option value="การใส่ปุ๋ยหลังเก็บเกี่ยว">PH04 - การใส่ปุ๋ยหลังเก็บเกี่ยว</option>
              <option value="การป้องกันและกำจัดศัตรูพืช">PH05 - การป้องกันและกำจัดศัตรูพืช</option>
              <option value="การกำจัดวัชพืช">PH06 - การกำจัดวัชพืช</option>
            </select>
          `;
          } else if (activityId === '9' && cleanSubNum === '2') {
            inputField = `
            <div id="submenu-9-2-container">
              <div class="worker-select-row">
                <select name="submenu-9.2" class="submenu-9-2-select">
                  <option value="">-- เลือกชื่อคนงาน --</option>
                </select>
                <button type="button" class="remove-btn" title="ลบคนงานนี้">X</button>
              </div>
              <button type="button" class="add-worker-btn" data-activity-id="9">+ เพิ่มชื่อคนงาน</button>
            </div>
          `;
          } else if (activityId === '9' && cleanSubNum === '3') {
            inputField = `
            <div style="margin-bottom: 6px;">
              <label>เวลาเริ่ม: <input type="time" id="start-9" /></label>
            </div>
            <div style="margin-bottom: 6px;">
              <label>เวลาสิ้นสุด: <input type="time" id="end-9" /></label>
            </div>
            <div style="margin-bottom: 6px;">
              <label>ระยะเวลา (นาที): 
                <input type="text" name="submenu-9.3" readonly placeholder="คำนวณอัตโนมัติ" />
              </label>
            </div>
          `;
          } else if (activityId === '9' && cleanSubNum === '4') {
            const submenuName = `submenu-${activityId}.${cleanSubNum}`;
              inputField = `
                <div class="equipment-container" data-submenu-name="${submenuName}">
                  <div class="equipment-row">
                    <select name="${submenuName}" class="equipment-select">
                      <option value="">-- เลือกอุปกรณ์/ยานพาหนะ --</option>
                    </select>
                    <button type="button" class="remove-equipment-btn" title="ลบอุปกรณ์">X</button>
                  </div>
                  <button type="button" class="add-equipment-btn" data-submenu="${submenuName}">+ เพิ่มอุปกรณ์อีกชิ้น</button>
                </div>
              `;
          } else if (activityId === '9' && cleanSubNum === '5') {
            inputField = `<input type="text" name="submenu-9.5" placeholder="ข้อสังเกตที่ต้องบันทึก" />`;
          // Soil & Water Testing (Activity 10)
          }  else if (activityId === '10' && cleanSubNum === '1') {
              // 10.1 รายละเอียดจุดทดสอบ (required text)
              inputField = `<input type="text" name="submenu-10.1" placeholder="รายละเอียดจุดทดสอบ" required />`;

            } else if (activityId === '10' && cleanSubNum === '2') {
              // 10.2 ค่า #1 (required numeric)
              inputField = `<input type="number" step="any" name="submenu-10.2" placeholder="ค่า #1" required />`;

            } else if (activityId === '10' && cleanSubNum === '3') {
              // 10.3 ค่า #2 (optional numeric)
              inputField = `<input type="number" step="any" name="submenu-10.3" placeholder="ค่า #2" />`;

            } else if (activityId === '10' && cleanSubNum === '4') {
              // 10.4 ค่า #3 (optional numeric)
              inputField = `<input type="number" step="any" name="submenu-10.4" placeholder="ค่า #3" />`;

            } else if (activityId === '10' && cleanSubNum === '5') {
              // 10.5 ค่า #4 (optional numeric)
              inputField = `<input type="number" step="any" name="submenu-10.5" placeholder="ค่า #4" />`;

            } else if (activityId === '10' && cleanSubNum === '6') {
              // 10.6 ค่า #5 (optional numeric)
              inputField = `<input type="number" step="any" name="submenu-10.6" placeholder="ค่า #5" />`;

            } else if (activityId === '10' && cleanSubNum === '7') {
              // 10.7 ค่า #6 (optional numeric)
              inputField = `<input type="number" step="any" name="submenu-10.7" placeholder="ค่า #6" />`;

            } else if (activityId === '10' && cleanSubNum === '8') {
              // 10.8 ค่า #7 (optional numeric)
              inputField = `<input type="number" step="any" name="submenu-10.8" placeholder="ค่า #7" />`;

            } else if (activityId === '10' && cleanSubNum === '9') {
              // 10.9 ค่า #8 (optional numeric)
              inputField = `<input type="number" step="any" name="submenu-10.9" placeholder="ค่า #8" />`;

            } else if (activityId === '10' && cleanSubNum === '10') {
              // 10.10 ข้อสังเกตุที่ต้องบันทึก (optional text area)
              inputField = `<input type="text" name="submenu-10.10" placeholder="ข้อสังเกตที่ต้องบันทึก" />`;

          } else {
            inputField = `<input type="text" name="submenu-${activityId}.${cleanSubNum}" />`;
          }

          return `
            <div class="submenu-item">
              <label>
                <span class="submenu-tooltip">
                  ${sub.question}
                  <div class="tooltip-box">${sub.desc}</div>
                </span>
                ${inputField}
              </label>
            </div>
          `;
        }).join('');

        if (activityId === '4') {
          submenuContainer.innerHTML += `
            <div id="gc07-extra-fields" style="display:none; margin-top:10px; padding-left:10px; border-left:2px solid #ccc;">
              <div class="submenu-item">
                <label>4.6 ชื่อสารเคมี:
                  <select name="submenu-4.6" id="submenu-4-6" data-formula-dropdown></select>
                </label>
              </div>
              <div class="submenu-item">
                <label>4.7 ปริมาณที่ใช้:
                  <div style="display:flex; gap:10px;">
                    <input type="number" name="submenu-4.7.1" placeholder="ปริมาณ" min="0" step="0.01" required />
                    <select name="submenu-4.7.2" required>
                      <option value="">หน่วย</option>
                      <option value="kg">kg</option>
                      <option value="L">L</option>
                      <option value="Bottle">ขวด</option>
                      <option value="Bag">ถุง</option>
                      <option value="Tablet">เม็ด</option>
                    </select>
                  </div>
                </label>
              </div>
              <div class="submenu-item">
                <label>4.8 พื้นที่ของต้นไม้ที่เน้น:
                  <select name="submenu-4.8" required>
                      <option value="">-- เลือกบริเวณของต้นไม้ --</option>
                      <option value="ใบ">ใบ</option>
                      <option value="กิ่ง">กิ่ง</option>
                      <option value="ผล">ผล</option>
                      <option value="โคนต้น">โคนต้น</option>
                    </select>
                </label>
              </div>
            </div>
          `;

          // Load formula IDs into 4.6 dropdown
          const loadFormulaDropdown = async () => {
            try {
              const select = document.getElementById('submenu-4-6');
              const res = await fetch('/api/formulas');
              if (!res.ok) throw new Error('Failed to fetch formula IDs');
              const data = await res.json();
              const formulas = data.formulas || [];

              select.innerHTML = '<option value="">-- เลือกรหัสสูตรปุ๋ย --</option>';
              formulas.forEach(f => {
                const option = document.createElement('option');
                option.value = f.id;
                option.textContent = f.id;
                select.appendChild(option);
              });
            } catch (err) {
              console.error('Error loading formula IDs for submenu 4.6:', err);
            }
          };

          const gc07Select = submenuContainer.querySelector('[id="submenu-4.1"]');
          const gc07extraFields = submenuContainer.querySelector('#gc07-extra-fields');

          if (gc07Select && gc07extraFields) {
            const gc07Inputs = gc07extraFields.querySelectorAll('input, select');

            const toggleGC07Fields = () => {
              const isGC07 = gc07Select.value === 'พ่นสารเคมี';
              gc07extraFields.style.display = isGC07 ? 'block' : 'none';
              gc07Inputs.forEach(input => {
                if (isGC07) input.setAttribute('required', 'required');
                else input.removeAttribute('required');
              });

              // Only load formulas when the extra fields are visible
              if (isGC07) loadFormulaDropdown();
            };

            gc07Select.addEventListener('change', toggleGC07Fields);
            toggleGC07Fields(); // initial state
          }
        }

        if (activityId === '9') {
          // Append extra fields (hidden by default)
          submenuContainer.innerHTML += `
            <div id="ph-extra-fields" style="display:none; margin-top:10px; padding-left:10px; border-left:2px solid #ccc;">
              <div class="submenu-item">
                <label>9.6 ชื่อสารเคมี
                  <select name="submenu-9.6" id="submenu-9-6" data-formula-dropdown required>
                    <option value="">-- เลือกรหัสสูตรปุ๋ย --</option>
                  </select>
                </label>
              </div>
              <div class="submenu-item">
                <label>9.7 ปริมาณปุ๋ยที่ใช้</label>
                <div style="display:flex; gap:10px;">
                  <input type="number" name="submenu-9.7.1" placeholder="ปริมาณ" min="0" step="0.01" required />
                  <select name="submenu-9.7.2" required>
                    <option value="">หน่วย</option>
                    <option value="kg">kg</option>
                    <option value="L">L</option>
                    <option value="Bottle">ขวด</option>
                    <option value="Bag">ถุง</option>
                    <option value="Tablet">เม็ด</option>
                  </select>
                </div>
              </div>
              <div class="submenu-item">
                <label>9.8 พื้นที่ของต้นไม้ที่เน้น
                  <select name="submenu-9.8" required>
                    <option value="">-- เลือกบริเวณของต้นไม้ --</option>
                    <option value="ใบ">ใบ</option>
                    <option value="กิ่ง">กิ่ง</option>
                    <option value="ผล">ผล</option>
                    <option value="โคนต้น">โคนต้น</option>
                  </select>
                </label>
              </div>
            </div>
          `;

          // Load formula IDs into 9.6 dropdown
          const loadFormulaDropdown = async () => {
            try {
              const select = document.getElementById('submenu-9-6');
              const res = await fetch('/api/formulas');
              if (!res.ok) throw new Error('Failed to fetch formula IDs');
              const data = await res.json();
              const formulas = data.formulas || [];

              select.innerHTML = '<option value="">-- เลือกรหัสสูตรปุ๋ย --</option>';
              formulas.forEach(f => {
                const option = document.createElement('option');
                option.value = f.id;
                option.textContent = f.id;
                select.appendChild(option);
              });
            } catch (err) {
              console.error('Error loading formula IDs for submenu 9.6:', err);
            }
          };

          // Wait for submenu-9.1 to exist before attaching event
          const waitForElement = (id, callback, interval = 50, maxAttempts = 20) => {
            let attempts = 0;
            const timer = setInterval(() => {
              const el = document.getElementById(id);
              if (el || attempts >= maxAttempts) {
                clearInterval(timer);
                if (el) callback(el);
              }
              attempts++;
            }, interval);
          };

          waitForElement('submenu-9.1', (phSelect) => {
            const phextraFields = document.getElementById('ph-extra-fields');

            const toggleExtraFields = () => {
              const selectedValue = phSelect.value;

              // Show extra fields only for PH04–PH06
              const show = ['การใส่ปุ๋ยหลังเก็บเกี่ยว', 
                            'การป้องกันและกำจัดศัตรูพืช', 
                            'การกำจัดวัชพืช'].includes(selectedValue);

              phextraFields.style.display = show ? 'block' : 'none';

              // Set or remove required attributes
              phextraFields.querySelectorAll('select, input').forEach(el => {
                if (show) el.setAttribute('required', 'required');
                else el.removeAttribute('required');
              });

              // Load formulas only if visible
              if (show) loadFormulaDropdown();
            };

            // Attach change listener
            phSelect.addEventListener('change', toggleExtraFields);

            // Initial check
            toggleExtraFields();
          });
        }


        ['2', '4', '5', '6', '7', '8', '9'].forEach(id => {
          const container2 = submenuContainer.querySelector(`#submenu-${id}-2-container`);
          if (!container2) return;

          // Populate all existing selects with cached worker names
          const selects = container2.querySelectorAll(`select.submenu-${id}-2-select`);
          selects.forEach(select => {
            populateWorkerSelect(select);
          });

          // Use event delegation to add/remove worker rows
          container2.addEventListener('click', e => {
            if (e.target.classList.contains('add-worker-btn')) {
              const row = document.createElement('div');
              row.className = 'worker-select-row';
              row.innerHTML = `
                <select name="submenu-${id}.2" class="submenu-${id}-2-select" required>
                  <option value="">-- เลือกชื่อคนงาน --</option>
                </select>
                <button type="button" class="remove-btn" title="ลบ">X</button>
              `;
              container2.insertBefore(row, e.target);

              // Populate new select from cached workerNames
              const select = row.querySelector('select');
              cachedWorkerNames.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                select.appendChild(option);
              });

            } else if (e.target.classList.contains('remove-btn')) {
              const row = e.target.closest('.worker-select-row');
              if (row) row.remove();
            }
          });
        });

        ['1', '2', '4', '5', '6', '7', '8', '9'].forEach(id => {
          const startInput = submenuContainer.querySelector(`#start-${id}`);
          const endInput = submenuContainer.querySelector(`#end-${id}`);
          let durationInput;
          if (id === '4') {
            durationInput = submenuContainer.querySelector(`input[name='submenu-4.4']`);
          } else {
            durationInput = submenuContainer.querySelector(`input[name='submenu-${id}.1']`) ||
              submenuContainer.querySelector(`input[name='submenu-${id}.3']`);
          }
          if (startInput && endInput && durationInput) {
            const calculateDuration = () => {
              const start = startInput.value;
              const end = endInput.value;
              if (start && end) {
                const startDate = new Date(`1970-01-01T${start}:00`);
                const endDate = new Date(`1970-01-01T${end}:00`);
                let diff = (endDate - startDate) / 60000;
                if (diff < 0) diff += 24 * 60;
                durationInput.value = diff.toString();
              } else {
                durationInput.value = '';
              }
            };

            startInput.addEventListener('input', calculateDuration);
            startInput.addEventListener('change', calculateDuration);
            endInput.addEventListener('input', calculateDuration);
            endInput.addEventListener('change', calculateDuration);

            calculateDuration();
          }
        });
      } catch (err) {
        console.error(`Failed to load submenus for Activity ID ${activityId}:`, err);
        submenuContainer.innerHTML = '<p>Error loading details.</p>';
      }
    } else {
      submenuContainer.innerHTML = '';
    }
    await initEquipmentUI(submenuContainer);
    disableWorkerSelectRequired();
  });
};