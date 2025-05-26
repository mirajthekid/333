// Global variables
let socket;
let userId;
let username;
let partnerUsername = null;
let roomId = null;
let skipCountdownTimer = null;
let typingTimer = null;
let isTyping = false;
let reconnectAttempts = 0;
let maxReconnectAttempts = 3;
let reconnectBackoff = 2000; // Start with 2 seconds
let onlineUsersCount = 0; // Track online users count

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const waitingScreen = document.getElementById('waiting-screen');
const chatScreen = document.getElementById('chat-screen');
const skipOverlay = document.getElementById('skip-overlay');
const cancelSkipBtn = document.getElementById('cancel-skip-btn'); // Cancel skip button
const connectionLabel = document.querySelector('.connection-label'); // Connection label for online count

const usernameInput = document.getElementById('username-input');
const loginStatus = document.getElementById('login-status');

const waitingStatus = document.getElementById('waiting-status');
const cancelSearchBtn = document.getElementById('cancel-search-btn');

const chatMessages = document.getElementById('chat-messages');
const skipBtn = document.getElementById('skip-btn');
const skipCountdown = document.getElementById('skip-countdown');

// Get DOM elements
const typingIndicator = document.getElementById('typing-indicator');
const typingText = document.getElementById('typing-text');
const chatInputContainer = document.getElementById('chat-input-container');

// Input will be set dynamically
let messageInput = null;

// WebSocket server URL - dynamically determine protocol and port
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const port = window.location.port ? `:${window.location.port}` : '';
const WS_URL = `${protocol}//${window.location.hostname}${port}`;

// Initialize the application
// Handle mobile viewport resizing when keyboard appears/disappears
function handleMobileResize() {
    if (chatScreen.classList.contains('active')) {
        // Prevent default scrolling behavior
        window.scrollTo(0, 0);
        
        // Scroll chat messages to bottom
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            // On iOS devices, we need to handle the viewport differently
            if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                // Lock the viewport height
                const viewportHeight = window.innerHeight;
                document.documentElement.style.height = viewportHeight + 'px';
                document.body.style.height = viewportHeight + 'px';
                
                // Force scroll to top to prevent shifting
                window.scrollTo(0, 0);
            }
        }, 100);
    }
}

// Prevent viewport issues on mobile
function preventViewportIssues() {
    // For iOS devices
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        // Set a fixed viewport height
        const viewportHeight = window.innerHeight;
        document.documentElement.style.height = viewportHeight + 'px';
        document.body.style.height = viewportHeight + 'px';
        
        // Prevent scrolling on the body
        document.body.style.overflow = 'hidden';
        
        // Prevent zoom on input focus
        const metaViewport = document.querySelector('meta[name=viewport]');
        if (metaViewport) {
            metaViewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        } else {
            const meta = document.createElement('meta');
            meta.name = 'viewport';
            meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
            document.head.appendChild(meta);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Ensure utils is loaded
    if (!window.utils) {
        console.error('Utils module not loaded. Some security features may not work.');
    }
    // Apply mobile viewport fixes
    preventViewportIssues();
    
    // Set up cancel button listener if it exists
    if (cancelSkipBtn) {
        cancelSkipBtn.addEventListener('click', cancelSkipBtnHandler);
    }
    
    // Make the entire body activate username input on login page for mobile
    document.body.addEventListener('click', (e) => {
        // Only do this when login screen is active
        if (loginScreen.classList.contains('active')) {
            // Don't interfere with actual button clicks
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                return;
            }
            
            // Focus the username input
            if (usernameInput) {
                usernameInput.focus();
            }
        }
    });
    
    // Immediately focus the username input on page load for mobile
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        // For mobile devices, use a more aggressive approach to focus
        setTimeout(() => {
            if (usernameInput) {
                // This sequence helps ensure focus on various mobile browsers
                usernameInput.click();
                usernameInput.focus();
                // Some mobile browsers need this trick
                usernameInput.blur();
                usernameInput.focus();
            }
        }, 500); // Slightly longer delay for mobile browsers
    }
    // Create chat input element dynamically
    function createChatInput() {
        // Check if input already exists
        if (document.getElementById('message-input')) {
            return;
        }
        
        // Clear the container first
        chatInputContainer.innerHTML = '';
        
        // Create input
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'message-input';
        input.className = 'chat-message-input';
        input.autocomplete = 'off';
        input.placeholder = '';
        input.inputMode = 'text'; // Better keyboard on mobile
        input.enterKeyHint = 'send'; // Show send button on mobile keyboard
        
        // Add event listener for sending messages
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
        
        // Add event for mobile keyboard's done/send button
        input.addEventListener('keyup', (e) => {
            if (e.keyCode === 13 || e.key === 'Enter') {
                sendMessage();
            }
        });
        
        // Handle mobile keyboard done button (blur event)
        input.addEventListener('blur', () => {
            // On mobile, when the keyboard is dismissed, check if there's a message
            if (input.value.trim() && chatScreen.classList.contains('active')) {
                // Small delay to ensure this was an intentional blur (like pressing "done")
                setTimeout(() => {
                    // Only proceed if the input is still not focused and we're still on chat screen
                    if (document.activeElement !== input && chatScreen.classList.contains('active') && input.value.trim()) {
                        sendMessage();
                    }
                }, 300);
            }
        });
        
        // Add multiple event listeners for typing indicator to ensure it triggers
        input.addEventListener('input', handleTypingEvent);
        input.addEventListener('keydown', handleTypingEvent);
        input.addEventListener('keyup', handleTypingEvent);
        
        // Append input to container
        chatInputContainer.appendChild(input);
        
        // Update the global reference
        messageInput = input;
        
        console.log('Chat input created and added to container');
    }
    
    // Override showScreen function to add chat input when needed
    // Preserve original showScreen if it exists, otherwise define a basic one
    const originalShowScreenFn = window.showScreen;
    window.showScreen = function(screen) {
        // Call original function or basic implementation
        if (typeof originalShowScreenFn === 'function' && screen !== chatScreen) { // Avoid double call for chatScreen
            originalShowScreenFn(screen);
        } else {
            // Hide all screens
            document.querySelectorAll('.terminal-screen').forEach(s => {
                s.classList.remove('active');
            });
            
            // Show the requested screen
            if (screen) {
              screen.classList.add('active');
            }
        }
        
        // Clear the chat input container if not showing chat screen
        if (screen !== chatScreen) {
            if (chatInputContainer) {
                chatInputContainer.innerHTML = '';
            }
        }
        
        // If showing chat screen, create chat input and focus it
        if (screen === chatScreen) {
            createChatInput();
            
            // Focus the message input after a short delay to ensure it's created
            setTimeout(() => {
                const currentMessageInput = document.getElementById('message-input');
                if (currentMessageInput) {
                    // Scroll chat to bottom first
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                    
                    // For mobile, don't auto-focus to prevent keyboard from popping up automatically
                    // and causing layout issues
                    if (!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                        // Only focus automatically on desktop
                        currentMessageInput.focus();
                    } else {
                        // On mobile, just add the resize listener without forcing focus
                        window.addEventListener('resize', handleMobileResize);
                    }
                }
            }, 100);
        }
        
        // If showing login screen, ensure username input is focused
        if (screen === loginScreen) {
            // Focus the username input after a short delay
            setTimeout(() => {
                if (usernameInput) {
                    // For mobile, use multiple techniques to ensure focus
                    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                        // Programmatically click the input first
                        usernameInput.click();
                        usernameInput.focus();
                        // Some mobile browsers need this blur/focus sequence
                        usernameInput.blur();
                        usernameInput.focus();
                        
                        // For iOS specifically
                        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                            usernameInput.setAttribute('readonly', 'readonly');
                            setTimeout(() => {
                                usernameInput.removeAttribute('readonly');
                                usernameInput.click();
                                usernameInput.focus();
                            }, 100);
                        }
                    } else {
                        // For desktop
                        usernameInput.focus();
                    }
                }
            }, 300); // Longer delay for more reliable focus on mobile
        }
    };
    
    // Focus username input on page load
    if (usernameInput) usernameInput.focus();
    
    // Event listeners for username input
    if (usernameInput) {
        usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
        
        // Handle mobile keyboard "done" or "go" button
        usernameInput.addEventListener('keyup', (e) => {
            // Check for Enter key (which is 13) for compatibility with mobile keyboards
            if (e.keyCode === 13 || e.key === 'Enter') {
                handleLogin();
            }
        });
        
        // Handle mobile keyboard done button (blur event)
        usernameInput.addEventListener('blur', () => {
            // On mobile, when the keyboard is dismissed, check if there's a username
            // and if we're still on the login screen
            if (usernameInput.value.trim() && loginScreen.classList.contains('active')) {
                // Small delay to ensure this was an intentional blur (like pressing "done")
                // and not just clicking elsewhere on the screen
                setTimeout(() => {
                    // Only proceed if the input is still not focused and we're still on login screen
                    if (document.activeElement !== usernameInput && loginScreen.classList.contains('active')) {
                        handleLogin();
                    }
                }, 300);
            }
        });
    }
    
    // Make login screen clickable to focus the username input
    if (loginScreen && usernameInput) {
        loginScreen.addEventListener('click', (e) => {
            // Don't focus if clicking on a button
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                return;
            }
            usernameInput.focus();
        });
    }


    // Handle login function
    function handleLogin() {
        if (!usernameInput) return;
        username = usernameInput.value.trim();
        
        if (!username) {
            if(loginStatus) {
                loginStatus.textContent = 'Username cannot be empty';
                loginStatus.classList.add('error');
            }
            return;
        }
        
        // Show waiting screen
        showScreen(waitingScreen);
        if(waitingStatus) waitingStatus.textContent = 'Connecting to server...';
        
        // Initialize WebSocket connection
        connectToServer();
    }

    // Connect to WebSocket server
    function connectToServer() {
        // Close existing socket if any
        if (socket) {
            socket.close();
        }
        
        try {
            // Create WebSocket connection
            socket = new WebSocket(WS_URL);
            
            // Connection opened
            socket.addEventListener('open', (event) => {
                console.log('Connected to server');
                if(waitingStatus) waitingStatus.textContent = 'Connected! Waiting for a chat partner...';
                
                // Send login message
                socket.send(JSON.stringify({
                    type: 'login',
                    username: username
                }));
            });
            
            // Listen for messages
            socket.addEventListener('message', handleSocketMessage);
            
            // Connection closed
            socket.addEventListener('close', (event) => {
                console.log('Disconnected from server');
                handleDisconnect();
            });
            
            // Connection error
            socket.addEventListener('error', (event) => {
                console.error('WebSocket error:', event);
                handleConnectionError();
            });
        } catch (error) {
            console.error('Error connecting to server:', error);
            handleConnectionError();
        }
    }

    if (cancelSearchBtn) cancelSearchBtn.addEventListener('click', handleCancelSearch);
    
    // Message input event listeners will be added when the element is created
    
    // Allow typing anywhere on the screen except when clicking buttons
    document.addEventListener('click', (e) => {
        if (chatScreen.classList.contains('active')) {
            // Don't focus input if a button was clicked
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                return;
            }
            
            const currentMessageInput = document.getElementById('message-input');
            if (currentMessageInput) {
                currentMessageInput.focus();
            }
        }
    });
    
    // Auto-focus input when entering chat
    // const autoFocusInput = () => { // This function was defined but not called.
    //     if (chatScreen.classList.contains('active')) {
    //         const currentMessageInput = document.getElementById('message-input');
    //         if (currentMessageInput) {
    //             currentMessageInput.focus();
    //         }
    //     }
    // };
    
    // Skip functionality
    if (skipBtn) {
        // Remove any existing event listeners first
        // skipBtn.removeEventListener('click', initiateSkip); // No, this would remove the one below if script re-runs
        const newSkipBtn = skipBtn.cloneNode(true);
        skipBtn.parentNode.replaceChild(newSkipBtn, skipBtn);
        
        newSkipBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Skip button clicked');
            initiateSkip();
        });
        // Update the global skipBtn reference
        window.skipBtn = newSkipBtn; 
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (skipOverlay && skipOverlay.classList.contains('active')) {
                cancelSkip();
            } else if (chatScreen && chatScreen.classList.contains('active')) {
                console.log('ESC key pressed, initiating skip');
                initiateSkip();
            }
        }
    });
    
    // No report functionality needed anymore
});

// Handle WebSocket messages
function handleSocketMessage(event) {
    console.log('Raw message data:', event.data);
    
    try {
        const data = JSON.parse(event.data);
        console.log('Parsed message data:', data);
        
        // Check message type
        switch (data.type) {
            case 'online_count':
                // Update online count
                onlineUsersCount = data.count;
                updateOnlineCount();
                break;
                
            case 'matched':
                // Handle match with another user
                roomId = data.roomId;
                partnerUsername = data.partner; // Assuming backend sends 'partner'
                const partnerCountryCode = data.partnerCountry; // EXPECTING THIS FROM BACKEND

                showScreen(chatScreen);
                if (chatMessages) chatMessages.innerHTML = ''; // Clear previous messages
                
                const messageContainer = document.createDocumentFragment();
                messageContainer.appendChild(document.createTextNode("You are now chatting with " + partnerUsername + " "));
                
                if (typeof createCountryFlagElement === 'function' && partnerCountryCode) {
                    const flagImgElement = createCountryFlagElement(partnerCountryCode);
                    if (flagImgElement) {
                        messageContainer.appendChild(flagImgElement);
                    }
                }
                displayMessage(messageContainer, null, 'system');
                
                if (messageInput) messageInput.focus(); // Auto-focus message input
                break;
                
            case 'message':
                // Display message
                displayMessage(data.content, data.sender, 'message', data.timestamp);
                break;
                
            case 'typing':
                // Handle typing indicator
                console.log('Received typing status:', data);
                if (typingIndicator && typingText) {
                    if (data.username !== username) {  // Don't show our own typing indicator
                        if (data.isTyping) {
                            // Show typing indicator with partner's username
                            console.log('Showing typing indicator for:', data.username);
                            typingText.textContent = `${data.username} is typing...`;
                            typingIndicator.classList.add('active');
                        } else {
                            // Hide typing indicator
                            console.log('Hiding typing indicator');
                            typingIndicator.classList.remove('active');
                        }
                    }
                }
                break;
                
            case 'skip_notification': // Assuming this is what the server sends for partner initiating skip
                // Handle skip notification from partner
                if (data.username) { // Check if username is provided in skip_notification
                     displayMessage(`${data.username} initiated skip protocol`, null, 'system');
                } else {
                     displayMessage(`Your partner initiated skip protocol`, null, 'system');
                }
                // The actual skip (room closure, etc.) should be handled by 'partner_skipped' or 'disconnected'
                break;

            case 'partner_skipped': // This event should trigger finding a new partner
            case 'partner_disconnected':
                let eventMessage = data.message || `${partnerUsername || 'Your partner'} has disconnected.`;
                if (data.type === 'partner_skipped' && data.username) {
                    eventMessage = `${data.username} has left the conversation.`;
                }
                showSystemMessage(eventMessage);
                
                const oldRoomIdForSkip = roomId;
                roomId = null;
                partnerUsername = null;

                if (typingIndicator) typingIndicator.classList.remove('active');

                setTimeout(() => {
                    if (chatScreen.classList.contains('active') || waitingScreen.classList.contains('active')) { // Check if user hasn't already navigated away
                        if(chatMessages) chatMessages.innerHTML = '';
                        showScreen(waitingScreen);
                        if(waitingStatus) updateWaitingStatus('Finding a new connection...');
                        
                        if (socket && socket.readyState === WebSocket.OPEN) {
                            // Re-login to get into the queue
                            console.log('Re-sending login to find new partner after partner skip/disconnect.');
                            socket.send(JSON.stringify({ type: 'login', username: username }));
                        }
                    }
                }, 2000); // Delay before re-queueing
                break;
                
            case 'system':
                // Display system message
                displayMessage(data.content, null, 'system', data.timestamp);
                break;

            case 'login_success':
                userId = data.userId;
                console.log('Login successful, userId:', userId);
                showScreen(waitingScreen);
                if(waitingStatus) updateWaitingStatus('Waiting for a partner...');
                break;
            
            case 'login_error':
                showScreen(loginScreen);
                if(loginStatus) {
                    loginStatus.textContent = data.message || 'Login failed. Please try again.';
                    loginStatus.classList.add('error');
                }
                break;

            case 'report_acknowledged':
                 if(data.message) showSystemMessage(data.message);
                 break;

            default:
                console.warn('Unknown message type:', data.type);
        }
    } catch (error) {
        console.error('Error parsing message:', error, event.data);
    }
}


// Handle disconnect
function handleDisconnect() {
    showScreen(loginScreen);
    if(loginStatus) {
        loginStatus.textContent = 'Disconnected from server. Please try again.';
        loginStatus.classList.add('error');
    }
    resetChatState();
}

// Handle connection error
function handleConnectionError() {
    showScreen(loginScreen);
     if(loginStatus) {
        loginStatus.textContent = 'Error connecting to server. Please try again.';
        loginStatus.classList.add('error');
    }
    resetChatState();
}

// Reset chat state
function resetChatState() {
    roomId = null;
    partnerUsername = null;
    isTyping = false;
    
    if (typingTimer) {
        clearTimeout(typingTimer);
        typingTimer = null;
    }
    
    if (skipCountdownTimer) {
        clearInterval(skipCountdownTimer);
        skipCountdownTimer = null;
    }
     if (typingIndicator) {
        typingIndicator.classList.remove('active');
    }
}

// Handle cancel search
function handleCancelSearch() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'cancel_search' })); // Notify server
        socket.close(); // Close the connection from client-side
    }
    showScreen(loginScreen);
    if(loginStatus) {
        loginStatus.textContent = 'Search cancelled. You may connect again.';
        loginStatus.style.color = 'var(--notification-color)'; // Use notification color
    }
    if(usernameInput) {
        usernameInput.value = ''; // Clear username for fresh start
        usernameInput.focus();
    }
    resetChatState();
}

// Update online count
function updateOnlineCount() {
    if (connectionLabel) {
        connectionLabel.textContent = `ONLINE TYPERS: ${onlineUsersCount}`;
    }
}

// Display a message in the chat
function displayMessage(content, sender, type = 'message', timestamp = null) {
    if (!chatMessages) return;
    // Create message element
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    if (type === 'system') {
        messageElement.classList.add('system');
        if (typeof content === 'string') {
            messageElement.textContent = content;
        } else if (content instanceof Node) { // Handle DocumentFragment or single DOM element
            messageElement.appendChild(content.cloneNode(true)); // Clone to avoid issues if content is reused
        }
    } else {
        messageElement.classList.add(sender === username ? 'outgoing' : 'incoming');
        // Create message wrapper for better styling
        const messageWrapper = document.createElement('div');
        messageWrapper.className = 'message-wrapper';
        
        // Add timestamp first if provided (to position it on the left)
        if (timestamp) {
            const timeSpan = document.createElement('span');
            timeSpan.className = 'message-timestamp';
            timeSpan.textContent = formatTimestamp(timestamp);
            messageWrapper.appendChild(timeSpan);
        }
        
        // Add sender name
        const senderSpan = document.createElement('span');
        senderSpan.className = 'message-sender';
        senderSpan.textContent = sender === username ? `${username}:` : `${sender}:`;
        messageWrapper.appendChild(senderSpan);
        
        // Add message content with glitch effect
        const contentSpan = document.createElement('span');
        contentSpan.className = 'message-content';
        
        if (typeof content === 'string') {
            contentSpan.appendChild(glitchText(content));
        } else if (content instanceof Node) { // Should not happen for non-system messages with current logic
            contentSpan.appendChild(content.cloneNode(true));
        }
        
        messageWrapper.appendChild(contentSpan);
        messageElement.appendChild(messageWrapper);
    }
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Send a message
function sendMessage() {
    if (!messageInput) return;
    const content = messageInput.value.trim();
    if (!content) return;
    
    messageInput.value = '';
    
    if (isTyping) { // If user was typing, send stop typing
        isTyping = false;
        sendTypingStatus(false); 
    }
    
    // Display message locally first for immediate feedback
    displayMessage(content, username, 'message', Date.now()); // Add timestamp for local message
    
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'message',
            content: content, // Send sanitized content
            username: username, // Send current username
            roomId: roomId
        }));
    } else {
        displayMessage('Error: Not connected to server', null, 'system');
    }
}

// Glitch text effect function
function glitchText(text) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    const hackingChars = '01░▒▓█▄▀■□▪▫▬▲►▼◄◊○●◘◙◦☺☻☼♀♂♠♣♥♦♪♫';
    const glitchDuration = 800; // ms
    const glitchSteps = 15;
    const stepDuration = glitchDuration / glitchSteps;
    
    let currentStep = 0;
    const originalText = text;
    const textLength = text.length;
    
    const glitchSpan = document.createElement('span');
    glitchSpan.classList.add('glitch-text');
    glitchSpan.setAttribute('data-text', text); // For CSS pseudo-elements if used
    glitchSpan.textContent = text; // Start with original text, or apply initial scramble if desired

    // If you want an initial scramble effect that resolves:
    // glitchSpan.textContent = text.replace(/[a-zA-Z0-9]/g, () => hackingChars.charAt(Math.floor(Math.random() * hackingChars.length)));
    // const glitchInterval = setInterval(() => { ... }); // then proceed with interval logic
    // For now, keeping it simple as the primary glitch is on hover via CSS in styles.css
    
    return glitchSpan;
}


// Send login request to server
function sendLoginRequest() {
    console.log(`Preparing to send login request for username: ${username}`);
    try {
        const loginData = {
            type: 'login',
            username: username
        };
        const loginJSON = JSON.stringify(loginData);
        console.log(`Sending login data: ${loginJSON}`);
        socket.send(loginJSON);
        console.log('Login request sent successfully');
    } catch (error) {
        console.error('Error sending login request:', error);
         if(loginStatus) {
            loginStatus.textContent = 'Error sending login request. Please try again.';
            loginStatus.style.color = 'var(--error-color)';
        }
    }
    
    showScreen(waitingScreen);
    updateWaitingStatus('Establishing secure connection...');
    
    const waitingMessages = [
        'Searching for available users...', 'Waiting for someone to connect...',
        'Looking for a chat partner...', 'Waiting for another user to join...',
        'Pairing users in order...', 'Still waiting for a match...',
        'You are in the queue. Will be matched when another user joins...',
        'Secure connection established. Waiting for a partner...',
        'Patience is a virtue. Waiting for your match...',
        'You will be paired with the next person who joins...'
    ];
    
    let messageIndex = 0;
    if (window.waitingStatusInterval) clearInterval(window.waitingStatusInterval); // Clear previous interval
    window.waitingStatusInterval = setInterval(() => {
        if (!waitingScreen || !waitingScreen.classList.contains('active')) {
            clearInterval(window.waitingStatusInterval);
            return;
        }
        messageIndex = (messageIndex + 1) % waitingMessages.length;
        updateWaitingStatus(waitingMessages[messageIndex]);
    }, 3000);
}


// Show system message
function showSystemMessage(message) {
    displayMessage(message, null, 'system');
}

// Handle typing event
function handleTypingEvent(event) {
    if (event && event.type === 'keydown' && 
        (event.ctrlKey || event.altKey || event.metaKey || 
         ['Control', 'Alt', 'Meta', 'Shift', 'CapsLock', 'Escape', 'Tab', 
          'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key))) {
        return;
    }
    
    if (!roomId || !partnerUsername || !socket || socket.readyState !== WebSocket.OPEN) {
        return;
    }
    
    const currentInput = document.getElementById('message-input');
    if (!currentInput) return;
    
    const currentlyTyping = currentInput.value.length > 0;
    
    clearTimeout(typingTimer); // Clear existing timer
    
    if (currentlyTyping) {
        if (!isTyping) { // Only send if state changed to typing
            isTyping = true;
            sendTypingStatus(true);
        }
        // Set a new timer to mark as not typing if no input for 1.5s
        typingTimer = setTimeout(() => {
            isTyping = false;
            sendTypingStatus(false);
        }, 1500);
    } else { // Input is empty
        if (isTyping) { // Only send if state changed to not typing
            isTyping = false;
            sendTypingStatus(false);
        }
    }
}

// Helper function to send typing status
function sendTypingStatus(isTypingStatus) {
    if (!socket || socket.readyState !== WebSocket.OPEN || !roomId || !username) {
        // console.error('Cannot send typing status: socket/room/username unavailable.');
        return;
    }
    const typingMessage = { type: 'typing', isTyping: isTypingStatus, username: username, roomId: roomId };
    try {
        socket.send(JSON.stringify(typingMessage));
        // console.log(`Sent typing status: ${isTypingStatus}`);
    } catch (error) {
        // console.error('Error sending typing status:', error);
    }
}

// Initiate skip
function initiateSkip() {
    console.log('Initiating skip...');
    if (!skipBtn) return; // Ensure skipBtn exists
    
    // Prevent multiple skip initiations
    if (skipOverlay && skipOverlay.classList.contains('active')) {
        console.log('Skip already in progress.');
        return;
    }

    try {
        const skipMsgContent = `${username} initiated skip protocol`;
        const existingSystemMessages = chatMessages.querySelectorAll('.message.system');
        let alreadyShown = false;
        existingSystemMessages.forEach(msg => {
            if (msg.textContent === skipMsgContent) {
                alreadyShown = true;
            }
        });
        if (!alreadyShown) {
            showSystemMessage(skipMsgContent);
        }
        
        if (socket && socket.readyState === WebSocket.OPEN && roomId) {
            socket.send(JSON.stringify({ type: 'skip_notification', username: username, roomId: roomId }));
            console.log('Skip notification sent to partner');
        }
    } catch (error) {
        console.error('Error during skip initiation (message/notification):', error);
    }
    
    if (skipOverlay) skipOverlay.classList.add('active');
    
    // Play sound
    try {
        // Simplified sound for broad compatibility, ensure you have a beep or similar short sound.
        // const beepSound = new Audio('path_to_your_beep_sound.wav'); // Replace with actual path or data URI
        // beepSound.volume = 0.2;
        // beepSound.play();
    } catch (error) {
        console.error('Error playing sound:', error);
    }
    
    let countdown = 3;
    if(skipCountdown) skipCountdown.textContent = countdown;
    
    if (skipCountdownTimer) clearInterval(skipCountdownTimer); // Clear existing timer
    skipCountdownTimer = setInterval(() => {
        countdown--;
        if(skipCountdown) {
            skipCountdown.textContent = countdown;
            skipCountdown.classList.add('pulse'); // Add pulse animation
            setTimeout(() => skipCountdown.classList.remove('pulse'), 200); // Remove after animation
        }
        
        if (countdown <= 0) {
            clearInterval(skipCountdownTimer);
            skipCountdownTimer = null;
            completeSkip();
        }
    }, 1000);
}

// Cancel skip button handler
function cancelSkipBtnHandler(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    console.log('Cancel skip button clicked');
    if (skipOverlay && skipOverlay.classList.contains('active') && skipCountdownTimer) {
        cancelSkip();
    }
}

// Cancel skip
function cancelSkip() {
    console.log('Cancelling skip process...');
    if (skipCountdownTimer) {
        clearInterval(skipCountdownTimer);
        skipCountdownTimer = null;
    }
    if (skipOverlay) skipOverlay.classList.remove('active');
    
    // Notify server about skip cancellation (optional, depends on backend handling)
    // if (socket && socket.readyState === WebSocket.OPEN && roomId) {
    //     socket.send(JSON.stringify({ type: 'skip_cancel', userId: userId, roomId: roomId }));
    // }
    showSystemMessage(`${username} cancelled the skip sequence.`);
    console.log('Skip process cancelled');
}

// Complete skip
function completeSkip() {
    if (skipCountdownTimer) clearInterval(skipCountdownTimer);
    skipCountdownTimer = null;

    if (skipOverlay) skipOverlay.classList.remove('active');
    
    const oldRoomId = roomId; // Store current room ID before resetting
    resetChatState(); // Reset local state like partnerUsername, roomId
    
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'skip', // This message should tell the server to find a new partner
            username: username,
            roomId: oldRoomId // Important for server to know which room was skipped
        }));
        
        if (chatMessages) chatMessages.innerHTML = ''; // Clear messages from old chat
        if (typingIndicator) typingIndicator.classList.remove('active');
        
        showScreen(waitingScreen);
        updateWaitingStatus('Finding a new connection...');
        // Server should handle putting this user back in the queue and sending a new 'matched' event
        // No need to send 'login' again from here if 'skip' implies re-queueing on backend.
        // If backend requires 'login' to re-queue, then it would be:
        // setTimeout(() => {
        //    if (waitingScreen.classList.contains('active') && socket && socket.readyState === WebSocket.OPEN) {
        //        socket.send(JSON.stringify({ type: 'login', username: username }));
        //    }
        // }, 500);
    } else {
        showSystemMessage('Cannot skip: Not connected to server.');
        showScreen(loginScreen); // Go back to login if not connected
    }
}


// Report user (remains for completeness, ensure backend handles this)
function reportUser() {
    if (socket && socket.readyState === WebSocket.OPEN && partnerUsername) {
        socket.send(JSON.stringify({
            type: 'report',
            reportedUser: partnerUsername,
            reportingUser: username,
            roomId: roomId
        }));
        showSystemMessage(`Report for ${partnerUsername} sent. Thank you.`);
    }
}

// Main showScreen function (ensure it's correctly defined globally or imported if in a module)
// window.showScreen = function(screenId) { ... } // if it's global
// Basic version if not already complexly defined elsewhere:
function showScreen(screenElement) {
    if (!screenElement) return;
    // Hide all screens
    [loginScreen, waitingScreen, chatScreen].forEach(s => {
        if(s) s.classList.remove('active');
    });
    // Show the requested screen
    screenElement.classList.add('active');

    // Specific logic for chat screen
    if (screenElement === chatScreen) {
        if (document.querySelector('.connection-info')) {
            document.querySelector('.connection-info').style.visibility = 'visible';
            updateOnlineUsersDisplay();
        }
        if (document.getElementById('chat-messages')) {
            document.getElementById('chat-messages').style.display = 'block'; // Or 'flex' if it's a flex container
        }
         // Ensure chat input is created if it's not there
        const currentMessageInput = document.getElementById('message-input');
        if (!currentMessageInput && chatInputContainer) { // And chatInputContainer exists
            // Call the function that creates the input
            // This assumes createChatInput() is available in this scope
             if (typeof createChatInput === "function") createChatInput();

        } else if (currentMessageInput) {
            // If input exists, try to focus it (mainly for desktop)
             if (!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                currentMessageInput.focus();
            }
        }


    } else { // For screens other than chatScreen
        if (document.querySelector('.connection-info')) {
            document.querySelector('.connection-info').style.visibility = 'hidden';
        }
        if (document.getElementById('chat-messages')) {
            document.getElementById('chat-messages').style.display = 'none';
        }
         if (typingIndicator) { // Also hide typing indicator
            typingIndicator.classList.remove('active');
            typingIndicator.style.display = 'none';
        }
         if (chatInputContainer) { // And clear/hide chat input container
            chatInputContainer.innerHTML = ''; // Clear it
            chatInputContainer.style.display = 'none'; // Hide it
        }
    }
     // Ensure chat input container is displayed only on chat screen
    if (chatInputContainer) {
        chatInputContainer.style.display = (screenElement === chatScreen) ? 'flex' : 'none';
    }
}


function updateWaitingStatus(message) {
    if(waitingStatus) waitingStatus.textContent = message;
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Update the online users count display
function updateOnlineUsersDisplay() {
    const connLabel = document.querySelector('.connection-label');
    if (connLabel) {
        connLabel.innerHTML = `ONLINE: <span style="color: var(--accent-color); font-weight: bold;">${onlineUsersCount}</span>`;
    }
}