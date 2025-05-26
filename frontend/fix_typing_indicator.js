// Minimal fix for typing indicator visibility
(function() {
    console.log('Minimal typing indicator fix loaded');
    
    // Add CSS to ensure typing indicator is visible when active
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .typing-indicator.active {
            display: block !important;
            color: var(--accent-color, #00aaff) !important;
        }
        #typing-text {
            color: var(--accent-color, #00aaff) !important;
        }
    `;
    document.head.appendChild(styleElement);
    
    // Don't override any existing functions, just fix the CSS
    console.log('CSS fix for typing indicator applied');
})();
