// Minimal fix for typing indicator visibility and position on Render
(function() {
    'use strict'; // Enable strict mode for better security
    console.log('Typing indicator fix loaded');
    
    // Wait for DOM to be fully loaded
    if (document.readyState === 'complete') {
        applyFix();
    } else {
        window.addEventListener('load', applyFix);
    }
    
    function applyFix() {
        console.log('Applying typing indicator fix');
        
        // Disable skip sound
        if (window.playSound) {
            const originalPlaySound = window.playSound;
            window.playSound = function(soundType) {
                // Don't play the skip sound
                if (soundType === 'skip') {
                    return;
                }
                // Play other sounds normally
                originalPlaySound.call(this, soundType);
            };
        }
        
        // Add CSS to ensure typing indicator is visible and positioned correctly
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            /* Base styles for typing indicator */
            .typing-indicator {
                background-color: rgba(0, 0, 0, 0.7) !important;
                border-radius: 4px !important;
                padding: 4px 8px !important;
                font-size: 10px !important;
                max-width: 80% !important;
                border: none !important;
                box-shadow: none !important;
                z-index: 9999 !important;
                opacity: 0 !important;
                visibility: hidden !important;
                transition: opacity 0.3s ease, visibility 0.3s ease !important;
            }
            
            /* Remove shadow from message input */
            #message-input, .chat-message-input {
                box-shadow: none !important;
            }
            
            /* Desktop positioning - above chat input */
            @media (min-width: 769px) {
                .typing-indicator {
                    position: absolute !important;
                    bottom: 100% !important;
                    left: 30px !important;
                    margin-bottom: 5px !important;
                }
                
                /* Make chat input container relative for positioning */
                #chat-input-container {
                    position: relative !important;
                }
            }
            
            /* Mobile positioning */
            @media (max-width: 768px) {
                .typing-indicator {
                    position: fixed !important;
                    bottom: 70px !important;
                    left: 10px !important;
                }
            }
            
            /* Ensure visibility when active */
            .typing-indicator.active {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
            }
            
            /* Style the text */
            #typing-text {
                color: var(--accent-color, #00aaff) !important;
                font-size: 10px !important;
            }
            
            /* Hide the dots */
            .typing-indicator .typing-dot {
                display: none !important;
            }
        `;
        document.head.appendChild(styleElement);
        
        // Helper function to hide the typing indicator
        function hideTypingIndicator(indicator) {
            if (indicator) {
                indicator.classList.remove('active');
                indicator.style.opacity = '0';
                indicator.style.visibility = 'hidden';
                
                // Wait for transition to complete before hiding completely
                setTimeout(() => {
                    if (!indicator.classList.contains('active')) {
                        indicator.style.display = 'none';
                    }
                }, 300); // Match the transition duration
            }
        }
        
        // Directly patch the handleSocketMessage function to ensure typing indicator works
        const originalHandleSocketMessage = window.handleSocketMessage;
        
        window.handleSocketMessage = function(event) {
            // Call the original function first
            if (originalHandleSocketMessage) {
                originalHandleSocketMessage.call(this, event);
            }
            
            try {
                const data = JSON.parse(event.data);
                
                // Only handle typing events here
                if (data.type === 'typing' && data.username !== window.username) {
                    // Get typing indicator elements
                    const typingIndicator = document.getElementById('typing-indicator');
                    
                    if (!typingIndicator) {
                        return;
                    }
                    
                    if (data.isTyping) {
                        // Show typing indicator with partner's username
                        const typingText = document.getElementById('typing-text');
                        if (typingText) {
                            typingText.textContent = `${data.username} is typing...`;
                        }
                        
                        // Force styles directly
                        typingIndicator.classList.add('active');
                        typingIndicator.style.display = 'block';
                        typingIndicator.style.visibility = 'visible';
                        typingIndicator.style.opacity = '1';
                        
                        // Apply different styles based on screen size
                        if (window.innerWidth <= 768) {
                            // Mobile styles
                            typingIndicator.style.position = 'fixed';
                            typingIndicator.style.bottom = '70px';
                            typingIndicator.style.left = '10px';
                        } else {
                            // Desktop styles - position above chat input
                            typingIndicator.style.position = 'absolute';
                            typingIndicator.style.bottom = '100%';
                            typingIndicator.style.left = '30px';
                            
                            // Try to move the typing indicator to the chat input container for proper positioning
                            const chatInputContainer = document.getElementById('chat-input-container');
                            if (chatInputContainer && typingIndicator.parentElement !== chatInputContainer) {
                                chatInputContainer.appendChild(typingIndicator);
                            }
                        }
                        
                        typingIndicator.style.zIndex = '9999';
                        
                        // Add a safety timeout to hide the typing indicator after 5 seconds
                        // in case we miss the 'stop typing' event
                        if (window.typingHideTimeout) {
                            clearTimeout(window.typingHideTimeout);
                        }
                        
                        window.typingHideTimeout = setTimeout(() => {
                            hideTypingIndicator(typingIndicator);
                        }, 5000);
                    } else {
                        // Hide typing indicator when partner stops typing
                        hideTypingIndicator(typingIndicator);
                        
                        // Clear any existing timeout
                        if (window.typingHideTimeout) {
                            clearTimeout(window.typingHideTimeout);
                        }
                    }
                }
            } catch (error) {
                console.error('Fix: Error in typing indicator fix:', error);
                // Don't expose detailed error information
                // Just silently fail instead of potentially exposing sensitive information
            }
        };
        
        // Add a listener for when the chat screen becomes active
        const chatScreen = document.getElementById('chat-screen');
        if (chatScreen) {
            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type === 'attributes' && 
                        mutation.attributeName === 'class' && 
                        chatScreen.classList.contains('active')) {
                        // Ensure the typing indicator is properly positioned
                        const typingIndicator = document.getElementById('typing-indicator');
                        if (typingIndicator) {
                            typingIndicator.style.order = '9999';
                        }
                    }
                }
            });
            
            observer.observe(chatScreen, { 
                attributes: true,
                attributeFilter: ['class']
            });
        }
    }
})();
