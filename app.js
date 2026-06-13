// State Model and LocalStorage Initialization
// Phase 3: We default to an empty state so the user is greeted by the clean Welcome Screen on first launch.
let state = {
    accounts: [], // Empty by default to trigger welcome screen
    activeAccountId: "",
    transactions: [],
    taskPresets: [
        { id: "pre-1", name: "Code Review", amount: 1500.00 },
        { id: "pre-2", name: "UI Design Module", amount: 8000.00 },
        { id: "pre-3", name: "Database Optimization", amount: 4000.00 },
        { id: "pre-4", name: "Article Writing", amount: 2000.00 }
    ],
    wishlist: [
        { id: "wish-seed-1", name: "4K Designer Monitor", cost: 24500.00 },
        { id: "wish-seed-2", name: "Mechanical Keyboard", cost: 8500.00 }
    ],
    tasksGrid: [
        { id: "grid-row-1", description: "Homepage Layout Coding", rate: 5000.00, date: getPastDateOffsetDays(0), completed: true },
        { id: "grid-row-2", description: "API Integration Tasks", rate: 3500.00, date: getPastDateOffsetDays(0), completed: false }
    ]
};

// Memory Session Tracker for Unlocked Password Accounts
let unlockedAccounts = {};

// Tracking variables for switches and auth
let pendingSwitchAccountId = null;
let previousSelectedAccountId = "";
let pendingWishlistItemId = null;

// Global chart variables
let barChart = null;
let lineChart = null;
let pieChart = null;
let chartFilterMode = 'all';

// Helper to seed dates
function getPastDateOffsetDays(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 16); // Formats as YYYY-MM-DDTHH:MM
}

// Format Helper: Rupee Currency Formatting
function formatCurrency(amount) {
    return '₹' + parseFloat(amount).toLocaleString('en-IN', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
}

// Format Helper: Pretty DateTime
function formatPrettyDateTime(dateTimeStr) {
    const d = new Date(dateTimeStr);
    if (isNaN(d.getTime())) return dateTimeStr;
    return d.toLocaleDateString('en-IN', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
    }) + ' @ ' + d.toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

// Format Helper: Date only
function formatPrettyDate(dateTimeStr) {
    const d = new Date(dateTimeStr);
    if (isNaN(d.getTime())) return dateTimeStr;
    return d.toLocaleDateString('en-IN', { 
        day: 'numeric',
        month: 'short', 
        year: 'numeric' 
    });
}

// LocalStorage Persistence
function loadState() {
    const savedState = localStorage.getItem('visualsier_state_p3');
    if (savedState) {
        try {
            const parsed = JSON.parse(savedState);
            if (parsed.accounts) state.accounts = parsed.accounts;
            if (parsed.activeAccountId) state.activeAccountId = parsed.activeAccountId;
            if (parsed.transactions) state.transactions = parsed.transactions;
            if (parsed.taskPresets) state.taskPresets = parsed.taskPresets;
            if (parsed.wishlist) state.wishlist = parsed.wishlist;
            if (parsed.tasksGrid) state.tasksGrid = parsed.tasksGrid;
            
            previousSelectedAccountId = state.activeAccountId;
            if (state.activeAccountId) {
                unlockedAccounts[state.activeAccountId] = true;
            }
        } catch (e) {
            console.error("Failed to parse stored state, using empty defaults.", e);
        }
    }
}

function saveState() {
    localStorage.setItem('visualsier_state_p3', JSON.stringify(state));
}

// --- Dynamic Calculations ---

function getAccountBalance(accountId) {
    const account = state.accounts.find(a => a.id === accountId);
    if (!account) return 0;
    
    let balance = parseFloat(account.initialBalance) || 0;
    state.transactions.forEach(tx => {
        if (tx.accountId === accountId) {
            const txAmt = parseFloat(tx.amount) || 0;
            if (tx.type === 'earning') {
                balance += txAmt;
            } else if (tx.type === 'expense') {
                balance -= txAmt;
            }
        }
    });
    return balance;
}

function getNetWorth() {
    return state.accounts.reduce((sum, acc) => sum + getAccountBalance(acc.id), 0);
}

function getTotalEarnings(filterActiveOnly = false) {
    return state.transactions
        .filter(tx => !filterActiveOnly || tx.accountId === state.activeAccountId)
        .filter(tx => tx.type === 'earning')
        .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
}

function getTotalExpenses(filterActiveOnly = false) {
    return state.transactions
        .filter(tx => !filterActiveOnly || tx.accountId === state.activeAccountId)
        .filter(tx => tx.type === 'expense')
        .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
}

// Compute daily income breakdown (sum per calendar day)
function getDailyIncomeBreakdown() {
    const activeTxs = state.transactions
        .filter(tx => tx.accountId === state.activeAccountId && tx.type === 'earning');
    
    const dailyMap = {};
    activeTxs.forEach(tx => {
        const dateKey = tx.date.split('T')[0]; // Gets YYYY-MM-DD
        if (!dailyMap[dateKey]) {
            dailyMap[dateKey] = { total: 0, count: 0 };
        }
        dailyMap[dateKey].total += parseFloat(tx.amount) || 0;
        dailyMap[dateKey].count += 1;
    });

    // Sort days descending
    const sortedDays = Object.keys(dailyMap).sort((a, b) => new Date(b) - new Date(a));
    
    return sortedDays.slice(0, 5).map(day => ({
        date: day,
        total: dailyMap[day].total,
        count: dailyMap[day].count
    }));
}

// --- Welcome Screen Routing & Initialization ---
function checkWelcomeScreenStatus() {
    const welcomeScreen = document.getElementById('welcome-screen');
    const mainAppContainer = document.getElementById('main-app-container');

    if (!state.accounts || state.accounts.length === 0) {
        // No accounts -> show welcome landing card
        welcomeScreen.style.display = 'flex';
        mainAppContainer.style.display = 'none';
    } else {
        // Accounts exist -> load main dashboard
        welcomeScreen.style.display = 'none';
        mainAppContainer.style.display = 'grid';
        
        // Ensure an active account is selected
        if (!state.activeAccountId) {
            state.activeAccountId = state.accounts[0].id;
        }
        previousSelectedAccountId = state.activeAccountId;
        unlockedAccounts[state.activeAccountId] = true;

        renderDashboard();
    }
}

// Handle Welcome Screen Account Creation Submit
document.getElementById('welcome-create-account-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('welcome-account-name').value.trim();
    const initialBalance = parseFloat(document.getElementById('welcome-account-initial').value) || 0;
    const password = document.getElementById('welcome-account-password').value;
    const confirmPass = document.getElementById('welcome-account-confirm').value;

    if (password !== confirmPass) {
        showToast("Error: Passwords do not match!", "error");
        return;
    }

    const newId = `acc-${Date.now()}`;
    // Save account with compulsory password
    state.accounts.push({ id: newId, name, initialBalance, password });
    
    // Auto unlock for welcome screen flow
    unlockedAccounts[newId] = true;
    state.activeAccountId = newId;
    previousSelectedAccountId = newId;

    saveState();
    showToast(`Welcome Account "${name}" created successfully!`, 'success');
    
    // Reroute layout
    checkWelcomeScreenStatus();
});

// --- UI Navigation ---
function switchTab(tabId) {
    document.querySelectorAll('.nav-menu .nav-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    document.querySelectorAll('.tab-pane').forEach(pane => {
        if (pane.id === `tab-${tabId}`) {
            pane.classList.add('active');
        } else {
            pane.classList.remove('active');
        }
    });

    if (tabId === 'history') {
        renderHistory();
    } else if (tabId === 'tasks') {
        renderTasksTab();
    } else if (tabId === 'wishlist') {
        renderWishlist();
    } else if (tabId === 'dashboard') {
        renderDashboard();
    }
}

// --- Modals Management ---
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
        const dateInput = modal.querySelector('input[type="datetime-local"]');
        if (dateInput) {
            setDefaultDateTime(dateInput);
        }
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
    }
}

function setDefaultDateTime(inputElement) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    inputElement.value = `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Toast Notifications
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-triangle';
    if (type === 'info') iconName = 'info';
    
    toast.innerHTML = `
        <i data-lucide="${iconName}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    lucide.createIcons();
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 4000);
}

// --- Account Password Security Management ---

// Account switching handler
document.getElementById('active-account-select').addEventListener('change', (e) => {
    const selectAccountId = e.target.value;
    handleAccountSelectUnlock(selectAccountId);
});

function handleAccountSelectUnlock(targetAccountId) {
    const account = state.accounts.find(a => a.id === targetAccountId);
    if (!account) return;

    if (account.password && !unlockedAccounts[targetAccountId]) {
        pendingSwitchAccountId = targetAccountId;
        document.getElementById('login-account-title').textContent = `Unlock "${account.name}"`;
        document.getElementById('login-password').value = '';
        document.getElementById('login-error-msg').style.display = 'none';
        
        document.getElementById('account-login-overlay').classList.add('show');
    } else {
        state.activeAccountId = targetAccountId;
        previousSelectedAccountId = targetAccountId;
        saveState();
        refreshCurrentTab();
    }
}

// Unlock overlay form submit
document.getElementById('login-account-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const passwordInput = document.getElementById('login-password').value;
    const account = state.accounts.find(a => a.id === pendingSwitchAccountId);

    if (account && account.password === passwordInput) {
        unlockedAccounts[pendingSwitchAccountId] = true;
        state.activeAccountId = pendingSwitchAccountId;
        previousSelectedAccountId = pendingSwitchAccountId;
        
        saveState();
        
        document.getElementById('account-login-overlay').classList.remove('show');
        refreshCurrentTab();
        showToast(`Account "${account.name}" unlocked!`, 'success');
    } else {
        document.getElementById('login-error-msg').style.display = 'block';
        showToast("Access Denied: Incorrect Password", "error");
    }
});

document.getElementById('login-cancel-btn').addEventListener('click', () => {
    document.getElementById('account-login-overlay').classList.remove('show');
    document.getElementById('active-account-select').value = previousSelectedAccountId;
});

function refreshCurrentTab() {
    renderAccountSelectors();
    renderDashboard();
    
    const activeBtn = document.querySelector('.nav-menu .nav-btn.active');
    if (activeBtn) {
        const tab = activeBtn.getAttribute('data-tab');
        if (tab === 'wishlist') renderWishlist();
        if (tab === 'tasks') renderTasksTab();
        if (tab === 'history') renderHistory();
    }
}

// --- Dynamic Rendering: Account Selectors ---
function renderAccountSelectors() {
    const select = document.getElementById('active-account-select');
    select.innerHTML = '';
    
    state.accounts.forEach(acc => {
        const balance = getAccountBalance(acc.id);
        const opt = document.createElement('option');
        opt.value = acc.id;
        opt.textContent = `${acc.name} (${formatCurrency(balance)})`;
        if (acc.id === state.activeAccountId) {
            opt.selected = true;
        }
        select.appendChild(opt);
    });

    const activeAcc = state.accounts.find(a => a.id === state.activeAccountId);
    const activeBalance = getAccountBalance(state.activeAccountId);
    
    const activeLabel = document.getElementById('stat-active-name');
    if (activeLabel) activeLabel.textContent = activeAcc ? activeAcc.name : 'Unknown Account';
    
    const activeBalanceVal = document.getElementById('stat-active-balance');
    if (activeBalanceVal) activeBalanceVal.textContent = formatCurrency(activeBalance);

    const netWorthVal = document.getElementById('net-worth-amount');
    if (netWorthVal) netWorthVal.textContent = formatCurrency(getNetWorth());

    const wishlistRef = document.getElementById('wishlist-active-balance-ref');
    if (wishlistRef) wishlistRef.textContent = formatCurrency(activeBalance);
}

// --- Dynamic Rendering: Dashboard ---
function renderDashboard() {
    renderAccountSelectors();

    const activeOnly = chartFilterMode === 'active';
    const totalEarn = getTotalEarnings(activeOnly);
    const totalSpent = getTotalExpenses(activeOnly);
    
    document.getElementById('stat-total-earnings').textContent = formatCurrency(totalEarn);
    document.getElementById('stat-total-expenses').textContent = formatCurrency(totalSpent);

    const wishlistCount = state.wishlist.length;
    const activeBalance = getAccountBalance(state.activeAccountId);
    const affordableCount = state.wishlist.filter(w => activeBalance >= w.cost).length;
    
    document.getElementById('stat-wishlist-count').textContent = `${wishlistCount} Item${wishlistCount !== 1 ? 's' : ''}`;
    document.getElementById('stat-wishlist-affordable').textContent = `${affordableCount} Affordable`;

    renderMiniWishlist();
    renderMiniPurchases();
    renderDailyIncomeTable();
    renderCharts();
}

function renderMiniPurchases() {
    const container = document.getElementById('mini-purchases-list');
    if (!container) return;
    container.innerHTML = '';
    
    // Get recent wishlist purchases (expenses with specific notes)
    const activeTxs = state.transactions
        .filter(tx => tx.accountId === state.activeAccountId && tx.type === 'expense' && tx.notes && tx.notes.includes('Wishlist purchase'))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
        
    if (activeTxs.length === 0) {
        container.innerHTML = `<p class="card-subtext" style="text-align: center; padding: 1.5rem;">No items purchased recently.</p>`;
        return;
    }

    activeTxs.slice(0, 4).forEach(tx => {
        const div = document.createElement('div');
        div.className = 'mini-wish-item';
        div.innerHTML = `
            <div class="mini-wish-info">
                <span class="mini-wish-name">${tx.name.replace('Purchased: ', '')}</span>
                <span class="mini-wish-cost">${formatCurrency(tx.amount)}</span>
            </div>
            <span class="mini-wish-status ok" style="color: var(--accent-success);"><i data-lucide="check-circle" style="width: 14px; height: 14px; margin-right: 4px; vertical-align: middle;"></i>Bought</span>
        `;
        container.appendChild(div);
    });
}

function renderMiniWishlist() {
    const container = document.getElementById('mini-wishlist-list');
    container.innerHTML = '';
    
    if (state.wishlist.length === 0) {
        container.innerHTML = `<p class="card-subtext" style="text-align: center; padding: 1.5rem;">No items in wishlist</p>`;
        return;
    }

    const activeBalance = getAccountBalance(state.activeAccountId);
    state.wishlist.slice(0, 4).forEach(w => {
        const affordable = activeBalance >= w.cost;
        const div = document.createElement('div');
        div.className = 'mini-wish-item';
        div.innerHTML = `
            <div class="mini-wish-info">
                <span class="mini-wish-name">${w.name}</span>
                <span class="mini-wish-cost">${formatCurrency(w.cost)}</span>
            </div>
            <span class="mini-wish-status ${affordable ? 'ok' : 'no'}">${affordable ? 'Affordable' : 'Needed'}</span>
        `;
        container.appendChild(div);
    });
}

// Render Daily Income panel on Dashboard
function renderDailyIncomeTable() {
    const tbody = document.getElementById('daily-income-tbody');
    tbody.innerHTML = '';

    const dailyData = getDailyIncomeBreakdown();

    if (dailyData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
                    No task earnings recorded yet.
                </td>
            </tr>
        `;
        return;
    }

    dailyData.forEach(day => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${formatPrettyDate(day.date)}</strong></td>
            <td>${day.count} Task${day.count !== 1 ? 's' : ''} completed</td>
            <td style="text-align: right; font-weight: 700; color: var(--accent-success);">
                +${formatCurrency(day.total)}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- Dynamic Rendering: Tasks Spreadsheet Grid Tab ---
function renderTasksTab() {
    const presetsContainer = document.getElementById('presets-container');
    presetsContainer.innerHTML = '';
    
    if (state.taskPresets.length === 0) {
        presetsContainer.innerHTML = `<p class="section-description">No presets defined.</p>`;
    } else {
        state.taskPresets.forEach(preset => {
            const div = document.createElement('div');
            div.className = 'preset-item';
            div.innerHTML = `
                <div class="preset-info">
                    <h4>${preset.name}</h4>
                    <span>${formatCurrency(preset.amount)}</span>
                </div>
                <div class="preset-actions">
                    <button class="preset-btn-log" title="Insert preset row into grid" onclick="insertPresetToGrid('${preset.id}')">
                        <i data-lucide="corner-down-right"></i>
                    </button>
                    <button class="preset-btn-delete" title="Delete Preset" onclick="deletePreset('${preset.id}')">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            `;
            presetsContainer.appendChild(div);
        });
    }

    renderSpreadsheet();
    lucide.createIcons();
}

function renderSpreadsheet() {
    const tbody = document.getElementById('spreadsheet-tbody');
    tbody.innerHTML = '';
    
    if (!state.tasksGrid || state.tasksGrid.length === 0) {
        state.tasksGrid = [
            { id: "grid-row-" + Date.now(), description: "", rate: 0, date: getPastDateOffsetDays(0), completed: false }
        ];
    }
    
    state.tasksGrid.forEach((row) => {
        const tr = document.createElement('tr');
        if (row.completed) tr.classList.add('selected');
        
        tr.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="grid-checkbox" data-id="${row.id}" ${row.completed ? 'checked' : ''}>
            </td>
            <td>
                <input type="text" class="spreadsheet-input grid-desc" data-id="${row.id}" value="${row.description || ''}" placeholder="Enter task details...">
            </td>
            <td>
                <input type="number" class="spreadsheet-input grid-rate" data-id="${row.id}" step="0.01" min="0" value="${row.rate > 0 ? row.rate.toFixed(2) : ''}" placeholder="0.00">
            </td>
            <td>
                <input type="datetime-local" class="spreadsheet-input grid-date" data-id="${row.id}" value="${row.date || getPastDateOffsetDays(0)}">
            </td>
            <td style="text-align: center;">
                <button class="preset-btn-delete" title="Remove row" onclick="deleteGridRow('${row.id}')">
                    <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Inline cell change tracking listeners
    document.querySelectorAll('.grid-desc').forEach(el => {
        el.addEventListener('change', (e) => {
            const id = e.target.getAttribute('data-id');
            const row = state.tasksGrid.find(r => r.id === id);
            if (row) {
                row.description = e.target.value;
                saveState();
            }
        });
    });

    document.querySelectorAll('.grid-rate').forEach(el => {
        el.addEventListener('change', (e) => {
            const id = e.target.getAttribute('data-id');
            const row = state.tasksGrid.find(r => r.id === id);
            if (row) {
                row.rate = parseFloat(e.target.value) || 0;
                saveState();
                calculateGridTotal();
            }
        });
    });

    document.querySelectorAll('.grid-date').forEach(el => {
        el.addEventListener('change', (e) => {
            const id = e.target.getAttribute('data-id');
            const row = state.tasksGrid.find(r => r.id === id);
            if (row) {
                row.date = e.target.value;
                saveState();
            }
        });
    });

    document.querySelectorAll('.grid-checkbox').forEach(el => {
        el.addEventListener('change', (e) => {
            const id = e.target.getAttribute('data-id');
            const row = state.tasksGrid.find(r => r.id === id);
            if (row) {
                row.completed = e.target.checked;
                const tr = e.target.closest('tr');
                if (row.completed) {
                    tr.classList.add('selected');
                } else {
                    tr.classList.remove('selected');
                }
                saveState();
                calculateGridTotal();
            }
        });
    });

    calculateGridTotal();
    lucide.createIcons();
}

function insertPresetToGrid(presetId) {
    const preset = state.taskPresets.find(p => p.id === presetId);
    if (!preset) return;
    
    const newRow = {
        id: "grid-row-" + Date.now(),
        description: preset.name,
        rate: preset.amount,
        date: getPastDateOffsetDays(0),
        completed: true
    };
    
    if (state.tasksGrid.length === 1 && !state.tasksGrid[0].description && state.tasksGrid[0].rate === 0) {
        state.tasksGrid[0] = newRow;
    } else {
        state.tasksGrid.push(newRow);
    }
    
    saveState();
    renderSpreadsheet();
    showToast(`Preset "${preset.name}" inserted.`);
}

function addSpreadsheetRow() {
    state.tasksGrid.push({
        id: "grid-row-" + Date.now(),
        description: "",
        rate: 0,
        date: getPastDateOffsetDays(0),
        completed: false
    });
    saveState();
    renderSpreadsheet();
}

function deleteGridRow(rowId) {
    state.tasksGrid = state.tasksGrid.filter(r => r.id !== rowId);
    if (state.tasksGrid.length === 0) {
        state.tasksGrid.push({
            id: "grid-row-" + Date.now(),
            description: "",
            rate: 0,
            date: getPastDateOffsetDays(0),
            completed: false
        });
    }
    saveState();
    renderSpreadsheet();
}

function clearGrid() {
    if (confirm("Clear spreadsheet grid?")) {
        state.tasksGrid = [
            { id: "grid-row-" + Date.now(), description: "", rate: 0, date: getPastDateOffsetDays(0), completed: false }
        ];
        saveState();
        renderSpreadsheet();
        showToast("Grid cleared.");
    }
}

function calculateGridTotal() {
    const total = state.tasksGrid
        .filter(r => r.completed)
        .reduce((sum, r) => sum + (parseFloat(r.rate) || 0), 0);
    
    document.getElementById('grid-calculated-total').textContent = formatCurrency(total);
    return total;
}

function saveGridTasks() {
    const checkedRows = state.tasksGrid.filter(r => r.completed && r.rate > 0 && r.description);
    
    if (checkedRows.length === 0) {
        // Check if there are checked rows without rate/description
        const anyChecked = state.tasksGrid.filter(r => r.completed);
        if (anyChecked.length > 0) {
            showToast("Checked tasks must have a description AND a rate (₹ amount) to be saved!", "error");
        } else {
            showToast("Tick the checkbox ✓ next to tasks you want to save to your account.", "info");
        }
        return;
    }

    const totalAmount = checkedRows.reduce((sum, r) => sum + (parseFloat(r.rate) || 0), 0);
    const account = state.accounts.find(a => a.id === state.activeAccountId);

    checkedRows.forEach(row => {
        state.transactions.push({
            id: `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            accountId: state.activeAccountId,
            type: "earning",
            name: row.description,
            amount: parseFloat(row.rate),
            date: row.date,
            notes: "Logged from task spreadsheet"
        });
    });

    state.tasksGrid = state.tasksGrid.filter(r => !r.completed);
    if (state.tasksGrid.length === 0) {
        state.tasksGrid.push({
            id: "grid-row-" + Date.now(),
            description: "",
            rate: 0,
            date: getPastDateOffsetDays(0),
            completed: false
        });
    }

    saveState();
    renderSpreadsheet();
    renderDashboard();
    
    showToast(`✅ ${checkedRows.length} task${checkedRows.length !== 1 ? 's' : ''} saved! +${formatCurrency(totalAmount)} added to ${account ? account.name : 'account'}.`, 'success');
}

function deletePreset(presetId) {
    state.taskPresets = state.taskPresets.filter(p => p.id !== presetId);
    saveState();
    renderTasksTab();
    showToast('Preset template deleted.');
}

// --- Dynamic Rendering: Wishlist Tab ---
function renderWishlist() {
    const container = document.getElementById('wishlist-container');
    container.innerHTML = '';
    
    const activeBalance = getAccountBalance(state.activeAccountId);
    
    if (state.wishlist.length === 0) {
        container.innerHTML = `
            <div class="dashboard-card" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                <i data-lucide="shopping-cart" style="width: 48px; height: 48px; color: var(--text-muted); margin-bottom: 1rem;"></i>
                <h4>Wishlist is Empty</h4>
                <p class="card-subtext">Add desired items to track affordability.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    state.wishlist.forEach(item => {
        const affordable = activeBalance >= item.cost;
        const progressPercent = Math.min((activeBalance / item.cost) * 100, 100);
        
        const card = document.createElement('div');
        card.className = 'wish-card';
        card.innerHTML = `
            <div class="wish-card-header">
                <span class="wish-card-title">${item.name}</span>
                <button class="wish-card-delete" onclick="deleteWishItem('${item.id}')" title="Delete wishlist target">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
            
            <div class="wish-card-details">
                <span class="wish-card-cost">${formatCurrency(item.cost)}</span>
                <div class="wish-progress-box">
                    <div class="wish-progress-bar">
                        <div class="wish-progress-fill" style="width: ${progressPercent}%"></div>
                    </div>
                    <div class="wish-progress-text">
                        <span>Savings Progress</span>
                        <span>${progressPercent.toFixed(0)}%</span>
                    </div>
                </div>
            </div>
            
            <div class="wish-card-actions">
                <span class="badge ${affordable ? 'success' : 'danger'}">
                    <i data-lucide="${affordable ? 'check-circle' : 'lock'}"></i>
                    ${affordable ? 'Affordable' : 'Savings Needed'}
                </span>
                
                <button class="action-btn primary small" 
                        onclick="triggerPurchaseWishlistAuth('${item.id}')" 
                        ${!affordable ? 'disabled' : ''}>
                    <i data-lucide="shopping-cart"></i> Buy Now
                </button>
            </div>
        `;
        container.appendChild(card);
    });
    
    lucide.createIcons();
}

// Wishlist Buy authentication triggers
function triggerPurchaseWishlistAuth(itemId) {
    const item = state.wishlist.find(i => i.id === itemId);
    if (!item) return;

    const activeBalance = getAccountBalance(state.activeAccountId);
    if (activeBalance < item.cost) {
        showToast('Insufficient balance to purchase this item.', 'error');
        return;
    }

    pendingWishlistItemId = itemId;
    document.getElementById('auth-wishlist-item-id').value = itemId;
    document.getElementById('auth-wish-item-name').textContent = item.name;
    document.getElementById('auth-wish-item-cost').textContent = formatCurrency(item.cost);
    document.getElementById('wish-auth-password').value = '';
    document.getElementById('wish-auth-error-msg').style.display = 'none';

    openModal('modal-wishlist-auth');
    // Focus password field after modal opens
    setTimeout(() => {
        const pwInput = document.getElementById('wish-auth-password');
        if (pwInput) pwInput.focus();
    }, 150);
}

// Handle Wishlist Release Password Submission
document.getElementById('wishlist-auth-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const passInput = document.getElementById('wish-auth-password').value;
    const account = state.accounts.find(a => a.id === state.activeAccountId);

    if (account && account.password === passInput) {
        closeModal('modal-wishlist-auth');
        executePurchaseWishlist(pendingWishlistItemId);
    } else {
        document.getElementById('wish-auth-error-msg').style.display = 'block';
        showToast("Authorization Failed: Incorrect Password", "error");
    }
});

// Final purchase and 2-Page printable invoice export
// This now shows a choice modal first (PDF vs Print)
let _lastPurchasedItem = null;
let _lastPurchaseBalanceBefore = 0;
let _lastPurchaseBalanceAfter = 0;

function executePurchaseWishlist(itemId) {
    const item = state.wishlist.find(i => i.id === itemId);
    if (!item) return;
    
    const balanceBefore = getAccountBalance(state.activeAccountId);
    const account = state.accounts.find(a => a.id === state.activeAccountId);
    
    const now = new Date();
    const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const balanceAfter = balanceBefore - item.cost;
    
    // Log expense transaction
    const newTx = {
        id: `tx-${Date.now()}`,
        accountId: state.activeAccountId,
        type: 'expense',
        name: `Purchased: ${item.name}`,
        amount: item.cost,
        date: localISO,
        notes: `Wishlist purchase - password authorized`
    };
    state.transactions.push(newTx);

    // Remove wishlist item
    state.wishlist = state.wishlist.filter(i => i.id !== itemId);
    saveState();

    // Cache for PDF/Print output
    _lastPurchasedItem = item;
    _lastPurchaseBalanceBefore = balanceBefore;
    _lastPurchaseBalanceAfter = balanceAfter;

    // Build print receipt template (ready but don't print yet)
    buildPurchaseReceiptHTML(item, account, balanceBefore, balanceAfter);

    // Update the Purchase Output Modal
    document.getElementById('purchase-confirm-item-name').textContent = `✅ ${item.name} — Purchased!`;
    document.getElementById('purchase-confirm-balance').textContent = `Remaining balance: ${formatCurrency(balanceAfter)}`;

    renderWishlist();
    renderDashboard();

    // Show the choice modal
    openModal('modal-purchase-output');
}

function buildPurchaseReceiptHTML(item, account, balanceBefore, balanceAfter) {
    const printArea = document.getElementById('print-area');
    
    const activeTxs = state.transactions.filter(t => t.accountId === account.id);
    activeTxs.sort((a,b) => new Date(b.date) - new Date(a.date));
    const recentTxs = activeTxs.slice(0, 8);
    
    let historyRows = '';
    recentTxs.forEach(tx => {
        historyRows += `
            <tr>
                <td>${formatPrettyDateTime(tx.date)}</td>
                <td>${tx.name}</td>
                <td style="text-align: right; font-weight:700; color:${tx.type === 'earning' ? 'green' : 'red'}">${tx.type === 'earning' ? '+' : '-'}${formatCurrency(tx.amount)}</td>
            </tr>
        `;
    });

    // Build remaining wishlist items table
    let remainingWishlistRows = '';
    if (state.wishlist.length > 0) {
        state.wishlist.forEach(w => {
            const canAfford = balanceAfter >= w.cost;
            remainingWishlistRows += `
                <tr>
                    <td>${w.name}</td>
                    <td style="text-align: right;">${formatCurrency(w.cost)}</td>
                    <td style="text-align: center; font-weight: 700; color: ${canAfford ? 'green' : 'red'};">${canAfford ? '✅ Affordable' : '❌ Need More'}</td>
                </tr>
            `;
        });
    } else {
        remainingWishlistRows = '<tr><td colspan="3" style="text-align: center;">🎉 All wishlist items purchased! Wishlist is empty.</td></tr>';
    }

    printArea.innerHTML = `
        <!-- Page 1: Account Balance Status -->
        <div class="receipt-container">
            <div class="receipt-header">
                <h1>Visualsier Account Sheet</h1>
                <p>Smart Job Tracker &amp; Financial Planner</p>
            </div>
            <div class="receipt-title">PAGE 1: ACCOUNT BALANCE DETAILS</div>
            
            <table class="receipt-table" style="margin-top: 15px;">
                <tr>
                    <td><strong>Account Owner:</strong></td>
                    <td>${account.name}</td>
                    <td><strong>Statement Date:</strong></td>
                    <td>${new Date().toLocaleDateString('en-IN')}</td>
                </tr>
                <tr>
                    <td><strong>Balance Before Purchase:</strong></td>
                    <td>${formatCurrency(balanceBefore)}</td>
                    <td><strong>Balance After Purchase:</strong></td>
                    <td style="font-weight:700;">${formatCurrency(balanceAfter)}</td>
                </tr>
            </table>

            <h3 style="margin-top: 25px; margin-bottom: 10px; font-size: 14px;">Recent Transaction History</h3>
            <table class="receipt-table">
                <thead>
                    <tr>
                        <th>Date &amp; Time</th>
                        <th>Details</th>
                        <th style="text-align: right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${historyRows || '<tr><td colspan="3" style="text-align:center">No transaction records.</td></tr>'}
                </tbody>
            </table>

            <div class="receipt-footer" style="margin-top: 50px;">
                <p>Page 1 of 2 &nbsp;|&nbsp; Wishlist purchase details on the following page.</p>
                <p>Generated on ${new Date().toLocaleString('en-IN')}</p>
            </div>
        </div>

        <!-- CSS Forced Page Break -->
        <div class="page-break"></div>

        <!-- Page 2: Wishlist Purchase Details + Remaining Items -->
        <div class="receipt-container">
            <div class="receipt-header">
                <h1>Visualsier Wishlist Invoice</h1>
                <p>Smart Job Tracker &amp; Financial Planner</p>
            </div>
            <div class="receipt-title">PAGE 2: PURCHASE RECEIPT & REMAINING WISHLIST</div>
            
            <h3 style="margin-top: 15px; margin-bottom: 10px; font-size: 14px;">Item Purchased</h3>
            <table class="receipt-table">
                <thead>
                    <tr>
                        <th>Item Purchased</th>
                        <th style="text-align: right; width: 180px;">Amount Debited</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>${item.name}</strong></td>
                        <td style="text-align: right; font-weight: 700; color: red;">-${formatCurrency(item.cost)}</td>
                    </tr>
                </tbody>
            </table>

            <div class="receipt-totals" style="margin-top: 20px;">
                <div class="receipt-total-row">
                    <span>Account Balance (Before):</span>
                    <span>${formatCurrency(balanceBefore)}</span>
                </div>
                <div class="receipt-total-row">
                    <span>Purchase Amount (Debited):</span>
                    <span style="color: red;">-${formatCurrency(item.cost)}</span>
                </div>
                <div class="receipt-total-row final">
                    <span>Remaining Balance (After):</span>
                    <span><strong>${formatCurrency(balanceAfter)}</strong></span>
                </div>
            </div>

            <h3 style="margin-top: 30px; margin-bottom: 10px; font-size: 14px;">Remaining Wishlist Items</h3>
            <table class="receipt-table">
                <thead>
                    <tr>
                        <th>Item Name</th>
                        <th style="text-align: right; width: 150px;">Cost</th>
                        <th style="text-align: center; width: 150px;">Affordability</th>
                    </tr>
                </thead>
                <tbody>
                    ${remainingWishlistRows}
                </tbody>
            </table>

            <div class="receipt-footer" style="margin-top: 50px;">
                <p>Page 2 of 2 &nbsp;|&nbsp; Authorized via Visualsier password credentials.</p>
                <p>Printed: ${new Date().toLocaleString('en-IN')}</p>
            </div>
        </div>
    `;
}

function closePurchaseOutput() {
    closeModal('modal-purchase-output');
    showToast(`Purchase complete! Balance updated.`, 'success');
}

// Purchase output: Print button
document.getElementById('purchase-print-btn').addEventListener('click', () => {
    closeModal('modal-purchase-output');
    showToast('Opening print dialog...', 'info');
    setTimeout(() => { window.print(); }, 300);
});

// Purchase output: Save as PDF button — uses professional jsPDF generator
document.getElementById('purchase-pdf-btn').addEventListener('click', () => {
    closeModal('modal-purchase-output');
    if (_lastPurchasedItem) {
        try {
            const account = state.accounts.find(a => a.id === state.activeAccountId);
            const activeTxs = state.transactions.filter(t => t.accountId === state.activeAccountId);
            generateProfessionalPurchaseReceiptPDF(
                _lastPurchasedItem,
                account,
                _lastPurchaseBalanceBefore,
                _lastPurchaseBalanceAfter,
                activeTxs,
                state.wishlist
            );
            showToast('✅ Purchase receipt PDF downloaded!', 'success');
        } catch (err) {
            console.error('jsPDF error:', err);
            showToast('Opening Save as PDF in print dialog...', 'info');
            setTimeout(() => { window.print(); }, 300);
        }
    }
});

function deleteWishItem(itemId) {
    state.wishlist = state.wishlist.filter(i => i.id !== itemId);
    saveState();
    renderWishlist();
    showToast(`Wishlist target deleted.`);
}

// --- Dynamic Rendering: Transaction History Tab ---
function renderHistory() {
    const tableBody = document.getElementById('history-table-body');
    tableBody.innerHTML = '';
    
    const filterType = document.getElementById('history-filter-type').value;
    const searchQuery = document.getElementById('history-search').value.toLowerCase();
    
    let filteredTxs = state.transactions;
    filteredTxs.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (filterType !== 'all') {
        filteredTxs = filteredTxs.filter(tx => tx.type === filterType);
    }
    
    if (searchQuery) {
        filteredTxs = filteredTxs.filter(tx => 
            tx.name.toLowerCase().includes(searchQuery) || 
            (tx.notes && tx.notes.toLowerCase().includes(searchQuery))
        );
    }
    
    if (filteredTxs.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">
                    No transactions found matching your filters.
                </td>
            </tr>
        `;
        return;
    }
    
    filteredTxs.forEach(tx => {
        const account = state.accounts.find(a => a.id === tx.accountId);
        const accountName = account ? account.name : 'Deleted Account';
        
        const row = document.createElement('tr');
        row.setAttribute('ondblclick', `openEditTransactionModal('${tx.id}')`);
        row.title = "Double click row to edit transaction details";
        
        row.innerHTML = `
            <td>${formatPrettyDateTime(tx.date)}</td>
            <td><span class="card-subtext" style="font-weight:600">${accountName}</span></td>
            <td><span class="tag-badge ${tx.type}">${tx.type === 'earning' ? 'Earning' : 'Expense'}</span></td>
            <td>
                <div style="font-weight: 600">${tx.name}</div>
                <div class="card-subtext">${tx.notes || ''}</div>
            </td>
            <td class="amount-col ${tx.type}">
                ${tx.type === 'earning' ? '+' : '-'}${formatCurrency(tx.amount)}
            </td>
            <td class="action-col" onclick="event.stopPropagation()">
                <button class="edit-tx-btn" onclick="openEditTransactionModal('${tx.id}')" title="Edit entry name/cost">
                    <i data-lucide="edit" style="width: 14px; height: 14px;"></i>
                </button>
                <button class="delete-tx-btn" onclick="deleteTransaction('${tx.id}')" title="Delete entry and revert balance">
                    <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
    
    lucide.createIcons();
}

function deleteTransaction(txId) {
    const txIndex = state.transactions.findIndex(t => t.id === txId);
    if (txIndex === -1) return;
    
    const tx = state.transactions[txIndex];
    if (confirm(`Delete entry "${tx.name}"? Balance changes will be recalculated.`)) {
        state.transactions.splice(txIndex, 1);
        saveState();
        
        renderAccountSelectors();
        renderHistory();
        showToast("Transaction deleted. Balance recalculated.");
    }
}

function clearAllHistory() {
    const activeAcc = state.accounts.find(a => a.id === state.activeAccountId);
    const accountName = activeAcc ? activeAcc.name : 'active account';
    
    if (confirm(`WARNING: Are you sure you want to clear ALL transaction history associated with "${accountName}"? This cannot be undone.`)) {
        state.transactions = state.transactions.filter(tx => tx.accountId !== state.activeAccountId);
        saveState();
        
        renderAccountSelectors();
        renderHistory();
        renderDashboard();
        showToast(`Transaction history cleared for "${accountName}".`);
    }
}

function openEditTransactionModal(txId) {
    const tx = state.transactions.find(t => t.id === txId);
    if (!tx) return;
    
    document.getElementById('edit-tx-id').value = tx.id;
    document.getElementById('edit-tx-name').value = tx.name;
    document.getElementById('edit-tx-amount').value = tx.amount.toFixed(2);
    document.getElementById('edit-tx-date').value = tx.date;
    document.getElementById('edit-tx-notes').value = tx.notes || '';
    
    openModal('modal-edit-tx');
}

document.getElementById('edit-tx-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-tx-id').value;
    const name = document.getElementById('edit-tx-name').value.trim();
    const amount = parseFloat(document.getElementById('edit-tx-amount').value) || 0;
    const date = document.getElementById('edit-tx-date').value;
    const notes = document.getElementById('edit-tx-notes').value.trim();
    
    const tx = state.transactions.find(t => t.id === id);
    if (tx) {
        tx.name = name;
        tx.amount = amount;
        tx.date = date;
        tx.notes = notes;
        
        saveState();
        closeModal('modal-edit-tx');
        
        renderAccountSelectors();
        renderHistory();
        renderDashboard();
        showToast("Transaction updated successfully!");
    }
});

// Both the stat-card button and the top-bar button trigger the same report prompt
document.getElementById('get-details-btn').addEventListener('click', () => {
    openModal('modal-report-prompt');
});

document.getElementById('download-details-topbar-btn').addEventListener('click', () => {
    openModal('modal-report-prompt');
});

// Separate PDF and Print buttons for account report
document.getElementById('confirm-print-report-btn').addEventListener('click', () => {
    closeModal('modal-report-prompt');
    generateAccountReportAndAction('print');
});

document.getElementById('confirm-pdf-report-btn').addEventListener('click', () => {
    closeModal('modal-report-prompt');
    generateAccountReportAndAction('pdf');
});

// Wishlist download buttons
document.getElementById('get-wishlist-btn').addEventListener('click', () => {
    openModal('modal-wishlist-report-prompt');
});

document.getElementById('download-wishlist-topbar-btn').addEventListener('click', () => {
    openModal('modal-wishlist-report-prompt');
});

document.getElementById('confirm-print-wishlist-btn').addEventListener('click', () => {
    closeModal('modal-wishlist-report-prompt');
    generateWishlistReportAndAction('print');
});

document.getElementById('confirm-pdf-wishlist-btn').addEventListener('click', () => {
    closeModal('modal-wishlist-report-prompt');
    generateWishlistReportAndAction('pdf');
});

function generateAccountReportAndAction(mode) {
    const account = state.accounts.find(a => a.id === state.activeAccountId);
    if (!account) return;

    const accountTxs = state.transactions.filter(tx => tx.accountId === account.id);
    const balance = getAccountBalance(account.id);
    const totalEarn = getTotalEarnings(true);
    const totalSpent = getTotalExpenses(true);

    if (mode === 'pdf') {
        // Use professional jsPDF generator for direct .pdf download
        try {
            generateProfessionalAccountPDF(account, accountTxs, balance, totalEarn, totalSpent);
            showToast('✅ Professional PDF downloaded successfully!', 'success');
        } catch (err) {
            console.error('jsPDF error:', err);
            // Fallback to browser print
            generateAccountReportPrintHTML();
            showToast('Opening Save as PDF in print dialog...', 'info');
        }
    } else {
        // Browser print
        generateAccountReportPrintHTML();
        showToast('Opening print dialog...', 'info');
    }
}

function generateAccountReportPrintHTML() {
    const account = state.accounts.find(a => a.id === state.activeAccountId);
    if (!account) return;

    const accountTxs = state.transactions.filter(tx => tx.accountId === account.id);
    accountTxs.sort((a, b) => new Date(a.date) - new Date(b.date));

    const printArea = document.getElementById('print-area');
    
    let txRows = '';
    accountTxs.forEach(tx => {
        txRows += `
            <tr>
                <td>${formatPrettyDateTime(tx.date)}</td>
                <td>
                    <strong>${tx.name}</strong><br>
                    <span style="font-size: 11px; color: #555;">${tx.notes || ''}</span>
                </td>
                <td><span style="text-transform: capitalize;">${tx.type}</span></td>
                <td style="text-align: right; font-weight: 700; color: ${tx.type === 'earning' ? 'green' : 'red'};">
                    ${tx.type === 'earning' ? '+' : '-'}${formatCurrency(tx.amount)}
                </td>
            </tr>
        `;
    });

    const balance = getAccountBalance(account.id);

    printArea.innerHTML = `
        <div class="receipt-container">
            <div class="receipt-header">
                <h1>Visualsier Statement</h1>
                <p>Smart Job Tracker & Financial Planner</p>
            </div>
            <div class="receipt-title">ACCOUNT TRANSACTION DETAILS STATEMENT</div>
            
            <table class="receipt-table" style="margin-top: 15px;">
                <tr>
                    <td><strong>Account Name:</strong></td>
                    <td>${account.name}</td>
                    <td><strong>Report Date:</strong></td>
                    <td>${new Date().toLocaleDateString('en-IN')}</td>
                </tr>
                <tr>
                    <td><strong>Starting Balance:</strong></td>
                    <td>${formatCurrency(account.initialBalance)}</td>
                    <td><strong>Current Net Balance:</strong></td>
                    <td><strong>${formatCurrency(balance)}</strong></td>
                </tr>
            </table>

            <h3 style="margin-top: 25px; margin-bottom: 10px; font-size: 16px;">Historical Logs</h3>
            <table class="receipt-table">
                <thead>
                    <tr>
                        <th style="width: 180px;">Date & Time</th>
                        <th>Description</th>
                        <th style="width: 100px;">Type</th>
                        <th style="text-align: right; width: 140px;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${txRows || '<tr><td colspan="4" style="text-align: center;">No transactions logged in this account.</td></tr>'}
                </tbody>
            </table>

            <div class="receipt-totals" style="margin-top: 30px;">
                <div class="receipt-total-row final">
                    <span>Final Account Balance:</span>
                    <span>${formatCurrency(balance)}</span>
                </div>
            </div>

            <div class="receipt-footer" style="margin-top: 50px;">
                <p>Generated via Visualsier Statement compiler. Choose "Save as PDF" to save soft copy.</p>
                <p>Printed on ${new Date().toLocaleString('en-IN')}</p>
            </div>
        </div>
    `;

    showToast("Generating report statement details...", "info");

    setTimeout(() => {
        window.print();
        showToast("Account details report generated successfully!", "success");
    }, 300);
}

// --- Dynamic Rendering: Wishlist Report PDF ---
function generateWishlistReportAndAction(mode) {
    const account = state.accounts.find(a => a.id === state.activeAccountId);
    if (!account) return;

    const activeBalance = getAccountBalance(account.id);

    if (mode === 'pdf') {
        try {
            generateProfessionalWishlistPDF(account, state.wishlist, activeBalance);
            showToast('✅ Wishlist PDF downloaded successfully!', 'success');
        } catch (err) {
            console.error('jsPDF error:', err);
            generateWishlistReportPrintHTML();
            showToast('Opening Save as PDF in print dialog...', 'info');
        }
    } else {
        generateWishlistReportPrintHTML();
        showToast('Opening print dialog...', 'info');
    }
}

function generateWishlistReportPrintHTML() {
    const account = state.accounts.find(a => a.id === state.activeAccountId);
    if (!account) return;

    const activeBalance = getAccountBalance(account.id);
    const printArea = document.getElementById('print-area');
    
    let wishRows = '';
    let totalWishCost = 0;
    
    if (state.wishlist.length > 0) {
        state.wishlist.forEach((w, idx) => {
            const canAfford = activeBalance >= w.cost;
            totalWishCost += w.cost;
            wishRows += `
                <tr>
                    <td style="text-align: center;">${idx + 1}</td>
                    <td><strong>${w.name}</strong></td>
                    <td style="text-align: right;">${formatCurrency(w.cost)}</td>
                    <td style="text-align: center; font-weight: 700; color: ${canAfford ? 'green' : 'red'};">${canAfford ? '✅ Affordable' : '❌ Need More'}</td>
                </tr>
            `;
        });
    } else {
        wishRows = '<tr><td colspan="4" style="text-align: center;">No wishlist items added yet.</td></tr>';
    }

    const affordableCount = state.wishlist.filter(w => activeBalance >= w.cost).length;

    printArea.innerHTML = `
        <div class="receipt-container">
            <div class="receipt-header">
                <h1>Visualsier Wishlist Report</h1>
                <p>Smart Job Tracker & Financial Planner</p>
            </div>
            <div class="receipt-title">WISHLIST STATUS REPORT</div>
            
            <table class="receipt-table" style="margin-top: 15px;">
                <tr>
                    <td><strong>Account Name:</strong></td>
                    <td>${account.name}</td>
                    <td><strong>Report Date:</strong></td>
                    <td>${new Date().toLocaleDateString('en-IN')}</td>
                </tr>
                <tr>
                    <td><strong>Current Balance:</strong></td>
                    <td><strong>${formatCurrency(activeBalance)}</strong></td>
                    <td><strong>Total Items:</strong></td>
                    <td>${state.wishlist.length} (${affordableCount} affordable)</td>
                </tr>
            </table>

            <h3 style="margin-top: 25px; margin-bottom: 10px; font-size: 16px;">Wishlist Items</h3>
            <table class="receipt-table">
                <thead>
                    <tr>
                        <th style="width: 50px; text-align: center;">#</th>
                        <th>Item Name</th>
                        <th style="text-align: right; width: 150px;">Cost</th>
                        <th style="text-align: center; width: 150px;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${wishRows}
                </tbody>
            </table>

            <div class="receipt-totals" style="margin-top: 30px;">
                <div class="receipt-total-row">
                    <span>Total Wishlist Cost:</span>
                    <span>${formatCurrency(totalWishCost)}</span>
                </div>
                <div class="receipt-total-row">
                    <span>Account Balance:</span>
                    <span>${formatCurrency(activeBalance)}</span>
                </div>
                <div class="receipt-total-row final">
                    <span>${activeBalance >= totalWishCost ? 'Surplus After All Purchases:' : 'Shortfall to Buy All:'}</span>
                    <span style="color: ${activeBalance >= totalWishCost ? 'green' : 'red'};">${formatCurrency(Math.abs(activeBalance - totalWishCost))}</span>
                </div>
            </div>

            <div class="receipt-footer" style="margin-top: 50px;">
                <p>Generated via Visualsier Wishlist compiler. Choose "Save as PDF" to save soft copy.</p>
                <p>Printed on ${new Date().toLocaleString('en-IN')}</p>
            </div>
        </div>
    `;

    setTimeout(() => {
        window.print();
        showToast("Wishlist report generated successfully!", "success");
    }, 300);
}

// --- Dynamic Rendering: Account Archival Delete ---
function deleteAccountAndSaveStatement() {
    const account = state.accounts.find(a => a.id === state.activeAccountId);
    if (!account) return;

    if (state.accounts.length <= 1) {
        showToast("Cannot delete the final account. Maintain at least one active account.", "error");
        return;
    }

    const confirmMsg = `WARNING: Deleting account "${account.name}" will permanently wipe it. A soft copy statement will be exported to PDF first. Continue?`;
    
    if (confirm(confirmMsg)) {
        const accountTxs = state.transactions.filter(tx => tx.accountId === account.id);
        accountTxs.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        const printArea = document.getElementById('print-area');
        
        let txRows = '';
        accountTxs.forEach(tx => {
            txRows += `
                <tr>
                    <td>${formatPrettyDateTime(tx.date)}</td>
                    <td>
                        <strong>${tx.name}</strong><br>
                        <span style="font-size: 11px; color: #555;">${tx.notes || ''}</span>
                    </td>
                    <td><span style="text-transform: capitalize;">${tx.type}</span></td>
                    <td style="text-align: right; font-weight: 700; color: ${tx.type === 'earning' ? 'green' : 'red'};">
                        ${tx.type === 'earning' ? '+' : '-'}${formatCurrency(tx.amount)}
                    </td>
                </tr>
            `;
        });
        
        const closingBalance = getAccountBalance(account.id);
        
        printArea.innerHTML = `
            <div class="receipt-container">
                <div class="receipt-header">
                    <h1>Visualsier Closing Statement</h1>
                    <p>Smart Job Tracker & Financial Planner</p>
                </div>
                <div class="receipt-title">ARCHIVED ACCOUNT DETAILS</div>
                
                <table class="receipt-table" style="margin-top: 15px;">
                    <tr>
                        <td><strong>Closing Account:</strong></td>
                        <td>${account.name}</td>
                        <td><strong>Archival Date:</strong></td>
                        <td>${new Date().toLocaleDateString('en-IN')}</td>
                    </tr>
                    <tr>
                        <td><strong>Initial Balance:</strong></td>
                        <td>${formatCurrency(account.initialBalance)}</td>
                        <td><strong>Closing Balance:</strong></td>
                        <td><strong>${formatCurrency(closingBalance)}</strong></td>
                    </tr>
                </table>

                <h3 style="margin-top: 25px; margin-bottom: 10px; font-size: 16px;">Historical Transactions</h3>
                <table class="receipt-table">
                    <thead>
                        <tr>
                            <th style="width: 180px;">Date & Time</th>
                            <th>Description</th>
                            <th style="width: 100px;">Type</th>
                            <th style="text-align: right; width: 140px;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${txRows || '<tr><td colspan="4" style="text-align: center;">No transactions logged in this account.</td></tr>'}
                    </tbody>
                </table>

                <div class="receipt-footer" style="margin-top: 50px;">
                    <p>This statement was compiled automatically prior to deletion of account ID: ${account.id}.</p>
                    <p>Printed on ${new Date().toLocaleString('en-IN')}</p>
                </div>
            </div>
        `;

        showToast("Compiling statement PDF. Opening Print menu...", "info");
        
        setTimeout(() => {
            window.print();
            
            // Delete account and its transactions
            state.accounts = state.accounts.filter(a => a.id !== account.id);
            state.transactions = state.transactions.filter(t => t.accountId !== account.id);
            
            // Switch to remaining account
            state.activeAccountId = state.accounts[0].id;
            previousSelectedAccountId = state.accounts[0].id;
            
            saveState();
            
            renderAccountSelectors();
            renderDashboard();
            showToast(`Account "${account.name}" deleted and statement archived.`, "success");
        }, 500);
    }
}

// --- Dynamic Rendering: Multi-Chart (Bar, Line, Pie) ---
function renderCharts() {
    renderBarChart();
    renderLineChart();
    renderPieChart();
}

function renderBarChart() {
    const ctx = document.getElementById('analytics-chart-bar');
    if (!ctx) return;

    if (barChart) barChart.destroy();

    const monthLabels = [];
    const monthKeys = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
        const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
        monthKeys.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
        monthLabels.push(`${monthNames[m.getMonth()]} ${m.getFullYear()}`);
    }

    const earningsData = Array(6).fill(0);
    const expensesData = Array(6).fill(0);

    const activeOnly = chartFilterMode === 'active';

    state.transactions.forEach(tx => {
        if (activeOnly && tx.accountId !== state.activeAccountId) return;

        const txDate = new Date(tx.date);
        if (isNaN(txDate.getTime())) return;
        
        const txKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
        const idx = monthKeys.indexOf(txKey);
        
        if (idx !== -1) {
            const val = parseFloat(tx.amount) || 0;
            if (tx.type === 'earning') {
                earningsData[idx] += val;
            } else if (tx.type === 'expense') {
                expensesData[idx] += val;
            }
        }
    });

    barChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: monthLabels,
            datasets: [
                {
                    label: 'Earnings',
                    data: earningsData,
                    backgroundColor: '#10b981',
                    borderRadius: 5,
                    maxBarThickness: 20
                },
                {
                    label: 'Expenses',
                    data: expensesData,
                    backgroundColor: '#f43f5e',
                    borderRadius: 5,
                    maxBarThickness: 20
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#94a3b8', font: { family: 'Outfit', size: 10 } }
                }
            },
            scales: {
                x: { ticks: { color: '#94a3b8', font: { family: 'Outfit', size: 9 } }, grid: { display: false } },
                y: { ticks: { color: '#94a3b8', font: { family: 'Outfit', size: 9 }, callback: v => '₹' + v }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
            }
        }
    });
}

function renderLineChart() {
    const ctx = document.getElementById('analytics-chart-line');
    if (!ctx) return;

    if (lineChart) lineChart.destroy();

    const monthLabels = [];
    const monthKeys = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
        const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
        monthKeys.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
        monthLabels.push(`${monthNames[m.getMonth()]} ${m.getFullYear()}`);
    }

    const netBalanceTimeline = Array(6).fill(0);
    const activeOnly = chartFilterMode === 'active';

    // Calculate running balance for each key month
    monthKeys.forEach((key, keyIdx) => {
        let runningBal = 0;
        
        // Sum initial balance if activeOnly
        if (activeOnly) {
            const acc = state.accounts.find(a => a.id === state.activeAccountId);
            runningBal += acc ? (parseFloat(acc.initialBalance) || 0) : 0;
        } else {
            state.accounts.forEach(acc => {
                runningBal += parseFloat(acc.initialBalance) || 0;
            });
        }

        // Sum transaction changes prior or equal to this month
        state.transactions.forEach(tx => {
            if (activeOnly && tx.accountId !== state.activeAccountId) return;

            const txDate = new Date(tx.date);
            if (isNaN(txDate.getTime())) return;

            const txKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
            
            if (txKey <= key) {
                const val = parseFloat(tx.amount) || 0;
                if (tx.type === 'earning') runningBal += val;
                if (tx.type === 'expense') runningBal -= val;
            }
        });

        netBalanceTimeline[keyIdx] = runningBal;
    });

    lineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: monthLabels,
            datasets: [{
                label: 'Running Net Worth',
                data: netBalanceTimeline,
                borderColor: '#06b6d4',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.35,
                pointBackgroundColor: '#06b6d4'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { ticks: { color: '#94a3b8', font: { family: 'Outfit', size: 9 } }, grid: { display: false } },
                y: { ticks: { color: '#94a3b8', font: { family: 'Outfit', size: 9 }, callback: v => '₹' + v }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
            }
        }
    });
}

function renderPieChart() {
    const ctx = document.getElementById('analytics-chart-pie');
    if (!ctx) return;

    if (pieChart) pieChart.destroy();

    const activeOnly = chartFilterMode === 'active';
    const totalEarn = getTotalEarnings(activeOnly);
    const totalSpent = getTotalExpenses(activeOnly);

    pieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Earnings', 'Expenses'],
            datasets: [{
                data: [totalEarn, totalSpent],
                backgroundColor: ['#10b981', '#f43f5e'],
                borderColor: 'rgba(6, 9, 19, 0.8)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#94a3b8', font: { family: 'Outfit', size: 10 } }
                }
            }
        }
    });
}

// --- Controller Actions & Event Listeners ---

// Create Account Modal Submission
document.getElementById('create-account-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('new-account-name').value.trim();
    const initialBalance = parseFloat(document.getElementById('new-account-initial').value) || 0;
    const password = document.getElementById('new-account-password').value;
    const confirmPass = document.getElementById('new-account-confirm').value;

    if (password !== confirmPass) {
        showToast("Error: Passwords do not match!", "error");
        return;
    }

    const newId = `acc-${Date.now()}`;
    state.accounts.push({ id: newId, name, initialBalance, password });
    
    unlockedAccounts[newId] = true;
    state.activeAccountId = newId;
    previousSelectedAccountId = newId;

    saveState();
    closeModal('modal-account');
    document.getElementById('create-account-form').reset();
    
    refreshCurrentTab();
    showToast(`Account "${name}" created successfully!`);
});

// Create Preset Modal Submission
document.getElementById('create-preset-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('preset-name').value.trim();
    const amount = parseFloat(document.getElementById('preset-default-amount').value) || 0;
    
    const newId = `pre-${Date.now()}`;
    state.taskPresets.push({ id: newId, name, amount });
    
    saveState();
    closeModal('modal-preset');
    document.getElementById('create-preset-form').reset();
    
    renderTasksTab();
    showToast(`Preset "${name}" added!`);
});

// Custom Expense Modal Submission
document.getElementById('quick-expense-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('expense-name').value.trim();
    const amount = parseFloat(document.getElementById('expense-amount').value) || 0;
    const date = document.getElementById('expense-date').value;
    
    const newTx = {
        id: `tx-${Date.now()}`,
        accountId: state.activeAccountId,
        type: 'expense',
        name,
        amount,
        date,
        notes: 'Manually logged custom cost'
    };
    
    state.transactions.push(newTx);
    saveState();
    
    closeModal('modal-quick-expense');
    document.getElementById('quick-expense-form').reset();
    
    renderDashboard();
    showToast(`Logged expense: ${name} (-${formatCurrency(amount)})`, 'info');
});

// Add Wishlist Form Submission
document.getElementById('wishlist-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('wish-name').value.trim();
    const cost = parseFloat(document.getElementById('wish-cost').value) || 0;
    
    const newItem = {
        id: `wish-${Date.now()}`,
        name,
        cost
    };
    
    state.wishlist.push(newItem);
    saveState();
    
    document.getElementById('wishlist-form').reset();
    renderWishlist();
    showToast(`"${name}" added to shopping goals!`);
});

// Navigation Links Event Binding
document.querySelectorAll('.nav-menu .nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchTab(tab);
    });
});

// Spreadsheet Actions Event Listeners
document.getElementById('add-row-btn').addEventListener('click', addSpreadsheetRow);
document.getElementById('clear-grid-btn').addEventListener('click', clearGrid);
document.getElementById('calculate-total-btn').addEventListener('click', calculateGridTotal);
document.getElementById('save-grid-tasks-btn').addEventListener('click', saveGridTasks);

// Quick action buttons
document.getElementById('quick-task-btn').addEventListener('click', () => {
    switchTab('tasks');
});

document.getElementById('quick-expense-btn').addEventListener('click', () => {
    openModal('modal-quick-expense');
});

document.getElementById('add-account-btn').addEventListener('click', () => {
    openModal('modal-account');
});

document.getElementById('new-preset-btn').addEventListener('click', () => {
    openModal('modal-preset');
});

document.getElementById('delete-account-btn').addEventListener('click', deleteAccountAndSaveStatement);
document.getElementById('clear-all-history-btn').addEventListener('click', clearAllHistory);

// Chart filters
document.getElementById('chart-filter-all').addEventListener('click', (e) => {
    document.getElementById('chart-filter-all').classList.add('active');
    document.getElementById('chart-filter-active').classList.remove('active');
    chartFilterMode = 'all';
    renderDashboard();
});

document.getElementById('chart-filter-active').addEventListener('click', (e) => {
    document.getElementById('chart-filter-all').classList.remove('active');
    document.getElementById('chart-filter-active').classList.add('active');
    chartFilterMode = 'active';
    renderDashboard();
});

document.getElementById('history-search').addEventListener('input', renderHistory);
document.getElementById('history-filter-type').addEventListener('change', renderHistory);

// Start app
window.addEventListener('DOMContentLoaded', () => {
    loadState();
    checkWelcomeScreenStatus();
    lucide.createIcons();
});

// --- PWA Install Prompt Logic ---
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    const installSection = document.getElementById('install-app-section');
    if (installSection) installSection.style.display = 'block';
    
    const dashboardInstallBtn = document.getElementById('dashboard-install-btn');
    if (dashboardInstallBtn) dashboardInstallBtn.style.display = 'flex';
});

document.getElementById('install-app-btn')?.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        
        const installSection = document.getElementById('install-app-section');
        if (installSection) installSection.style.display = 'none';
        
        const dashboardInstallBtn = document.getElementById('dashboard-install-btn');
        if (dashboardInstallBtn) dashboardInstallBtn.style.display = 'none';
    }
});

window.addEventListener('appinstalled', () => {
    const installSection = document.getElementById('install-app-section');
    if (installSection) installSection.style.display = 'none';
    
    const dashboardInstallBtn = document.getElementById('dashboard-install-btn');
    if (dashboardInstallBtn) dashboardInstallBtn.style.display = 'none';
    
    deferredPrompt = null;
    showToast("App installed successfully! You can now use the desktop shortcut.");
});
