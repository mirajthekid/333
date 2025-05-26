// DOM manipulation debugging for typing indicator
(function() {
    console.log("DOM manipulation debug script loaded");
    
    // Function to monitor the typing indicator element
    function monitorTypingIndicator() {
        // Get the typing indicator elements
        const typingIndicator = document.getElementById('typing-indicator');
        const typingText = document.getElementById('typing-text');
        
        if (!typingIndicator || !typingText) {
            console.error("CLIENT B: Typing indicator elements not found, will try again in 1 second");
            setTimeout(monitorTypingIndicator, 1000);
            return;
        }
        
        console.log("CLIENT B: Found typing indicator elements");
        console.log("CLIENT B: Initial state - typingIndicator:", {
            element: typingIndicator,
            display: window.getComputedStyle(typingIndicator).display,
            visibility: window.getComputedStyle(typingIndicator).visibility,
            classList: typingIndicator.classList,
            cssText: typingIndicator.style.cssText
        });
        
        // Intercept classList.add/remove for the typing indicator
        const originalAdd = typingIndicator.classList.add;
        const originalRemove = typingIndicator.classList.remove;
        
        typingIndicator.classList.add = function(...classes) {
            console.log("CLIENT B: Adding classes to typing indicator:", classes);
            const result = originalAdd.apply(this, classes);
            
            // Log the state after the change
            console.log("CLIENT B: After adding classes:", {
                classes: typingIndicator.className,
                display: window.getComputedStyle(typingIndicator).display,
                visibility: window.getComputedStyle(typingIndicator).visibility
            });
            
            return result;
        };
        
        typingIndicator.classList.remove = function(...classes) {
            console.log("CLIENT B: Removing classes from typing indicator:", classes);
            const result = originalRemove.apply(this, classes);
            
            // Log the state after the change
            console.log("CLIENT B: After removing classes:", {
                classes: typingIndicator.className,
                display: window.getComputedStyle(typingIndicator).display,
                visibility: window.getComputedStyle(typingIndicator).visibility
            });
            
            return result;
        };
        
        // Add CSS to ensure the typing indicator is visible when active
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            .typing-indicator.active {
                display: block !important;
            }
            #typing-text {
                color: var(--accent-color, #00aaff) !important;
            }
        `;
        document.head.appendChild(styleElement);
        console.log("CLIENT B: Added CSS fixes for typing indicator");
        
        // Add a button to manually test the typing indicator
        const testButton = document.createElement('button');
        testButton.textContent = "Test Typing Indicator";
        testButton.style.position = "fixed";
        testButton.style.bottom = "10px";
        testButton.style.right = "10px";
        testButton.style.zIndex = "9999";
        testButton.style.padding = "5px";
        testButton.style.backgroundColor = "#333";
        testButton.style.color = "#fff";
        testButton.style.border = "1px solid #666";
        testButton.style.borderRadius = "4px";
        
        testButton.addEventListener('click', function() {
            console.log("CLIENT B: Testing typing indicator");
            
            // Toggle the active class
            if (typingIndicator.classList.contains('active')) {
                console.log("CLIENT B: Trying to HIDE typing indicator");
                typingIndicator.classList.remove('active');
            } else {
                console.log("CLIENT B: Trying to SHOW typing indicator for Test User");
                typingText.textContent = "Test User is typing...";
                typingIndicator.classList.add('active');
            }
        });
        
        document.body.appendChild(testButton);
        console.log("CLIENT B: Added test button for typing indicator");
    }
    
    // Wait for the page to be fully loaded
    if (document.readyState === 'complete') {
        monitorTypingIndicator();
    } else {
        window.addEventListener('load', monitorTypingIndicator);
    }
})();
