document.getElementById('activity-form').addEventListener('submit', e => {
  e.preventDefault();

  const checked = Array.from(document.querySelectorAll('input[name="activity"]:checked'))
    .map(cb => cb.value);

  if (checked.length < 1 || checked.length > 5) {
    alert("Please select between 1 and 5 activities.");
    return;
  }

  saveToSession('activities', checked);

  const submenuInputs = Array.from(document.querySelectorAll('.submenu-container input, .submenu-container textarea, .submenu-container select'));
  const submenuAnswers = submenuInputs.reduce((acc, input) => {
    if (input.name && input.value.trim() !== '') {
      acc[input.name] = input.value.trim();
    }
    return acc;
  }, {});

  // Collect multi-selects
  ['submenu-7.2', 'submenu-8.2', 'submenu-9.2', 'submenu-10.2'].forEach(name => {
    const workerInputs = document.querySelectorAll(`select[name="${name}"]`);
    const workerValues = Array.from(workerInputs).map(input => input.value.trim()).filter(Boolean);
    if (workerValues.length > 0) submenuAnswers[name] = workerValues.join(', ');
  });

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
            // For Activity 8, these time inputs are handled below in the 8.3 block to avoid duplicates
            if (activityId !== '8') {
              inputField = `<input type="time" name="submenu-${activityId}.${cleanSubNum}" required />`;
            }
          } else if (/ระยะเวลา/.test(sub.question)) {
            if (
              (activityId === '1' && cleanSubNum === '1') ||
              (activityId === '7' && cleanSubNum === '4') ||
              (activityId === '8' && cleanSubNum === '3') ||
              (activityId === '9' && cleanSubNum === '3') ||
              (activityId === '10' && cleanSubNum === '3')
            ) {
              inputField = `
                <div style="margin-bottom: 6px;">
                  <label>เวลาเริ่ม: <input type="time" id="start-${activityId}" /></label>
                </div>
                <div style="margin-bottom: 6px;">
                  <label>เวลาสิ้นสุด: <input type="time" id="end-${activityId}" /></label>
                </div>
                <div style="margin-bottom: 6px;">
                  <label>ระยะเวลา (นาที): <input type="text" name="submenu-${activityId}.${cleanSubNum}" readonly placeholder="คำนวณอัตโนมัติ" /></label>
                </div>
              `;
            } else {
              inputField = `<input type="text" name="submenu-${activityId}.${cleanSubNum}" readonly placeholder="คำนวณอัตโนมัติ" />`;
            }
          } else if (activityId === '6' && cleanSubNum === '1') {
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
          } else if (activityId === '6' && cleanSubNum === '3') {
            inputField = `
              <select name="submenu-${activityId}.${cleanSubNum}" required>
                <option value="">-- โปรดเลือก --</option>
                <option value="ใช่">ใช่</option>
                <option value="ไม่ใช่">ไม่ใช่</option>
              </select>
            `;
          } else if (activityId === '7' && cleanSubNum === '1') {
            inputField = `
              <select name="submenu-7.1" id="submenu-7.1" required>
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
          } else if (activityId === '7' && cleanSubNum === '2') {
            inputField = `
              <div id="submenu-7-2-container">
                <div class="worker-select-row">
                  <select name="submenu-7.2" class="submenu-7-2-select" required>
                    <option value="">-- เลือกชื่อคนงาน --</option>
                  </select>
                  <button type="button" class="remove-btn" title="ลบคนงานนี้">X</button>
                </div>
                <button type="button" class="add-worker-btn" data-activity-id="7">+ เพิ่มชื่อคนงาน</button>
              </div>
            `;
          } else if (activityId === '7' && cleanSubNum === '3') {
            inputField = `<input type="text" name="submenu-7.3" />`;
          } else if (activityId === '7' && cleanSubNum === '4') {
            inputField = `
              <div style="margin-bottom: 6px;">
                <label>เวลาเริ่ม: <input type="time" id="start-7" /></label>
              </div>
              <div style="margin-bottom: 6px;">
                <label>เวลาสิ้นสุด: <input type="time" id="end-7" /></label>
              </div>
              <div style="margin-bottom: 6px;">
                <label>ระยะเวลา (นาที): 
                  <input type="text" name="submenu-7.4" readonly placeholder="คำนวณอัตโนมัติ" />
                </label>
              </div>
            `;
          } else if (activityId === '8' && cleanSubNum === '1') {
            inputField = `
              <select name="submenu-8.1" required>
                <option value="">-- เลือกประเภทงานตัดแต่ง --</option>
                <option value="TP01">TP01</option>
                <option value="TP02">TP02</option>
                <option value="TP03">TP03</option>
                <option value="TP04">TP04</option>
                <option value="TP05">TP05</option>
                <option value="TP06">TP06</option>
              </select>
            `;
          } else if (activityId === '8' && cleanSubNum === '2') {
            inputField = `
              <div id="submenu-8-2-container">
                <div class="worker-select-row">
                  <select name="submenu-8.2" class="submenu-8-2-select" required>
                    <option value="">-- เลือกชื่อคนงาน --</option>
                  </select>
                  <button type="button" class="remove-btn" title="ลบคนงานนี้">X</button>
                </div>
                <button type="button" class="add-worker-btn" data-activity-id="8">+ เพิ่มชื่อคนงาน</button>
              </div>
            `;
          } else if (activityId === '8' && cleanSubNum === '4') {
            inputField = `
              <input type="text" name="submenu-10.4" />
            `;
          } else if (activityId === '9') {
            // submenu-9.1: dropdown for pollination methods
            if (cleanSubNum === '1') {
              const methods = ['ผสมเกสรด้วยมือ', 'ฉีดพ่นแบบแห้ง', 'ฉีดพ่นแบบเปียก'];
              inputField = `<select name="submenu-9.1" required>
                <option value="">-- เลือกวิธีผสมเกสร --</option>
                ${methods.map(m => `<option value="${m}">${m}</option>`).join('')}
              </select>`;
            } else if (cleanSubNum === '2') {
              inputField = `
                <div id="submenu-9-2-container">
                  <div class="worker-select-row">
                    <select name="submenu-9.2" class="submenu-9-2-select" required>
                      <option value="">-- เลือกชื่อคนงาน --</option>
                    </select>
                    <button type="button" class="remove-btn" title="ลบคนงานนี้">X</button>
                  </div>
                  <button type="button" class="add-worker-btn" data-activity-id="9">+ เพิ่มชื่อคนงาน</button>
                </div>`;
            } else if (cleanSubNum === '3') {
              inputField = `
                <div style="margin-bottom:6px;">
                  <label>เวลาเริ่ม: <input type="time" id="start-9" /></label>
                </div>
                <div style="margin-bottom:6px;">
                  <label>เวลาสิ้นสุด: <input type="time" id="end-9" /></label>
                </div>
                <div style="margin-bottom:6px;">
                  <label>ระยะเวลา (นาที): 
                    <input type="text" name="submenu-9.3" readonly placeholder="คำนวณอัตโนมัติ" />
                  </label>
                </div>`;
            } else if (cleanSubNum === '4') {
              inputField = `
                <input type="text" name="submenu-9.4" />`;
            }
          } else if (activityId === '10') {
            if (cleanSubNum === '1') {
              inputField = `
                <select name="submenu-10.1" required>
                  <option value="">-- เลือกการอนุรักษ์ผลผลิต --</option>
                  <option value="การห่อผลด้วยถุง">การห่อผลด้วยถุง</option>
                  <option value="การค้ำกิ่ง">การค้ำกิ่ง</option>
                </select>
              `;
            } else if (cleanSubNum === '2') {
              inputField = `
                <div id="submenu-10-2-container">
                  <div class="worker-select-row">
                    <select name="submenu-10.2" class="submenu-10-2-select" required>
                      <option value="">-- เลือกชื่อคนงาน --</option>
                    </select>
                    <button type="button" class="remove-btn" title="ลบคนงานนี้">X</button>
                  </div>
                  <button type="button" class="add-worker-btn" data-activity-id="10">+ เพิ่มชื่อคนงาน</button>
                </div>
              `;
            } else if (cleanSubNum === '3') {
              inputField = `
                <div style="margin-bottom: 6px;">
                  <label>เวลาเริ่ม: <input type="time" id="start-10" /></label>
                </div>
                <div style="margin-bottom: 6px;">
                  <label>เวลาสิ้นสุด: <input type="time" id="end-10" /></label>
                </div>
                <div style="margin-bottom: 6px;">
                  <label>ระยะเวลา (นาที): <input type="text" name="submenu-10.3" readonly placeholder="คำนวณอัตโนมัติ" /></label>
                </div>
              `;
            } else if (cleanSubNum === '4') {
              inputField = `<input type="text" name="submenu-10.4" />`;
            } else {
              inputField = `<input type="text" name="submenu-10.${cleanSubNum}" />`;
            }
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

        if (activityId === '7') {
          submenuContainer.innerHTML += `
            <div id="gc07-extra-fields" style="display:none; margin-top:10px; padding-left:10px; border-left:2px solid #ccc;">
              <div class="submenu-item">
                <label>7.6 ชื่อสารเคมี:
                  <input type="text" name="submenu-7.6" />
                </label>
              </div>
              <div class="submenu-item">
                <label>7.7 ปริมาณที่ใช้:
                  <input type="text" name="submenu-7.7" />
                </label>
              </div>
              <div class="submenu-item">
                <label>7.8 ขนาดถัง:
                  <input type="text" name="submenu-7.8" />
                </label>
              </div>
            </div>
          `;

          const gc07Select = submenuContainer.querySelector('[id="submenu-7.1"]');
          const extraFields = submenuContainer.querySelector('#gc07-extra-fields');

          if (gc07Select && extraFields) {
            const toggleGC07Fields = () => {
              extraFields.style.display = gc07Select.value === 'พ่นสารเคมี' ? 'block' : 'none';
            };
            gc07Select.addEventListener('change', toggleGC07Fields);
            toggleGC07Fields(); // initial state
          }
        }

        ['7', '8', '9', '10'].forEach(id => {
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

        ['1', '7', '8', '9', '10'].forEach(id => {
          const startInput = submenuContainer.querySelector(`#start-${id}`);
          const endInput = submenuContainer.querySelector(`#end-${id}`);
          let durationInput;
          if (id === '7') {
            durationInput = submenuContainer.querySelector(`input[name='submenu-7.4']`);
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
  });
};
