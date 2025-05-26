// Debug script for typing indicator issues
(function() {
    console.log("Typing indicator debug script loaded");
    
    // Find input element and add our debug event listeners
    function setupDebugListeners() {
        console.log("Setting up debug listeners for typing indicator");
        
        // Find message input
        const messageInput = document.getElementById('message-input');
        if (!messageInput) {
            console.error("DEBUG: Message input not found, will try again in 1 second");
            setTimeout(setupDebugListeners, 1000);
            return;
        }
        
        // Add input event listener for typing
        messageInput.addEventListener('input', function() {
            console.log("CLIENT A: Input detected in message box");
            
            // Check if typing state variables exist
            console.log("CLIENT A: Current state - username:", window.username, "roomId:", window.roomId, "isTyping:", window.isTyping);
            
            // Check if socket exists and is open
            if (window.socket) {
                console.log("CLIENT A: Socket exists, readyState:", window.socket.readyState, 
                           "(0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)");
            } else {
                console.error("CLIENT A: Socket does not exist!");
            }
        });
        
        // Intercept the original sendTypingStatus function
        if (typeof window.sendTypingStatus === 'function') {
            const originalSendTypingStatus = window.sendTypingStatus;
            
            window.sendTypingStatus = function(isTyping) {
                console.log("CLIENT A: Sending typing! My name:", window.username, 
                           "My room:", window.roomId, "Am I typing?:", isTyping);
                
                // Call the original function
                try {
                    originalSendTypingStatus(isTyping);
                    console.log("CLIENT A: Successfully called original sendTypingStatus");
                } catch (error) {
                    console.error("CLIENT A: Error in original sendTypingStatus:", error);
                }
            };
            
            console.log("DEBUG: Successfully intercepted sendTypingStatus function");
        } else {
            console.error("DEBUG: sendTypingStatus function not found!");
            
            // Create our own implementation if missing
            window.sendTypingStatus = function(isTyping) {
                console.log("CLIENT A: Using debug sendTypingStatus! My name:", window.username, 
                           "My room:", window.roomId, "Am I typing?:", isTyping);
                
                if (!window.socket || window.socket.readyState !== 1) {
                    console.error("CLIENT A: Socket not available for sending typing status");
                    return;
                }
                
                if (!window.roomId) {
                    console.error("CLIENT A: No roomId available for sending typing status");
                    return;
                }
                
                const typingMessage = {
                    type: 'typing',
                    isTyping: isTyping,
                    username: window.username,
                    roomId: window.roomId
                };
                
                try {
                    window.socket.send(JSON.stringify(typingMessage));
                    console.log("CLIENT A: Sent typing status:", typingMessage);
                } catch (error) {
                    console.error("CLIENT A: Error sending typing status:", error);
                }
            };
            
            console.log("DEBUG: Created new sendTypingStatus function");
        }
        
        // Intercept the socket message handler to debug typing events
        if (typeof window.handleSocketMessage === 'function') {
            const originalHandleSocketMessage = window.handleSocketMessage;
            
            window.handleSocketMessage = function(event) {
                try {
                    // Parse the message
                    const data = JSON.parse(event.data);
                    
                    // If it's a typing event, log it
                    if (data.type === 'typing') {
                        console.log("CLIENT B: Server told me about typing! Message:", data);
                        
                        // Check if the DOM elements exist
                        console.log("CLIENT B: typingIndicator element:", 
                                   document.getElementById('typing-indicator'));
                        console.log("CLIENT B: typingText element:", 
                                   document.getElementById('typing-text'));
                    }
                } catch (error) {
                    // Ignore parsing errors
                }
                
                // Call the original function
                return originalHandleSocketMessage(event);
            };
            
            console.log("DEBUG: Successfully intercepted handleSocketMessage function");
        } else {
            console.error("DEBUG: handleSocketMessage function not found!");
        }
        
        // Add a mutation observer to monitor the typing indicator's display property
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'attributes' && 
                        (mutation.attributeName === 'class' || mutation.attributeName === 'style')) {
                        console.log("CLIENT B: Typing indicator element changed:", 
                                   "class:", typingIndicator.className,
                                   "display:", window.getComputedStyle(typingIndicator).display);
                    }
                });
            });
            
            observer.observe(typingIndicator, { 
                attributes: true, 
                attributeFilter: ['class', 'style'] 
            });
            
            console.log("DEBUG: Set up mutation observer for typing indicator");
        } else {
            console.error("DEBUG: Typing indicator element not found for mutation observer");
        }
    }
    
    // Wait for the page to be fully loaded
    if (document.readyState === 'complete') {
        setupDebugListeners();
    } else {
        window.addEventListener('load', setupDebugListeners);
    }
})();
