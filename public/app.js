const screens = document.querySelectorAll(".screen");
const navLinks = document.querySelectorAll(".nav-link");
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toast-message");
const toastUndo = document.getElementById("toast-undo");
const globalSearch = document.getElementById("global-search");
const globalSearchResults = document.getElementById("global-search-results");
const itemSearch = document.getElementById("item-search");
const itemResults = document.getElementById("item-results");
const themeSelect = document.getElementById("theme-select");
const accentPicker = document.getElementById("accent-color");
const gradientsToggle = document.getElementById("enable-gradients");

const inventoryRows = document.getElementById("inventory-rows");
const expenseRows = document.getElementById("expense-rows");
const fastAddButton = document.getElementById("fast-add-item");
const fastItemName = document.getElementById("fast-item-name");
const fastItemBin = document.getElementById("fast-item-bin");
const itemImageUpload = document.getElementById("item-image-upload");
const expenseSaveButton = document.getElementById("save-expense");
const expenseName = document.getElementById("expense-name");
const expenseCategory = document.getElementById("expense-category");
const expenseAmount = document.getElementById("expense-amount");
const receiptUpload = document.getElementById("receipt-upload");

let itemsCache = [];
let expensesCache = [];
let selectedItemId = null;
let selectedExpenseId = null;

function showToast(message, undoCallback) {
  toastMessage.textContent = message;
  toast.classList.add("active");
  toastUndo.onclick = () => {
    toast.classList.remove("active");
    if (undoCallback) undoCallback();
  };
  setTimeout(() => toast.classList.remove("active"), 4000);
}

function switchScreen(target) {
  screens.forEach((screen) => screen.classList.toggle("active", screen.id === `screen-${target}`));
  navLinks.forEach((link) => link.classList.toggle("active", link.dataset.screen === target));
}

navLinks.forEach((link) => {
  link.addEventListener("click", () => switchScreen(link.dataset.screen));
});

async function apiFetch(path, options) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json", ...(options?.headers ?? {}) },
    ...options
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Request failed");
  }
  return response;
}

async function loadDashboard() {
  const summary = await apiFetch("/api/reports/summary").then((res) => res.json());
  document.getElementById("kpi-profit").textContent = `$${(summary.salesTotal - summary.expenseTotal).toFixed(2)}`;
  document.getElementById("kpi-florida").textContent = `$${Number(summary.floridaLiability).toFixed(2)}`;
  const ready = await apiFetch("/api/items/ready").then((res) => res.json());
  document.getElementById("kpi-ready").textContent = String(ready.items.length);
}

function renderItems(items) {
  inventoryRows.innerHTML = items
    .map(
      (item) => `
    <div class="row" data-id="${item.id}">
      <span>${item.name}</span>
      <span class="pill ${item.status === "listed" ? "listed" : item.status === "sold" ? "draft" : "ready"}">${item.status}</span>
      <span>${item.bin_location ?? "—"}</span>
      <span class="soft-warning">${item.status === "unlisted" ? "Ready for pricing" : ""}</span>
      <span><button class="btn ghost small" data-action="edit">Edit</button></span>
    </div>`
    )
    .join("");

  inventoryRows.querySelectorAll(".row").forEach((row) => {
    row.addEventListener("click", () => {
      selectedItemId = row.dataset.id;
    });
  });
}

async function loadItems() {
  const data = await apiFetch("/api/items").then((res) => res.json());
  itemsCache = data.items || [];
  renderItems(itemsCache);
  attachSearch(globalSearch, globalSearchResults, buildGlobalItems());
  attachSearch(itemSearch, itemResults, itemsCache);
}

function renderExpenses(expenses) {
  expenseRows.innerHTML = expenses
    .map(
      (expense) => `
    <div class="row" data-id="${expense.id}">
      <span>${expense.name}</span>
      <span>${expense.category}</span>
      <span>${expense.amount}</span>
      <span class="pill ready">${expense.receipt_key ? "Uploaded" : "Missing"}</span>
      <span><button class="btn ghost small" data-action="edit">Edit</button></span>
    </div>`
    )
    .join("");

  expenseRows.querySelectorAll(".row").forEach((row) => {
    row.addEventListener("click", () => {
      selectedExpenseId = row.dataset.id;
    });
  });
}

async function loadExpenses() {
  const data = await apiFetch("/api/expenses").then((res) => res.json());
  expensesCache = data.expenses || [];
  renderExpenses(expensesCache);
}

function renderNextActions() {
  const nextActions = document.getElementById("next-actions");
  const itemsNeedingDraft = itemsCache.filter((item) => item.status === "unlisted");
  const content = [
    `Finish ${itemsNeedingDraft.length} pricing drafts to unlock listings`,
    "Review Florida sales tax liability in Reports",
    "Upload receipts for 2 expenses"
  ];
  nextActions.innerHTML = content.map((item) => `<li>${item}</li>`).join("");
}

function renderSearchResults(input, resultsContainer, items) {
  const query = input.value.toLowerCase();
  const matches = items.filter((item) => item.name.toLowerCase().includes(query));
  if (!query || matches.length === 0) {
    resultsContainer.classList.remove("active");
    resultsContainer.innerHTML = "";
    return;
  }
  resultsContainer.classList.add("active");
  resultsContainer.innerHTML = matches
    .map((item) => `<button type="button" data-id="${item.id}">${item.name}</button>`)
    .join("");
}

function attachSearch(input, resultsContainer, items) {
  input.addEventListener("input", () => renderSearchResults(input, resultsContainer, items));
  resultsContainer.addEventListener("click", (event) => {
    if (!(event.target instanceof HTMLButtonElement)) return;
    input.value = event.target.textContent;
    resultsContainer.classList.remove("active");
  });
  document.addEventListener("click", (event) => {
    if (!resultsContainer.contains(event.target) && event.target !== input) {
      resultsContainer.classList.remove("active");
    }
  });
}

function buildGlobalItems() {
  return [
    ...itemsCache.map((item) => ({ ...item, name: `Item: ${item.name}` })),
    ...expensesCache.map((expense) => ({ ...expense, name: `Expense: ${expense.name}` }))
  ];
}

function updateTheme() {
  const theme = themeSelect.value;
  document.body.classList.toggle("theme-dark", theme === "dark");
  document.body.classList.toggle("theme-light", theme !== "dark");
}

function updateAccent() {
  document.documentElement.style.setProperty("--accent", accentPicker.value);
}

function updateGradients() {
  document.body.style.backgroundImage = gradientsToggle.checked
    ? "radial-gradient(circle at top left, rgba(91, 93, 255, 0.15), transparent 50%)"
    : "none";
}

async function downloadCsv(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error("Export failed");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = path.split("/").pop() || "export.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("CSV export downloaded");
  } catch (error) {
    showToast("Export blocked by auth. Sign in via Zero Trust.");
  }
}

function registerActions() {
  const newEntry = document.getElementById("new-entry");
  newEntry.addEventListener("click", () => showToast("Entry created", () => showToast("Entry restored")));
  document.getElementById("export-csv").addEventListener("click", () => downloadCsv("/api/exports/csv"));
  document.getElementById("export-year-end").addEventListener("click", () => downloadCsv("/api/exports/year-end"));
  document.getElementById("export-florida-tax").addEventListener("click", () => downloadCsv("/api/exports/florida-tax"));
  document.getElementById("add-item").addEventListener("click", () => showToast("Item added", () => showToast("Item removed")));
  document.getElementById("add-sale").addEventListener("click", () => showToast("Sale logged", () => showToast("Sale removed")));
  document.getElementById("add-expense").addEventListener("click", () => showToast("Expense saved"));
  document.getElementById("add-lot").addEventListener("click", () => showToast("Lot created"));
  document.getElementById("add-draft").addEventListener("click", () => showToast("Draft started"));
  document.getElementById("ready-filter").addEventListener("click", async () => {
    const ready = await apiFetch("/api/items/ready").then((res) => res.json());
    renderItems(ready.items || []);
    showToast("Ready to List filter applied");
  });
  document.getElementById("view-tax").addEventListener("click", () => showToast("Tax Jar opened"));
  document.getElementById("tax-drilldown").addEventListener("click", () =>
    showToast("Drilldown: sales revenue - expenses - promo discounts.")
  );

  document.querySelectorAll(".btn.ghost.small").forEach((button) => {
    button.addEventListener("click", () => showToast("Closed-period edit warning. Confirm if needed."));
  });
}

async function registerForms() {
  fastAddButton.addEventListener("click", async () => {
    if (!fastItemName.value.trim()) return;
    await apiFetch("/api/items", {
      method: "POST",
      body: JSON.stringify({ name: fastItemName.value, binLocation: fastItemBin.value, status: "unlisted" })
    });
    fastItemName.value = "";
    fastItemBin.value = "";
    showToast("Item added");
    await loadItems();
    renderNextActions();
  });

  expenseSaveButton.addEventListener("click", async () => {
    if (!expenseName.value.trim()) return;
    await apiFetch("/api/expenses", {
      method: "POST",
      body: JSON.stringify({ name: expenseName.value, category: expenseCategory.value, amount: Number(expenseAmount.value) })
    });
    expenseName.value = "";
    expenseCategory.value = "";
    expenseAmount.value = "";
    showToast("Expense saved");
    await loadExpenses();
  });

  itemImageUpload.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedItemId) return;
    await fetch(`/api/items/${selectedItemId}/images`, {
      method: "POST",
      headers: { "content-type": file.type },
      body: await file.arrayBuffer()
    });
    showToast("Image uploaded");
  });

  receiptUpload.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedExpenseId) return;
    await fetch(`/api/expenses/${selectedExpenseId}/receipt`, {
      method: "POST",
      headers: { "content-type": file.type },
      body: await file.arrayBuffer()
    });
    showToast("Receipt uploaded");
  });
}

async function boot() {
  renderNextActions();
  registerActions();
  await loadItems();
  await loadExpenses();
  await loadDashboard();
  renderNextActions();
  await registerForms();
}

if (themeSelect) {
  themeSelect.addEventListener("change", updateTheme);
  accentPicker.addEventListener("input", updateAccent);
  gradientsToggle.addEventListener("change", updateGradients);
  updateTheme();
  updateAccent();
}

boot();
