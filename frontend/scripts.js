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
    window.originalShowScreen = window.showScreen;
    window.showScreen = function(screen) {
        // Call original function
        if (window.originalShowScreen) {
            window.originalShowScreen(screen);
        } else {
            // Hide all screens
            document.querySelectorAll('.terminal-screen').forEach(s => {
                s.classList.remove('active');
            });
            
            // Show the requested screen
            screen.classList.add('active');
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
    usernameInput.focus();
    
    // Event listeners for username input
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
    
    // Make login screen clickable to focus the username input
    loginScreen.addEventListener('click', (e) => {
        // Don't focus if clicking on a button
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
            return;
        }
        usernameInput.focus();
    });

    // Handle login function
    function handleLogin() {
        username = usernameInput.value.trim();
        
        if (!username) {
            loginStatus.textContent = 'Username cannot be empty';
            loginStatus.classList.add('error');
            return;
        }
        
        // Show waiting screen
        showScreen(waitingScreen);
        waitingStatus.textContent = 'Connecting to server...';
        
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
                waitingStatus.textContent = 'Connected! Waiting for a chat partner...';
                
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

    cancelSearchBtn.addEventListener('click', handleCancelSearch);
    
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
    const autoFocusInput = () => {
        if (chatScreen.classList.contains('active')) {
            const currentMessageInput = document.getElementById('message-input');
            if (currentMessageInput) {
                currentMessageInput.focus();
            }
        }
    };
    
    // Skip functionality
    // Remove any existing event listeners first
    skipBtn.removeEventListener('click', initiateSkip);
    // Add fresh event listener
    skipBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Skip button clicked');
        initiateSkip();
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (skipOverlay.classList.contains('active')) {
                cancelSkip();
            } else if (chatScreen.classList.contains('active')) {
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
                
            case 'match':
                // Handle match with another user
                handleMatch(data);
                break;
                
            case 'message':
                // Display message
                displayMessage(data.content, data.sender, 'message', data.timestamp);
                break;
                
                        case 'typing':
                // Handle typing indicator
                console.log('Received typing status:', data);
                if (data.username !== username) {  // Don't show our own typing indicator
                    if (data.isTyping) {
                        // Show typing indicator with partner's username
                        console.log('Showing typing indicator for:', data.username);
                        if (typingText) {
                            typingText.textContent = `${data.username} is typing...`;
                        }
                        if (typingIndicator) {
                            typingIndicator.classList.add('active');
                        }
                    } else {
                        // Hide typing indicator
                        console.log('Hiding typing indicator');
                        if (typingIndicator) {
                            typingIndicator.classList.remove('active');
                        }
                    }
                }
                break;
                
            case 'skip_notification':
                // Handle skip notification from partner
                handlePartnerSkip(data.username);
                break;
                
            case 'system':
                // Display system message
                displayMessage(data.content, null, 'system', data.timestamp);
                break;
                
            default:
                console.warn('Unknown message type:', data.type);
        }
    } catch (error) {
        console.error('Error parsing message:', error);
    }
}

// Handle match with another user
function handleMatch(data) {
    roomId = data.roomId;
    partnerUsername = data.partnerUsername;
    
    // Show chat screen
    showScreen(chatScreen);
    
    // Display system message about the match
    displayMessage(`Connected with ${partnerUsername}`, null, 'system');
    
    // Clear any previous messages
    // chatMessages.innerHTML = '';
    
    // Auto-focus message input
    messageInput.focus();
}

// Handle partner skip
function handlePartnerSkip(skipUsername) {
    // Only process if it's from our partner
    if (skipUsername === partnerUsername) {
        displayMessage(`${partnerUsername} initiated skip protocol`, null, 'system');
        
        // Show skip overlay
        skipOverlay.classList.add('active');
    }
}

// Handle disconnect
function handleDisconnect() {
    // Show login screen
    showScreen(loginScreen);
    
    // Display error message
    loginStatus.textContent = 'Disconnected from server. Please try again.';
    loginStatus.classList.add('error');
    
    // Reset variables
    resetChatState();
}

// Handle connection error
function handleConnectionError() {
    // Show login screen
    showScreen(loginScreen);
    
    // Display error message
    loginStatus.textContent = 'Error connecting to server. Please try again.';
    loginStatus.classList.add('error');
    
    // Reset variables
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
}

// Handle cancel search
function handleCancelSearch() {
    // Close socket
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
    }
    
    // Show login screen
    showScreen(loginScreen);
    
    // Reset variables
    resetChatState();
}

// Update online count
function updateOnlineCount() {
    const connectionLabel = document.querySelector('.connection-label');
    if (connectionLabel) {
        connectionLabel.textContent = `ONLINE TYPERS: ${onlineUsersCount}`;
    }
}

// Display a message in the chat
function displayMessage(content, sender, type = 'message', timestamp = null) {
    // Create message element
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    // Add appropriate class based on message type
    if (type === 'system') {
        messageElement.classList.add('system');
    } else if (sender === username) {
        messageElement.classList.add('outgoing');
    } else {
        messageElement.classList.add('incoming');
    }
    
    // Set message content - using textContent which automatically escapes HTML
    messageElement.textContent = type === 'system' ? content : (sender === username ? content : `${content}`);
    
    // Add timestamp if provided
    if (timestamp) {
        const timestampElement = document.createElement('span');
        timestampElement.classList.add('timestamp');
        timestampElement.textContent = formatTimestamp(timestamp);
        messageElement.appendChild(timestampElement);
    }
    
    // Add to chat messages
    chatMessages.appendChild(messageElement);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Send a message
function sendMessage() {
    // Get message content
    const content = messageInput.value.trim();
    
    // Don't send empty messages
    if (!content) {
        return;
    }
    
    // Clear input
    messageInput.value = '';
    
    // Reset typing status
    isTyping = false;
    sendTypingStatus(false);
    
    // Display message locally first for immediate feedback
    displayMessage(content, username, 'message');
    
    // Send message to server
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'message',
            content: content,
            sender: username,
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
    
    // Create a span to hold the glitching text
    const glitchSpan = document.createElement('span');
    glitchSpan.classList.add('glitch-text');
    
    // Set data-text attribute for CSS pseudo-elements
    glitchSpan.setAttribute('data-text', text);
    
    // Initial content
    glitchSpan.textContent = text.replace(/[a-zA-Z0-9]/g, () => hackingChars.charAt(Math.floor(Math.random() * hackingChars.length)));
    
    const glitchInterval = setInterval(() => {
        currentStep++;
        
        if (currentStep >= glitchSteps) {
            // End glitch effect
            glitchSpan.textContent = originalText;
            clearInterval(glitchInterval);
        } else {
            // Create glitched text
            let glitchedText = '';
            for (let i = 0; i < textLength; i++) {
                // Gradually reveal more of the original text as we progress
                if (i < (textLength * (currentStep / glitchSteps))) {
                    // Revealed characters occasionally glitch
                    if (Math.random() < 0.05) {
                        glitchedText += hackingChars.charAt(Math.floor(Math.random() * hackingChars.length));
                    } else {
                        glitchedText += originalText[i];
                    }
                } else if (Math.random() < 0.7) {
                    // Hacking-style characters (more common)
                    glitchedText += hackingChars.charAt(Math.floor(Math.random() * hackingChars.length));
                } else {
                    // Regular random characters (less common)
                    glitchedText += characters.charAt(Math.floor(Math.random() * characters.length));
                }
            }
            glitchSpan.textContent = glitchedText;
        }
    }, stepDuration);
    
    return glitchSpan;
}

// Connect to WebSocket server with reconnection logic
function connectToServer() {
    try {
        console.log(`Attempting to connect to WebSocket server at: ${WS_URL}`);
        console.log(`Current protocol: ${window.location.protocol}, hostname: ${window.location.hostname}, port: ${window.location.port}`);
        
        // Create WebSocket connection
        socket = new WebSocket(WS_URL);
        console.log('WebSocket object created:', socket);

        // Connection opened
        socket.addEventListener('open', (event) => {
            console.log('Connected to WebSocket server');
            console.log('WebSocket open event:', event);
            // Reset reconnection attempts on successful connection
            reconnectAttempts = 0;
            reconnectBackoff = 2000; // Reset backoff time

            // Send login request only if we have a username and are connecting for login purposes
            if (username && loginStatus.textContent === 'Connecting to server...') {
                console.log(`Sending login request for username: ${username}`);
                sendLoginRequest();
            } else {
                console.log(`Not sending login request. Username: ${username}, Status: ${loginStatus.textContent}`);
            }
        });

        // Listen for messages
        socket.addEventListener('message', handleSocketMessage);

        // Connection closed
        socket.addEventListener('close', (event) => {
            console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);

            // Attempt to reconnect if not at max attempts
            if (reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                const timeout = reconnectBackoff * Math.pow(2, reconnectAttempts - 1); // Exponential backoff
                console.log(`Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts}) in ${timeout}ms...`);
                
                loginStatus.textContent = `Connection lost. Reconnecting (${reconnectAttempts}/${maxReconnectAttempts})...`;
                loginStatus.style.color = 'var(--notification-color)';
                
                setTimeout(() => {
                    connectToServer();
                }, timeout);
            } else {
                // Max reconnection attempts reached
                console.log('Maximum reconnection attempts reached. Giving up.');
                
                // Show login screen with error message
                showScreen(loginScreen);
                loginStatus.textContent = 'Connection lost. Please refresh the page and try again.';
                loginStatus.style.color = 'var(--error-color)';
                
                // Clear any existing data
                userId = null;
                roomId = null;
                partnerUsername = null;
            }
        });
        
        // Connection error
        socket.addEventListener('error', (event) => {
            console.error('WebSocket error:', event);
            // Error handling is done in the close event handler
        });
    } catch (error) {
        console.error('Error connecting to server:', error);
        loginStatus.textContent = 'Could not connect to server. Please try again later.';
        loginStatus.style.color = 'var(--error-color)';
    }
}

// Handle login
function handleLogin() {
    // Get and validate username
    username = usernameInput.value.trim();
    console.log(`Login attempt with username: ${username}`);
    
    if (!username) {
        loginStatus.textContent = 'Please enter a username';
        loginStatus.style.color = 'var(--error-color)';
        return;
    }
    
    if (username.length < 3) {
        loginStatus.textContent = 'Username must be at least 3 characters';
        loginStatus.style.color = 'var(--error-color)';
        return;
    }
    
    // Update UI to show we're connecting
    loginStatus.textContent = 'Connecting to server...';
    loginStatus.style.color = 'var(--notification-color)';
    console.log(`WebSocket URL: ${WS_URL}`);
    
    // Close any existing connection
    if (socket) {
        console.log('Closing existing socket connection');
        socket.close();
    }
    
    // Connect to server
    console.log('Attempting to connect to WebSocket server...');
    connectToServer();
    
    // Set a timeout in case connection fails
    setTimeout(() => {
        console.log(`Connection status check - Socket exists: ${!!socket}, ReadyState: ${socket ? socket.readyState : 'N/A'}`);
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            loginStatus.textContent = 'Failed to connect to server. Please try again.';
            loginStatus.style.color = 'var(--error-color)';
            console.error('WebSocket connection failed or timed out');
        } else {
            console.log('WebSocket connection established successfully');
        }
    }, 5000);
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
        loginStatus.textContent = 'Error sending login request. Please try again.';
        loginStatus.style.color = 'var(--error-color)';
    }
    
    // Show waiting screen
    showScreen(waitingScreen);
    updateWaitingStatus('Establishing secure connection...');
    
    // Set up waiting messages with periodic updates
    const waitingMessages = [
        'Searching for available users...',
        'Waiting for someone to connect...',
        'Looking for a chat partner...',
        'Waiting for another user to join...',
        'Pairing users in order (1st with 2nd, 3rd with 4th)...',
        'Still waiting for a match...',
        'You are in the queue. Will be matched when another user joins...',
        'Secure connection established. Waiting for a partner...',
        'Patience is a virtue. Waiting for your match...',
        'You will be paired with the next person who joins...'
    ];
    
    let messageIndex = 0;
    const waitingInterval = setInterval(() => {
        if (!waitingScreen.classList.contains('active')) {
            clearInterval(waitingInterval);
            return;
        }
        
        messageIndex = (messageIndex + 1) % waitingMessages.length;
        updateWaitingStatus(waitingMessages[messageIndex]);
    }, 3000);
    
    // Store the interval ID to clear it when needed
    window.waitingStatusInterval = waitingInterval;
}

// Handle cancel search
function handleCancelSearch() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        // Send cancel message to server
        socket.send(JSON.stringify({
            type: 'cancel_search'
        }));
        
        // Close the connection
        socket.close();
    }
    
    // Clear user data
    userId = null;
    username = null;
    
    // Return to login screen
    showScreen(loginScreen);
    loginStatus.textContent = 'Search cancelled. You may connect again.';
    loginStatus.style.color = 'var(--notification-color)';
    
    // Clear username input for fresh start
    usernameInput.value = '';
    usernameInput.focus();
}

// Handle WebSocket messages
function handleSocketMessage(event) {
    console.log('WebSocket message received:', event);
    try {
        const rawData = event.data;
        console.log('Raw message data:', rawData);
        
        const data = JSON.parse(rawData);
        console.log('Parsed message data:', data);
        console.log('Message type:', data.type);
        
        // Debug all DOM elements
        console.log('DOM Elements check:');
        console.log('typingIndicator:', document.getElementById('typing-indicator'));
        console.log('typingText:', document.getElementById('typing-text'));
        console.log('messageInput:', document.getElementById('message-input'));
        console.log('Global typingIndicator:', typingIndicator);
        console.log('Global typingText:', typingText);
        
        switch (data.type) {
            case 'online_count':
                // Update online users count
                onlineUsersCount = data.count;
                updateOnlineUsersDisplay();
                break;
            case 'login_success':
                userId = data.userId;
                console.log('Login successful, userId:', userId);
                console.log('Full login success data:', data);
                
                // Show waiting screen
                showScreen(waitingScreen);
                updateWaitingStatus('Waiting for a partner...');
                break;
                
            case 'login_error':
                // Show error message
                showScreen(loginScreen);
                loginStatus.textContent = data.message || 'Login failed. Please try again.';
                loginStatus.style.color = 'var(--error-color)';
                break;
                
            case 'matched':
                // Store room ID and partner username
                roomId = data.roomId;
                partnerUsername = data.partner;
                
                // Show chat screen
                showScreen(chatScreen);
                
                // Clear previous messages
                chatMessages.innerHTML = '';
                
                // Show system message
                showSystemMessage(`You are now chatting with ${partnerUsername}`);
                
                // Auto-focus message input
                messageInput.focus();
                break;
                
            case 'message':
                // Display message
                displayMessage(data.content, data.sender, 'message', data.timestamp);
                break;
                
                        case 'typing':
                // Handle typing indicator
                console.log('Received typing status:', data);
                if (data.username !== username) {  // Don't show our own typing indicator
                    if (data.isTyping) {
                        // Show typing indicator with partner's username
                        console.log('Showing typing indicator for:', data.username);
                        if (typingText) {
                            typingText.textContent = `${data.username} is typing...`;
                        }
                        if (typingIndicator) {
                            typingIndicator.classList.add('active');
                        }
                    } else {
                        // Hide typing indicator
                        console.log('Hiding typing indicator');
                        if (typingIndicator) {
                            typingIndicator.classList.remove('active');
                        }
                    }
                }
                break;
                
            case 'skip_request':
                console.log('Skip request received');
                
                // Clear any existing skip timer just in case
                if (skipCountdownTimer) {
                    clearInterval(skipCountdownTimer);
                    skipCountdownTimer = null;
                }
                
                // Show skip overlay if it exists
                if (skipOverlay) {
                    skipOverlay.classList.add('active');
                } else {
                    console.error('Skip overlay element not found');
                    return;
                }
                
                // Start countdown
                let countdown = 3;
                if (skipCountdown) {
                    skipCountdown.textContent = countdown;
                }
                
                // Make sure the cancel button is properly set up
                if (cancelSkipBtn) {
                    // Remove any existing listeners to prevent duplicates
                    cancelSkipBtn.removeEventListener('click', cancelSkipBtnHandler);
                    // Add the new listener
                    cancelSkipBtn.addEventListener('click', cancelSkipBtnHandler);
                    // Make sure it's visible and interactive
                    cancelSkipBtn.style.display = 'inline-block';
                } else {
                    console.error('Cancel skip button not found');
                }
                
                // Start the countdown timer
                skipCountdownTimer = setInterval(() => {
                    countdown--;
                    if (skipCountdown) {
                        skipCountdown.textContent = countdown;
                    }
                    
                    if (countdown <= 0) {
                        clearInterval(skipCountdownTimer);
                        skipCountdownTimer = null;
                        completeSkip();
                    }
                }, 1000);
                break;
                
            case 'skip_cancel':
                // Hide skip overlay and cancel countdown
                cancelSkip();
                break;
                
            case 'disconnected':
            case 'partner_disconnected':
            case 'partner_skipped':
                // Show system message
                let messageText = '';
                if (data.type === 'disconnected') {
                    messageText = `${partnerUsername} has disconnected`;
                } else if (data.type === 'partner_skipped') {
                    // Use the provided message which includes the username
                    messageText = data.message || 'Your chat partner has left the conversation';
                } else {
                    messageText = data.message || 'Your chat partner has disconnected';
                }
                
                showSystemMessage(messageText);
                
                // Reset state variables
                const oldRoomId = roomId;
                roomId = null;
                partnerUsername = null;
                
                // Return to waiting screen after a delay
                setTimeout(() => {
                    // Only proceed if we're not already in a new chat
                    if (!chatScreen.classList.contains('active')) {
                        // Clear chat messages
                        chatMessages.innerHTML = '';
                        
                        // Hide typing indicator
                        typingIndicator.classList.remove('active');
                        
                        // Show waiting screen if not already in a new chat
                        showScreen(waitingScreen);
                        updateWaitingStatus('Finding a new connection...');
                        
                        // First ensure we're removed from any existing queue
                        if (socket && socket.readyState === WebSocket.OPEN) {
                            socket.send(JSON.stringify({
                                type: 'cancel_search'
                            }));
                            
                            // Use a single timeout with a reasonable delay
                            setTimeout(() => {
                                // Double-check we're still in waiting screen and socket is open
                                if (waitingScreen.classList.contains('active') && socket && socket.readyState === WebSocket.OPEN) {
                                    console.log('Sending login request to re-enter queue after partner disconnect/skip');
                                    socket.send(JSON.stringify({
                                        type: 'login',
                                        username: username
                                    }));
                                }
                            }, 1500); // Longer delay to ensure server has processed previous messages
                        }
                    }
                }, 3000);
                break;
                
            case 'report_acknowledged':
                showSystemMessage(data.message);
                break;
                
            default:
                console.log('Unknown message type:', data.type);
        }
    } catch (error) {
        console.error('Error handling WebSocket message:', error);
    }
}

// Send a chat message
function sendMessage() {
    // Get the current message input element
    const currentMessageInput = document.getElementById('message-input');
    
    // If message input doesn't exist, return
    if (!currentMessageInput) {
        console.error('Message input element not found');
        return;
    }
    
    const messageText = currentMessageInput.value;
    
    // Simple validation - just check if the message is empty
    if (!messageText.trim()) {
        return;
    }
    
    // Get sanitized message or use original if utils not available
    const message = window.utils && window.utils.sanitizeText ? 
        window.utils.sanitizeText(messageText) : messageText.trim();
    
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'message',
            content: message,
            username: username
        }));
        
        // Display the message in the chat
        displayMessage(message, username, 'outgoing', Date.now());
        
        // Clear input
        currentMessageInput.value = '';
        
        // Reset typing status
        if (isTyping) {
            isTyping = false;
            socket.send(JSON.stringify({
                type: 'typing',
                isTyping: false,
                username: username
            }));
        }
    } else {
        showSystemMessage('Connection lost. Please refresh the page.');
    }
}

// Display a message in the chat
function displayMessage(content, sender, type = 'message', timestamp = null) {
    // Create message container
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type === 'system' ? 'system' : sender === username ? 'outgoing' : 'incoming'}`;
    
    if (type === 'system') {
        // System messages are simple text
        messageDiv.innerHTML = content; // Use innerHTML for system messages to support formatting
    } else {
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
        
        // Apply glitch effect to the content
        if (type !== 'system') {
            contentSpan.appendChild(glitchText(content));
        } else {
            contentSpan.textContent = content;
        }
        
        messageWrapper.appendChild(contentSpan);
        
        // Add wrapper to message div
        messageDiv.appendChild(messageWrapper);
    }
    
    // Add to chat container
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom with a slight delay to ensure rendering is complete
    setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // For mobile devices, ensure the viewport is adjusted correctly
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            // This helps prevent the viewport from jumping around
            if (document.activeElement && document.activeElement.tagName === 'INPUT') {
                // If an input is focused (keyboard is likely visible)
                // Make sure we can still see the latest messages
                window.scrollTo(0, 0);
            }
        }
    }, 10);
}

// Show system message
function showSystemMessage(message) {
    displayMessage(message, null, 'system');
}

// Handle typing event
function handleTypingEvent(event) {
    // Don't process if it's a key event that's not a character key
    if (event && event.type === 'keydown' && 
        (event.ctrlKey || event.altKey || event.metaKey || 
         event.key === 'Control' || event.key === 'Alt' || event.key === 'Meta' ||
         event.key === 'Shift' || event.key === 'CapsLock' ||
         event.key === 'Escape' || event.key === 'Tab' ||
         event.key === 'ArrowUp' || event.key === 'ArrowDown' ||
         event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        return;
    }
    
    // Make sure we're in a chat room and socket is connected
    if (!roomId || !partnerUsername || !socket || socket.readyState !== WebSocket.OPEN) {
        return;
    }
    
    // Get the input element directly
    const input = document.getElementById('message-input');
    if (!input) {
        console.error('Message input not found in handleTypingEvent');
        return;
    }
    
    // Check if typing state has changed
    const currentlyTyping = input.value.length > 0;
    
    // Clear any existing typing timeout
    if (typingTimer) {
        clearTimeout(typingTimer);
    }
    
    // Only send if typing state changed
    if (currentlyTyping !== isTyping) {
        isTyping = currentlyTyping;
        sendTypingStatus(isTyping);
    } else if (isTyping) {
        // If still typing, reset the timer
        typingTimer = setTimeout(() => {
            isTyping = false;
            sendTypingStatus(false);
            console.log('Typing timeout reached, set isTyping to false');
        }, 1500); // 1.5 seconds of inactivity before stopping typing indicator
    }
    
    // If user is typing, set a timeout to clear typing status after inactivity
    if (isTyping) {
        typingTimer = setTimeout(() => {
            if (isTyping) {  // Double-check in case it changed
                isTyping = false;
                sendTypingStatus(false);
                console.log('Typing timeout reached, set isTyping to false');
            }
        }, 1500); // 1.5 seconds of inactivity before stopping typing indicator
    }
}

// Helper function to send typing status
function sendTypingStatus(isTyping) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.error('Socket not available for sending typing status');
        return;
    }
    
    if (!roomId || !partnerUsername) {
        console.error('No active chat room for sending typing status');
        return;
    }
    
    const typingMessage = {
        type: 'typing',
        isTyping: isTyping,
        username: username,
        roomId: roomId
    };
    
    try {
        socket.send(JSON.stringify(typingMessage));
        console.log(`Sent typing status: ${isTyping ? 'typing' : 'stopped typing'}`);
    } catch (error) {
        console.error('Error sending typing status:', error);
    }
}

// Initiate skip
function initiateSkip() {
    console.log('Initiating skip...');
    
    // First, add the skip message to the chat
    try {
        // Show a simple message in the chat that the user initiated skip protocol
        const skipMessage = document.createElement('div');
        skipMessage.classList.add('message', 'system');
        skipMessage.textContent = `${username} initiated skip protocol`;
        chatMessages.appendChild(skipMessage);
        
        // Ensure it's visible by scrolling to it
        chatMessages.scrollTop = chatMessages.scrollHeight;
        console.log('Skip message added to chat');
        
        // Send a notification to the partner immediately
        if (socket && socket.readyState === WebSocket.OPEN && roomId) {
            socket.send(JSON.stringify({
                type: 'skip_notification',
                username: username,
                roomId: roomId
            }));
            console.log('Skip notification sent to partner');
        }
    } catch (error) {
        console.error('Error adding skip message to chat:', error);
    }
    
    // Then show the skip overlay with a glitch effect
    skipOverlay.classList.add('active');
    
    // Add a sound effect (terminal beep)
    try {
        const beepSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YWoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBhRq0/L/zHwrCRNl0eX1uGQOABlw3vfvsloHACV98Pv0v3UYBTR9sMWdVy0OGUqf1+LGciUFBhBm1/n/13woCgkUZNXu/9uALwUDA2LjzLFqOCY9Z5yztpxrTDAmK1KRvOHgrnwqBgEGWdz//9SFNQ0BAVzRwbCGbWdjb4GRlYpuWEhHVHacsdDe0aJvNwsAAVjf+v/KdygODRRh0MSziGZSRUlwpNr/7qpaHQYHF2Tc//7FcCMNFGDEoXheTElTcZKgnIRpU0Q6QFqNscfNvJJzRiMPCzJt1OTpyJJbJwcADWvm//btyoM9GQUDEmfX7OC4fVUtEA8tXqGzuLKVdVxCKyIuXqjN4OG6jWMxCgMRb+P//9aDJwUDA2XBn3ZYVFR0pcTKtIXDtYlYMiQxWpO63OTXpXc9EwILVdXm6+TGlWUuBgAHYd///+2xcz4dBgISZdPf0LyQcVU4HRoiS4yxztDDpYXY3r9oJxgZOHLc///1sWYfBAEIXL+jgWxkZnKRnJmHbVlNSVBolLfX6+jGhVgfCQUTZd3//9V8JQkNGGfOtpFwXFVfeqXLyayEYEAtLEFnpMzj5s6hcDYQAQlZ3P//35EzCQQHVcGjhmtZTlJ3qNLo3K1hKhYPHFOUx+Pq1KF1Og8BAVvk///dlzQEAABStJJxX1lc0tCrdEEuMVaYy+Tj1J5sLA0GD2HY8PXq1rSKXSwTCg1b1fHx6NjOv7OTYjYZEBZl2vLu5cL//+7GlWIrEAgRYtbt8/Pv5tbEq4xoQScaHE+Uw+Pq6OLUv6V+VzYcEBZHjdHq8vLu5dK4l3FMKR0aJl6q2+/08e3j0LSNZDsgEhc9e8Dj8fT08Oziz7KIYDYbERIwZ7ze8vf39vPt4Mm0kGw/IxYQFzp5v+Hy+Pr6+fby59vFroRbOB8QDxg6er7i9Pr8/f37+fXx6drGro1kPyMUDhEiTJHF6vf7/f7+/v38+vj06+HVxauIaUUoFg8NEjBwuej6/v///////v7+/fz69vLp3c23mHZSMx0PCwsTMnC87Pv////////////////////////+/v39/Pv5+Pbz8Ozm3tTLwbmwqKCYkYuFgHt3c3BubGtqamlpaWlqa2xtb3Fzd3p+goaKjpKWmp2gpKaqrK+ysrS1tre4uLm5urq7u7y8vLy9vb29vr6+v7+/v8DAwMDAwMHBwcHCwsLDw8PExMTFxcbGx8fIyMnJysrLy8zMzc3Ozs/P0NDR0dLS09PU1NXV1tbX19jY2dna2tvb3Nzd3d7e39/g4OHh4uLj4+Tk5eXm5ufn6Ojp6erq6+vs7O3t7u7v7/Dw8fHy8vPz9PT19fb29/f4+Pn5+vr7+/z8/f3+/v8AAAEBBQYIDQ8TFRocICMlKCosLzEzNTY4OTo7PD0+Pj9AQEBBQUFCQ0RFRkhJSktNTlBRU1RWV1laW1xdXl9gYWJiY2RkZWVmZmZnZ2dnZ2hoaGhoaGhoaGdnZ2dmZmVlZGRjYmFgX15dW1pYV1VSUExJRkM/PDk1Mi4rJyQgHRkWEg8LBwQAAP38+ff18/Hu7Oro5uTj4eDf3t3c29va2tnZ2NjY19fX19fX19fX19jY2NjZ2dra29vc3N3d3t7f3+Dg4eHi4uPj5OTl5ebm5+fo6Onp6urr6+zs7e3u7u/v8PDx8fLy8/P09PX19vb39/j4+fn6+vv7/Pz9/f7+///+/v39/Pv6+fj39vX08/Lx8O/u7ezr6uno5+bl5OPi4eDf3t3c29rZ2NfW1dTT0tHPzs3MysnIx8bFxMPCwcC/vr28u7q5uLe2tbSzsrGwr66trKuqqainpqWko6OioaGgoJ+fnp6dnZ2cnJubm5qamZmZmZiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiY');
        beepSound.volume = 0.2;
        beepSound.play();
    } catch (error) {
        console.error('Error playing sound:', error);
    }
    
    // Start countdown with visual effects
    let countdown = 3;
    skipCountdown.textContent = countdown;
    
    // Add another skip message as a backup to ensure it appears
    setTimeout(() => {
        try {
            // Double-check if the message is already in the chat
            const existingMessages = document.querySelectorAll('.message.system');
            let messageExists = false;
            existingMessages.forEach(msg => {
                if (msg.textContent === `${username} initiated skip protocol`) {
                    messageExists = true;
                }
            });
            
            // If the message doesn't exist yet, add it
            if (!messageExists) {
                const backupSkipMessage = document.createElement('div');
                backupSkipMessage.classList.add('message', 'system');
                backupSkipMessage.textContent = `${username} initiated skip protocol`;
                chatMessages.appendChild(backupSkipMessage);
                chatMessages.scrollTop = chatMessages.scrollHeight;
                console.log('Backup skip message added to chat');
            }
        } catch (error) {
            console.error('Error adding backup skip message:', error);
        }
    }, 100);
    
    skipCountdownTimer = setInterval(() => {
        countdown--;
        skipCountdown.textContent = countdown;
        
        // Visual effect for countdown change
        skipCountdown.classList.add('pulse');
        
        setTimeout(() => {
            skipCountdown.classList.remove('pulse');
        }, 200);
        
        if (countdown <= 0) {
            clearInterval(skipCountdownTimer);
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
    
    // Only if we're in an active skip countdown
    if (skipOverlay && skipOverlay.classList.contains('active') && skipCountdownTimer) {
        console.log('Cancelling skip...');
        cancelSkip();
    } else {
        console.log('Skip not active or already cancelled');
    }
}

// Cancel skip
function cancelSkip() {
    console.log('Cancelling skip process...');
    
    // Clear the countdown timer
    if (skipCountdownTimer) {
        clearInterval(skipCountdownTimer);
        skipCountdownTimer = null;
    }
    
    // Hide the skip overlay if it exists
    if (skipOverlay) {
        skipOverlay.classList.remove('active');
    }
    
    // Notify the server that we're cancelling the skip
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'skip_cancel',
            userId: userId,
            roomId: roomId
        }));
    }
    
    console.log('Skip process cancelled');
}

// Complete skip
function completeSkip() {
    // Clear any existing timers to prevent multiple executions
    clearInterval(skipCountdownTimer);
    
    // Remove skip overlay
    skipOverlay.classList.remove('active');
    
    // Reset state variables
    const oldRoomId = roomId;
    roomId = null;
    partnerUsername = null;
    
    if (socket && socket.readyState === WebSocket.OPEN) {
        // Send skip message to server
        socket.send(JSON.stringify({
            type: 'skip',
            username: username,
            roomId: oldRoomId // Send the room ID to ensure server can identify the correct room
        }));
        
        // Clear chat messages
        chatMessages.innerHTML = '';
        
        // Hide typing indicator
        typingIndicator.classList.remove('active');
        
        // Show waiting screen
        showScreen(waitingScreen);
        updateWaitingStatus('Finding a new connection...');
        
        // First ensure we're removed from any existing queue
        socket.send(JSON.stringify({
            type: 'cancel_search'
        }));
        
        // Use a single timeout with a reasonable delay to prevent rapid retries
        setTimeout(() => {
            // Check if we're still in waiting screen and socket is open
            if (waitingScreen.classList.contains('active') && socket && socket.readyState === WebSocket.OPEN) {
                console.log('Sending login request to re-enter queue');
                socket.send(JSON.stringify({
                    type: 'login',
                    username: username
                }));
            }
        }, 1500); // Longer delay to ensure server has processed previous messages
    }
}

// Report user
function reportUser() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'report',
            reportedUser: partnerUsername,
            reportingUser: username
        }));
        
        showSystemMessage('Report sent. Thank you for helping keep the platform safe.');
    }
}

// Helper functions
function showScreen(screen) {
    // Hide all screens
    loginScreen.classList.remove('active');
    waitingScreen.classList.remove('active');
    chatScreen.classList.remove('active');
    
    // Show the requested screen
    screen.classList.add('active');
    
    // If switching to waiting or login screen, clear chat messages
    if (screen === waitingScreen || screen === loginScreen) {
        // Clear chat messages
        chatMessages.innerHTML = '';
    }
    
    // Hide chat-specific elements when not in chat screen
    if (screen !== chatScreen) {
        // Hide typing indicator and other chat-specific elements
        document.getElementById('typing-indicator').style.display = 'none';
        
        // Make sure chat header elements are not visible on other screens
        if (document.querySelector('.connection-info')) {
            document.querySelector('.connection-info').style.visibility = 'hidden';
        }
        if (document.querySelector('.chat-controls')) {
            document.querySelector('.chat-controls').style.visibility = 'hidden';
        }
        // Hide chat messages container
        document.getElementById('chat-messages').style.display = 'none';
    } else {
        // Show chat-specific elements only in chat screen
        if (document.querySelector('.connection-info')) {
            document.querySelector('.connection-info').style.visibility = 'visible';
            // Update online users display when showing chat screen
            updateOnlineUsersDisplay();
        }
        if (document.querySelector('.chat-controls')) {
            document.querySelector('.chat-controls').style.visibility = 'visible';
        }
        // Show chat messages container
        document.getElementById('chat-messages').style.display = 'block';
    }
}

function updateWaitingStatus(message) {
    waitingStatus.textContent = message;
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Update the online users count display
function updateOnlineUsersDisplay() {
    if (connectionLabel) {
        connectionLabel.innerHTML = `ONLINE: <span style="color: var(--accent-color); font-weight: bold;">${onlineUsersCount}</span>`;
    }
}
