// Improved WebSocket URL construction that works better with Render
// This handles both local development and production deployment on Render
const getWebSocketUrl = () => {
    const isSecure = window.location.protocol === 'https:';
    const wsProtocol = isSecure ? 'wss:' : 'ws:';
    
    // Check if we're on Render (typically domain ends with .onrender.com)
    const isRender = window.location.hostname.includes('.onrender.com');
    
    // For Render, ensure we use the same hostname but with wss protocol
    if (isRender) {
        return `${wsProtocol}//${window.location.hostname}`;
    }
    
    // For local development
    const port = window.location.port ? `:${window.location.port}` : '';
    return `${wsProtocol}//${window.location.hostname}${port}`;
};

// Export the function for use in the main script
window.getWebSocketUrl = getWebSocketUrl;
