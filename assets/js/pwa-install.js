// PWA Installation Handler
class PWAInstaller {
  constructor() {
    this.deferredPrompt = null;
    this.installButton = null;
    this.isStandalone = this.checkStandalone();
    this.initialized = false;
  }
  
  initialize() {
    if (this.initialized) return;
    
    // Check if already installed
    if (this.isStandalone) {
      console.log('[PWA] Running in standalone mode');
      this.setupStandaloneFeatures();
    }
    
    // Listen for beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('[PWA] beforeinstallprompt fired');
      
      // Prevent default browser prompt
      e.preventDefault();
      
      // Store the event
      this.deferredPrompt = e;
      
      // Show install button
      this.showInstallButton();
    });
    
    // Track installation
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed successfully');
      this.hideInstallButton();
      this.deferredPrompt = null;
      
      // Track analytics
      this.trackEvent('pwa_installed');
    });
    
    // Listen for display mode changes
    window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
      this.isStandalone = e.matches;
      if (this.isStandalone) {
        this.setupStandaloneFeatures();
      }
    });
    
    this.initialized = true;
  }
  
  checkStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone ||
           document.referrer.includes('android-app://');
  }
  
  setupStandaloneFeatures() {
    // Hide browser UI elements
    document.documentElement.classList.add('pwa-standalone');
    
    // Enable pull-to-refresh
    this.enablePullToRefresh();
    
    // Setup share target
    this.setupShareTarget();
    
    // Setup badge API
    this.setupBadgeAPI();
  }
  
  createInstallButton() {
    const button = document.createElement('button');
    button.id = 'pwa-install-button';
    button.className = 'btn btn-primary position-fixed bottom-0 start-50 translate-middle-x mb-3 d-none';
    button.style.zIndex = '9999';
    button.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
    button.innerHTML = `
      <i class="bi bi-download"></i> Install Society 360 App
    `;
    
    button.addEventListener('click', () => this.installApp());
    
    document.body.appendChild(button);
    this.installButton = button;
  }
  
  showInstallButton() {
    if (!this.installButton) {
      this.createInstallButton();
    }
    
    // Don't show if already in standalone mode
    if (this.isStandalone) return;
    
    // Check if user has dismissed before
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) {
      return; // Don't show if dismissed in last 7 days
    }
    
    setTimeout(() => {
      this.installButton?.classList.remove('d-none');
    }, 3000); // Show after 3 seconds
  }
  
  hideInstallButton() {
    this.installButton?.classList.add('d-none');
  }
  
  async installApp() {
    if (!this.deferredPrompt) {
      // Provide manual installation instructions
      this.showManualInstallGuide();
      return;
    }
    
    // Show the install prompt
    this.deferredPrompt.prompt();
    
    // Wait for user response
    const choice = await this.deferredPrompt.userChoice;
    
    console.log('[PWA] User choice:', choice.outcome);
    
    // Track choice
    this.trackEvent('pwa_install_choice', {
      outcome: choice.outcome
    });
    
    // Clear the prompt
    this.deferredPrompt = null;
    this.hideInstallButton();
  }
  
  showManualInstallGuide() {
    const platform = this.detectPlatform();
    let guide = '';
    
    if (platform === 'ios') {
      guide = `
        <strong>Install on iOS:</strong><br>
        1. Tap the Share button <i class="bi bi-box-arrow-up"></i><br>
        2. Scroll down and tap "Add to Home Screen"<br>
        3. Tap "Add" in the top right
      `;
    } else if (platform === 'android') {
      guide = `
        <strong>Install on Android:</strong><br>
        1. Tap the menu button (⋮)<br>
        2. Tap "Install app" or "Add to Home screen"<br>
        3. Follow the prompts
      `;
    } else {
      guide = `
        <strong>Install this app:</strong><br>
        Look for the install icon <i class="bi bi-download"></i> in your browser's address bar.
      `;
    }
    
    Swal.fire({
      title: 'Install Society 360',
      html: guide,
      icon: 'info',
      confirmButtonText: 'Got it'
    });
  }
  
  detectPlatform() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
      return 'ios';
    }
    
    if (/android/i.test(userAgent)) {
      return 'android';
    }
    
    return 'desktop';
  }
  
  enablePullToRefresh() {
    let touchStartY = 0;
    let pulling = false;
    
    document.addEventListener('touchstart', (e) => {
      if (window.scrollY === 0) {
        touchStartY = e.touches[0].clientY;
        pulling = true;
      }
    }, { passive: true });
    
    document.addEventListener('touchmove', (e) => {
      if (pulling && window.scrollY === 0) {
        const touchY = e.touches[0].clientY;
        const pullDistance = touchY - touchStartY;
        
        if (pullDistance > 100) {
          pulling = false;
          this.refreshContent();
        }
      }
    }, { passive: true });
    
    document.addEventListener('touchend', () => {
      pulling = false;
    });
  }
  
  refreshContent() {
    // Show refresh indicator
    const indicator = document.createElement('div');
    indicator.className = 'refresh-indicator';
    indicator.innerHTML = '<div class="spinner-border text-primary"></div>';
    document.body.prepend(indicator);
    
    // Reload content
    setTimeout(() => {
      window.location.reload();
    }, 300);
  }
  
  setupShareTarget() {
    // Handle share target if PWA was launched via share
    const urlParams = new URLSearchParams(window.location.search);
    const sharedText = urlParams.get('text');
    const sharedUrl = urlParams.get('url');
    const sharedTitle = urlParams.get('title');
    
    if (sharedText || sharedUrl) {
      console.log('[PWA] App opened via share target');
      
      // Handle shared content
      if (sharedText) {
        this.handleSharedContent(sharedText, sharedUrl, sharedTitle);
      }
    }
  }
  
  handleSharedContent(text, url, title) {
    // Example: Create a new notice from shared content
    if (currentUser && currentUser.role === 'Chairman') {
      Swal.fire({
        title: 'Create Notice from Share?',
        text: `Would you like to create a notice from: "${text}"`,
        showCancelButton: true,
        confirmButtonText: 'Create Notice'
      }).then((result) => {
        if (result.isConfirmed) {
          // Navigate to notice creation with pre-filled content
          loadSection('notices');
          setTimeout(() => {
            document.getElementById('noticeTitle').value = title || 'Shared Notice';
            document.getElementById('noticeContent').value = text + (url ? `\n\n${url}` : '');
          }, 100);
        }
      });
    }
  }
  
  setupBadgeAPI() {
    if ('setAppBadge' in navigator) {
      // Listen for badge updates from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'INCREMENT_BADGE') {
          this.incrementBadge();
        } else if (event.data.type === 'CLEAR_BADGE') {
          this.clearBadge();
        }
      });
    }
  }
  
  async incrementBadge() {
    try {
      if ('setAppBadge' in navigator) {
        const currentBadge = await navigator.getAppBadge?.() || 0;
        await navigator.setAppBadge(currentBadge + 1);
      }
    } catch (error) {
      console.error('[PWA] Failed to set badge:', error);
    }
  }
  
  async clearBadge() {
    try {
      if ('clearAppBadge' in navigator) {
        await navigator.clearAppBadge();
      }
    } catch (error) {
      console.error('[PWA] Failed to clear badge:', error);
    }
  }
  
  trackEvent(eventName, params = {}) {
    // Track analytics if available
    if (typeof gtag !== 'undefined') {
      gtag('event', eventName, params);
    }
    
    console.log('[PWA] Event:', eventName, params);
  }
  
  getInstallStatus() {
    return {
      canInstall: !!this.deferredPrompt,
      isStandalone: this.isStandalone,
      platform: this.detectPlatform()
    };
  }
}

// Initialize PWA installer
const pwaInstaller = new PWAInstaller();
document.addEventListener('DOMContentLoaded', () => {
  pwaInstaller.initialize();
});

// Check for updates
if ('serviceWorker' in navigator) {
  setInterval(() => {
    navigator.serviceWorker.getRegistration().then(registration => {
      if (registration) {
        registration.update();
      }
    });
  }, 60 * 60 * 1000); // Check every hour
}