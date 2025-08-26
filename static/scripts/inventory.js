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

            // Default value
            let value = item[key] || "";
            let color = "#222"; // default background

            // If your API includes a separate color property
            if (item[`${key}_color`]) {
                color = item[`${key}_color`];
            }

            td.textContent = value;
            td.style.backgroundColor = color;
            tr.appendChild(td);
        });

        // Actions column
        const actionTd = document.createElement("td");

        // Reset usage button (row-level)
        const resetBtn = document.createElement("button");
        resetBtn.textContent = "Reset Usage";
        resetBtn.className = "button";
        resetBtn.onclick = async () => {
            await fetch(`/api/inventory/reset/${encodeURIComponent(item["Product Name"])}`, {
                method: "POST"
            });
            loadInventory();
        };
        actionTd.appendChild(resetBtn);

        // Add stock button
        const addBtn = document.createElement("button");
        addBtn.textContent = "Add Stock";
        addBtn.className = "button";
        addBtn.style.marginLeft = "5px";
        addBtn.onclick = async () => {
            const qty = prompt("Enter quantity to add:");
            if (!qty || isNaN(qty)) return alert("Invalid number");
            const unit = prompt("Enter unit (optional):") || "";
            await fetch("/api/inventory/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    product: item["Product Name"],
                    amount: parseFloat(qty), // matches backend 'amount'
                    unit: unit
                })
            });
            loadInventory();
        };
        actionTd.appendChild(addBtn);

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
    loadInventory();
});

// --- Load table on page ready ---
document.addEventListener("DOMContentLoaded", loadInventory);
