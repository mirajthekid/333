// Debug script for server-side typing indicator issues
const fs = require('fs');
const path = require('path');

// Create a log file for typing events
const logFile = path.join(__dirname, 'typing_debug.log');
fs.writeFileSync(logFile, `Typing debug log started at ${new Date().toISOString()}\n`);

function logTypingEvent(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    
    // Log to console
    console.log(`SERVER DEBUG: ${message}`);
    
    // Append to log file
    try {
        fs.appendFileSync(logFile, logMessage);
    } catch (error) {
        console.error('Error writing to debug log:', error);
    }
}

// Export the logging function
module.exports = { logTypingEvent };
