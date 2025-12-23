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

const dataStore = {
  items: [
    { id: "itm-1", name: "Vintage Camera", status: "Draft" },
    { id: "itm-2", name: "Mid-century Lamp", status: "Listed" },
    { id: "itm-3", name: "Record Player", status: "Ready" },
    { id: "itm-4", name: "Leather Satchel", status: "Draft" }
  ],
  lots: [
    { id: "lot-1", name: "Vintage Audio" },
    { id: "lot-2", name: "Winter Apparel" }
  ],
  sales: [
    { id: "sale-1", name: "#EV-0192" },
    { id: "sale-2", name: "#SF-0441" }
  ],
  expenses: [
    { id: "exp-1", name: "Shipping supplies" },
    { id: "exp-2", name: "Estate sale haul" }
  ]
};

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

function renderNextActions() {
  const nextActions = document.getElementById("next-actions");
  const itemsNeedingDraft = dataStore.items.filter((item) => item.status === "Draft");
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

async function downloadCsv() {
  try {
    const response = await fetch("/api/exports/csv", { headers: { "cf-access-jwt-assertion": "browser", "cf-access-authenticated-user-email": "user@local" } });
    if (!response.ok) throw new Error("Export failed");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "items-export.csv";
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
  document.getElementById("export-csv").addEventListener("click", downloadCsv);
  document.getElementById("add-item").addEventListener("click", () => showToast("Item added", () => showToast("Item removed")));
  document.getElementById("add-sale").addEventListener("click", () => showToast("Sale logged", () => showToast("Sale removed")));
  document.getElementById("add-expense").addEventListener("click", () => showToast("Expense saved"));
  document.getElementById("add-lot").addEventListener("click", () => showToast("Lot created"));
  document.getElementById("add-draft").addEventListener("click", () => showToast("Draft started"));
  document.getElementById("ready-filter").addEventListener("click", () => showToast("Ready to List filter applied"));
  document.getElementById("view-tax").addEventListener("click", () => showToast("Tax Jar opened"));
  document.getElementById("tax-drilldown").addEventListener("click", () =>
    showToast("Drilldown: sales revenue - expenses - promo discounts.")
  );

  document.querySelectorAll(".btn.ghost.small").forEach((button) => {
    button.addEventListener("click", () => showToast("Closed-period edit warning. Confirm if needed."));
  });
}

const globalItems = [
  ...dataStore.items.map((item) => ({ ...item, name: `Item: ${item.name}` })),
  ...dataStore.lots.map((lot) => ({ ...lot, name: `Lot: ${lot.name}` })),
  ...dataStore.sales.map((sale) => ({ ...sale, name: `Sale: ${sale.name}` })),
  ...dataStore.expenses.map((expense) => ({ ...expense, name: `Expense: ${expense.name}` }))
];

attachSearch(globalSearch, globalSearchResults, globalItems);
attachSearch(itemSearch, itemResults, dataStore.items);
renderNextActions();
registerActions();

if (themeSelect) {
  themeSelect.addEventListener("change", updateTheme);
  accentPicker.addEventListener("input", updateAccent);
  gradientsToggle.addEventListener("change", updateGradients);
  updateTheme();
  updateAccent();
}
