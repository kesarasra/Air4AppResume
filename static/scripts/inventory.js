// --- Load Inventory Table ---
async function loadInventory() {
    const res = await fetch("/api/inventory");
    const items = await res.json();
    const tbody = document.querySelector("#inventory-table tbody");
    tbody.innerHTML = "";

    items.forEach(item => {
        const tr = document.createElement("tr");

        // Table columns
        [
            "Product Name", "TH Product Name", "Supplier", "Category",
            "Package Type", "Package Size Per", "Scientific Unit Type",
            "Bulk Case Quantity", "Bulk Pricing", "Package Pricing", "Unit Pricing",
            "Total Bulk Case Stocked", "Total Packages Stocked", "Total Quantity Stocked",
            "Total Packages Used", "Total Quantity Used",
            "Monthly Packages Used", "Monthly Quantity Used",
            "Monthly Packages to Order", "Monthly Quantity to Order",
            "Min Threshold"
        ].forEach(key => {
            const td = document.createElement("td");
            td.setAttribute("data-key", key);
            td.textContent = item[key] || "";
            tr.appendChild(td);
        });

        // --- Actions column ---
        const actionTd = document.createElement("td");
        actionTd.setAttribute("data-key", "Actions");
        actionTd.classList.add("action-buttons");

        // Reset usage button
        const resetBtn = document.createElement("button");
        resetBtn.textContent = "รีเซ็ตการใช้งาน";
        resetBtn.className = "button";
        resetBtn.onclick = async () => {
            await fetch(`/api/inventory/reset/${encodeURIComponent(item["Product Name"])}`, {
                method: "POST"
            });
            const packagesUsedTd = tr.querySelector("td[data-key='Total Packages Used']");
            const quantityUsedTd = tr.querySelector("td[data-key='Total Quantity Used']");
            if (packagesUsedTd) packagesUsedTd.textContent = "0";
            if (quantityUsedTd) quantityUsedTd.textContent = "0";
        };
        actionTd.appendChild(resetBtn);

        // Add Packages button
        const addBtn = document.createElement("button");
        addBtn.textContent = "เพิ่มจำนวนแพ็กเกจ";
        addBtn.className = "button";
        addBtn.onclick = async () => {
            const qty = prompt("Enter number of packages to add:");
            if (!qty || isNaN(qty)) return alert("Invalid number");
            const amount = parseFloat(qty);

            const res = await fetch("/api/inventory/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ product: item["Product Name"], amount })
            });
            const result = await res.json();
            if (result.status !== "success") return alert(result.message || "Error updating inventory");

            const packagesTd = tr.querySelector("td[data-key='Total Packages Stocked']");
            const sizeTd = tr.querySelector("td[data-key='Package Size Per']");
            const unitTd = tr.querySelector("td[data-key='Scientific Unit Type']");
            const quantityTd = tr.querySelector("td[data-key='Total Quantity Stocked']");

            const currentPackages = parseFloat(packagesTd.textContent) || 0;
            const packageSize = parseFloat(sizeTd.textContent) || 0;
            const unit = unitTd ? unitTd.textContent : "";

            const newPackages = currentPackages + amount;
            packagesTd.textContent = newPackages;
            quantityTd.textContent = `${(newPackages * packageSize).toFixed(2)} ${unit}`.trim();
        };
        actionTd.appendChild(addBtn);

        // Delete Packages button
        const delBtn = document.createElement("button");
        delBtn.textContent = "ลบจำนวนแพ็กเกจ";
        delBtn.className = "button";
        delBtn.onclick = async () => {
            const qty = prompt("Enter number of packages to delete:");
            if (!qty || isNaN(qty)) return alert("Invalid number");
            const amount = parseFloat(qty);

            const res = await fetch("/api/inventory/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ product: item["Product Name"], amount })
            });
            const result = await res.json();
            if (result.status !== "success") return alert(result.message || "Error updating inventory");

            const packagesTd = tr.querySelector("td[data-key='Total Packages Stocked']");
            const sizeTd = tr.querySelector("td[data-key='Package Size Per']");
            const unitTd = tr.querySelector("td[data-key='Scientific Unit Type']");
            const quantityTd = tr.querySelector("td[data-key='Total Quantity Stocked']");

            const currentPackages = parseFloat(packagesTd.textContent) || 0;
            const packageSize = parseFloat(sizeTd.textContent) || 0;
            const unit = unitTd ? unitTd.textContent : "";

            const newPackages = Math.max(0, currentPackages - amount);
            packagesTd.textContent = newPackages;
            quantityTd.textContent = `${(newPackages * packageSize).toFixed(2)} ${unit}`.trim();
        };
        actionTd.appendChild(delBtn);

        tr.appendChild(actionTd);
        tbody.appendChild(tr);
    });
}

// --- Page-level Reset Usage Button ---
document.getElementById("reset-btn").addEventListener("click", async () => {
    const confirmReset = confirm("Reset usage for ALL products?");
    if (!confirmReset) return;
    await fetch("/api/inventory/reset", { method: "POST" });
    alert("All usage reset to zero!");
    
    // Update table usage columns without reloading
    document.querySelectorAll("#inventory-table tbody tr").forEach(tr => {
        const packagesUsedTd = tr.querySelector("td[data-key='Total Packages Used']");
        const quantityUsedTd = tr.querySelector("td[data-key='Total Quantity Used']");
        if (packagesUsedTd) packagesUsedTd.textContent = "0";
        if (quantityUsedTd) quantityUsedTd.textContent = "0";
    });
});

// --- Load table on page ready ---
document.addEventListener("DOMContentLoaded", loadInventory);
