// Global Configuration
const CONFIG = {
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
let fcmToken = null;
let isOnline = navigator.onLine;

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupNetworkListeners();
    loadCachedData();
    initializeFCM();
});

// Network Status
function setupNetworkListeners() {
    window.addEventListener('online', () => {
        isOnline = true;
        document.querySelector('.offline-indicator').style.display = 'none';
        syncOfflineData();
    });
    
    window.addEventListener('offline', () => {
        isOnline = false;
        document.querySelector('.offline-indicator').style.display = 'block';
    });
}

// Authentication
async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch(`${CONFIG.SCRIPT_URL}?action=login&username=${username}&password=${password}`);
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            // Save FCM token if available
            if (fcmToken) {
                await saveFCMToken();
            }
            
            showDashboard();
        } else {
            alert('Invalid credentials');
        }
    } catch (error) {
        console.error('Login error:', error);
        // Check cached credentials for offline login
        const cachedUser = JSON.parse(localStorage.getItem(`user_${username}`));
        if (cachedUser && cachedUser.password === password) {
            currentUser = cachedUser;
            showDashboard();
        } else {
            alert('Login failed. Please check your connection.');
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
        currentUser = JSON.parse(savedUser);
        showDashboard();
    }
}

// Dashboard Management
function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboardContainer').style.display = 'block';
    document.getElementById('userBadge').textContent = `${currentUser.name} (${currentUser.role})`;
    
    setupBottomNav();
    loadSection('dashboard');
}

function setupBottomNav() {
    const navItems = getNavItemsByRole(currentUser.role);
    const navHtml = navItems.map(item => `
        <div class="col">
            <a href="#" class="nav-item-custom ${currentSection === item.id ? 'active' : ''}" 
               onclick="loadSection('${item.id}')">
                <i class="bi bi-${item.icon}"></i>
                <span>${item.label}</span>
            </a>
        </div>
    `).join('');
    
    document.getElementById('bottomNav').innerHTML = navHtml;
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
        ]
    };
    
    return [...baseItems, ...(roleItems[role] || [])];
}

// Section Loading
async function loadSection(sectionId) {
    currentSection = sectionId;
    setupBottomNav();
    
    const contentDiv = document.getElementById('dashboardContent');
    contentDiv.innerHTML = '<div class="skeleton-loader p-5 rounded"></div>';
    
    // Load section content based on role and section
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
            await loadChairmanSection(sectionId);
            break;
        case 'Super Admin':
            await loadSuperAdminSection(sectionId);
            break;
        default:
            await loadDefaultDashboard();
    }
}

// Security Guard Functions
async function loadSecurityGuardSection(sectionId) {
    const contentDiv = document.getElementById('dashboardContent');
    
    if (sectionId === 'visitor-entry') {
        contentDiv.innerHTML = `
            <div class="card dashboard-card">
                <div class="card-body">
                    <h5 class="card-title mb-4">
                        <i class="bi bi-person-plus"></i> Visitor Entry
                    </h5>
                    
                    <form id="visitorEntryForm" onsubmit="submitVisitorEntry(event)">
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
                                <option value="">Loading flats...</option>
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
        
        await loadFlatsForSelect();
    } else if (sectionId === 'active-visitors') {
        await loadActiveVisitors();
    } else if (sectionId === 'dashboard') {
        await loadSecurityDashboard();
    }
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
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Generate WhatsApp message with approval links
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
            
            const whatsappLink = `https://wa.me/${flatOwner.phone}?text=${whatsappMessage}`;
            
            // Show WhatsApp button
            Swal.fire({
                title: 'Visitor Registered!',
                html: `
                    <p>Visitor entry recorded successfully.</p>
                    <p>Notify owner via WhatsApp:</p>
                    <a href="${whatsappLink}" target="_blank" class="btn btn-success">
                        <i class="bi bi-whatsapp"></i> Send WhatsApp Message
                    </a>
                `,
                icon: 'success'
            });
            
            document.getElementById('visitorEntryForm').reset();
            
            // Trigger push notification
            await sendPushNotification(flatOwner.fcmToken, formData);
        }
    } catch (error) {
        console.error('Error submitting visitor:', error);
        // Save offline
        saveOfflineEntry('visitor', formData);
        alert('Saved offline. Will sync when online.');
    }
}

// Flat Owner Functions
async function loadFlatOwnerSection(sectionId) {
    const contentDiv = document.getElementById('dashboardContent');
    
    if (sectionId === 'visitors') {
        await loadVisitorHistory();
    } else if (sectionId === 'complaints') {
        contentDiv.innerHTML = `
            <div class="card dashboard-card mb-3">
                <div class="card-body">
                    <h5 class="card-title">
                        <i class="bi bi-plus-circle"></i> Raise New Complaint
                    </h5>
                    <form id="complaintForm" onsubmit="submitComplaint(event)">
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
                        
                        <div class="mb-3">
                            <label class="form-label">Upload Photo (Optional)</label>
                            <input type="file" class="form-control" id="complaintPhoto" accept="image/*" 
                                   onchange="previewImage(this)">
                            <img id="imagePreview" class="mt-2" style="max-width: 100%; max-height: 200px; display: none;">
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
                    <div id="complaintsList"></div>
                </div>
            </div>
        `;
        
        await loadMyComplaints();
    } else if (sectionId === 'maintenance') {
        await loadMaintenanceBills();
    } else if (sectionId === 'dashboard') {
        await loadOwnerDashboard();
    }
}

// Treasurer Functions
async function loadTreasurerSection(sectionId) {
    const contentDiv = document.getElementById('dashboardContent');
    
    if (sectionId === 'maintenance-tracker') {
        contentDiv.innerHTML = `
            <div class="card dashboard-card">
                <div class="card-body">
                    <h5 class="card-title mb-4">
                        <i class="bi bi-cash-stack"></i> Maintenance Collection Tracker
                    </h5>
                    
                    <div class="row mb-3">
                        <div class="col-6">
                            <div class="card bg-success text-white">
                                <div class="card-body text-center">
                                    <h6>Total Collected</h6>
                                    <h3 id="totalCollected">₹0</h3>
                                </div>
                            </div>
                        </div>
                        <div class="col-6">
                            <div class="card bg-danger text-white">
                                <div class="card-body text-center">
                                    <h6>Pending</h6>
                                    <h3 id="totalPending">₹0</h3>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mb-3">
                        <input type="text" class="form-control" id="searchFlat" 
                               placeholder="Search flat number..." onkeyup="filterMaintenanceList()">
                    </div>
                    
                    <div id="maintenanceList"></div>
                    
                    <button class="btn btn-warning w-100 mt-3" onclick="generateDefaulterList()">
                        <i class="bi bi-exclamation-triangle"></i> Generate Defaulter List
                    </button>
                </div>
            </div>
        `;
        
        await loadMaintenanceTracker();
    } else if (sectionId === 'expenses') {
        contentDiv.innerHTML = `
            <div class="card dashboard-card mb-3">
                <div class="card-body">
                    <h5 class="card-title">
                        <i class="bi bi-plus-circle"></i> Log New Expense
                    </h5>
                    <form id="expenseForm" onsubmit="submitExpense(event)">
                        <div class="mb-3">
                            <label class="form-label">Expense Category</label>
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
                            <label class="form-label">Upload Bill/Receipt</label>
                            <input type="file" class="form-control" id="expenseReceipt" accept="image/*">
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">Requires Chairman Approval?</label>
                            <select class="form-select" id="requiresApproval">
                                <option value="false">No</option>
                                <option value="true">Yes (Amount > ₹10,000)</option>
                            </select>
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
                    <div id="expensesList"></div>
                </div>
            </div>
        `;
        
        await loadRecentExpenses();
    }
}

// Chairman Functions
async function loadChairmanSection(sectionId) {
    const contentDiv = document.getElementById('dashboardContent');
    
    if (sectionId === 'notices') {
        contentDiv.innerHTML = `
            <div class="card dashboard-card mb-3">
                <div class="card-body">
                    <h5 class="card-title">
                        <i class="bi bi-megaphone"></i> Post New Notice
                    </h5>
                    <form id="noticeForm" onsubmit="postNotice(event)">
                        <div class="mb-3">
                            <label class="form-label">Title</label>
                            <input type="text" class="form-control" id="noticeTitle" required>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">Content</label>
                            <textarea class="form-control" id="noticeContent" rows="4" required></textarea>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">Priority</label>
                            <select class="form-select" id="noticePriority">
                                <option>Normal</option>
                                <option>Important</option>
                                <option>Urgent</option>
                            </select>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">Target Audience</label>
                            <select class="form-select" id="noticeTarget">
                                <option>All Residents</option>
                                <option>Owners Only</option>
                                <option>Tenants Only</option>
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
                    <div id="noticesList"></div>
                </div>
            </div>
        `;
        
        await loadNotices();
    } else if (sectionId === 'meetings') {
        await loadMeetingsSection();
    } else if (sectionId === 'approvals') {
        await loadApprovalsSection();
    }
}

// WhatsApp Action Handler (for action.html)
function handleVisitorAction() {
    const urlParams = new URLSearchParams(window.location.search);
    const visitorId = urlParams.get('visitor');
    const action = urlParams.get('action');
    
    if (visitorId && action) {
        updateVisitorStatus(visitorId, action);
    }
}

async function updateVisitorStatus(visitorId, action) {
    try {
        const response = await fetch(`${CONFIG.SCRIPT_URL}?action=updateVisitor&visitorId=${visitorId}&status=${action}`);
        const result = await response.json();
        
        if (result.success) {
            document.body.innerHTML = `
                <div class="container mt-5">
                    <div class="alert alert-success text-center">
                        <i class="bi bi-check-circle-fill" style="font-size: 3rem;"></i>
                        <h3 class="mt-3">Visitor ${action === 'approve' ? 'Approved' : 'Rejected'}</h3>
                        <p>The visitor has been notified.</p>
                        <button class="btn btn-primary" onclick="window.close()">Close</button>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error updating visitor:', error);
    }
}

// Push Notifications
async function initializeFCM() {
    if (typeof firebase === 'undefined') return;
    
    try {
        const messaging = firebase.messaging();
        
        // Request permission
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            fcmToken = await messaging.getToken({
                vapidKey: 'BFRR_iRMZcUauMvzeqoyupYREkb7qHWK_GiMd4pwXtlBJdLKRyZ49SgVYdOI6OAfoOyz4GrFE_7nOjI0TTMh1uU'
            });
            
            console.log('FCM Token:', fcmToken);
            
            // Save token to sheet if user is logged in
            if (currentUser) {
                await saveFCMToken();
            }
        }
        
        // Handle foreground messages
        messaging.onMessage((payload) => {
            showNotification(payload.notification.title, payload.notification.body);
        });
    } catch (error) {
        console.error('FCM initialization error:', error);
    }
}

async function saveFCMToken() {
    if (!fcmToken || !currentUser) return;
    
    try {
        await fetch(`${CONFIG.SCRIPT_URL}?action=saveFCMToken`, {
            method: 'POST',
            body: JSON.stringify({
                userId: currentUser.id,
                fcmToken: fcmToken
            })
        });
    } catch (error) {
        console.error('Error saving FCM token:', error);
    }
}

function showNotification(title, body) {
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: '/icons/icon-192x192.png'
        });
    }
    
    // Show in-app toast
    const toast = document.createElement('div');
    toast.className = 'toast show';
    toast.innerHTML = `
        <div class="toast-header">
            <strong class="me-auto">${title}</strong>
            <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body">${body}</div>
    `;
    
    document.querySelector('.notification-toast').appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

// Offline Support
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

async function syncOfflineData() {
    const offlineData = JSON.parse(localStorage.getItem('offlineData') || '{}');
    
    for (const [type, entries] of Object.entries(offlineData)) {
        for (const entry of entries.filter(e => !e.synced)) {
            try {
                const response = await fetch(`${CONFIG.SCRIPT_URL}?action=add${type}`, {
                    method: 'POST',
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

// Cache Management
function loadCachedData() {
    const cached = localStorage.getItem('appCache');
    if (cached) {
        cachedData = JSON.parse(cached);
    }
}

function updateCache(key, data) {
    cachedData[key] = {
        data: data,
        timestamp: Date.now()
    };
    
    localStorage.setItem('appCache', JSON.stringify(cachedData));
}

// Utility Functions
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
}

// Initialize SweetAlert2 for better UI
const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/sweetalert2@11';
document.head.appendChild(script);