// ============================================================================
// RESELLER OPS - Frontend Application
// ============================================================================

// ============================================================================
// HAMBURGER MENU TOGGLE
// ============================================================================

const menuToggle = document.getElementById('menu-toggle');
const menuOverlay = document.getElementById('menu-overlay');
const sidebar = document.querySelector('.sidebar');

function toggleMenu() {
  menuToggle.classList.toggle('active');
  menuOverlay.classList.toggle('active');
  sidebar.classList.toggle('active');

  // Prevent body scroll when menu is open
  if (sidebar.classList.contains('active')) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
}

// Toggle menu on button click
if (menuToggle) {
  menuToggle.addEventListener('click', toggleMenu);
}

// Close menu when overlay clicked
if (menuOverlay) {
  menuOverlay.addEventListener('click', toggleMenu);
}

// Close menu when navigation link clicked
document.querySelectorAll('.sidebar .nav-link').forEach(link => {
  link.addEventListener('click', () => {
    if (sidebar.classList.contains('active')) {
      toggleMenu();
    }
  });
});

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const appState = {
  items: [],
  sales: [],
  expenses: [],
  lots: [],
  pricingDrafts: [],
  settings: {},
  feeProfiles: [],
  currentScreen: 'dashboard',
  loading: false
};

const SERVICE_WORKER_VERSION = 'v1';
const MUTATION_QUEUE_KEY = 'resellerOpsMutationQueue';
let isSyncingQueuedMutations = false;

function getMutationQueue() {
  try {
    return JSON.parse(localStorage.getItem(MUTATION_QUEUE_KEY)) || [];
  } catch (error) {
    console.warn('Failed to read offline queue:', error);
    return [];
  }
}

function setMutationQueue(queue) {
  localStorage.setItem(MUTATION_QUEUE_KEY, JSON.stringify(queue));
  updateOfflineBanner();
}

function createQueueId() {
  return `mutation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function enqueueMutation({ method, path, body }) {
  const queue = getMutationQueue();
  const entry = {
    id: createQueueId(),
    method,
    path,
    body,
    timestamp: new Date().toISOString()
  };
  queue.push(entry);
  setMutationQueue(queue);
  return entry;
}

function updateOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (!banner) return;

  const messageEl = banner.querySelector('[data-offline-message]');
  const actionButton = banner.querySelector('[data-offline-action]');
  const queueCount = getMutationQueue().length;

  if (!navigator.onLine) {
    banner.classList.add('active');
    messageEl.textContent = `Offline mode: ${queueCount} update${queueCount === 1 ? '' : 's'} queued.`;
    actionButton.disabled = true;
    return;
  }

  if (isSyncingQueuedMutations) {
    banner.classList.add('active');
    messageEl.textContent = `Syncing ${queueCount} queued update${queueCount === 1 ? '' : 's'}...`;
    actionButton.disabled = true;
    return;
  }

  if (queueCount > 0) {
    banner.classList.add('active');
    messageEl.textContent = `Back online. ${queueCount} update${queueCount === 1 ? '' : 's'} ready to sync.`;
    actionButton.disabled = false;
    return;
  }

  banner.classList.remove('active');
  messageEl.textContent = '';
  actionButton.disabled = true;
}

// ============================================================================
// API CLIENT
// ============================================================================

const api = {
  baseUrl: '',

  async request(method, path, body = null, requestOptions = {}) {
    const { skipQueue = false } = requestOptions;

    if (method !== 'GET' && !skipQueue && !navigator.onLine) {
      enqueueMutation({ method, path, body });
      showToast('Offline: update queued for sync.');
      return { queued: true };
    }

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${this.baseUrl}${path}`, options);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      if (response.status === 204) {
        return null;
      }

      return await response.json();
    } catch (error) {
      if (method !== 'GET' && !skipQueue && !navigator.onLine) {
        enqueueMutation({ method, path, body });
        showToast('Offline: update queued for sync.');
        return { queued: true };
      }
      console.error('API Error:', error);
      throw error;
    }
  },

  async uploadFile(path, formData) {
    if (!navigator.onLine) {
      showToast('Offline: file uploads are disabled.');
      throw new Error('Offline: file uploads are disabled');
    }

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Upload Error:', error);
      throw error;
    }
  },

  // Items
  getItems: (filters = {}) => api.request('GET', `/api/items?${new URLSearchParams(filters)}`),
  getItem: (id) => api.request('GET', `/api/items/${id}`),
  createItem: (data) => api.request('POST', '/api/items', data),
  updateItem: (id, data) => api.request('PUT', `/api/items/${id}`, data),
  deleteItem: (id) => api.request('DELETE', `/api/items/${id}`),

  // Sales
  getSales: (filters = {}) => api.request('GET', `/api/sales?${new URLSearchParams(filters)}`),
  getSale: (id) => api.request('GET', `/api/sales/${id}`),
  createSale: (data) => api.request('POST', '/api/sales', data),
  updateSale: (id, data) => api.request('PUT', `/api/sales/${id}`, data),
  deleteSale: (id) => api.request('DELETE', `/api/sales/${id}`),

  // Expenses
  getExpenses: (filters = {}) => api.request('GET', `/api/expenses?${new URLSearchParams(filters)}`),
  getExpense: (id) => api.request('GET', `/api/expenses/${id}`),
  createExpense: (data) => api.request('POST', '/api/expenses', data),
  updateExpense: (id, data) => api.request('PUT', `/api/expenses/${id}`, data),
  deleteExpense: (id) => api.request('DELETE', `/api/expenses/${id}`),

  // Lots
  getLots: () => api.request('GET', '/api/lots'),
  getLot: (id) => api.request('GET', `/api/lots/${id}`),
  createLot: (data) => api.request('POST', '/api/lots', data),
  updateLot: (id, data) => api.request('PUT', `/api/lots/${id}`, data),
  deleteLot: (id) => api.request('DELETE', `/api/lots/${id}`),

  // Pricing Drafts
  getPricingDrafts: (filters = {}) => api.request('GET', `/api/pricing-drafts?${new URLSearchParams(filters)}`),
  getPricingDraft: (id) => api.request('GET', `/api/pricing-drafts/${id}`),
  createPricingDraft: (data) => api.request('POST', '/api/pricing-drafts', data),
  updatePricingDraft: (id, data) => api.request('PUT', `/api/pricing-drafts/${id}`, data),
  deletePricingDraft: (id) => api.request('DELETE', `/api/pricing-drafts/${id}`),
  applyPricingDraft: (id) => api.request('POST', `/api/pricing-drafts/${id}/apply`),

  // Settings
  getSettings: () => api.request('GET', '/api/settings'),
  getSetting: (key) => api.request('GET', `/api/settings/${key}`),
  updateSetting: (key, value) => api.request('PUT', `/api/settings/${key}`, { value }),

  // Reports
  getDashboard: () => api.request('GET', '/api/reports/dashboard'),
  getProfitLoss: (startDate, endDate) => api.request('GET', `/api/reports/profit-loss?start_date=${startDate}&end_date=${endDate}`),
  getTaxSummary: (startDate, endDate) => api.request('GET', `/api/reports/tax-summary?start_date=${startDate}&end_date=${endDate}`),
  getFloridaTax: (startDate, endDate) => api.request('GET', `/api/reports/florida-sales-tax?start_date=${startDate}&end_date=${endDate}`),

  // Stats
  getStatsSummary: (period = 'month') => api.request('GET', `/api/stats/summary?period=${period}`),

  // Photos
  uploadPhoto: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.uploadFile('/api/photos/upload', formData);
  },

  // AI
  generateSEO: (itemId = null, lotId = null) => api.request('POST', '/api/ai/generate-seo', { item_id: itemId, lot_id: lotId }),
  categorize: (text, type) => api.request('POST', '/api/ai/categorize', { text, type }),
  suggestPrice: (itemId = null, data = {}) => api.request('POST', '/api/ai/suggest-price', { item_id: itemId, ...data }),
  suggestSplit: (name, category, amount) => api.request('POST', '/api/ai/suggest-split', { name, category, amount }),
  enhanceDescription: (description) => api.request('POST', '/api/ai/enhance-description', { description }),
  getAIInsights: () => api.request('GET', '/api/ai/insights'),
  getAIUsage: () => api.request('GET', '/api/ai/usage'),

  // Backup & Restore
  downloadBackup: async () => {
    const response = await fetch('/api/backup/full');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reseller-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
  restoreBackup: (backupData) => api.request('POST', '/api/restore/full', backupData),

  // Import
  importItems: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.uploadFile('/api/import/items', formData);
  },
  importExpenses: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.uploadFile('/api/import/expenses', formData);
  },

  // Validation
  validateSKU: (sku, excludeId = null) => api.request('GET', `/api/validate/sku?sku=${encodeURIComponent(sku)}${excludeId ? `&exclude_id=${excludeId}` : ''}`)
};

// ============================================================================
// UI HELPERS
// ============================================================================

function showToast(message, undoCallback = null) {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');
  const toastUndo = document.getElementById('toast-undo');

  toastMessage.textContent = message;
  toast.classList.add('active');

  if (undoCallback) {
    toastUndo.style.display = 'inline-block';
    toastUndo.onclick = () => {
      toast.classList.remove('active');
      undoCallback();
    };
  } else {
    toastUndo.style.display = 'none';
  }

  setTimeout(() => toast.classList.remove('active'), 4000);
}

function initOfflineBanner() {
  if (document.getElementById('offline-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'offline-banner';
  banner.className = 'offline-banner';
  banner.innerHTML = `
    <span data-offline-message></span>
    <button class="btn ghost small" data-offline-action>Sync now</button>
  `;

  document.body.prepend(banner);

  const actionButton = banner.querySelector('[data-offline-action]');
  actionButton.addEventListener('click', () => replayQueuedMutations());

  updateOfflineBanner();
}

function refreshCurrentScreen() {
  switch (appState.currentScreen) {
    case 'inventory':
      loadInventory();
      break;
    case 'sales':
      loadSales();
      break;
    case 'expenses':
      loadExpenses();
      break;
    case 'lots':
      loadLots();
      break;
    case 'pricing':
      loadPricing();
      break;
    case 'dashboard':
      loadDashboard();
      break;
    default:
      break;
  }
}

async function replayQueuedMutations() {
  if (!navigator.onLine) {
    updateOfflineBanner();
    return;
  }

  const queue = getMutationQueue();
  if (!queue.length) {
    updateOfflineBanner();
    return;
  }

  isSyncingQueuedMutations = true;
  updateOfflineBanner();

  let processed = 0;
  while (queue.length) {
    const entry = queue[0];
    try {
      await api.request(entry.method, entry.path, entry.body, { skipQueue: true });
      queue.shift();
      processed += 1;
      setMutationQueue(queue);
    } catch (error) {
      showToast(`Sync paused: ${error.message}`);
      break;
    }
  }

  isSyncingQueuedMutations = false;
  updateOfflineBanner();

  if (processed > 0) {
    showToast(`Synced ${processed} update${processed === 1 ? '' : 's'} from offline queue.`);
    refreshCurrentScreen();
  }
}

function formatCurrency(amount) {
  if (amount == null) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// SCREEN SWITCHING
// ============================================================================

function switchScreen(screenName) {
  appState.currentScreen = screenName;

  // Update nav
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.screen === screenName);
  });

  // Update screens
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.toggle('active', screen.id === `screen-${screenName}`);
  });

  // Load screen data
  loadScreen(screenName);
}

async function loadScreen(screenName) {
  try {
    switch (screenName) {
      case 'dashboard':
        await loadDashboard();
        break;
      case 'inventory':
        await loadInventory();
        break;
      case 'sales':
        await loadSales();
        break;
      case 'expenses':
        await loadExpenses();
        break;
      case 'lots':
        await loadLots();
        break;
      case 'pricing':
        await loadPricing();
        break;
      case 'ebay-valuation':
        await loadEbayValuation();
        break;
      case 'reports':
        await loadReports();
        break;
      case 'settings':
        await loadSettings();
        break;
    }
  } catch (error) {
    showToast(`Error loading ${screenName}: ${error.message}`);
  }
}

// ============================================================================
// DASHBOARD
// ============================================================================

async function loadDashboard() {
  try {
    const data = await api.getDashboard();

    // Update KPIs
    document.querySelector('.kpi .value.positive').textContent = formatCurrency(data.mtd_profit);
    document.querySelector('.kpi .value.warning').textContent = formatCurrency(data.sales_tax_liability);
    document.querySelectorAll('.kpi .value')[2].textContent = data.ready_drafts;

    // Update next actions
    const nextActions = document.getElementById('next-actions');
    nextActions.innerHTML = data.next_actions.map(action =>
      `<li>${escapeHtml(action)}</li>`
    ).join('');

    // Try to load AI insights
    try {
      const insights = await api.getAIInsights();
      updateDashboardInsights(insights);
    } catch (error) {
      console.log('AI insights unavailable:', error.message);
    }

    // Load eBay dashboard widgets
    await loadEbayDashboardWidgets();
  } catch (error) {
    console.error('Dashboard error:', error);
    showToast('Error loading dashboard');
  }
}

function updateDashboardInsights(insights) {
  // This would update a dashboard insights panel if it exists
  console.log('AI Insights:', insights);
}

/**
 * Load eBay dashboard widgets with activity stats
 */
async function loadEbayDashboardWidgets() {
  try {
    // Calculate eBay metrics from app state
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // eBay Activity counts
    const ebayItems = appState.items.filter(i => i.ebay_listing_id);
    const activeListings = ebayItems.filter(i => i.ebay_status === 'active').length;
    const draftListings = ebayItems.filter(i => i.ebay_status === 'draft').length;

    const ebaySales = appState.sales?.filter(s => s.platform === 'eBay') || [];
    const soldThisWeek = ebaySales.filter(s => new Date(s.sale_date) >= weekAgo).length;

    // Update eBay Activity widget
    document.getElementById('ebay-active-count').textContent = activeListings;
    document.getElementById('ebay-draft-count').textContent = draftListings;
    document.getElementById('ebay-sold-week').textContent = soldThisWeek;

    // eBay Performance (MTD)
    const ebayMTDSales = ebaySales
      .filter(s => new Date(s.sale_date) >= monthStart)
      .reduce((sum, s) => sum + (s.gross_amount || 0), 0);

    const ebayMTDProfit = ebaySales
      .filter(s => new Date(s.sale_date) >= monthStart)
      .reduce((sum, s) => sum + (s.profit || 0), 0);

    const profitMargin = ebayMTDSales > 0 ? (ebayMTDProfit / ebayMTDSales * 100).toFixed(1) : 0;

    document.getElementById('ebay-mtd-sales').textContent = formatCurrency(ebayMTDSales);
    document.getElementById('ebay-profit-margin').textContent = `${profitMargin}%`;

    // eBay Action Items
    const actionItems = [];

    // Items ready to list (have photos, not listed)
    const readyToList = appState.items.filter(i =>
      !i.ebay_listing_id &&
      i.status === 'Unlisted' &&
      i.photo_count > 0
    ).length;
    if (readyToList > 0) {
      actionItems.push(`<li><a href="#" onclick="loadScreen('inventory'); return false;">${readyToList} items ready to list on eBay</a></li>`);
    }

    // Stale listings (active for 30+ days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const staleListings = ebayItems.filter(i =>
      i.ebay_status === 'active' &&
      new Date(i.updated_at) < thirtyDaysAgo
    ).length;
    if (staleListings > 0) {
      actionItems.push(`<li>${staleListings} stale listings (30+ days)</li>`);
    }

    // Items without pricing
    const needsValuation = appState.items.filter(i =>
      !i.ebay_listing_id &&
      i.status === 'Unlisted' &&
      (!i.suggested_price || i.suggested_price === 0)
    ).length;
    if (needsValuation > 0) {
      actionItems.push(`<li><a href="#" onclick="loadScreen('ebay-valuation'); return false;">${needsValuation} items need eBay valuation</a></li>`);
    }

    // Drafts pending review
    if (draftListings > 0) {
      actionItems.push(`<li><a href="https://www.ebay.com/sh/lst/drafts" target="_blank">${draftListings} eBay drafts pending publish</a></li>`);
    }

    const actionItemsList = document.getElementById('ebay-action-items');
    if (actionItems.length > 0) {
      actionItemsList.innerHTML = actionItems.join('');
    } else {
      actionItemsList.innerHTML = '<li class="muted">No action items - you\'re all caught up! 🎉</li>';
    }
  } catch (error) {
    console.error('Failed to load eBay dashboard widgets:', error);
    // Silently fail - dashboard still works without eBay widgets
  }
}

// ============================================================================
// INVENTORY
// ============================================================================

async function loadInventory() {
  try {
    const response = await api.getItems();
    appState.items = response.items || [];
    renderInventoryTable();
  } catch (error) {
    showToast('Error loading inventory');
  }
}

function renderInventoryTable() {
  const container = document.querySelector('#screen-inventory .table');
  if (!container) return;

  const getSortIcon = (column) => {
    if (currentSort.screen === 'inventory' && currentSort.column === column) {
      return currentSort.direction === 'asc' ? ' ▲' : ' ▼';
    }
    return '';
  };

  const html = `
    <div class="row header">
      <span class="checkbox-col">
        <input type="checkbox" id="select-all" title="Select all" />
      </span>
      <span class="sortable" data-sort="name">Item${getSortIcon('name')}</span>
      <span class="sortable" data-sort="status">Status${getSortIcon('status')}</span>
      <span class="sortable" data-sort="cost">Cost${getSortIcon('cost')}</span>
      <span class="sortable" data-sort="bin_location">Location${getSortIcon('bin_location')}</span>
      <span></span>
    </div>
    ${appState.items.map(item => `
      <div class="row">
        <span class="checkbox-col">
          <input type="checkbox" data-select-item="${item.id}" />
        </span>
        <span>${escapeHtml(item.name)}</span>
        <span class="pill ${item.status.toLowerCase()}">${escapeHtml(item.status)}</span>
        <span>${formatCurrency(item.cost)}</span>
        <span>${escapeHtml(item.bin_location || '-')}</span>
        <span>
          <button class="btn ghost small" data-action="edit-item" data-id="${item.id}">Edit</button>
          <button class="btn ghost small" data-action="delete-item" data-id="${item.id}">Delete</button>
        </span>
      </div>
    `).join('')}
  `;

  container.innerHTML = html;

  // Wire up select-all checkbox
  const selectAllCheckbox = document.getElementById('select-all');
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', () => toggleSelectAll('inventory'));
  }

  // Wire up individual checkboxes
  container.querySelectorAll('[data-select-item]').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      toggleSelection('inventory', e.target.dataset.selectItem);
    });
  });

  // Update checkbox states
  updateCheckboxStates('inventory');

  // Wire up sort handlers
  container.querySelectorAll('.sortable').forEach(header => {
    header.addEventListener('click', () => {
      handleSort('inventory', header.dataset.sort);
    });
  });

  // Wire up event listeners
  container.querySelectorAll('[data-action="edit-item"]').forEach(btn => {
    btn.addEventListener('click', () => handleEditItem(btn.dataset.id));
  });

  container.querySelectorAll('[data-action="delete-item"]').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteItem(btn.dataset.id));
  });
}

async function handleDeleteItem(id) {
  const item = appState.items.find(i => i.id === id);
  if (!item) return;

  if (!confirm(`Delete "${item.name}"?\n\nThis action cannot be undone.`)) {
    return;
  }

  try {
    await api.deleteItem(id);
    showToast('Item deleted');
    await loadInventory();
  } catch (error) {
    showToast(`Delete failed: ${error.message}`);
  }
}

// ============================================================================
// SALES
// ============================================================================

async function loadSales() {
  try {
    const response = await api.getSales();
    appState.sales = response.sales || [];
    renderSalesTable();
  } catch (error) {
    showToast('Error loading sales');
  }
}

function renderSalesTable() {
  const container = document.querySelector('#screen-sales .table');
  if (!container) return;

  const getSortIcon = (column) => {
    if (currentSort.screen === 'sales' && currentSort.column === column) {
      return currentSort.direction === 'asc' ? ' ▲' : ' ▼';
    }
    return '';
  };

  const html = `
    <div class="row header">
      <span class="sortable" data-sort="order_number">Order${getSortIcon('order_number')}</span>
      <span class="sortable" data-sort="platform">Platform${getSortIcon('platform')}</span>
      <span class="sortable" data-sort="profit">Profit${getSortIcon('profit')}</span>
      <span class="sortable" data-sort="sale_date">Date${getSortIcon('sale_date')}</span>
      <span></span>
    </div>
    ${appState.sales.map(sale => `
      <div class="row">
        <span>${escapeHtml(sale.order_number || 'N/A')}</span>
        <span>${escapeHtml(sale.platform)}</span>
        <span class="${sale.profit >= 0 ? 'positive' : 'negative'}">${formatCurrency(sale.profit)}</span>
        <span>${formatDate(sale.sale_date)}</span>
        <span>
          <button class="btn ghost small" data-action="edit-sale" data-id="${sale.id}">Edit</button>
          <button class="btn ghost small" data-action="delete-sale" data-id="${sale.id}">Delete</button>
        </span>
      </div>
    `).join('')}
  `;

  container.innerHTML = html;

  // Wire up sort handlers
  container.querySelectorAll('.sortable').forEach(header => {
    header.addEventListener('click', () => {
      handleSort('sales', header.dataset.sort);
    });
  });

  // Wire up event listeners
  container.querySelectorAll('[data-action="edit-sale"]').forEach(btn => {
    btn.addEventListener('click', () => handleEditSale(btn.dataset.id));
  });

  container.querySelectorAll('[data-action="delete-sale"]').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteSale(btn.dataset.id));
  });
}

async function handleEditSale(id) {
  const sale = appState.sales.find(s => s.id === id);
  if (!sale) return;

  openModal('Edit Sale', 'template-sale-form', sale, null); // Callback set in setupSaleFormHandlers
}

async function handleDeleteSale(id) {
  const sale = appState.sales.find(s => s.id === id);
  if (!sale) return;

  if (!confirm(`Delete sale "${sale.order_number || 'N/A'}"?\n\nThis action cannot be undone.`)) {
    return;
  }

  try {
    await api.deleteSale(id);
    showToast('Sale deleted');
    await loadSales();
  } catch (error) {
    showToast(`Delete failed: ${error.message}`);
  }
}

// ============================================================================
// EXPENSES
// ============================================================================

async function loadExpenses() {
  try {
    const response = await api.getExpenses();
    appState.expenses = response.expenses || [];
    renderExpensesTable();
  } catch (error) {
    showToast('Error loading expenses');
  }
}

function renderExpensesTable() {
  const container = document.querySelector('#screen-expenses .table');
  if (!container) return;

  const getSortIcon = (column) => {
    if (currentSort.screen === 'expenses' && currentSort.column === column) {
      return currentSort.direction === 'asc' ? ' ▲' : ' ▼';
    }
    return '';
  };

  const html = `
    <div class="row header">
      <span class="sortable" data-sort="name">Expense${getSortIcon('name')}</span>
      <span class="sortable" data-sort="category">Category${getSortIcon('category')}</span>
      <span class="sortable" data-sort="amount">Amount${getSortIcon('amount')}</span>
      <span class="sortable" data-sort="expense_date">Date${getSortIcon('expense_date')}</span>
      <span></span>
    </div>
    ${appState.expenses.map(expense => `
      <div class="row">
        <span>${escapeHtml(expense.name)}</span>
        <span>${escapeHtml(expense.category)}</span>
        <span>${formatCurrency(expense.amount)}</span>
        <span>${formatDate(expense.expense_date)}</span>
        <span>
          <button class="btn ghost small" data-action="edit-expense" data-id="${expense.id}">Edit</button>
          <button class="btn ghost small" data-action="delete-expense" data-id="${expense.id}">Delete</button>
        </span>
      </div>
    `).join('')}
  `;

  container.innerHTML = html;

  // Wire up sort handlers
  container.querySelectorAll('.sortable').forEach(header => {
    header.addEventListener('click', () => {
      handleSort('expenses', header.dataset.sort);
    });
  });

  // Wire up event listeners
  container.querySelectorAll('[data-action="edit-expense"]').forEach(btn => {
    btn.addEventListener('click', () => handleEditExpense(btn.dataset.id));
  });

  container.querySelectorAll('[data-action="delete-expense"]').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteExpense(btn.dataset.id));
  });
}

async function handleEditExpense(id) {
  const expense = appState.expenses.find(e => e.id === id);
  if (!expense) return;

  openModal('Edit Expense', 'template-expense-form', expense, async (data) => {
    await api.updateExpense(id, data);
    showToast('Expense updated');
    await loadExpenses();
  });
}

async function handleDeleteExpense(id) {
  const expense = appState.expenses.find(e => e.id === id);
  if (!expense) return;

  if (!confirm(`Delete expense "${expense.name}"?\n\nThis action cannot be undone.`)) {
    return;
  }

  try {
    await api.deleteExpense(id);
    showToast('Expense deleted');
    await loadExpenses();
  } catch (error) {
    showToast(`Delete failed: ${error.message}`);
  }
}

// ============================================================================
// LOTS
// ============================================================================

async function loadLots() {
  try {
    const response = await api.getLots();
    appState.lots = response.lots || [];
    renderLotsTable();
  } catch (error) {
    showToast('Error loading lots');
  }
}

function renderLotsTable() {
  const container = document.querySelector('#screen-lots .table');
  if (!container) return;

  const getSortIcon = (column) => {
    if (currentSort.screen === 'lots' && currentSort.column === column) {
      return currentSort.direction === 'asc' ? ' ▲' : ' ▼';
    }
    return '';
  };

  const html = `
    <div class="row header">
      <span class="sortable" data-sort="name">Lot${getSortIcon('name')}</span>
      <span>Items</span>
      <span class="sortable" data-sort="total_cost">Total Cost${getSortIcon('total_cost')}</span>
      <span></span>
    </div>
    ${appState.lots.map(lot => `
      <div class="row">
        <span>${escapeHtml(lot.name)}</span>
        <span>${lot.items?.length || 0} items</span>
        <span>${formatCurrency(lot.total_cost || 0)}</span>
        <span>
          <button class="btn ghost small" data-action="edit-lot" data-id="${lot.id}">Edit</button>
          <button class="btn ghost small" data-action="delete-lot" data-id="${lot.id}">Delete</button>
        </span>
      </div>
    `).join('')}
  `;

  container.innerHTML = html;

  // Wire up sort handlers
  container.querySelectorAll('.sortable').forEach(header => {
    header.addEventListener('click', () => {
      handleSort('lots', header.dataset.sort);
    });
  });

  // Wire up event listeners
  container.querySelectorAll('[data-action="edit-lot"]').forEach(btn => {
    btn.addEventListener('click', () => handleEditLot(btn.dataset.id));
  });

  container.querySelectorAll('[data-action="delete-lot"]').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteLot(btn.dataset.id));
  });
}

async function handleEditLot(id) {
  const lot = appState.lots.find(l => l.id === id);
  if (!lot) return;

  openModal('Edit Lot', 'template-lot-form', lot, null); // Callback set in setupLotFormHandlers
}

async function handleDeleteLot(id) {
  const lot = appState.lots.find(l => l.id === id);
  if (!lot) return;

  if (!confirm(`Delete lot "${lot.name}"?\n\nThis action cannot be undone.`)) {
    return;
  }

  try {
    await api.deleteLot(id);
    showToast('Lot deleted');
    await loadLots();
  } catch (error) {
    showToast(`Delete failed: ${error.message}`);
  }
}

// ============================================================================
// PRICING & SEO
// ============================================================================

async function loadPricing() {
  try {
    const response = await api.getPricingDrafts();
    appState.pricingDrafts = response.pricing_drafts || [];
    renderPricingTable();
  } catch (error) {
    showToast('Error loading pricing drafts');
  }
}

function renderPricingTable() {
  const container = document.querySelector('#screen-pricing .panel');
  if (!container) return;

  if (appState.pricingDrafts.length === 0) {
    container.innerHTML = '<p class="muted">No pricing drafts yet. Create one to get started!</p>';
    return;
  }

  const html = appState.pricingDrafts.map(draft => `
    <div class="card">
      <h4>${escapeHtml(draft.seo_title || 'Untitled Draft')}</h4>
      <p>Suggested Price: ${formatCurrency(draft.suggested_price)}</p>
      <p class="muted">Confidence: ${Math.round((draft.confidence_score || 0) * 100)}%</p>
      <div class="card-actions">
        <button class="btn small" data-action="apply-draft" data-id="${draft.id}">Apply & List</button>
        <button class="btn ghost small" data-action="edit-draft" data-id="${draft.id}">Edit</button>
        <button class="btn ghost small" data-action="delete-draft" data-id="${draft.id}">Delete</button>
      </div>
    </div>
  `).join('');

  container.innerHTML = html;

  // Wire up event listeners
  container.querySelectorAll('[data-action="apply-draft"]').forEach(btn => {
    btn.addEventListener('click', () => handleApplyDraft(btn.dataset.id));
  });

  container.querySelectorAll('[data-action="edit-draft"]').forEach(btn => {
    btn.addEventListener('click', () => handleEditDraft(btn.dataset.id));
  });

  container.querySelectorAll('[data-action="delete-draft"]').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteDraft(btn.dataset.id));
  });
}

async function handleApplyDraft(id) {
  const draft = appState.pricingDrafts.find(d => d.id === id);
  if (!draft) return;

  if (!confirm(`Apply this draft and mark item as Listed?\n\nThis will update the item with the pricing and SEO from this draft.`)) {
    return;
  }

  try {
    await api.applyPricingDraft(id);
    showToast('Draft applied! Item marked as Listed.');
    await loadPricing();
    await loadInventory(); // Refresh inventory to show updated status
  } catch (error) {
    showToast(`Apply failed: ${error.message}`);
  }
}

async function handleEditDraft(id) {
  const draft = appState.pricingDrafts.find(d => d.id === id);
  if (!draft) return;

  openModal('Edit Pricing Draft', 'template-pricing-form', draft, async (data) => {
    await api.updatePricingDraft(id, data);
    showToast('Pricing draft updated');
    await loadPricing();
  });
}

async function handleDeleteDraft(id) {
  const draft = appState.pricingDrafts.find(d => d.id === id);
  if (!draft) return;

  if (!confirm(`Delete pricing draft?\n\nThis action cannot be undone.`)) {
    return;
  }

  try {
    await api.deletePricingDraft(id);
    showToast('Pricing draft deleted');
    await loadPricing();
  } catch (error) {
    showToast(`Delete failed: ${error.message}`);
  }
}

// ============================================================================
// REPORTS
// ============================================================================

async function loadReports() {
  try {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    const taxSummary = await api.getTaxSummary(startOfYear, today);

    // Update tax jar
    document.querySelector('#screen-reports .value').textContent = formatCurrency(taxSummary.federal_tax_estimate);
  } catch (error) {
    showToast('Error loading reports');
  }
}

// ============================================================================
// SETTINGS
// ============================================================================

async function loadSettings() {
  try {
    const response = await api.getSettings();
    appState.settings = response.settings || {};

    // Store settings in localStorage for applyThemeClasses
    localStorage.setItem('settings', JSON.stringify(appState.settings));

    // Update theme selector
    const theme = appState.settings.theme || 'light';
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
      themeSelect.value = theme;
    }

    // Update color theme selector
    const colorTheme = appState.settings.color_theme || 'peach';
    const colorThemeSelect = document.getElementById('color-theme-select');
    if (colorThemeSelect) {
      colorThemeSelect.value = colorTheme;
    }

    // Apply theme classes
    applyThemeClasses();
  } catch (error) {
    showToast('Error loading settings');
  }
}

async function updateTheme(value) {
  try {
    await api.updateSetting('theme', value);
    // Update localStorage
    const settings = JSON.parse(localStorage.getItem('settings') || '{}');
    settings.theme = value;
    localStorage.setItem('settings', JSON.stringify(settings));
    applyThemeClasses();
    showToast('Theme updated');
  } catch (error) {
    showToast('Error updating theme');
  }
}

async function updateColorTheme(value) {
  try {
    await api.updateSetting('color_theme', value);
    // Update localStorage
    const settings = JSON.parse(localStorage.getItem('settings') || '{}');
    settings.color_theme = value;
    localStorage.setItem('settings', JSON.stringify(settings));
    applyThemeClasses();
    showToast('Color theme updated');
  } catch (error) {
    showToast('Error updating color theme');
  }
}

/**
 * Apply theme and color theme classes to body
 */
function applyThemeClasses() {
  const settings = JSON.parse(localStorage.getItem('settings') || '{}');
  const theme = settings.theme || 'light';
  const colorTheme = settings.color_theme || 'peach';

  // Set theme class (light/dark)
  document.body.className = `theme-${theme}`;

  // Set color theme data attribute (blue/purple/teal/green/pink)
  if (colorTheme !== 'peach') {
    document.body.setAttribute('data-color-theme', colorTheme);
  } else {
    document.body.removeAttribute('data-color-theme');
  }
}

// ============================================================================
// BACKUP & RESTORE
// ============================================================================

async function downloadBackup() {
  try {
    await api.downloadBackup();
    showToast('Backup downloaded successfully');
  } catch (error) {
    showToast(`Backup failed: ${error.message}`);
  }
}

async function restoreBackup() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm('This will OVERWRITE all existing data. Are you sure?')) return;

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      await api.restoreBackup(backup);
      showToast('Backup restored successfully! Reloading...');

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      showToast(`Restore failed: ${error.message}`);
    }
  };

  input.click();
}

// ============================================================================
// MODAL SYSTEM
// ============================================================================

let currentModalData = null;
let currentModalSaveCallback = null;

function openModal(title, templateId, data = null, onSave) {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');

  // Set title
  modalTitle.textContent = title;

  // Load template
  const template = document.getElementById(templateId);
  if (!template) {
    console.error(`Template ${templateId} not found`);
    return;
  }

  const clone = template.content.cloneNode(true);
  modalBody.innerHTML = '';
  modalBody.appendChild(clone);

  // Store data and callback
  currentModalData = data;
  currentModalSaveCallback = onSave;

  // Populate form if editing
  if (data) {
    populateForm(modalBody.querySelector('form'), data);
  }

  // Setup form-specific handlers
  setupFormHandlers(templateId, modalBody);

  // Show modal
  overlay.classList.add('active');
  modal.classList.add('active');
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('modal');

  overlay.classList.remove('active');
  modal.classList.remove('active');

  currentModalData = null;
  currentModalSaveCallback = null;
}

function populateForm(form, data) {
  if (!form || !data) return;

  Object.keys(data).forEach(key => {
    const input = form.querySelector(`[name="${key}"]`);
    if (input) {
      if (input.type === 'checkbox') {
        input.checked = data[key];
      } else if (input.type === 'radio') {
        const radio = form.querySelector(`[name="${key}"][value="${data[key]}"]`);
        if (radio) radio.checked = true;
      } else {
        input.value = data[key] || '';
      }
    }
  });
}

function getFormData(form) {
  const formData = new FormData(form);
  const data = {};

  for (const [key, value] of formData.entries()) {
    // Skip empty values
    if (value === '') {
      data[key] = null;
    } else {
      data[key] = value;
    }
  }

  return data;
}

async function handleModalSave() {
  const modalBody = document.getElementById('modal-body');
  const form = modalBody.querySelector('form');

  if (!form) return;

  // Validate form
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const data = getFormData(form);

  try {
    if (currentModalSaveCallback) {
      await currentModalSaveCallback(data);
    }
    closeModal();
  } catch (error) {
    showToast(`Save failed: ${error.message}`);
  }
}

// ============================================================================
// FORM HANDLERS
// ============================================================================

function setupFormHandlers(templateId, container) {
  switch (templateId) {
    case 'template-item-form':
      setupItemFormHandlers(container);
      break;
    case 'template-sale-form':
      setupSaleFormHandlers(container);
      break;
    case 'template-expense-form':
      setupExpenseFormHandlers(container);
      break;
    case 'template-lot-form':
      setupLotFormHandlers(container);
      break;
    case 'template-pricing-form':
      setupPricingFormHandlers(container);
      break;
  }
}

// Item Form Handlers
function setupItemFormHandlers(container) {
  // SKU validation (real-time)
  const skuInput = container.querySelector('[name="sku"]');
  const skuHint = container.querySelector('#sku-hint');

  if (skuInput) {
    skuInput.addEventListener('blur', async () => {
      const sku = skuInput.value.trim();
      if (!sku) {
        skuHint.textContent = '';
        return;
      }

      try {
        const result = await api.validateSKU(sku, currentModalData?.id);
        if (result.exists) {
          skuHint.textContent = '⚠️ SKU already exists';
          skuHint.classList.add('warning');
        } else {
          skuHint.textContent = '✓ Available';
          skuHint.classList.remove('warning');
        }
      } catch (error) {
        skuHint.textContent = '';
      }
    });
  }

  // AI: Enhance description
  const enhanceBtn = container.querySelector('#enhance-description-btn');
  const descInput = container.querySelector('[name="description"]');

  if (enhanceBtn && descInput) {
    enhanceBtn.addEventListener('click', async () => {
      const description = descInput.value.trim();
      if (!description) {
        showToast('Enter a description first');
        return;
      }

      enhanceBtn.disabled = true;
      enhanceBtn.textContent = '✨ Enhancing...';

      try {
        const result = await api.enhanceDescription(description);
        descInput.value = result.enhanced;
        showToast('Description enhanced with AI');
      } catch (error) {
        showToast(`AI enhancement failed: ${error.message}`);
      } finally {
        enhanceBtn.disabled = false;
        enhanceBtn.textContent = '✨ Enhance with AI';
      }
    });
  }

  // AI: Analyze photo
  const photoUpload = container.querySelector('#photo-upload');
  const analyzeBtn = container.querySelector('#analyze-photo-btn');
  const photoPreview = container.querySelector('#photo-preview');
  const categorySelect = container.querySelector('#item-category');
  const aiCategorySuggestion = container.querySelector('#ai-category-suggestion');
  const aiCategoryValue = container.querySelector('#ai-category-value');
  const applyCategoryBtn = container.querySelector('#apply-ai-category');

  if (photoUpload) {
    photoUpload.addEventListener('change', () => {
      if (photoUpload.files.length > 0) {
        analyzeBtn.disabled = false;

        // Show preview
        photoPreview.innerHTML = '';
        Array.from(photoUpload.files).forEach(file => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'photo-preview-item';
            photoPreview.appendChild(img);
          };
          reader.readAsDataURL(file);
        });
      }
    });
  }

  if (analyzeBtn && photoUpload) {
    analyzeBtn.addEventListener('click', async () => {
      const file = photoUpload.files[0];
      if (!file) return;

      analyzeBtn.disabled = true;
      analyzeBtn.textContent = '✨ Analyzing...';

      try {
        const formData = new FormData();
        formData.append('photo', file);

        const result = await api.uploadFile('/api/ai/analyze-photo', formData);

        // Show AI category suggestion
        aiCategoryValue.textContent = `${result.suggestedCategory} (${Math.round(result.confidence * 100)}% confidence)`;
        aiCategorySuggestion.style.display = 'block';

        // Apply category button
        applyCategoryBtn.onclick = () => {
          categorySelect.value = result.suggestedCategory;
          aiCategorySuggestion.style.display = 'none';
        };

        showToast('Photo analyzed with AI');
      } catch (error) {
        showToast(`Photo analysis failed: ${error.message}`);
      } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = '✨ Analyze Photo with AI';
      }
    });
  }
}

// Sale Form Handlers
function setupSaleFormHandlers(container) {
  const itemsPicker = container.querySelector('#sale-items-picker');
  const addItemBtn = container.querySelector('#add-sale-item');

  // Item picker
  let selectedItems = currentModalData?.items || [];

  function renderItemPicker() {
    if (!itemsPicker) return;

    itemsPicker.innerHTML = selectedItems.map((item, idx) => `
      <div class="picker-item">
        <select data-idx="${idx}">
          ${appState.items.map(i => `
            <option value="${i.id}" ${i.id === item.item_id ? 'selected' : ''}>${i.name}</option>
          `).join('')}
        </select>
        <input type="number" data-idx="${idx}" value="${item.quantity || 1}" min="1" placeholder="Qty" />
        <button type="button" class="btn ghost tiny" data-idx="${idx}">Remove</button>
      </div>
    `).join('');

    // Update handlers
    itemsPicker.querySelectorAll('select').forEach(select => {
      select.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        selectedItems[idx].item_id = e.target.value;
        updateSaleCalculations();
      });
    });

    itemsPicker.querySelectorAll('input[type="number"]').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        selectedItems[idx].quantity = parseInt(e.target.value) || 1;
        updateSaleCalculations();
      });
    });

    itemsPicker.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        selectedItems.splice(idx, 1);
        renderItemPicker();
        updateSaleCalculations();
      });
    });
  }

  if (addItemBtn) {
    addItemBtn.addEventListener('click', () => {
      selectedItems.push({ item_id: appState.items[0]?.id || '', quantity: 1 });
      renderItemPicker();
    });
  }

  // Auto-calculations
  const grossInput = container.querySelector('[name="gross_amount"]');
  const feesInput = container.querySelector('[name="platform_fees"]');
  const promoInput = container.querySelector('[name="promotion_discount"]');
  const shippingInput = container.querySelector('[name="shipping_cost"]');

  function updateSaleCalculations() {
    const gross = parseFloat(grossInput?.value || 0);
    const fees = parseFloat(feesInput?.value || 0);
    const promo = parseFloat(promoInput?.value || 0);
    const shipping = parseFloat(shippingInput?.value || 0);

    // Calculate COGS from selected items
    let cogs = 0;
    selectedItems.forEach(item => {
      const itemData = appState.items.find(i => i.id === item.item_id);
      if (itemData) {
        cogs += (itemData.cost || 0) * (item.quantity || 1);
      }
    });

    const profit = gross - fees - promo - shipping - cogs;
    const taxRate = 0.22; // Default 22% federal tax
    const tax = Math.max(0, profit * taxRate);

    container.querySelector('#calc-profit').textContent = formatCurrency(profit);
    container.querySelector('#calc-tax').textContent = formatCurrency(tax);
  }

  [grossInput, feesInput, promoInput, shippingInput].forEach(input => {
    if (input) {
      input.addEventListener('input', updateSaleCalculations);
    }
  });

  renderItemPicker();
  updateSaleCalculations();

  // Store selected items for save
  currentModalSaveCallback = async (data) => {
    data.items = selectedItems;
    if (currentModalData?.id) {
      await api.updateSale(currentModalData.id, data);
      showToast('Sale updated');
    } else {
      await api.createSale(data);
      showToast('Sale created');
    }
    await loadSales();
  };
}

// Expense Form Handlers
function setupExpenseFormHandlers(container) {
  const categorySelect = container.querySelector('#expense-category');
  const vehicleSection = container.querySelector('#vehicle-deduction-section');
  const splitInventory = container.querySelector('[name="split_inventory"]');
  const splitOperations = container.querySelector('[name="split_operations"]');
  const splitOther = container.querySelector('[name="split_other"]');
  const splitTotal = container.querySelector('#split-total');
  const suggestSplitBtn = container.querySelector('#suggest-split-btn');

  // Show/hide vehicle deduction
  if (categorySelect && vehicleSection) {
    categorySelect.addEventListener('change', () => {
      vehicleSection.style.display = categorySelect.value === 'Vehicle' ? 'block' : 'none';
    });

    // Trigger on load
    if (categorySelect.value === 'Vehicle') {
      vehicleSection.style.display = 'block';
    }
  }

  // Update split total
  function updateSplitTotal() {
    const inv = parseInt(splitInventory?.value || 0);
    const ops = parseInt(splitOperations?.value || 0);
    const oth = parseInt(splitOther?.value || 0);
    const total = inv + ops + oth;

    if (splitTotal) {
      splitTotal.textContent = total;
      splitTotal.parentElement.classList.toggle('warning', total !== 100);
    }
  }

  [splitInventory, splitOperations, splitOther].forEach(input => {
    if (input) {
      input.addEventListener('input', updateSplitTotal);
    }
  });

  updateSplitTotal();

  // AI: Suggest split
  if (suggestSplitBtn) {
    suggestSplitBtn.addEventListener('click', async () => {
      const name = container.querySelector('[name="name"]')?.value;
      const category = categorySelect?.value;
      const amount = parseFloat(container.querySelector('[name="amount"]')?.value || 0);

      if (!name || !category) {
        showToast('Enter name and category first');
        return;
      }

      suggestSplitBtn.disabled = true;
      suggestSplitBtn.textContent = '✨ Calculating...';

      try {
        const result = await api.suggestExpenseSplit({ name, category, amount });

        splitInventory.value = result.inventory;
        splitOperations.value = result.operations;
        splitOther.value = result.other;

        updateSplitTotal();
        showToast(`AI suggested split (${Math.round(result.confidence * 100)}% confidence)`);
      } catch (error) {
        showToast(`AI split suggestion failed: ${error.message}`);
      } finally {
        suggestSplitBtn.disabled = false;
        suggestSplitBtn.textContent = '✨ AI Suggest Split';
      }
    });
  }

  // Vehicle deduction mutual exclusivity
  const mileageInput = container.querySelector('[name="vehicle_mileage"]');
  const actualInput = container.querySelector('[name="vehicle_actual"]');

  if (mileageInput && actualInput) {
    mileageInput.addEventListener('input', () => {
      if (mileageInput.value) {
        actualInput.disabled = true;
        actualInput.value = '';
      } else {
        actualInput.disabled = false;
      }
    });

    actualInput.addEventListener('input', () => {
      if (actualInput.value) {
        mileageInput.disabled = true;
        mileageInput.value = '';
      } else {
        mileageInput.disabled = false;
      }
    });
  }
}

// Lot Form Handlers
function setupLotFormHandlers(container) {
  const itemsPicker = container.querySelector('#lot-items-picker');
  let selectedItems = currentModalData?.items || [];

  function renderItemPicker() {
    if (!itemsPicker) return;

    itemsPicker.innerHTML = `
      <div class="checkbox-list">
        ${appState.items.map(item => `
          <label>
            <input type="checkbox" value="${item.id}" ${selectedItems.includes(item.id) ? 'checked' : ''} />
            ${escapeHtml(item.name)} (${formatCurrency(item.cost || 0)})
          </label>
        `).join('')}
      </div>
    `;

    itemsPicker.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          selectedItems.push(e.target.value);
        } else {
          selectedItems = selectedItems.filter(id => id !== e.target.value);
        }
        updateLotCost();
      });
    });
  }

  function updateLotCost() {
    let totalCost = 0;
    selectedItems.forEach(itemId => {
      const item = appState.items.find(i => i.id === itemId);
      if (item) {
        totalCost += item.cost || 0;
      }
    });

    const costEl = container.querySelector('#lot-total-cost');
    if (costEl) {
      costEl.textContent = formatCurrency(totalCost);
    }
  }

  renderItemPicker();
  updateLotCost();

  // Store selected items for save
  currentModalSaveCallback = async (data) => {
    data.items = selectedItems;
    if (currentModalData?.id) {
      await api.updateLot(currentModalData.id, data);
      showToast('Lot updated');
    } else {
      await api.createLot(data);
      showToast('Lot created');
    }
    await loadLots();
  };
}

// Pricing Draft Form Handlers
function setupPricingFormHandlers(container) {
  const priceTypeRadios = container.querySelectorAll('[name="price_type"]');
  const itemSelectRow = container.querySelector('#item-select-row');
  const lotSelectRow = container.querySelector('#lot-select-row');
  const itemSelect = container.querySelector('#pricing-item-select');
  const lotSelect = container.querySelector('#pricing-lot-select');

  // Populate selects
  if (itemSelect) {
    itemSelect.innerHTML = '<option value="">-- Select Item --</option>' +
      appState.items.map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('');
  }

  if (lotSelect) {
    lotSelect.innerHTML = '<option value="">-- Select Lot --</option>' +
      appState.lots.map(lot => `<option value="${lot.id}">${escapeHtml(lot.name)}</option>`).join('');
  }

  // Toggle item/lot select
  priceTypeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'item') {
        itemSelectRow.style.display = 'block';
        lotSelectRow.style.display = 'none';
        lotSelect.value = '';
      } else {
        itemSelectRow.style.display = 'none';
        lotSelectRow.style.display = 'block';
        itemSelect.value = '';
      }
    });
  });

  // AI: Suggest price
  const suggestPriceBtn = container.querySelector('#suggest-price-btn');
  const aiPriceSuggestion = container.querySelector('#ai-price-suggestion');
  const applyPriceBtn = container.querySelector('#apply-ai-price');
  const priceInput = container.querySelector('[name="suggested_price"]');

  if (suggestPriceBtn) {
    suggestPriceBtn.addEventListener('click', async () => {
      const itemId = itemSelect?.value;
      const lotId = lotSelect?.value;

      if (!itemId && !lotId) {
        showToast('Select an item or lot first');
        return;
      }

      suggestPriceBtn.disabled = true;
      suggestPriceBtn.textContent = '✨ Calculating...';

      try {
        const result = await api.suggestPrice(itemId, lotId);

        container.querySelector('#ai-price-min').textContent = result.min.toFixed(2);
        container.querySelector('#ai-price-max').textContent = result.max.toFixed(2);
        container.querySelector('#ai-price-suggested').textContent = result.suggested.toFixed(2);
        container.querySelector('#ai-price-reasoning').textContent = result.reasoning;

        aiPriceSuggestion.style.display = 'block';

        applyPriceBtn.onclick = () => {
          priceInput.value = result.suggested.toFixed(2);
          aiPriceSuggestion.style.display = 'none';
        };

        showToast(`AI price suggested (${Math.round(result.confidence * 100)}% confidence)`);
      } catch (error) {
        showToast(`AI price suggestion failed: ${error.message}`);
      } finally {
        suggestPriceBtn.disabled = false;
        suggestPriceBtn.textContent = '✨ AI Suggest Price';
      }
    });
  }

  // AI: Generate SEO
  const generateSeoBtn = container.querySelector('#generate-seo-btn');
  const aiSeoResult = container.querySelector('#ai-seo-result');
  const applySeoBtn = container.querySelector('#apply-ai-seo');
  const titleInput = container.querySelector('[name="seo_title"]');
  const descInput = container.querySelector('[name="seo_description"]');
  const titleCharCount = container.querySelector('#title-char-count');

  // Title character count
  if (titleInput && titleCharCount) {
    titleInput.addEventListener('input', () => {
      titleCharCount.textContent = titleInput.value.length;
    });
  }

  if (generateSeoBtn) {
    generateSeoBtn.addEventListener('click', async () => {
      const itemId = itemSelect?.value;
      const lotId = lotSelect?.value;

      if (!itemId && !lotId) {
        showToast('Select an item or lot first');
        return;
      }

      generateSeoBtn.disabled = true;
      generateSeoBtn.textContent = '✨ Generating...';

      try {
        const result = await api.generateSEO(itemId, lotId);

        container.querySelector('#ai-seo-title').textContent = result.title;
        container.querySelector('#ai-seo-description').textContent = result.description;
        container.querySelector('#ai-seo-keywords').textContent = result.keywords.join(', ');

        const confidencePct = Math.round(result.confidence * 100);
        container.querySelector('#ai-seo-confidence').style.width = `${confidencePct}%`;
        container.querySelector('#ai-seo-confidence-text').textContent = `${confidencePct}%`;

        aiSeoResult.style.display = 'block';

        applySeoBtn.onclick = () => {
          titleInput.value = result.title;
          descInput.value = result.description;
          titleCharCount.textContent = result.title.length;
          aiSeoResult.style.display = 'none';
        };

        showToast('SEO generated with AI');
      } catch (error) {
        showToast(`SEO generation failed: ${error.message}`);
      } finally {
        generateSeoBtn.disabled = false;
        generateSeoBtn.textContent = '✨ Generate SEO with AI';
      }
    });
  }
}

// ============================================================================
// BATCH ACTIONS & MULTI-SELECT
// ============================================================================

let selectedItems = new Set();

function toggleSelection(screen, id) {
  const key = `${screen}:${id}`;
  if (selectedItems.has(key)) {
    selectedItems.delete(key);
  } else {
    selectedItems.add(key);
  }
  updateBatchActionsBar(screen);
  updateCheckboxStates(screen);
}

function toggleSelectAll(screen) {
  let data = [];
  switch (screen) {
    case 'inventory': data = appState.items; break;
    case 'sales': data = appState.sales; break;
    case 'expenses': data = appState.expenses; break;
    case 'lots': data = appState.lots; break;
  }

  const allSelected = data.every(item => selectedItems.has(`${screen}:${item.id}`));

  if (allSelected) {
    // Deselect all
    data.forEach(item => selectedItems.delete(`${screen}:${item.id}`));
  } else {
    // Select all
    data.forEach(item => selectedItems.add(`${screen}:${item.id}`));
  }

  updateBatchActionsBar(screen);
  updateCheckboxStates(screen);
}

function updateCheckboxStates(screen) {
  // Update individual checkboxes
  document.querySelectorAll(`[data-select-item]`).forEach(checkbox => {
    const id = checkbox.dataset.selectItem;
    checkbox.checked = selectedItems.has(`${screen}:${id}`);
  });

  // Update select-all checkbox
  const selectAllCheckbox = document.getElementById('select-all');
  if (selectAllCheckbox) {
    let data = [];
    switch (screen) {
      case 'inventory': data = appState.items; break;
      case 'sales': data = appState.sales; break;
      case 'expenses': data = appState.expenses; break;
      case 'lots': data = appState.lots; break;
    }
    const allSelected = data.length > 0 && data.every(item => selectedItems.has(`${screen}:${item.id}`));
    selectAllCheckbox.checked = allSelected;
  }
}

function updateBatchActionsBar(screen) {
  const bar = document.getElementById('batch-actions-bar');
  if (!bar) return;

  const screenSelected = Array.from(selectedItems).filter(key => key.startsWith(`${screen}:`));

  if (screenSelected.length > 0) {
    bar.classList.add('active');
    document.getElementById('batch-count').textContent = `${screenSelected.length} selected`;
  } else {
    bar.classList.remove('active');
  }
}

function clearSelection(screen) {
  const keysToDelete = Array.from(selectedItems).filter(key => key.startsWith(`${screen}:`));
  keysToDelete.forEach(key => selectedItems.delete(key));
  updateBatchActionsBar(screen);
  updateCheckboxStates(screen);
}

async function batchDelete(screen) {
  const screenSelected = Array.from(selectedItems).filter(key => key.startsWith(`${screen}:`));
  const ids = screenSelected.map(key => key.split(':')[1]);

  if (!confirm(`Delete ${ids.length} items?\n\nThis action cannot be undone.`)) {
    return;
  }

  let deleteFunc;
  switch (screen) {
    case 'inventory': deleteFunc = api.deleteItem; break;
    case 'sales': deleteFunc = api.deleteSale; break;
    case 'expenses': deleteFunc = api.deleteExpense; break;
    case 'lots': deleteFunc = api.deleteLot; break;
  }

  try {
    for (const id of ids) {
      await deleteFunc(id);
    }
    showToast(`${ids.length} items deleted`);
    clearSelection(screen);

    // Reload data
    switch (screen) {
      case 'inventory': await loadInventory(); break;
      case 'sales': await loadSales(); break;
      case 'expenses': await loadExpenses(); break;
      case 'lots': await loadLots(); break;
    }
  } catch (error) {
    showToast(`Batch delete failed: ${error.message}`);
  }
}

async function batchUpdateStatus(screen, newStatus) {
  const screenSelected = Array.from(selectedItems).filter(key => key.startsWith(`${screen}:`));
  const ids = screenSelected.map(key => key.split(':')[1]);

  try {
    for (const id of ids) {
      await api.updateItem(id, { status: newStatus });
    }
    showToast(`${ids.length} items updated to ${newStatus}`);
    clearSelection(screen);
    await loadInventory();
  } catch (error) {
    showToast(`Batch update failed: ${error.message}`);
  }
}

async function batchUpdateCategory(screen) {
  const screenSelected = Array.from(selectedItems).filter(key => key.startsWith(`${screen}:`));
  const ids = screenSelected.map(key => key.split(':')[1]);

  const category = prompt('Enter new category:');
  if (!category) return;

  try {
    for (const id of ids) {
      if (screen === 'inventory') {
        await api.updateItem(id, { category });
      } else if (screen === 'expenses') {
        await api.updateExpense(id, { category });
      }
    }
    showToast(`${ids.length} items updated`);
    clearSelection(screen);

    if (screen === 'inventory') {
      await loadInventory();
    } else if (screen === 'expenses') {
      await loadExpenses();
    }
  } catch (error) {
    showToast(`Batch update failed: ${error.message}`);
  }
}

async function batchExport(screen) {
  const screenSelected = Array.from(selectedItems).filter(key => key.startsWith(`${screen}:`));
  const ids = screenSelected.map(key => key.split(':')[1]);

  let data = [];
  switch (screen) {
    case 'inventory':
      data = appState.items.filter(item => ids.includes(item.id));
      break;
    case 'sales':
      data = appState.sales.filter(sale => ids.includes(sale.id));
      break;
    case 'expenses':
      data = appState.expenses.filter(expense => ids.includes(expense.id));
      break;
    case 'lots':
      data = appState.lots.filter(lot => ids.includes(lot.id));
      break;
  }

  const csv = convertToCSV(data);
  downloadCSV(csv, `${screen}-selected-${new Date().toISOString().split('T')[0]}.csv`);
  showToast(`${ids.length} items exported`);
}

function convertToCSV(data) {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const rows = data.map(item =>
    headers.map(header => {
      const value = item[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================================
// SORTABLE TABLES
// ============================================================================

let currentSort = {
  screen: null,
  column: null,
  direction: 'asc'
};

function sortData(data, column, direction = 'asc') {
  return [...data].sort((a, b) => {
    let aVal = a[column];
    let bVal = b[column];

    // Handle null/undefined
    if (aVal == null) return direction === 'asc' ? 1 : -1;
    if (bVal == null) return direction === 'asc' ? -1 : 1;

    // Convert to comparable values
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (direction === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
  });
}

function handleSort(screen, column) {
  // Toggle direction if clicking same column
  if (currentSort.screen === screen && currentSort.column === column) {
    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort.screen = screen;
    currentSort.column = column;
    currentSort.direction = 'asc';
  }

  // Sort the appropriate data
  switch (screen) {
    case 'inventory':
      appState.items = sortData(appState.items, column, currentSort.direction);
      renderInventoryTable();
      break;
    case 'sales':
      appState.sales = sortData(appState.sales, column, currentSort.direction);
      renderSalesTable();
      break;
    case 'expenses':
      appState.expenses = sortData(appState.expenses, column, currentSort.direction);
      renderExpensesTable();
      break;
    case 'lots':
      appState.lots = sortData(appState.lots, column, currentSort.direction);
      renderLotsTable();
      break;
  }
}

// ============================================================================
// KEYBOARD SHORTCUTS HELP
// ============================================================================

function showKeyboardShortcuts() {
  const shortcuts = [
    { keys: 'Ctrl/Cmd + N', description: 'New entry (context-aware)' },
    { keys: 'Ctrl/Cmd + S', description: 'Save form (when modal is open)' },
    { keys: 'Ctrl/Cmd + B', description: 'Backup/Export data' },
    { keys: 'Esc', description: 'Close modal or clear search' },
    { keys: '/', description: 'Focus global search' },
    { keys: '?', description: 'Show keyboard shortcuts (this dialog)' },
    { keys: '1-8', description: 'Switch screens (1=Dashboard, 2=Inventory, etc.)' }
  ];

  const html = `
    <div class="shortcuts-help">
      <h3>Keyboard Shortcuts</h3>
      <table class="shortcuts-table">
        ${shortcuts.map(s => `
          <tr>
            <td class="shortcut-key">${s.keys}</td>
            <td>${s.description}</td>
          </tr>
        `).join('')}
      </table>
      <p class="muted" style="margin-top: 16px;">Press <kbd>Esc</kbd> to close</p>
    </div>
  `;

  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  document.getElementById('modal-title').textContent = 'Keyboard Shortcuts';
  modalBody.innerHTML = html;
  modalFooter.style.display = 'none';

  overlay.classList.add('active');
  modal.classList.add('active');

  // Close footer visibility when modal closes
  const originalClose = closeModal;
  window.closeModal = function() {
    modalFooter.style.display = 'flex';
    originalClose();
    window.closeModal = originalClose;
  };
}

// ============================================================================
// SCREEN-SPECIFIC ACTIONS
// ============================================================================

async function handleAddItem() {
  openModal('Add Item', 'template-item-form', null, async (data) => {
    await api.createItem(data);
    showToast('Item created');
    await loadInventory();
  });
}

async function handleEditItem(id) {
  const item = appState.items.find(i => i.id === id);
  if (!item) return;

  openModal('Edit Item', 'template-item-form', item, async (data) => {
    await api.updateItem(id, data);
    showToast('Item updated');
    await loadInventory();
  });
}

async function handleAddSale() {
  openModal('Log Sale', 'template-sale-form', null, null); // Callback set in setupSaleFormHandlers
}

async function handleAddExpense() {
  openModal('Add Expense', 'template-expense-form', null, async (data) => {
    await api.createExpense(data);
    showToast('Expense created');
    await loadExpenses();
  });
}

async function handleAddLot() {
  openModal('New Lot', 'template-lot-form', null, null); // Callback set in setupLotFormHandlers
}

async function handleAddPricingDraft() {
  openModal('New Pricing Draft', 'template-pricing-form', null, async (data) => {
    await api.createPricingDraft(data);
    showToast('Pricing draft created');
    await loadPricing();
  });
}

/**
 * Handle ChatGPT CSV import
 */
async function handleChatGPTImport() {
  openModal('Import from ChatGPT', 'template-chatgpt-import', null, async () => {
    const fileInput = document.getElementById('chatgpt-csv-file');
    const file = fileInput?.files[0];

    if (!file) {
      showToast('Please select a CSV file');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/import/chatgpt-items', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Import failed');
      }

      const result = await response.json();

      if (result.imported > 0) {
        showToast(`✓ Imported ${result.imported} items successfully`);
        await loadInventory();
        closeModal();
      }

      if (result.errors > 0) {
        console.warn('Import errors:', result.errorDetails);
        showToast(`⚠ ${result.errors} rows had errors (check console)`, 5000);
      }
    } catch (error) {
      console.error('ChatGPT import failed:', error);
      showToast(`✗ Import failed: ${error.message}`);
    }
  });
}

/**
 * Import active eBay listings to local inventory
 */
async function handleImportEbayListings() {
  // Pre-flight connection check
  try {
    const statusResponse = await fetch('/api/ebay/status');
    if (statusResponse.ok) {
      const status = await statusResponse.json();
      if (!status.connected) {
        showToast('⚠️ eBay not connected. Please connect to eBay in Settings first.');
        return;
      }
    }
  } catch (error) {
    console.error('Failed to check eBay status:', error);
  }

  const confirmed = confirm('Import active eBay listings? This will fetch all inventory items from your eBay account.');

  if (!confirmed) {
    return;
  }

  showToast('Importing listings from eBay...', 10000);

  try {
    const response = await fetch('/api/ebay/import-listings', {
      method: 'POST'
    });

    if (!response.ok) {
      let errorMessage = 'Import failed';

      try {
        const error = await response.json();
        errorMessage = error.error || error.message || errorMessage;

        // Log full error to console for debugging
        console.error('eBay import error:', error);
      } catch (parseError) {
        // Response wasn't JSON - try text
        try {
          const text = await response.text();
          errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
      }

      throw new Error(errorMessage);
    }

    const result = await response.json();

    if (result.imported > 0) {
      showToast(`✓ Imported ${result.imported} listings (${result.duplicates} already existed)`);
      await loadInventory();
    } else if (result.duplicates > 0) {
      showToast(`All ${result.duplicates} listings already imported`);
    } else {
      showToast('No new listings found');
    }

    if (result.errors > 0) {
      console.warn('Import errors:', result.errorDetails);
      showToast(`⚠ ${result.errors} items had errors (check console)`, 5000);
    }
  } catch (error) {
    console.error('eBay listing import failed:', error);
    showToast(`✗ Import failed: ${error.message}`);
  }
}

/**
 * Import eBay sales for a date range
 */
async function handleImportEbaySales() {
  // Pre-flight connection check
  try {
    const statusResponse = await fetch('/api/ebay/status');
    if (statusResponse.ok) {
      const status = await statusResponse.json();
      if (!status.connected) {
        showToast('⚠️ eBay not connected. Please connect to eBay in Settings first.');
        return;
      }
    }
  } catch (error) {
    console.error('Failed to check eBay status:', error);
  }

  // Create simple modal for date range selection
  const modalContent = `
    <div class="panel">
      <h4>Import eBay Sales</h4>
      <p class="muted">Import orders from eBay and auto-match to your items</p>

      <div class="form-row">
        <label>Start Date</label>
        <input type="date" id="import-sales-start" value="${getDefaultStartDate()}" />
      </div>

      <div class="form-row">
        <label>End Date</label>
        <input type="date" id="import-sales-end" value="${getDefaultEndDate()}" />
      </div>

      <details>
        <summary>How it works</summary>
        <p>Sales are automatically matched to items via eBay listing ID. Unmatched sales will still be imported for manual review.</p>
      </details>
    </div>
  `;

  const modal = document.getElementById('modal');
  const modalTitle = modal.querySelector('h3');
  const modalBody = modal.querySelector('.modal-body');
  const saveBtn = modal.querySelector('#modal-save');

  modalTitle.textContent = 'Import eBay Sales';
  modalBody.innerHTML = modalContent;
  modal.style.display = 'flex';

  saveBtn.onclick = async () => {
    const startDate = document.getElementById('import-sales-start')?.value;
    const endDate = document.getElementById('import-sales-end')?.value;

    if (!startDate || !endDate) {
      showToast('Please select both start and end dates');
      return;
    }

    closeModal();
    showToast('Importing sales from eBay...', 10000);

    try {
      const response = await fetch('/api/ebay/import-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRange: {
            start: new Date(startDate).toISOString(),
            end: new Date(endDate).toISOString()
          }
        })
      });

      if (!response.ok) {
        let errorMessage = 'Import failed';

        try {
          const error = await response.json();
          errorMessage = error.error || error.message || errorMessage;

          // Log full error to console for debugging
          console.error('eBay import error:', error);
        } catch (parseError) {
          // Response wasn't JSON - try text
          try {
            const text = await response.text();
            errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
          } catch (e) {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (result.imported > 0) {
        showToast(`✓ Imported ${result.imported} sales (${result.matched} matched, ${result.orphaned} unmatched)`);
        await loadSales();
      } else {
        showToast('No sales found in date range');
      }

      if (result.errors > 0) {
        console.warn('Import errors:', result.errorDetails);
        showToast(`⚠ ${result.errors} orders had errors (check console)`, 5000);
      }
    } catch (error) {
      console.error('eBay sales import failed:', error);
      showToast(`✗ Import failed: ${error.message}`);
    }
  };
}

/**
 * Check eBay connection health and warn user if token is expiring or expired
 */
async function checkEbayConnectionHealth() {
  try {
    const response = await fetch('/api/ebay/debug-status');
    if (!response.ok) return;

    const status = await response.json();

    // Show warning if token expires soon (less than 60 minutes)
    if (status.connected && status.tokenValid && status.timeUntilExpiry < 60 && status.timeUntilExpiry > 0) {
      const minutes = Math.round(status.timeUntilExpiry);
      showToast(`⚠️ eBay connection expires in ${minutes} minute${minutes !== 1 ? 's' : ''}. Please reconnect soon in Settings.`, 8000);
    }

    // Show error if token expired
    if (status.connected && !status.tokenValid) {
      showToast('❌ eBay connection expired. Please reconnect in Settings to import data.', 10000);
    }

  } catch (error) {
    // Don't show errors to user - this is a background health check
    console.error('Failed to check eBay connection health:', error);
  }
}

/**
 * Get default start date (30 days ago)
 */
function getDefaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().split('T')[0];
}

/**
 * Get default end date (today)
 */
function getDefaultEndDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Handle creating eBay draft listing from an item
 */
async function handleCreateEbayDraft(itemId) {
  const item = appState.items.find(i => i.id === itemId);
  if (!item) {
    showToast('Item not found');
    return;
  }

  // Pre-fill form data with item information
  const formData = {
    itemId: item.id,
    sku: item.sku || `SKU-${Date.now()}`, // Generate SKU if missing
    title: item.name || '',
    price: item.suggested_price || item.cost * 2 || 0, // 2x markup default
    quantity: 1,
    condition: 'USED_GOOD', // Default condition
    description: item.description || item.name || ''
  };

  openModal('Create eBay Draft Listing', 'template-ebay-draft', formData, async (data) => {
    // Validate
    if (!data.title || !data.price || !data.condition || !data.quantity) {
      showToast('Please fill all required fields');
      return;
    }

    const button = document.querySelector('#modal-save');
    if (button) {
      button.disabled = true;
      button.textContent = 'Creating draft...';
    }

    try {
      const response = await fetch('/api/ebay/create-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: data.itemId,
          sku: data.sku,
          title: data.title,
          price: parseFloat(data.price),
          quantity: parseInt(data.quantity),
          condition: data.condition,
          description: data.description
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create draft');
      }

      const result = await response.json();

      closeModal();
      showToast('✓ eBay draft created! Opening eBay drafts page...');

      // Reload inventory to show updated status
      await loadInventory();

      // Open eBay drafts page in new tab
      if (result.draftUrl) {
        window.open(result.draftUrl, '_blank');
      }
    } catch (error) {
      console.error('eBay draft creation failed:', error);
      showToast(`✗ ${error.message}`);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Save';
      }
    }
  });

  // Set up character counter for title
  const titleInput = document.getElementById('ebay-title');
  const charCount = document.getElementById('ebay-title-char-count');
  if (titleInput && charCount) {
    const updateCount = () => {
      charCount.textContent = titleInput.value.length;
    };
    titleInput.addEventListener('input', updateCount);
    updateCount(); // Initial count
  }
}

// ============================================================================
// QUICK ACTIONS (FAB SHORTCUTS)
// ============================================================================

/**
 * Quick Add Item - Minimal prompts for fast item entry
 */
async function handleQuickAddItem() {
  const name = prompt('Item name:');
  if (!name) return;

  const cost = prompt('Cost (optional):');

  try {
    await api.request('POST', '/api/items', {
      name,
      cost: cost ? parseFloat(cost) : 0,
      category: 'Unsorted',
      status: 'Unlisted',
      lifecycle_stage: 'Captured'
    });

    showToast(`✓ Added "${name}"`);
    if (appState.currentScreen === 'inventory') {
      await loadInventory();
    }
  } catch (error) {
    showToast(`✗ Failed to add item: ${error.message}`);
  }
}

/**
 * Quick Sale - Show recent items for quick sale entry
 */
async function handleQuickSale() {
  // Get last 10 unlisted/listed items
  const recentItems = appState.items
    .filter(i => ['Unlisted', 'Listed', 'Draft'].includes(i.status))
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 10);

  if (recentItems.length === 0) {
    showToast('No items available for quick sale');
    return;
  }

  // Create simple selection modal
  const modalContent = `
    <div class="panel">
      <h4>Quick Sale</h4>
      <p class="muted">Select item and enter sale price</p>

      <div class="form-row">
        <label>Item</label>
        <select id="quick-sale-item" required>
          ${recentItems.map(item =>
            `<option value="${item.id}">${item.name} (${item.category || 'No category'})</option>`
          ).join('')}
        </select>
      </div>

      <div class="form-row">
        <label>Sale Price</label>
        <input type="number" id="quick-sale-price" step="0.01" required />
      </div>

      <div class="form-row">
        <label>Platform (optional)</label>
        <input type="text" id="quick-sale-platform" placeholder="e.g., eBay, Mercari" />
      </div>
    </div>
  `;

  const modal = document.getElementById('modal');
  const modalTitle = modal.querySelector('h3');
  const modalBody = modal.querySelector('.modal-body');
  const saveBtn = modal.querySelector('#modal-save');

  modalTitle.textContent = 'Quick Sale';
  modalBody.innerHTML = modalContent;
  modal.style.display = 'flex';

  saveBtn.onclick = async () => {
    const itemId = parseInt(document.getElementById('quick-sale-item')?.value);
    const price = parseFloat(document.getElementById('quick-sale-price')?.value);
    const platform = document.getElementById('quick-sale-platform')?.value || 'Direct';

    if (!itemId || !price) {
      showToast('Please fill in all required fields');
      return;
    }

    const item = appState.items.find(i => i.id === itemId);
    if (!item) {
      showToast('Item not found');
      return;
    }

    try {
      // Create sale
      const saleData = {
        order_number: `QUICK-${Date.now()}`,
        sale_date: new Date().toISOString(),
        platform,
        gross_amount: price,
        platform_fees: 0,
        shipping_cost: 0,
        net_amount: price,
        profit: item.cost ? price - item.cost : 0
      };

      const saleResult = await api.request('POST', '/api/sales', saleData);
      const saleId = saleResult.id;

      // Link to item
      await api.request('POST', '/api/sales/link-item', {
        saleId,
        itemId
      });

      // Update item status
      await api.request('PUT', `/api/items/${itemId}`, {
        ...item,
        status: 'Sold',
        lifecycle_stage: 'Sold'
      });

      closeModal();
      showToast(`✓ Sold "${item.name}" for $${price.toFixed(2)}`);

      if (appState.currentScreen === 'sales') {
        await loadSales();
      } else if (appState.currentScreen === 'inventory') {
        await loadInventory();
      }
    } catch (error) {
      showToast(`✗ Failed to record sale: ${error.message}`);
    }
  };
}

// ============================================================================
// EBAY OAUTH INTEGRATION
// ============================================================================

/**
 * Check eBay connection status
 */
async function checkEbayStatus() {
  try {
    const response = await api.request('GET', '/api/ebay/status');
    if (response.ok) {
      const data = await response.json();
      updateEbayStatus(data.connected);
    }
  } catch (error) {
    console.error('Failed to check eBay status:', error);
  }
}

/**
 * Update eBay UI based on connection status
 * @param {boolean} connected - Whether eBay is connected
 */
function updateEbayStatus(connected) {
  const ebayBtn = document.getElementById('ebay-connect-btn');
  const ebayStatusText = document.getElementById('ebay-status-text');

  if (ebayBtn) {
    if (connected) {
      ebayBtn.textContent = 'Disconnect';
      ebayBtn.classList.remove('secondary');
      ebayBtn.classList.add('danger');
    } else {
      ebayBtn.textContent = 'Connect';
      ebayBtn.classList.remove('danger');
      ebayBtn.classList.add('secondary');
    }
  }

  if (ebayStatusText) {
    if (connected) {
      ebayStatusText.textContent = '✓ Connected to eBay';
      ebayStatusText.style.color = 'var(--success, #22c55e)';
    } else {
      ebayStatusText.textContent = 'Not connected';
      ebayStatusText.style.color = 'var(--text-secondary)';
    }
  }
}

// ============================================================================
// EBAY VALUATION FUNCTIONS
// ============================================================================

/**
 * Load eBay Valuation screen
 */
async function loadEbayValuation() {
  // Check AI quota for photo valuations
  try {
    const usageResponse = await fetch('/api/ai/usage');
    if (usageResponse.ok) {
      const usage = await usageResponse.json();
      const dailyUsage = usage.today || 0;
      const quotaRemaining = 10000 - dailyUsage;
      // Each photo valuation uses 800 neurons
      const photoValuationsRemaining = Math.floor(quotaRemaining / 800);
      const remainingEl = document.getElementById('photo-valuations-remaining');
      if (remainingEl) {
        remainingEl.textContent = Math.max(0, photoValuationsRemaining);
      }
    }
  } catch (error) {
    console.error('Failed to check AI quota:', error);
  }
}

/**
 * Handle text-based valuation
 */
async function handleTextValuation() {
  const itemName = document.getElementById('valuation-item-name')?.value?.trim();

  if (!itemName) {
    showToast('Please enter an item name');
    return;
  }

  const button = document.getElementById('get-text-valuation-btn');
  if (button) {
    button.disabled = true;
    button.textContent = '🔍 Searching eBay...';
  }

  try {
    const response = await fetch('/api/ebay/valuation/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemName })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Valuation failed');
    }

    const valuation = await response.json();
    renderValuationResults(valuation, false);
  } catch (error) {
    console.error('Text valuation failed:', error);
    showToast(`✗ ${error.message}`);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = '🔍 Get Valuation';
    }
  }
}

/**
 * Handle photo-based valuation
 */
async function handlePhotoValuation() {
  const fileInput = document.getElementById('valuation-photo');
  const file = fileInput?.files?.[0];

  if (!file) {
    showToast('Please select a photo');
    return;
  }

  const button = document.getElementById('get-photo-valuation-btn');
  if (button) {
    button.disabled = true;
    button.textContent = '✨ Analyzing photo...';
  }

  const formData = new FormData();
  formData.append('photo', file);

  try {
    const response = await fetch('/api/ebay/valuation/photo', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Photo valuation failed');
    }

    const valuation = await response.json();
    renderValuationResults(valuation, true);

    // Update quota display
    await loadEbayValuation();
  } catch (error) {
    console.error('Photo valuation failed:', error);
    showToast(`✗ ${error.message}`);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = '✨ Analyze & Value';
    }
  }
}

/**
 * Render valuation results
 */
function renderValuationResults(valuation, isPhotoValuation) {
  // Show results container
  const resultsEl = document.getElementById('valuation-results');
  if (resultsEl) {
    resultsEl.style.display = 'block';
  }

  // Show detected item for photo valuations
  const detectedItemEl = document.getElementById('photo-detected-item');
  const detectedItemNameEl = document.getElementById('detected-item-name');
  if (isPhotoValuation && detectedItemEl && detectedItemNameEl) {
    detectedItemEl.style.display = 'block';
    detectedItemNameEl.textContent = valuation.detectedItem || 'Unknown';
  } else if (detectedItemEl) {
    detectedItemEl.style.display = 'none';
  }

  // Update KPIs
  const suggestedPriceEl = document.getElementById('valuation-suggested-price');
  if (suggestedPriceEl) {
    suggestedPriceEl.textContent = `$${valuation.suggestedPrice.toFixed(2)}`;
  }

  const priceRangeEl = document.getElementById('valuation-price-range');
  if (priceRangeEl) {
    priceRangeEl.textContent = `$${valuation.priceRange.min.toFixed(2)} - $${valuation.priceRange.max.toFixed(2)}`;
  }

  const soldCountEl = document.getElementById('valuation-sold-count');
  if (soldCountEl) {
    soldCountEl.textContent = valuation.marketData.soldCount;
  }

  // Update confidence bar
  const confidencePercent = Math.round(valuation.confidence * 100);
  const confidenceBarEl = document.getElementById('valuation-confidence-bar');
  if (confidenceBarEl) {
    confidenceBarEl.style.width = `${confidencePercent}%`;
  }

  const confidenceTextEl = document.getElementById('valuation-confidence-text');
  if (confidenceTextEl) {
    confidenceTextEl.textContent = `${confidencePercent}%`;
  }

  // Render sample listings
  const sampleListingsCountEl = document.getElementById('sample-listings-count');
  if (sampleListingsCountEl) {
    sampleListingsCountEl.textContent = valuation.marketData.listings?.length || 0;
  }

  const sampleListingsEl = document.getElementById('sample-listings');
  if (sampleListingsEl && valuation.marketData.listings) {
    sampleListingsEl.innerHTML = valuation.marketData.listings
      .map(listing => `
        <div style="padding: 8px; border-bottom: 1px solid var(--border); font-size: 14px;">
          <p><strong>${escapeHtml(listing.title)}</strong></p>
          <p class="muted">Price: $${listing.price.toFixed(2)} | Condition: ${escapeHtml(listing.condition)}</p>
        </div>
      `)
      .join('');
  }

  // Scroll to results
  if (resultsEl) {
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/**
 * Clear valuation results
 */
function clearValuationResults() {
  const resultsEl = document.getElementById('valuation-results');
  if (resultsEl) {
    resultsEl.style.display = 'none';
  }

  // Clear inputs
  const itemNameEl = document.getElementById('valuation-item-name');
  if (itemNameEl) {
    itemNameEl.value = '';
  }

  const photoEl = document.getElementById('valuation-photo');
  if (photoEl) {
    photoEl.value = '';
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initOfflineBanner();
  updateOfflineBanner();

  // Check eBay connection health on page load
  checkEbayConnectionHealth();

  window.addEventListener('online', () => {
    showToast('Back online. Syncing queued updates.');
    replayQueuedMutations();
  });

  window.addEventListener('offline', () => {
    showToast('You are offline. Updates will be queued.');
    updateOfflineBanner();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register(`/sw.js?v=${SERVICE_WORKER_VERSION}`)
      .catch((error) => console.warn('Service worker registration failed:', error));
  }

  // Setup navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      switchScreen(link.dataset.screen);
    });
  });

  // Setup modal close handlers
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-cancel')?.addEventListener('click', closeModal);
  document.getElementById('modal-save')?.addEventListener('click', handleModalSave);

  // Click outside modal to close
  document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') {
      closeModal();
    }
  });

  // Global keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // ESC: Close modal or clear search
    if (e.key === 'Escape') {
      const modal = document.getElementById('modal-overlay');
      if (modal && modal.classList.contains('active')) {
        closeModal();
      } else {
        const searchInput = document.getElementById('global-search');
        if (searchInput && searchInput.value) {
          searchInput.value = '';
          searchInput.blur();
        }
      }
      return;
    }

    // Ignore shortcuts when typing in inputs (except for special cases)
    const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

    // /: Focus global search (works even in inputs)
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      if (!isInputFocused) {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      }
      return;
    }

    // ?: Show keyboard shortcuts help
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !isInputFocused) {
      e.preventDefault();
      showKeyboardShortcuts();
      return;
    }

    // Don't process other shortcuts if typing
    if (isInputFocused) {
      // Allow Ctrl/Cmd + S in modal forms
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        const modal = document.getElementById('modal-overlay');
        if (modal && modal.classList.contains('active')) {
          e.preventDefault();
          handleModalSave();
        }
      }
      return;
    }

    // Ctrl/Cmd + N: New entry (context-aware)
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      const newEntryBtn = document.getElementById('new-entry');
      if (newEntryBtn) {
        newEntryBtn.click();
      }
      return;
    }

    // Ctrl/Cmd + B: Backup/Export
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      downloadBackup();
      return;
    }

    // Number keys 1-8: Switch screens
    if (e.key >= '1' && e.key <= '8' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const screens = ['dashboard', 'inventory', 'sales', 'expenses', 'lots', 'pricing', 'reports', 'settings'];
      const screenIndex = parseInt(e.key) - 1;
      if (screens[screenIndex]) {
        switchScreen(screens[screenIndex]);
      }
      return;
    }
  });

  // Setup action buttons
  const newEntryBtn = document.getElementById('new-entry');
  if (newEntryBtn) {
    newEntryBtn.addEventListener('click', () => {
      // Context-aware new entry based on current screen
      switch (appState.currentScreen) {
        case 'inventory':
          handleAddItem();
          break;
        case 'sales':
          handleAddSale();
          break;
        case 'expenses':
          handleAddExpense();
          break;
        case 'lots':
          handleAddLot();
          break;
        case 'pricing':
          handleAddPricingDraft();
          break;
        default:
          handleAddItem(); // Default to adding item
      }
    });
  }

  const exportCsvBtn = document.getElementById('export-csv');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', downloadBackup);
  }

  // Screen-specific action buttons
  document.getElementById('add-item')?.addEventListener('click', handleAddItem);
  document.getElementById('add-sale')?.addEventListener('click', handleAddSale);
  document.getElementById('add-expense')?.addEventListener('click', handleAddExpense);
  document.getElementById('add-lot')?.addEventListener('click', handleAddLot);
  document.getElementById('add-draft')?.addEventListener('click', handleAddPricingDraft);
  document.getElementById('import-chatgpt-btn')?.addEventListener('click', handleChatGPTImport);
  document.getElementById('import-ebay-listings-btn')?.addEventListener('click', handleImportEbayListings);
  document.getElementById('import-ebay-sales-btn')?.addEventListener('click', handleImportEbaySales);

  // eBay Valuation buttons
  document.getElementById('get-text-valuation-btn')?.addEventListener('click', handleTextValuation);
  document.getElementById('get-photo-valuation-btn')?.addEventListener('click', handlePhotoValuation);
  document.getElementById('clear-valuation-btn')?.addEventListener('click', clearValuationResults);

  // eBay Valuation method toggle
  document.querySelectorAll('input[name="valuation-method"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const textInput = document.getElementById('text-valuation-input');
      const photoInput = document.getElementById('photo-valuation-input');
      if (e.target.value === 'text') {
        if (textInput) textInput.style.display = 'block';
        if (photoInput) photoInput.style.display = 'none';
      } else {
        if (textInput) textInput.style.display = 'none';
        if (photoInput) photoInput.style.display = 'block';
      }
    });
  });

  // Batch actions buttons
  document.getElementById('batch-clear')?.addEventListener('click', () => {
    clearSelection(appState.currentScreen);
  });

  document.getElementById('batch-export')?.addEventListener('click', () => {
    batchExport(appState.currentScreen);
  });

  document.getElementById('batch-category')?.addEventListener('click', () => {
    batchUpdateCategory(appState.currentScreen);
  });

  document.getElementById('batch-status')?.addEventListener('click', () => {
    const status = prompt('Enter new status (Unlisted, Draft, Listed, Sold):');
    if (status && ['Unlisted', 'Draft', 'Listed', 'Sold'].includes(status)) {
      batchUpdateStatus(appState.currentScreen, status);
    } else if (status) {
      showToast('Invalid status. Must be: Unlisted, Draft, Listed, or Sold');
    }
  });

  document.getElementById('batch-delete')?.addEventListener('click', () => {
    batchDelete(appState.currentScreen);
  });

  // Setup settings
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => updateTheme(e.target.value));
  }

  const colorThemeSelect = document.getElementById('color-theme-select');
  if (colorThemeSelect) {
    colorThemeSelect.addEventListener('change', (e) => updateColorTheme(e.target.value));
  }

  // Apply theme classes on load
  applyThemeClasses();

  // eBay OAuth integration
  const ebayConnectBtn = document.getElementById('ebay-connect-btn');
  if (ebayConnectBtn) {
    // Check eBay connection status on load
    checkEbayStatus();

    ebayConnectBtn.addEventListener('click', async () => {
      const isConnected = ebayConnectBtn.textContent.trim() === 'Disconnect';

      if (isConnected) {
        // Disconnect eBay
        if (confirm('Are you sure you want to disconnect eBay?')) {
          try {
            await api.request('DELETE', '/api/ebay/disconnect');
            showToast('eBay disconnected successfully');
            updateEbayStatus(false);
          } catch (error) {
            showToast('Failed to disconnect eBay');
            console.error('eBay disconnect error:', error);
          }
        }
      } else {
        // Redirect to eBay OAuth
        window.location.href = '/api/ebay/auth';
      }
    });
  }

  // FAB (Floating Action Button) handlers
  const fabBtn = document.getElementById('fab-btn');
  const fabMenu = document.getElementById('fab-menu');

  if (fabBtn && fabMenu) {
    // Toggle FAB menu
    fabBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = fabMenu.classList.contains('open');

      if (isOpen) {
        fabMenu.classList.remove('open');
        fabMenu.style.display = 'none';
      } else {
        fabMenu.style.display = 'flex';
        // Small delay for animation
        setTimeout(() => fabMenu.classList.add('open'), 10);
      }
    });

    // Close FAB menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!fabBtn.contains(e.target) && !fabMenu.contains(e.target)) {
        fabMenu.classList.remove('open');
        setTimeout(() => {
          if (!fabMenu.classList.contains('open')) {
            fabMenu.style.display = 'none';
          }
        }, 300);
      }
    });

    // Handle FAB option clicks
    document.querySelectorAll('.fab-option').forEach(option => {
      option.addEventListener('click', async (e) => {
        const action = e.currentTarget.dataset.action;

        // Close FAB menu
        fabMenu.classList.remove('open');
        setTimeout(() => fabMenu.style.display = 'none', 300);

        // Execute action
        switch (action) {
          case 'quick-add-item':
            handleQuickAddItem();
            break;
          case 'quick-sale':
            handleQuickSale();
            break;
          case 'quick-expense':
            handleAddExpense();
            break;
          case 'ebay-check':
            loadScreen('ebay-valuation');
            break;
          case 'bulk-actions':
            showToast('Select items in inventory to use bulk actions');
            loadScreen('inventory');
            break;
        }
      });
    });
  }

  // Check for eBay OAuth callback status
  const urlParams = new URLSearchParams(window.location.search);
  const ebayStatus = urlParams.get('status');
  if (ebayStatus === 'ebay_connected') {
    showToast('eBay connected successfully!');
    updateEbayStatus(true);
    // Remove status param from URL
    window.history.replaceState({}, '', window.location.pathname + window.location.hash);
  } else if (ebayStatus === 'ebay_error') {
    showToast('Failed to connect eBay. Please try again.');
    // Remove status param from URL
    window.history.replaceState({}, '', window.location.pathname + window.location.hash);
  }

  // Clipboard auto-detection for ChatGPT imports
  let clipboardBanner = null;
  let lastClipboardCheck = '';

  async function checkClipboard() {
    try {
      // Check if clipboard API is available
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        return;
      }

      const text = await navigator.clipboard.readText();

      // Ignore if clipboard hasn't changed
      if (text === lastClipboardCheck || text.length < 20) {
        return;
      }

      lastClipboardCheck = text;

      // Detect CSV format (ChatGPT import pattern)
      const hasCSVHeaders = /name.*description.*category|name.*cost.*bin/i.test(text);
      const hasCSVRows = text.split('\n').length > 2;

      if (hasCSVHeaders && hasCSVRows) {
        showClipboardBanner('ChatGPT CSV detected - Import items?', () => {
          // Create a CSV file from clipboard text
          const blob = new Blob([text], { type: 'text/csv' });
          const file = new File([blob], 'clipboard-import.csv', { type: 'text/csv' });

          // Trigger import
          const formData = new FormData();
          formData.append('file', file);

          fetch('/api/import/chatgpt-items', {
            method: 'POST',
            body: formData
          })
          .then(res => res.json())
          .then(result => {
            if (result.imported > 0) {
              showToast(`✓ Imported ${result.imported} items from clipboard`);
              loadInventory();
            }
          })
          .catch(err => {
            showToast(`✗ Import failed: ${err.message}`);
          });
        });
      }
    } catch (error) {
      // Silently fail - clipboard access may be denied
      console.log('Clipboard check skipped:', error.message);
    }
  }

  function showClipboardBanner(message, onAccept) {
    // Remove existing banner
    if (clipboardBanner) {
      clipboardBanner.remove();
    }

    // Create banner
    clipboardBanner = document.createElement('div');
    clipboardBanner.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--bg-card);
      color: var(--text-primary);
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 9999;
      display: flex;
      gap: 16px;
      align-items: center;
      animation: slideUp 0.3s ease;
    `;

    clipboardBanner.innerHTML = `
      <span>📋 ${message}</span>
      <button class="btn small" id="clipboard-accept">Import</button>
      <button class="btn ghost small" id="clipboard-dismiss">Dismiss</button>
    `;

    document.body.appendChild(clipboardBanner);

    // Accept button
    document.getElementById('clipboard-accept').onclick = () => {
      clipboardBanner.remove();
      clipboardBanner = null;
      onAccept();
    };

    // Dismiss button
    document.getElementById('clipboard-dismiss').onclick = () => {
      clipboardBanner.remove();
      clipboardBanner = null;
    };

    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (clipboardBanner) {
        clipboardBanner.remove();
        clipboardBanner = null;
      }
    }, 10000);
  }

  // Check clipboard on window focus
  window.addEventListener('focus', checkClipboard);

  // Load initial screen
  loadScreen('dashboard');

  console.log('Reseller Ops initialized');
});
