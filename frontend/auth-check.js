// Authentication verification script
(function() {
    // Immediately check if we're on a chat route
    if (window.location.pathname.includes('/chat') || window.location.hash.includes('chat')) {
        // Clear any existing verification to force re-authentication
        const isVerified = sessionStorage.getItem('userVerified') === 'true';
        if (!isVerified) {
            // Clear any existing session data to prevent race conditions
            sessionStorage.clear();
            // Redirect to home with a flag to prevent loops
            const redirectUrl = new URL(window.location.origin);
            redirectUrl.searchParams.set('redirected', 'true');
            window.location.href = redirectUrl.toString();
            return; // Stop execution
        }
    }

    // Function to check if we're on the chat route
    function isChatRoute() {
        return window.location.pathname.includes('/chat') || 
               window.location.hash.includes('chat') ||
               (document.getElementById('chat-screen')?.classList.contains('active') === true) ||
               document.querySelector('.chat-container') !== null;
    }

    // Function to check if we're on the home/login route
    function isHomeRoute() {
        return window.location.pathname === '/' || 
               window.location.pathname.endsWith('index.html') ||
               (document.getElementById('login-screen')?.classList.contains('active') === true) ||
               document.getElementById('login-screen') !== null;
    }

    // Function to handle redirection
    function handleUnauthenticatedAccess() {
        // Clear any existing verification to prevent race conditions
        sessionStorage.removeItem('userVerified');
        // Store the attempted URL for potential redirect after login
        sessionStorage.setItem('redirectAfterLogin', window.location.href);
        // Force a hard redirect to root with a parameter to prevent loops
        const redirectUrl = new URL(window.location.origin);
        redirectUrl.searchParams.set('redirected', 'true');
        window.location.href = redirectUrl.toString();
    }

    // Global function to check authentication
    window.checkAuth = function() {
        // Check if we're on the chat route
        if (isChatRoute()) {
            const isVerified = sessionStorage.getItem('userVerified') === 'true';
            
            // If not verified, redirect to home page
            if (!isVerified) {
                handleUnauthenticatedAccess();
                return false;
            }
            return true;
        }
        
        // If we're on the home page, check for redirect
        if (isHomeRoute()) {
            const redirectUrl = sessionStorage.getItem('redirectAfterLogin');
            const isVerified = sessionStorage.getItem('userVerified') === 'true';
            
            // If user is verified and there's a redirect URL, go there
            if (isVerified && redirectUrl) {
                const targetUrl = new URL(redirectUrl);
                const currentUrl = new URL(window.location.href);
                
                // Only redirect if we're not already on the target URL to prevent loops
                if (targetUrl.pathname !== currentUrl.pathname || targetUrl.hash !== currentUrl.hash) {
                    sessionStorage.removeItem('redirectAfterLogin');
                    window.location.href = redirectUrl;
                    return false;
                }
            }
        }
        
        return true;
    };

    // Run check immediately when script loads
    if (isChatRoute() && sessionStorage.getItem('userVerified') !== 'true') {
        handleUnauthenticatedAccess();
    }
    
    // Also run check when DOM is fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', window.checkAuth);
    } else {
        window.checkAuth();
    }
    
    // Also check when the hash changes (for SPA routing)
    window.addEventListener('hashchange', window.checkAuth);
    
    // Additional check for SPA navigation
    const originalPushState = history.pushState;
    history.pushState = function() {
        originalPushState.apply(this, arguments);
        window.dispatchEvent(new Event('locationchange'));
    };
    
    window.addEventListener('popstate', function() {
        window.dispatchEvent(new Event('locationchange'));
    });
    
    window.addEventListener('locationchange', function() {
        if (isChatRoute() && sessionStorage.getItem('userVerified') !== 'true') {
            handleUnauthenticatedAccess();
        }
    });
})();
