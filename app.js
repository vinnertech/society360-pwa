// ============================================
// SOCIETY 360 - MAIN APPLICATION
// Version: 2.0.0 (Complete File)
// ============================================

// Global Configuration
const CONFIG = {
    // ✅ UPDATE THIS WITH YOUR ACTUAL APPS SCRIPT URL
    SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzCilOIf6E6JBmwddnPlIjLfK96-05JPo8zB3pacJ2tgq1D1wsO8gTyge1_0aqP4y-faw/exec',
    
    SHEETS: {
        USERS: 'Users',
        VISITORS: 'Visitors',
        MAINTENANCE: 'Maintenance',
        COMPLAINTS: 'Complaints',
        EXPENSES: 'Expenses',
        NOTICES: 'Notices',
        MEETINGS: 'Meetings'
    }
};

// Application State
let currentUser = null;
let currentSection = 'dashboard';
let cachedData = {};
let isOnline = navigator.onLine;
let fcmToken = null;
let messaging = null;

// VAPID Key for Firebase (replace with your actual key)
const VAPID_KEY = 'YOUR_VAPID_KEY_HERE';

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ Society 360 Initializing...');
    checkAuth();
    setupNetworkListeners();
    loadCachedData();
    initializeFirebaseMessaging();
});

// ============================================
// NETWORK & OFFLINE FUNCTIONS
// ============================================

function setupNetworkListeners() {
    window.addEventListener('online', () => {
        isOnline = true;
        const indicator = document.querySelector('.offline-indicator');
        if (indicator) indicator.style.display = 'none';
        syncOfflineData();
    });
    
    window.addEventListener('offline', () => {
        isOnline = false;
        const indicator = document.querySelector('.offline-indicator');
        if (indicator) indicator.style.display = 'block';
    });
}

function loadCachedData() {
    const cached = localStorage.getItem('appCache');
    if (cached) {
        try {
            cachedData = JSON.parse(cached);
        } catch (e) {
            cachedData = {};
        }
    }
}

function updateCache(key, data) {
    cachedData[key] = {
        data: data,
        timestamp: Date.now()
    };
    localStorage.setItem('appCache', JSON.stringify(cachedData));
}

async function syncOfflineData() {
    const offlineData = JSON.parse(localStorage.getItem('offlineData') || '{}');
    
    for (const [type, entries] of Object.entries(offlineData)) {
        for (const entry of entries.filter(e => !e.synced)) {
            try {
                const response = await fetch(`${CONFIG.SCRIPT_URL}?action=add${type}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(entry)
                });
                
                if (response.ok) {
                    entry.synced = true;
                }
            } catch (error) {
                console.error(`Error syncing ${type}:`, error);
            }
        }
    }
    
    localStorage.setItem('offlineData', JSON.stringify(offlineData));
}

function saveOfflineEntry(type, data) {
    const offlineData = JSON.parse(localStorage.getItem('offlineData') || '{}');
    
    if (!offlineData[type]) {
        offlineData[type] = [];
    }
    
    offlineData[type].push({
        ...data,
        timestamp: new Date().toISOString(),
        synced: false
    });
    
    localStorage.setItem('offlineData', JSON.stringify(offlineData));
}

// ============================================
// FIREBASE MESSAGING
// ============================================

function initializeFirebaseMessaging() {
    if (typeof firebase === 'undefined') {
        console.log('Firebase not loaded');
        return;
    }
    
    try {
        messaging = firebase.messaging();
        requestNotificationPermission();
        
        messaging.onMessage((payload) => {
            console.log('Message received:', payload);
            showInAppNotification(payload);
        });
    } catch (error) {
        console.error('Firebase error:', error);
    }
}

async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('Notifications not supported');
        return;
    }
    
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted' && messaging) {
            const token = await messaging.getToken({ vapidKey: VAPID_KEY });
            fcmToken = token;
            console.log('✅ FCM Token obtained');
            
            if (currentUser) {
                await saveFCMTokenToServer(token);
            }
        }
    } catch (error) {
        console.error('Notification permission error:', error);
    }
}

async function saveFCMTokenToServer(token) {
    if (!currentUser || !token) return;
    
    try {
        await fetch(`${CONFIG.SCRIPT_URL}?action=saveFCMToken`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, fcmToken: token })
        });
    } catch (error) {
        console.error('Error saving FCM token:', error);
    }
}

function showInAppNotification(payload) {
    const notification = payload.notification;
    
    const toastContainer = document.querySelector('.notification-toast') || createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = 'toast show';
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <div class="toast-header">
            <i class="bi bi-bell-fill text-primary me-2"></i>
            <strong class="me-auto">${notification?.title || 'Society 360'}</strong>
            <small>${new Date().toLocaleTimeString()}</small>
            <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body">
            ${notification?.body || 'New notification'}
        </div>
    `;
    
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.className = 'notification-toast position-fixed top-0 end-0 p-3';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
    return container;
}

// ============================================
// AUTHENTICATION
// ============================================

async function login() {
    const username = document.getElementById('username')?.value;
    const password = document.getElementById('password')?.value;
    
    if (!username || !password) {
        alert('Please enter username and password');
        return;
    }
    
    console.log('🔐 Attempting login with:', username);
    
    try {
        const url = `${CONFIG.SCRIPT_URL}?action=login&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
        console.log('Fetching:', url);
        
        const response = await fetch(url);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Login response:', data);
        
        if (data.success) {
            currentUser = data.user;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            // Cache user data for offline
            updateCache(`user_${username}`, data.user);
            
            if (fcmToken) {
                await saveFCMTokenToServer(fcmToken);
            }
            
            showDashboard();
        } else {
            alert('Invalid credentials: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Login error:', error);
        
        // Try offline login
        const cachedUser = cachedData[`user_${username}`];
        if (cachedUser && cachedUser.data.password === password) {
            currentUser = cachedUser.data;
            showDashboard();
        } else {
            alert('Login failed. Check your connection.');
        }
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('dashboardContainer').style.display = 'none';
}

function checkAuth() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            showDashboard();
        } catch (e) {
            localStorage.removeItem('currentUser');
        }
    }
}

// ============================================
// DASHBOARD MANAGEMENT
// ============================================

function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboardContainer').style.display = 'block';
    
    const userBadge = document.getElementById('userBadge');
    if (userBadge) {
        userBadge.textContent = `${currentUser.name} (${currentUser.role})`;
    }
    
    setupBottomNav();
    loadSection('dashboard');
}

function setupBottomNav() {
    const navItems = getNavItemsByRole(currentUser.role);
    const navHtml = navItems.map(item => `
        <div class="col">
            <a href="#" class="nav-item-custom ${currentSection === item.id ? 'active' : ''}" 
               onclick="loadSection('${item.id}'); return false;">
                <i class="bi bi-${item.icon}"></i>
                <span>${item.label}</span>
            </a>
        </div>
    `).join('');
    
    const bottomNav = document.getElementById('bottomNav');
    if (bottomNav) bottomNav.innerHTML = navHtml;
}

function getNavItemsByRole(role) {
    const baseItems = [
        { id: 'dashboard', icon: 'house', label: 'Home' }
    ];
    
    const roleItems = {
        'Super Admin': [
            { id: 'wings', icon: 'building', label: 'Wings' },
            { id: 'flats', icon: 'door-open', label: 'Flats' },
            { id: 'users', icon: 'people', label: 'Users' },
            { id: 'settings', icon: 'gear', label: 'Settings' }
        ],
        'Security Guard': [
            { id: 'visitor-entry', icon: 'person-plus', label: 'Entry' },
            { id: 'active-visitors', icon: 'eye', label: 'Active' }
        ],
        'Flat Owner': [
            { id: 'visitors', icon: 'people', label: 'Visitors' },
            { id: 'complaints', icon: 'exclamation-triangle', label: 'Issues' },
            { id: 'maintenance', icon: 'cash', label: 'Bills' }
        ],
        'Treasurer': [
            { id: 'maintenance-tracker', icon: 'cash-stack', label: 'Collection' },
            { id: 'expenses', icon: 'receipt', label: 'Expenses' },
            { id: 'reports', icon: 'graph-up', label: 'Reports' }
        ],
        'Chairman': [
            { id: 'notices', icon: 'megaphone', label: 'Notices' },
            { id: 'meetings', icon: 'calendar', label: 'Meetings' },
            { id: 'approvals', icon: 'check-circle', label: 'Approvals' }
        ],
        'Secretary': [
            { id: 'notices', icon: 'megaphone', label: 'Notices' },
            { id: 'meetings', icon: 'calendar', label: 'Meetings' }
        ],
        'Tenant': [
            { id: 'visitors', icon: 'people', label: 'Visitors' },
            { id: 'complaints', icon: 'exclamation-triangle', label: 'Issues' }
        ]
    };
    
    return [...baseItems, ...(roleItems[role] || [])];
}

// ============================================
// SECTION LOADING
// ============================================

async function loadSection(sectionId) {
    currentSection = sectionId;
    setupBottomNav();
    
    const contentDiv = document.getElementById('dashboardContent');
    contentDiv.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary"></div><p class="mt-3">Loading...</p></div>';
    
    switch(currentUser.role) {
        case 'Security Guard':
            await loadSecurityGuardSection(sectionId);
            break;
        case 'Flat Owner':
            await loadFlatOwnerSection(sectionId);
            break;
        case 'Treasurer':
            await loadTreasurerSection(sectionId);
            break;
        case 'Chairman':
        case 'Secretary':
            await loadChairmanSection(sectionId);
            break;
        case 'Super Admin':
            await loadSuperAdminSection(sectionId);
            break;
        default:
            await loadDefaultSection(sectionId);
    }
}

// ============================================
// SECURITY GUARD SECTIONS
// ============================================

async function loadSecurityGuardSection(sectionId) {
    const contentDiv = document.getElementById('dashboardContent');
    
    if (sectionId === 'visitor-entry') {
        await loadVisitorEntryForm();
    } else if (sectionId === 'active-visitors') {
        await loadActiveVisitorsList();
    } else if (sectionId === 'dashboard') {
        await loadGuardDashboard();
    } else {
        contentDiv.innerHTML = `<div class="alert alert-info">Section: ${sectionId}</div>`;
    }
}

async function loadVisitorEntryForm() {
    const contentDiv = document.getElementById('dashboardContent');
    
    let flatsOptions = '<option value="">Loading flats...</option>';
    
    try {
        const response = await fetch(`${CONFIG.SCRIPT_URL}?action=getFlatsForSelect`);
        const data = await response.json();
        
        if (data.success && data.flats) {
            flatsOptions = data.flats.map(f => 
                `<option value="${f.id}">${f.flatNumber} (${f.wing})</option>`
            ).join('');
        }
    } catch (error) {
        console.error('Error loading flats:', error);
        flatsOptions = '<option value="">Error loading flats</option>';
    }
    
    contentDiv.innerHTML = `
        <div class="card dashboard-card">
            <div class="card-body">
                <h5 class="card-title mb-4">
                    <i class="bi bi-person-plus"></i> Visitor Entry
                </h5>
                
                <form id="visitorEntryForm" onsubmit="submitVisitorEntry(event); return false;">
                    <div class="mb-3">
                        <label class="form-label">Visitor Name *</label>
                        <input type="text" class="form-control" id="visitorName" required>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Phone Number *</label>
                        <input type="tel" class="form-control" id="visitorPhone" required>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Select Flat *</label>
                        <select class="form-select" id="flatSelect" required>
                            ${flatsOptions}
                        </select>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Purpose of Visit</label>
                        <select class="form-select" id="visitPurpose">
                            <option>Personal</option>
                            <option>Delivery</option>
                            <option>Service/Maintenance</option>
                            <option>Guest</option>
                        </select>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Number of Visitors</label>
                        <input type="number" class="form-control" id="visitorCount" value="1" min="1">
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Vehicle Number (Optional)</label>
                        <input type="text" class="form-control" id="vehicleNumber">
                    </div>
                    
                    <button type="submit" class="btn btn-primary w-100">
                        <i class="bi bi-check-circle"></i> Register Entry & Notify Owner
                    </button>
                </form>
            </div>
        </div>
    `;
}

async function submitVisitorEntry(event) {
    event.preventDefault();
    
    const formData = {
        visitorName: document.getElementById('visitorName').value,
        visitorPhone: document.getElementById('visitorPhone').value,
        flatId: document.getElementById('flatSelect').value,
        purpose: document.getElementById('visitPurpose').value,
        visitorCount: document.getElementById('visitorCount').value,
        vehicleNumber: document.getElementById('vehicleNumber').value,
        entryTime: new Date().toISOString(),
        status: 'Pending',
        guardId: currentUser.id
    };
    
    try {
        const response = await fetch(`${CONFIG.SCRIPT_URL}?action=addVisitor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            const flatOwner = result.flatOwner;
            const approvalUrl = `${window.location.origin}/action.html?visitor=${result.visitorId}&action=approve`;
            const rejectUrl = `${window.location.origin}/action.html?visitor=${result.visitorId}&action=reject`;
            
            const whatsappMessage = encodeURIComponent(
                `🏢 *Society 360 - Visitor Alert*\n\n` +
                `📋 *Visitor Details:*\n` +
                `👤 Name: ${formData.visitorName}\n` +
                `📱 Phone: ${formData.visitorPhone}\n` +
                `🎯 Purpose: ${formData.purpose}\n` +
                `👥 Count: ${formData.visitorCount}\n` +
                `🕐 Time: ${new Date().toLocaleTimeString()}\n\n` +
                `*Approve or Reject Entry:*\n` +
                `✅ Approve: ${approvalUrl}\n` +
                `❌ Reject: ${rejectUrl}`
            );
            
            if (flatOwner && flatOwner.phone) {
                const whatsappLink = `https://wa.me/${flatOwner.phone}?text=${whatsappMessage}`;
                
                if (confirm('Visitor registered! Open WhatsApp to notify owner?')) {
                    window.open(whatsappLink, '_blank');
                }
            } else {
                alert('Visitor registered successfully!');
            }
            
            document.getElementById('visitorEntryForm').reset();
        } else {
            alert('Error: ' + (result.error || 'Failed to register visitor'));
        }
    } catch (error) {
        console.error('Error:', error);
        saveOfflineEntry('Visitor', formData);
        alert('Saved offline. Will sync when online.');
    }
}

async function loadActiveVisitorsList() {
    const contentDiv = document.getElementById('dashboardContent');
    
    try {
        const response = await fetch(`${CONFIG.SCRIPT_URL}?action=getActiveVisitors`);
        const data = await response.json();
        
        if (data.success && data.visitors) {
            const visitorsHtml = data.visitors.map(v => `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${v.name}</strong><br>
                            <small class="text-muted">${v.flatId} | ${v.purpose}</small>
                        </div>
                        <div class="text-end">
                            <span class="badge bg-success">Active</span><br>
                            <small class="text-muted">${new Date(v.entryTime).toLocaleTimeString()}</small>
                        </div>
                    </div>
                </div>
            `).join('');
            
            contentDiv.innerHTML = `
                <div class="card dashboard-card">
                    <div class="card-body">
                        <h5 class="card-title mb-3">
                            <i class="bi bi-eye"></i> Active Visitors
                        </h5>
                        <div class="list-group">
                            ${visitorsHtml || '<p class="text-muted text-center p-3">No active visitors</p>'}
                        </div>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        contentDiv.innerHTML = `<div class="alert alert-danger">Failed to load visitors</div>`;
    }
}

async function loadGuardDashboard() {
    const contentDiv = document.getElementById('dashboardContent');
    
    try {
        const response = await fetch(`${CONFIG.SCRIPT_URL}?action=getDashboardStats&role=Security Guard&userId=${currentUser.id}`);
        const data = await response.json();
        
        contentDiv.innerHTML = `
            <div class="row">
                <div class="col-12 mb-4">
                    <div class="card dashboard-card">
                        <div class="card-body">
                            <h5 class="card-title">Welcome, ${currentUser.name}!</h5>
                            <p class="text-muted">Security Guard Dashboard</p>
                        </div>
                    </div>
                </div>
                
                <div class="col-6 mb-3">
                    <div class="card dashboard-card bg-primary text-white" onclick="loadSection('visitor-entry')">
                        <div class="card-body text-center">
                            <i class="bi bi-person-plus" style="font-size: 2rem;"></i>
                            <h6 class="mt-2">New Entry</h6>
                        </div>
                    </div>
                </div>
                
                <div class="col-6 mb-3">
                    <div class="card dashboard-card bg-success text-white" onclick="loadSection('active-visitors')">
                        <div class="card-body text-center">
                            <i class="bi bi-people" style="font-size: 2rem;"></i>
                            <h6 class="mt-2">Active Visitors</h6>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        contentDiv.innerHTML = `<div class="alert alert-danger">Failed to load dashboard</div>`;
    }
}

// ============================================
// FLAT OWNER SECTIONS
// ============================================

async function loadFlatOwnerSection(sectionId) {
    const contentDiv = document.getElementById('dashboardContent');
    
    if (sectionId === 'visitors') {
        await loadVisitorHistory();
    } else if (sectionId === 'complaints') {
        await loadComplaintsSection();
    } else if (sectionId === 'maintenance') {
        await loadMaintenanceSection();
    } else if (sectionId === 'dashboard') {
        await loadOwnerDashboard();
    } else {
        contentDiv.innerHTML = `<div class="alert alert-info">Section: ${sectionId}</div>`;
    }
}

async function loadVisitorHistory() {
    const contentDiv = document.getElementById('dashboardContent');
    
    try {
        const response = await fetch(`${CONFIG.SCRIPT_URL}?action=getVisitors&flatId=${currentUser.flatId}`);
        const data = await response.json();
        
        if (data.success && data.visitors) {
            const visitorsHtml = data.visitors.map(v => `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${v.name}</strong><br>
                            <small class="text-muted">${v.phone} | ${v.purpose}</small>
                        </div>
                        <div class="text-end">
                            <span class="badge bg-${getStatusColor(v.status)}">${v.status}</span><br>
                            <small class="text-muted">${formatDate(v.entryTime)}</small>
                        </div>
                    </div>
                </div>
            `).join('');
            
            contentDiv.innerHTML = `
                <div class="card dashboard-card">
                    <div class="card-body">
                        <h5 class="card-title mb-3">
                            <i class="bi bi-clock-history"></i> Visitor History
                        </h5>
                        <div class="list-group">
                            ${visitorsHtml || '<p class="text-muted text-center p-3">No visitors yet</p>'}
                        </div>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        contentDiv.innerHTML = `<div class="alert alert-danger">Failed to load visitors</div>`;
    }
}

async function loadComplaintsSection() {
    const contentDiv = document.getElementById('dashboardContent');
    
    contentDiv.innerHTML = `
        <div class="card dashboard-card mb-3">
            <div class="card-body">
                <h5 class="card-title">
                    <i class="bi bi-plus-circle"></i> Raise New Complaint
                </h5>
                <form id="complaintForm" onsubmit="submitComplaint(event); return false;">
                    <div class="mb-3">
                        <label class="form-label">Category</label>
                        <select class="form-select" id="complaintCategory" required>
                            <option>Plumbing</option>
                            <option>Electrical</option>
                            <option>Cleaning</option>
                            <option>Security</option>
                            <option>Common Area</option>
                            <option>Other</option>
                        </select>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Description</label>
                        <textarea class="form-control" id="complaintDesc" rows="3" required></textarea>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Priority</label>
                        <select class="form-select" id="complaintPriority">
                            <option>Low</option>
                            <option>Medium</option>
                            <option>High</option>
                            <option>Emergency</option>
                        </select>
                    </div>
                    
                    <button type="submit" class="btn btn-primary w-100">
                        <i class="bi bi-send"></i> Submit Complaint
                    </button>
                </form>
            </div>
        </div>
        
        <div class="card dashboard-card">
            <div class="card-body">
                <h5 class="card-title">
                    <i class="bi bi-list-check"></i> My Complaints
                </h5>
                <div id="complaintsList">Loading...</div>
            </div>
        </div>
    `;
    
    await loadMyComplaints();
}

async function submitComplaint(event) {
    event.preventDefault();
    
    const formData = {
        flatId: currentUser.flatId,
        category: document.getElementById('complaintCategory').value,
        description: document.getElementById('complaintDesc').value,
        priority: document.getElementById('complaintPriority').value
    };
    
    try {
        const response = await fetch(`${CONFIG.SCRIPT_URL}?action=addComplaint`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('Complaint submitted successfully!');
            document.getElementById('complaintForm').reset();
            await loadMyComplaints();
        } else {
            alert('Error: ' + (result.error || 'Failed to submit complaint'));
        }
    } catch (error) {
        console.error('Error:', error);
        saveOfflineEntry('Complaint', formData);
        alert('Saved offline. Will sync when online.');
    }
}

async function loadMyComplaints() {
    try {
        const response = await fetch(`${CONFIG.SCRIPT_URL}?action=getComplaints&flatId=${currentUser.flatId}`);
        const data = await response.json();
        
        const complaintsList = document.getElementById('complaintsList');
        
        if (data.success && data.complaints && data.complaints.length > 0) {
            complaintsList.innerHTML = data.complaints.map(c => `
                <div class="border rounded p-3 mb-2">
                    <div class="d-flex justify-content-between">
                        <strong>${c.category}</strong>
                        <span class="badge bg-${getStatusColor(c.status)}">${c.status}</span>
                    </div>
                    <p class="mb-1 mt-2">${c.description}</p>
                    <small class="text-muted">Priority: ${c.priority} | ${formatDate(c.createdAt)}</small>
                </div>
            `).join('');
        } else {
            complaintsList.innerHTML = '<p class="text-muted text-center">No complaints yet</p>';
        }
    } catch (error) {
        document.getElementById('complaintsList').innerHTML = '<p class="text-danger">Failed to load complaints</p>';
    }
}

async function loadMaintenanceSection() {
    const contentDiv = document.getElementById('dashboardContent');
    
    try {
        const response = await fetch(`${CONFIG.SCRIPT_URL}?action=getMaintenance&flatId=${currentUser.flatId}`);
        const data = await response.json();
        
        if (data.success && data.bills) {
            const billsHtml = data.bills.map(b => `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${b.period}</strong><br>
                            <small class="text-muted">Due: ${formatDate(b.dueDate)}</small>
                        </div>
                        <div class="text-end">
                            <strong>₹${b.amount}</strong><br>
                            <span class="badge bg-${b.status === 'Paid' ? 'success' : 'warning'}">${b.status}</span>
                        </div>
                    </div>
                    ${b.status !== 'Paid' ? `
                        <button class="btn btn-sm btn-primary w-100 mt-2" onclick="payMaintenance('${b.id}', ${b.amount})">
                            Pay Now
                        </button>
                    ` : ''}
                </div>
            `).join('');
            
            contentDiv.innerHTML = `
                <div class="card dashboard-card">
                    <div class="card-body">
                        <h5 class="card-title mb-3">
                            <i class="bi bi-cash"></i> Maintenance Bills
                        </h5>
                        <div class="list-group">
                            ${billsHtml || '<p class="text-muted text-center p-3">No bills found</p>'}
                        </div>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        contentDiv.innerHTML = `<div class="alert alert-danger">Failed to load bills</div>`;
    }
}

function payMaintenance(billId, amount) {
    const paymentMode = prompt('Enter payment mode (Cash/Online/Cheque):', 'Online');
    if (paymentMode) {
        recordPayment(billId, amount, paymentMode);
    }
}

async function recordPayment(billId, amount, mode) {
    try {
        const response = await fetch(`${CONFIG.SCRIPT_URL}?action=recordPayment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ billId, amount, paymentMode: mode })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('Payment recorded successfully!');
            loadMaintenanceSection();
        } else {
            alert('Payment failed: ' + result.error);
        }
    } catch (error) {
        console.error('Payment error:', error);
        alert('Payment failed. Try again.');
    }
}

async function loadOwnerDashboard() {
    const contentDiv = document.getElementById('dashboardContent');
    
    try {
        const response = await fetch(`${CONFIG.SCRIPT_URL}?action=getDashboardStats&role=Flat Owner&userId=${currentUser.id}`);
        const data = await response.json();
        
        contentDiv.innerHTML = `
            <div class="row">
                <div class="col-12 mb-4">
                    <div class="card dashboard-card">
                        <div class="card-body">
                            <h5 class="card-title">Welcome back, ${currentUser.name}!</h5>
                            <p class="text-muted">Flat ${currentUser.flatId}</p>
                        </div>
                    </div>
                </div>
                
                <div class="col-4 mb-3">
                    <div class="card dashboard-card bg-primary text-white" onclick="loadSection('visitors')">
                        <div class="card-body text-center">
                            <i class="bi bi-people" style="font-size: 1.5rem;"></i>
                            <h6 class="mt-2">Visitors</h6>
                        </div>
                    </div>
                </div>
                
                <div class="col-4 mb-3">
                    <div class="card dashboard-card bg-warning text-white" onclick="loadSection('complaints')">
                        <div class="card-body text-center">
                            <i class="bi bi-exclamation-triangle" style="font-size: 1.5rem;"></i>
                            <h6 class="mt-2">Complaints</h6>
                        </div>
                    </div>
                </div>
                
                <div class="col-4 mb-3">
                    <div class="card dashboard-card bg-success text-white" onclick="loadSection('maintenance')">
                        <div class="card-body text-center">
                            <i class="bi bi-cash" style="font-size: 1.5rem;"></i>
                            <h6 class="mt-2">Bills</h6>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        contentDiv.innerHTML = `<div class="alert alert-danger">Failed to load dashboard</div>`;
    }
}

// ============================================
// TREASURER SECTIONS
// ============================================

async function loadTreasurerSection(sectionId) {
    const contentDiv = document.getElementById('dashboardContent');
    
    if (sectionId === 'maintenance-tracker') {
        await loadMaintenanceTracker();
    } else if (sectionId === 'expenses') {
        await loadExpensesSection();
    } else if (sectionId === 'dashboard') {
        await loadTreasurerDashboard();
    } else {
        contentDiv.innerHTML = `<div class="alert alert-info">Section: ${sectionId}</div>`;
    }
}

async function loadMaintenanceTracker() {
    const contentDiv = document.getElementById('dashboardContent');
    
    try {
        const response = await fetch(`${CONFIG.SCRIPT_URL}?action=getAllMaintenance`);
        const data = await response.json();
        
        contentDiv.innerHTML = `
            <div class="card dashboard-card">
                <div class="card-body">
                    <h5 class="card-title mb-4">
                        <i class="bi bi-cash-stack"></i> Maintenance Collection
                    </h5>
                    
                    <div class="row mb-3">
                        <div class="col-6">
                            <div class="card bg-success text-white">
                                <div class="card-body text-center">
                                    <h6>Collected</h6>
                                    <h4>₹${data.totalCollected || 0}</h4>
                                </div>
                            </div>
                        </div>
                        <div class="col-6">
                            <div class="card bg-danger text-white">
                                <div class="card-body text-center">
                                    <h6>Pending</h6>
                                    <h4>₹${data.totalPending || 0}</h4>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div id="maintenanceList"></div>
                </div>
            </div>
        `;
        
        const listDiv = document.getElementById('maintenanceList');
        if (data.records && data.records.length > 0) {
            listDiv.innerHTML = data.records.map(r => `
                <div class="border rounded p-3 mb-2">
                    <div class="d-flex justify-content-between">
                        <strong>${r.flatNumber}</strong>
                        <span class="badge bg-${r.status === 'Paid' ? 'success' : 'warning'}">${r.status}</span>
                    </div>
                    <p class="mb-1">${r.period} | Amount: ₹${r.amount}</p>
                    <small>Paid: ₹${r.paidAmount}</small>
                </div>
            `).join('');
        }
    } catch (error) {
        contentDiv.innerHTML = `<div class="alert alert-danger">Failed to load tracker</div>`;
    }
}

async function loadExpensesSection() {
    const contentDiv = document.getElementById('dashboardContent');
    
    contentDiv.innerHTML = `
        <div class="card dashboard-card mb-3">
            <div class="card-body">
                <h5 class="card-title">
                    <i class="bi bi-plus-circle"></i> Log Expense
                </h5>
                <form id="expenseForm" onsubmit="submitExpense(event); return false;">
                    <div class="mb-3">
                        <label class="form-label">Category</label>
                        <select class="form-select" id="expenseCategory" required>
                            <option>Maintenance</option>
                            <option>Salary</option>
                            <option>Utilities</option>
                            <option>Repairs</option>
                            <option>Events</option>
                            <option>Other</option>
                        </select>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Amount (₹)</label>
                        <input type="number" class="form-control" id="expenseAmount" required>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Description</label>
                        <textarea class="form-control" id="expenseDesc" rows="2" required></textarea>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Vendor (Optional)</label>
                        <input type="text" class="form-control" id="expenseVendor">
                    </div>
                    
                    <button type="submit" class="btn btn-primary w-100">
                        <i class="bi bi-save"></i> Log Expense
                    </button>
                </form>
            </div>
        </div>
        
        <div class="card dashboard-card">
            <div class="card-body">
                <h5 class="card-title">
                    <i class="bi bi-list-ul"></i> Recent Expenses
                </h5>
                <div id="expensesList">Loading...</div>
            </div>
        </div>
    `;
    
    await loadRecentExpenses();
}

async function submitExpense(event) {
    event.preventDefault();
    
    const formData = {
        category: document.getElementById('expenseCategory').value,
        amount: document.getElementById('expenseAmount').value,
        description: document.getElementById('expenseDesc').value,
        vendor: document.getElementById('expenseVendor').value,
        submittedBy: currentUser.id
    };
    
    try {
        const response = await fetch(`${CONFIG.SCRIPT_URL}?action=addExpense`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('Expense logged successfully!');
            document.getElementById('expenseForm').reset();
            await loadRecentExpenses();
        } else {
            alert('Error: ' + (result.error || 'Failed to log expense'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to log expense');
    }
}

async function loadRecentExpenses() {
    try {
        const response = await fetch(`${CONFIG.SCRIPT_URL}?action=getExpenses`);
        const data = await response.json();
        
        const expensesList = document.getElementById('expensesList');
        
        if (data.success && data.expenses && data.expenses.length > 0) {
            expensesList.innerHTML = data.expenses.slice(0, 5).map(e => `
                <div class="border rounded p-3 mb-2">
                    <div class="d-flex justify-content-between">
                        <strong>${e.category}</strong>
                        <strong>₹${e.amount}</strong>
                    </div>
                    <p class="mb-1">${e.description}</p>
                    <small class="text-muted">${formatDate(e.date)} | ${e.status}</small>
                </div>
            `).join('');
        } else {
            expensesList.innerHTML = '<p class="text-muted text-center">No expenses yet</p>';
        }
    } catch (error) {
        document.getElementById('expensesList').innerHTML = '<p class="text-danger">Failed to load expenses</p>';
    }
}

async function loadTreasurerDashboard() {
    const contentDiv = document.getElementById('dashboardContent');
    
    contentDiv.innerHTML = `
        <div class="row">
            <div class="col-12 mb-4">
                <div class="card dashboard-card">
                    <div class="card-body">
                        <h5 class="card-title">Welcome, ${currentUser.name}!</h5>
                        <p class="text-muted">Treasurer Dashboard</p>
                    </div>
                </div>
            </div>
            
            <div class="col-6 mb-3">
                <div class="card dashboard-card bg-primary text-white" onclick="loadSection('maintenance-tracker')">
                    <div class="card-body text-center">
                        <i class="bi bi-cash-stack" style="font-size: 2rem;"></i>
                        <h6 class="mt-2">Maintenance</h6>
                    </div>
                </div>
            </div>
            
            <div class="col-6 mb-3">
                <div class="card dashboard-card bg-warning text-white" onclick="loadSection('expenses')">
                    <div class="card-body text-center">
                        <i class="bi bi-receipt" style="font-size: 2rem;"></i>
                        <h6 class="mt-2">Expenses</h6>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// CHAIRMAN SECTIONS
// ============================================

async function loadChairmanSection(sectionId) {
    const contentDiv = document.getElementById('dashboardContent');
    
    if (sectionId === 'notices') {
        await loadNoticesSection();
    } else if (sectionId === 'meetings') {
        await loadMeetingsSection();
    } else if (sectionId === 'dashboard') {
        await loadChairmanDashboard();
    } else {
        contentDiv.innerHTML = `<div class="alert alert-info">Section: ${sectionId}</div>`;
    }
}

async function loadNoticesSection() {
    const contentDiv = document.getElementById('dashboardContent');
    
    contentDiv.innerHTML = `
        <div class="card dashboard-card mb-3">
            <div class="card-body">
                <h5 class="card-title">
                    <i class="bi bi-megaphone"></i> Post Notice
                </h5>
                <form id="noticeForm" onsubmit="postNotice(event); return false;">
                    <div class="mb-3">
                        <label class="form-label">Title</label>
                        <input type="text" class="form-control" id="noticeTitle" required>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Content</label>
                        <textarea class="form-control" id="noticeContent" rows="3" required></textarea>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Priority</label>
                        <select class="form-select" id="noticePriority">
                            <option>Normal</option>
                            <option>Important</option>
                            <option>Urgent</option>
                        </select>
                    </div>
                    
                    <button type="submit" class="btn btn-primary w-100">
                        <i class="bi bi-send"></i> Publish Notice
                    </button>
                </form>
            </div>
        </div>
        
        <div class="card dashboard-card">
            <div class="card-body">
                <h5 class="card-title">
                    <i class="bi bi-pin-angle"></i> Active Notices
                </h5>
                <div id="noticesList">Loading...</div>
            </div>
        </div>
    `;
    
    await loadActiveNotices();
}

async function postNotice(event) {
    event.preventDefault();
    
    const formData = {
        title: document.getElementById('noticeTitle').value,
        content: document.getElementById('noticeContent').value,
        priority: document.getElementById('noticePriority').value,
        createdBy: currentUser.id
    };
    
    try {
        const response = await fetch(`${CONFIG.SCRIPT_URL}?action=addNotice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('Notice published!');
            document.getElementById('noticeForm').reset();
            await loadActiveNotices();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to publish notice');
    }
}

async function loadActiveNotices() {
    try {
        const response = await fetch(`${CONFIG.SCRIPT_URL}?action=getNotices`);
        const data = await response.json();
        
        const noticesList = document.getElementById('noticesList');
        
        if (data.success && data.notices && data.notices.length > 0) {
            noticesList.innerHTML = data.notices.map(n => `
                <div class="border rounded p-3 mb-2">
                    <div class="d-flex justify-content-between">
                        <strong>${n.title}</strong>
                        <span class="badge bg-${n.priority === 'Urgent' ? 'danger' : n.priority === 'Important' ? 'warning' : 'secondary'}">${n.priority}</span>
                    </div>
                    <p class="mb-1 mt-2">${n.content}</p>
                    <small class="text-muted">${formatDate(n.date)}</small>
                </div>
            `).join('');
        } else {
            noticesList.innerHTML = '<p class="text-muted text-center">No active notices</p>';
        }
    } catch (error) {
        document.getElementById('noticesList').innerHTML = '<p class="text-danger">Failed to load notices</p>';
    }
}

async function loadMeetingsSection() {
    const contentDiv = document.getElementById('dashboardContent');
    
    contentDiv.innerHTML = `
        <div class="card dashboard-card mb-3">
            <div class="card-body">
                <h5 class="card-title">
                    <i class="bi bi-calendar-plus"></i> Schedule Meeting
                </h5>
                <form id="meetingForm" onsubmit="scheduleMeeting(event); return false;">
                    <div class="mb-3">
                        <label class="form-label">Title</label>
                        <input type="text" class="form-control" id="meetingTitle" required>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Date</label>
                        <input type="date" class="form-control" id="meetingDate" required>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Time</label>
                        <input type="time" class="form-control" id="meetingTime" required>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Location</label>
                        <input type="text" class="form-control" id="meetingLocation" value="Club House">
                    </div>
                    
                    <button type="submit" class="btn btn-primary w-100">
                        <i class="bi bi-calendar-check"></i> Schedule Meeting
                    </button>
                </form>
            </div>
        </div>
        
        <div class="card dashboard-card">
            <div class="card-body">
                <h5 class="card-title">
                    <i class="bi bi-calendar"></i> Upcoming Meetings
                </h5>
                <div id="meetingsList">Loading...</div>
            </div>
        </div>
    `;
    
    await loadUpcomingMeetings();
}

async function scheduleMeeting(event) {
    event.preventDefault();
    
    const formData = {
        title: document.getElementById('meetingTitle').value,
        date: document.getElementById('meetingDate').value,
        time: document.getElementById('meetingTime').value,
        location: document.getElementById('meetingLocation').value,
        createdBy: currentUser.id
    };
    
    try {
        const response = await fetch(`${CONFIG.SCRIPT_URL}?action=addMeeting`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('Meeting scheduled!');
            document.getElementById('meetingForm').reset();
            await loadUpcomingMeetings();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to schedule meeting');
    }
}

async function loadUpcomingMeetings() {
    try {
        const response = await fetch(`${CONFIG.SCRIPT_URL}?action=getMeetings`);
        const data = await response.json();
        
        const meetingsList = document.getElementById('meetingsList');
        
        if (data.success && data.meetings && data.meetings.length > 0) {
            meetingsList.innerHTML = data.meetings.map(m => `
                <div class="border rounded p-3 mb-2">
                    <strong>${m.title}</strong><br>
                    <small class="text-muted">
                        ${formatDate(m.date)} at ${m.time}<br>
                        Location: ${m.location}
                    </small>
                </div>
            `).join('');
        } else {
            meetingsList.innerHTML = '<p class="text-muted text-center">No upcoming meetings</p>';
        }
    } catch (error) {
        document.getElementById('meetingsList').innerHTML = '<p class="text-danger">Failed to load meetings</p>';
    }
}

async function loadChairmanDashboard() {
    const contentDiv = document.getElementById('dashboardContent');
    
    contentDiv.innerHTML = `
        <div class="row">
            <div class="col-12 mb-4">
                <div class="card dashboard-card">
                    <div class="card-body">
                        <h5 class="card-title">Welcome, ${currentUser.name}!</h5>
                        <p class="text-muted">Chairman Dashboard</p>
                    </div>
                </div>
            </div>
            
            <div class="col-6 mb-3">
                <div class="card dashboard-card bg-primary text-white" onclick="loadSection('notices')">
                    <div class="card-body text-center">
                        <i class="bi bi-megaphone" style="font-size: 2rem;"></i>
                        <h6 class="mt-2">Notices</h6>
                    </div>
                </div>
            </div>
            
            <div class="col-6 mb-3">
                <div class="card dashboard-card bg-success text-white" onclick="loadSection('meetings')">
                    <div class="card-body text-center">
                        <i class="bi bi-calendar" style="font-size: 2rem;"></i>
                        <h6 class="mt-2">Meetings</h6>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// SUPER ADMIN SECTIONS
// ============================================

async function loadSuperAdminSection(sectionId) {
    const contentDiv = document.getElementById('dashboardContent');
    
    if (sectionId === 'dashboard') {
        await loadAdminDashboard();
    } else {
        contentDiv.innerHTML = `<div class="alert alert-info">Section: ${sectionId}</div>`;
    }
}

async function loadAdminDashboard() {
    const contentDiv = document.getElementById('dashboardContent');
    
    contentDiv.innerHTML = `
        <div class="row">
            <div class="col-12 mb-4">
                <div class="card dashboard-card">
                    <div class="card-body">
                        <h5 class="card-title">Welcome, ${currentUser.name}!</h5>
                        <p class="text-muted">Super Admin Dashboard</p>
                    </div>
                </div>
            </div>
            
            <div class="col-4 mb-3">
                <div class="card dashboard-card bg-primary text-white">
                    <div class="card-body text-center">
                        <i class="bi bi-building" style="font-size: 1.5rem;"></i>
                        <h6 class="mt-2">Wings</h6>
                    </div>
                </div>
            </div>
            
            <div class="col-4 mb-3">
                <div class="card dashboard-card bg-success text-white">
                    <div class="card-body text-center">
                        <i class="bi bi-door-open" style="font-size: 1.5rem;"></i>
                        <h6 class="mt-2">Flats</h6>
                    </div>
                </div>
            </div>
            
            <div class="col-4 mb-3">
                <div class="card dashboard-card bg-warning text-white">
                    <div class="card-body text-center">
                        <i class="bi bi-people" style="font-size: 1.5rem;"></i>
                        <h6 class="mt-2">Users</h6>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// DEFAULT SECTIONS
// ============================================

async function loadDefaultSection(sectionId) {
    const contentDiv = document.getElementById('dashboardContent');
    
    if (sectionId === 'dashboard') {
        contentDiv.innerHTML = `
            <div class="card dashboard-card">
                <div class="card-body text-center p-5">
                    <i class="bi bi-house" style="font-size: 3rem; color: #667eea;"></i>
                    <h4 class="mt-3">Welcome, ${currentUser.name}!</h4>
                    <p class="text-muted">${currentUser.role} Dashboard</p>
                </div>
            </div>
        `;
    } else {
        contentDiv.innerHTML = `
            <div class="card dashboard-card">
                <div class="card-body text-center p-5">
                    <i class="bi bi-tools" style="font-size: 3rem; color: #667eea;"></i>
                    <h4 class="mt-3">${sectionId} Section</h4>
                    <p class="text-muted">This section is under development.</p>
                </div>
            </div>
        `;
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function getStatusColor(status) {
    const colors = {
        'Approved': 'success',
        'Pending': 'warning',
        'Rejected': 'danger',
        'Checked-Out': 'secondary',
        'Paid': 'success',
        'Open': 'warning',
        'Resolved': 'success',
        'Closed': 'secondary'
    };
    return colors[status] || 'secondary';
}

// ============================================
// EXPOSE FUNCTIONS GLOBALLY
// ============================================

window.login = login;
window.logout = logout;
window.loadSection = loadSection;
window.submitVisitorEntry = submitVisitorEntry;
window.submitComplaint = submitComplaint;
window.payMaintenance = payMaintenance;
window.submitExpense = submitExpense;
window.postNotice = postNotice;
window.scheduleMeeting = scheduleMeeting;
