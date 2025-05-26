// Script to clean up duplicate function definitions in scripts.js
(function() {
    console.log("Function cleanup script loaded");
    
    // List of functions that might be defined multiple times
    const functionsToCheck = [
        'handleSocketMessage',
        'sendTypingStatus',
        'handleTypingEvent',
        'connectToServer',
        'handleLogin',
        'sendMessage',
        'displayMessage',
        'showScreen',
        'handleCancelSearch'
    ];
    
    // Check for duplicate function definitions
    functionsToCheck.forEach(funcName => {
        const allFunctions = getAllFunctionDefinitions(funcName);
        if (allFunctions.length > 1) {
            console.warn(`Found ${allFunctions.length} definitions of ${funcName}. Using the last one.`);
        }
    });
    
    // Function to find all definitions of a function in the global scope
    function getAllFunctionDefinitions(funcName) {
        const allFunctions = [];
        
        // Check window object
        if (typeof window[funcName] === 'function') {
            allFunctions.push({
                source: 'window',
                func: window[funcName]
            });
        }
        
        return allFunctions;
    }
    
    // Add a global error handler to catch and log any errors
    window.addEventListener('error', function(event) {
        console.error('Global error caught:', {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error
        });
    });
    
    // Log WebSocket readyState changes
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
        const socket = new originalWebSocket(url, protocols);
        
        const originalAddEventListener = socket.addEventListener;
        socket.addEventListener = function(type, listener, options) {
            if (type === 'open' || type === 'close' || type === 'error') {
                const wrappedListener = function(event) {
                    console.log(`WebSocket ${type} event:`, {
                        readyState: socket.readyState,
                        url: url
                    });
                    return listener.apply(this, arguments);
                };
                return originalAddEventListener.call(this, type, wrappedListener, options);
            }
            return originalAddEventListener.call(this, type, listener, options);
        };
        
        return socket;
    };
    
    console.log("Function cleanup and monitoring complete");
})();
