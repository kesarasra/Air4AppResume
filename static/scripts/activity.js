document.getElementById('activity-form').addEventListener('submit', e => {
  e.preventDefault();

  const checked = Array.from(document.querySelectorAll('input[name="activity"]:checked'))
    .map(cb => cb.value);

  if (checked.length < 1 || checked.length > 5) {
    alert("Please select between 1 and 5 activities.");
    return;
  }

  saveToSession('activities', checked);

  // Gather submenu answers
  const submenuInputs = Array.from(document.querySelectorAll('.submenu-container input, .submenu-container textarea, .submenu-container select'));
  const submenuAnswers = submenuInputs.reduce((acc, input) => {
    if (input.name && input.value.trim() !== '') {
      acc[input.name] = input.value.trim();
    }
    return acc;
  }, {});
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

  // Event listener for activity checkbox changes to show/hide submenu inputs
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
            inputField = `<input type="time" name="submenu-${activityId}.${cleanSubNum}" required />`;
          } else if (/ระยะเวลา/.test(sub.question)) {
            inputField = `<input type="text" name="submenu-${activityId}.${cleanSubNum}" readonly placeholder="คำนวณอัตโนมัติ" />`;
          } else if (/6\.1/.test(sub.question)) {
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
          } else if (/รายละเอียดเพิ่มเติม|อธิบายปัญหา|โปรดระบุ/.test(sub.question)) {
            inputField = `<textarea name="submenu-${activityId}.${cleanSubNum}" rows="1" style="overflow:hidden;resize:none;width:100%;" oninput="this.style.height='auto';this.style.height=(this.scrollHeight)+'px';"></textarea>`;
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


        // After rendering inputs, add event listeners to calculate duration automatically
        const startInput = submenuContainer.querySelector(`input[name='submenu-${activityId}.1']`);
        const endInput = submenuContainer.querySelector(`input[name='submenu-${activityId}.2']`);
        const durationInput = submenuContainer.querySelector(`input[name='submenu-${activityId}.3']`);



        console.log('startInput:', startInput);
        console.log('endInput:', endInput);
        console.log('durationInput:', durationInput);


        if (startInput && endInput && durationInput) {
          const calculateDuration = () => {
            console.log('Calculating duration...');
            const start = startInput.value;
            const end = endInput.value;
            if (start && end) {
              const startDate = new Date(`1970-01-01T${start}:00`);
              const endDate = new Date(`1970-01-01T${end}:00`);
              let diff = (endDate - startDate) / 60000; // minutes

              if (diff < 0) {
                diff += 24 * 60; // next day
              }
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


      } catch (err) {
        console.error(`Failed to load submenus for Activity ID ${activityId}:`, err);
        submenuContainer.innerHTML = '<p>Error loading details.</p>';
      }
    } else {
      submenuContainer.innerHTML = '';
    }
  });
};
