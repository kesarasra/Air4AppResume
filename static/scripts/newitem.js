document.addEventListener('DOMContentLoaded', () => {
  const btnChemicalFormulas = document.getElementById('btn-chemical-formulas');
  const btnWorkerNames = document.getElementById('btn-worker-names');
  const btnEquipment = document.getElementById('btn-equipment');
  const formContainer = document.getElementById('item-form-container');

  btnChemicalFormulas.addEventListener('click', loadChemicalFormulaForm);
  btnWorkerNames.addEventListener('click', () => {
    formContainer.innerHTML = '<p>การสร้างชื่อพนักงาน กำลังจะมาเร็ว ๆ นี้</p>';
  });
  btnEquipment.addEventListener('click', () => {
    formContainer.innerHTML = '<p>การสร้างอุปกรณ์ กำลังจะมาเร็ว ๆ นี้</p>';
  });

  async function loadChemicalFormulaForm() {
    formContainer.innerHTML = '<p>กำลังโหลดแบบฟอร์ม...</p>';
    
    // Fetch chemical names from Fertilizers and Pesticides sheets
    try {
      const [fertilizers, pesticides] = await Promise.all([
        fetch('/api/fertilizer-names').then(res => res.json()),
        fetch('/api/pesticide-names').then(res => res.json()),
      ]);

      if (fertilizers.error || pesticides.error) {
        formContainer.innerHTML = '<p>เกิดข้อผิดพลาดในการโหลดชื่อสารเคมี</p>';
        return;
      }

      const chemicalNames = [...new Set([...(fertilizers || []), ...(pesticides || [])])].sort();

      // Now build the form HTML with chemicalNames for dropdown options
      formContainer.innerHTML = buildChemicalFormulaFormHTML(chemicalNames);

      setupChemicalFormulaFormLogic(chemicalNames);
    } catch (err) {
      console.error(err);
      formContainer.innerHTML = '<p>เกิดข้อผิดพลาดในการโหลดชื่อสารเคมี</p>';
    }
  }

  // Helper to build form HTML for chemical formula creation
  function buildChemicalFormulaFormHTML(chemicalNames) {
    return `
      <form id="chemical-formula-form">
        <fieldset>
          <legend>ประเภทสูตร</legend>
          <label><input type="radio" name="formulaType" value="one-time" checked />ใช้ครั้งเดียว</label>
          <label><input type="radio" name="formulaType" value="permanent" />ถาวร</label>
        </fieldset>

        <label for="formula-id">รหัสสูตร</label>
        <input type="text" id="formula-id" name="formulaId" readonly placeholder="Auto-generated for One-Time Use" required />

        <div id="chemicals-container">
          <!-- Chemical rows will be inserted here -->
        </div>

        <button type="button" id="add-chemical-btn">เพิ่มสารเคมี</button>

        <label for="water-volume">ปริมาณน้ำ (L) - ไม่บังคับ</label>
        <input type="number" id="water-volume" name="waterVolume" min="0" step="any" />

        <button type="submit" class="cta">ส่งสูตร</button>
      </form>
    `;
  }

  // Logic for form behavior
  function setupChemicalFormulaFormLogic(chemicalNames) {
    const form = document.getElementById('chemical-formula-form');
    const formulaIdInput = form.querySelector('#formula-id');
    const formulaTypeRadios = form.querySelectorAll('input[name="formulaType"]');
    const chemicalsContainer = form.querySelector('#chemicals-container');
    const addChemicalBtn = form.querySelector('#add-chemical-btn');

    // Generate unique ID function for one-time use formula
    function generateOneTimeFormulaId() {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      return `CF${y}${m}${d}-${randomDigits}`;
    }

    // Initialize formula ID depending on selected radio
    function updateFormulaIdField() {
      const selectedType = [...formulaTypeRadios].find(r => r.checked).value;
      if (selectedType === 'one-time') {
        formulaIdInput.value = generateOneTimeFormulaId();
        formulaIdInput.readOnly = true;
        formulaIdInput.required = false;
      } else {
        formulaIdInput.value = '';
        formulaIdInput.readOnly = false;
        formulaIdInput.required = true;
        formulaIdInput.placeholder = 'กรอกรหัสสูตรที่ไม่ซ้ำ';
      }
    }

    function updateRemoveButtons() {
        const chemicalRows = chemicalsContainer.querySelectorAll('.chemical-row');
        const disable = chemicalRows.length <= 1;
        chemicalRows.forEach(row => {
        const btn = row.querySelector('.remove-chemical-btn');
        btn.disabled = disable;
        btn.style.opacity = disable ? '0.5' : '1';
        btn.style.cursor = disable ? 'default' : 'pointer';
        });
    }

    // Add one chemical input row
    function addChemicalRow() {
      const rowIndex = chemicalsContainer.children.length;

      const chemicalOptions = chemicalNames.map(name => `<option value="${name}">${name}</option>`).join('');

      const row = document.createElement('div');
      row.className = 'chemical-row';
      row.innerHTML = `
        <select name="chemicalName" required>
          <option value="">เลือกสารเคมี</option>
          ${chemicalOptions}
        </select>
        <input type="number" name="amount" min="0" step="any" placeholder="ปริมาณ" required />
        <select name="unit" required>
          <option value="kg">kg</option>
          <option value="L">L</option>
          <option value="Bottle">ขวด</option>
          <option value="Bag">ถุง</option>
          <option value="Tablet">เม็ด</option>
        </select>
        <button type="button" class="remove-chemical-btn" title="Remove Chemical">&times;</button>
      `;

      // Remove button event
      row.querySelector('.remove-chemical-btn').addEventListener('click', () => {
        row.remove();
        updateRemoveButtons();
        });

        chemicalsContainer.appendChild(row);
        updateRemoveButtons();
    }

    // Initial setup
    updateFormulaIdField();
    addChemicalRow();

    formulaTypeRadios.forEach(radio => {
      radio.addEventListener('change', updateFormulaIdField);
    });

    addChemicalBtn.addEventListener('click', addChemicalRow);

    // Form submit handler
    form.addEventListener('submit', async e => {
      e.preventDefault();

      // Gather chemical data
      const chemicalRows = chemicalsContainer.querySelectorAll('.chemical-row');
      if (chemicalRows.length === 0) {
        alert('กรุณาเพิ่มสารเคมีอย่างน้อยหนึ่งชนิด');
        return;
      }

      const chemicals = [];
      for (const row of chemicalRows) {
        const chemicalName = row.querySelector('select[name="chemicalName"]').value.trim();
        const amountInput = parseFloat(row.querySelector('input[name="amount"]').value);
        const unit = row.querySelector('select[name="unit"]').value;

        if (!chemicalName || !amountInput || !unit) {
        alert('กรุณากรอกข้อมูลสารเคมีให้ครบถ้วนและถูกต้อง');
        return;
      }

      const amount = parseFloat(amountInput);
      if (isNaN(amount)) {
        alert(`ปริมาณสำหรับ ${chemicalName} ไม่ถูกต้อง`);
        return;
      }

      let normalizedAmount = amount;
      let normalizedUnit = unit;

        if (["Bottle", "Bag", "Tablet"].includes(unit)) {
          try {
            const resp = await fetch("/api/normalize-amount", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: chemicalName,
                amount: `${amount} ${unit}`
              })
            });
            const norm = await resp.json();
            if (!resp.ok || !norm.normalizedAmount || !norm.unitType) {
              alert(`การแปลงหน่วยล้มเหลวสำหรับ ${chemicalName}: ${norm.error || 'ไม่ทราบสาเหตุ'}`);
              return;
            }

            normalizedAmount = norm.normalizedAmount;
            normalizedUnit = norm.unitType;

          } catch (err) {
            alert(`ข้อผิดพลาดเครือข่ายระหว่างแปลงหน่วย: ${err.message}`);
            return;
          }
        }

        chemicals.push({
          thaiName: chemicalName,
          amount: normalizedAmount,
          unit: normalizedUnit
        });
      }

      const formulaId = formulaIdInput.value.trim();
      const oneTimeUse = form.querySelector('input[name="formulaType"]:checked').value === 'one-time' ? 'Y' : 'N';
      const waterVolumeInput = form.querySelector('#water-volume').value.trim();
      const waterVolume = waterVolumeInput === '' ? null : parseFloat(waterVolumeInput);

      if (!formulaId) {
        alert('จำเป็นต้องระบุรหัสสูตร');
        return;
      }

      // Prepare payload
      const payload = {
        formulaId,
        oneTimeUse,
        chemicals,
        waterVolume
      };

      try {
        const response = await fetch('/api/save-formula', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (response.ok) {
          alert(`สูตร ${result.formulaId} บันทึกสำเร็จแล้ว!`);
          form.reset();
          chemicalsContainer.innerHTML = '';
          addChemicalRow();
          updateFormulaIdField();
        } else {
          alert(`เกิดข้อผิดพลาดในการบันทึกสูตร: ${result.error || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ'}`);
        }
      } catch (err) {
        alert(`ข้อผิดพลาดเครือข่าย: ${err.message}`);
      }
    });
  }
});
